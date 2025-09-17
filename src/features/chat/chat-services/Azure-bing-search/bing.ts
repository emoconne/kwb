// Azure AI Projects SDK経由でのWeb検索
export class BingSearchResult {
  async SearchWeb(searchText: string, threadId?: string) {
    const projectEndpoint = process.env.AZURE_AI_FOUNDRY_ENDPOINT;
    const agentId = process.env.AZURE_AI_FOUNDRY_AGENT_ID;
    
    // 環境変数の詳細なデバッグ情報
    console.log('Debug - Environment variables:');
    console.log('AZURE_AI_FOUNDRY_ENDPOINT:', projectEndpoint ? 'SET' : 'NOT SET');
    console.log('AZURE_AI_FOUNDRY_AGENT_ID:', agentId ? 'SET' : 'NOT SET');
    
    if (!projectEndpoint || !agentId) {
      console.error('Missing Azure AI Project configuration:', {
        projectEndpoint: projectEndpoint ? 'set' : 'missing',
        agentId: agentId ? 'set' : 'missing'
      });
      
      // フォールバック検索を実行
      return this.fallbackSearch(searchText);
    }

    try {
      // Azure AI Projects SDKを使用してWeb検索を実行
      console.log('Debug - Azure AI Project configuration:');
      console.log('Project Endpoint:', projectEndpoint);
      console.log('Agent ID:', agentId);
      console.log('Search Text:', searchText);
      console.log('Using Azure AI Foundry with Entra authentication');

      // 認証の確認（App Service環境でのManaged Identity対応）
      try {
        const { DefaultAzureCredential } = await import("@azure/identity");
        
        let credentialOptions;
        
        if (process.env.WEBSITE_SITE_NAME) {
          // App Service環境：System Assigned Managed Identityを使用
          console.log('App Service environment: Using System Assigned Managed Identity');
          credentialOptions = {
            // ClientIdを指定しない（System Assigned Managed Identityを使用）
            loggingOptions: {
              enableLogging: true,
              logLevel: 'info'
            }
          };
        } else {
          // ローカル環境：Azure CLI認証を使用
          console.log('Local environment: Using Azure CLI authentication');
          credentialOptions = {
            loggingOptions: {
              enableLogging: true,
              logLevel: 'info'
            }
          };
        }
        
        const credential = new DefaultAzureCredential(credentialOptions);
        console.log('DefaultAzureCredential created successfully with options:', credentialOptions);
        
        // 認証トークンの取得を試行（Azure AI Foundry用のスコープを使用）
        const token = await credential.getToken("https://ml.azure.com/.default");
        console.log('Authentication successful, token obtained, expires:', token?.expiresOnTimestamp);
      } catch (authError) {
        console.error('Authentication failed:', authError);
        console.error('Auth error details:', {
          name: authError instanceof Error ? authError.name : 'Unknown',
          message: authError instanceof Error ? authError.message : String(authError),
          stack: authError instanceof Error ? authError.stack : undefined
        });
        
        // App Service環境でのエラーの場合、フォールバック検索を実行
        if (process.env.WEBSITE_SITE_NAME) {
          console.log('App Service環境での認証エラーを検出、フォールバック検索を実行します');
          return this.fallbackSearch(searchText);
        }
        
        throw new Error(`認証に失敗しました: ${authError instanceof Error ? authError.message : '不明なエラー'}`);
      }

      // タイムアウト付きでAzure AI Projects SDKを実行（60秒に短縮）
      const result = await Promise.race([
        this.executeAzureAISearch(projectEndpoint, agentId, searchText, threadId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Azure AI Projects SDK timeout (60秒)')), 60000)
        )
      ]);

      return result;
    } catch (err) {
      console.error('Azure AI Project error:', err);
      console.error('Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
      
      // エラーが発生した場合はフォールバック検索を実行
      console.log('Azure AI Foundry search failed, trying fallback search...');
      return this.fallbackSearch(searchText);
    }
  }

  // Microsoftサンプルコードに基づく実装
  private async executeAzureAISearch(projectEndpoint: string, agentId: string, searchText: string, threadId?: string) {
    const { AIProjectClient } = await import("@azure/ai-projects");
    const { DefaultAzureCredential } = await import("@azure/identity");

    console.log('=== Azure AI Foundry Connection Start ===');
    console.log('Project Endpoint:', projectEndpoint);
    console.log('Agent ID:', agentId);
    console.log('Search Text:', searchText);
    console.log('Thread ID:', threadId || 'new thread');
    
    // Microsoftサンプルコードに従った実装
    const project = new AIProjectClient(
      projectEndpoint,
      new DefaultAzureCredential()
    );
    
    console.log('AIProjectClient created successfully');
    
    // エージェントを取得
    const agent = await project.agents.getAgent(agentId);
    console.log(`Retrieved agent: ${agent.name}`);
    
    // スレッドを取得または作成
    let thread;
    if (threadId) {
      try {
        thread = await project.agents.threads.get(threadId);
        console.log(`Using existing thread, ID: ${thread.id}`);
      } catch (error) {
        console.log('Existing thread not found, creating new thread');
        thread = await project.agents.threads.create();
        console.log(`Created new thread, ID: ${thread.id}`);
      }
    } else {
      thread = await project.agents.threads.create();
      console.log(`Created thread, ID: ${thread.id}`);
    }
    
    // メッセージを作成
    const searchMessage = `Search for: "${searchText}"`;
    const message = await project.agents.messages.create(thread.id, "user", searchMessage);
    console.log(`Created message, ID: ${message.id}`);
    
    // ランを作成
    let run = await project.agents.runs.create(thread.id, agent.id);
    console.log(`Created run, ID: ${run.id}`);
    
    // ランが完了するまでポーリング
    let pollCount = 0;
    const maxPolls = 60; // 60秒
    
    while (run.status === "queued" || run.status === "in_progress") {
      if (pollCount >= maxPolls) {
        throw new Error('Agent run timeout (60 seconds)');
      }
      
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await project.agents.runs.get(thread.id, run.id);
      pollCount++;
      
      if (pollCount % 10 === 0) {
        console.log(`Run status: ${run.status} (${pollCount}/${maxPolls})`);
      }
    }
    
    if (run.status === "failed") {
      console.error(`Run failed:`, run.lastError);
      throw new Error(`Agent run failed: ${run.lastError?.message || 'Unknown error'}`);
    }
    
    console.log(`Run completed with status: ${run.status}`);
    
    // メッセージを取得
    const messages = await project.agents.messages.list(thread.id, { order: "asc" });
    
    let assistantResponse = '';
    const searchResults: any[] = [];
    
    // メッセージから回答を抽出
    for await (const m of messages) {
      if (m.role === "assistant") {
        const content = m.content.find((c) => c.type === "text" && "text" in c);
        if (content && 'text' in content) {
          assistantResponse = content.text.value;
          console.log(`Assistant response: ${assistantResponse.substring(0, 200)}...`);
          
          // URLアノテーションから検索結果を構築
          if (content.text.annotations) {
            content.text.annotations.forEach((annotation: any, index: number) => {
              if (annotation.type === "url_citation" && annotation.urlCitation) {
                searchResults.push({
                  name: annotation.urlCitation.title || `検索結果 ${index + 1}`,
                  snippet: annotation.urlCitation.title || '',
                  url: annotation.urlCitation.url || '',
                  sortOrder: index + 1
                });
              }
            });
          }
        }
      }
    }
    
    return {
      searchResults: {
        webPages: {
          value: searchResults
        }
      },
      assistantResponse,
      threadId: thread.id
    };
  }

  // フォールバック検索機能（DuckDuckGo Instant Answer API使用）
  private async fallbackSearch(searchText: string) {
    console.log('Executing fallback search for:', searchText);
    
    try {
      // DuckDuckGo Instant Answer APIを使用
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(searchText)}&format=json&no_html=1&skip_disambig=1`);
      
      if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('DuckDuckGo API response received');
      
      // 検索結果を構造化
      const searchResults: any[] = [];
      
      // Abstract（要約）がある場合
      if (data.Abstract && data.AbstractText) {
        searchResults.push({
          name: data.Abstract,
          snippet: data.AbstractText,
          url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(searchText)}`,
          sortOrder: 1
        });
      }
      
      // Related Topics（関連トピック）を追加
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 5).forEach((topic: any, index: number) => {
          if (topic.Text && topic.FirstURL) {
            searchResults.push({
              name: topic.Text.split(' - ')[0] || `関連トピック ${index + 1}`,
              snippet: topic.Text,
              url: topic.FirstURL,
              sortOrder: index + 2
            });
          }
        });
      }
      
      // Infobox（情報ボックス）から情報を追加
      if (data.Infobox && data.Infobox.content && Array.isArray(data.Infobox.content)) {
        data.Infobox.content.slice(0, 3).forEach((info: any, index: number) => {
          if (info.data_type === 'string' && info.value && info.label) {
            searchResults.push({
              name: info.label,
              snippet: info.value,
              url: `https://duckduckgo.com/${encodeURIComponent(searchText)}`,
              sortOrder: searchResults.length + 1
            });
          }
        });
      }
      
      // 結果がない場合のデフォルト
      if (searchResults.length === 0) {
        searchResults.push({
          name: searchText,
          snippet: `${searchText}に関する情報を検索しました。`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(searchText)}`,
          sortOrder: 1
        });
      }
      
      console.log(`Fallback search completed, found ${searchResults.length} results`);
      
      return {
        webPages: {
          value: searchResults
        }
      };
      
    } catch (error) {
      console.error('Fallback search failed:', error);
      
      // 最後の手段として、基本的な検索結果を返す
      return {
        webPages: {
          value: [
            {
              name: '検索エラー',
              snippet: '検索サービスが利用できません。一般的な知識に基づいて回答いたします。',
              url: '',
              sortOrder: 1
            }
          ]
        }
      };
    }
  }
}