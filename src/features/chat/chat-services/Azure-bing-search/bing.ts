// Azure AI Projects SDK経由でのWeb検索
export class BingSearchResult {
  async SearchWeb(searchText: string, threadId?: string) {
    const projectEndpoint = process.env.AZURE_AI_FOUNDRY_ENDPOINT;
    const agentId = process.env.AZURE_AI_FOUNDRY_AGENT_ID;
    const apiKey = process.env.AZURE_AI_FOUNDRY_API_KEY;
    
    // 環境変数の詳細なデバッグ情報
    console.log('Debug - Environment variables:');
    console.log('AZURE_AI_FOUNDRY_ENDPOINT:', projectEndpoint ? 'SET' : 'NOT SET');
    console.log('AZURE_AI_FOUNDRY_AGENT_ID:', agentId ? 'SET' : 'NOT SET');
    console.log('AZURE_AI_FOUNDRY_API_KEY:', apiKey ? 'SET' : 'NOT SET');
    
    if (!projectEndpoint || !agentId) {
      console.error('Missing Azure AI Project configuration:', {
        projectEndpoint: projectEndpoint ? 'set' : 'missing',
        agentId: agentId ? 'set' : 'missing',
        apiKey: apiKey ? 'set' : 'missing'
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
      console.log('Using Azure CLI authentication');

    // 認証の確認（App Service環境でのManaged Identity対応）
    try {
      const { DefaultAzureCredential } = await import("@azure/identity");
      
      // App Service環境でのManaged Identity設定
      const credentialOptions = {
        // App Service環境でのManaged Identityを優先
        managedIdentityClientId: process.env.AZURE_CLIENT_ID || undefined,
        // デバッグ情報を有効化
        loggingOptions: {
          enableLogging: true,
          logLevel: 'info'
        }
      };
      
      const credential = new DefaultAzureCredential(credentialOptions);
      console.log('DefaultAzureCredential created successfully with options:', credentialOptions);
      
      // 認証トークンの取得を試行
      const token = await credential.getToken("https://cognitiveservices.azure.com/.default");
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

      // タイムアウト付きでAzure AI Projects SDKを実行（120秒に延長）
      const result = await Promise.race([
        this.executeAzureAISearch(projectEndpoint, agentId, searchText, threadId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Azure AI Projects SDK timeout (120秒)')), 120000)
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
      
      // エラーの種類に応じた詳細なメッセージを生成
      let errorMessage = '不明なエラー';
      let suggestion = 'しばらく時間をおいて再度お試しください。';
      
      if (err instanceof Error) {
        if (err.message.includes('認証')) {
          errorMessage = '認証エラー';
          suggestion = 'Azure CLIでログインしてください: az login';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'タイムアウトエラー';
          suggestion = 'ネットワーク接続を確認してください。';
        } else if (err.message.includes('404') || err.message.includes('Not Found')) {
          errorMessage = 'リソースが見つかりません';
          suggestion = 'エンドポイントとエージェントIDを確認してください。';
        } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
          errorMessage = 'アクセス権限がありません';
          suggestion = '適切な権限を持つアカウントでログインしてください。';
        } else {
          errorMessage = err.message;
        }
      }
      
      // エラーが発生した場合はフォールバック検索を実行
      console.log('Azure AI Foundry search failed, trying fallback search...');
      return this.fallbackSearch(searchText);
    }
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
      
      // 検索結果を構築
      const searchResults = [];
      
      // Abstract（要約）がある場合
      if (data.Abstract) {
        searchResults.push({
          name: data.Heading || '検索結果',
          snippet: data.Abstract,
          url: data.AbstractURL || '#',
          sortOrder: 1
        });
      }
      
      // Related Topics（関連トピック）がある場合
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 5).forEach((topic: any, index: number) => {
          if (topic.Text && topic.FirstURL) {
            searchResults.push({
              name: topic.Text.split(' - ')[0] || `関連情報 ${index + 1}`,
              snippet: topic.Text,
              url: topic.FirstURL,
              sortOrder: index + 2
            });
          }
        });
      }
      
      // 検索結果がない場合のデフォルト
      if (searchResults.length === 0) {
        searchResults.push({
          name: '検索結果',
          snippet: `「${searchText}」についての情報が見つかりませんでした。一般的な知識に基づいて回答いたします。`,
          url: '#',
          sortOrder: 0
        });
      }
      
      return {
        webPages: {
          value: searchResults
        }
      };
      
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
      
      // 最終的なフォールバック
      return {
        webPages: {
          value: [
            {
              name: '検索サービス利用不可',
              snippet: `「${searchText}」についての検索サービスが現在利用できません。一般的な知識に基づいて回答いたします。`,
              url: '#',
              sortOrder: 0
            }
          ]
        }
      };
    }
  }

  private async executeAzureAISearch(projectEndpoint: string, agentId: string, searchText: string, threadId?: string) {
    // Azure AI Projects SDKの動的インポート
    const { AIProjectClient } = await import("@azure/ai-projects");
    const { DefaultAzureCredential, AzureKeyCredential } = await import("@azure/identity");

    console.log('Attempting to authenticate with Azure AI Foundry...');
    console.log('Environment check:', {
      isAppService: !!process.env.WEBSITE_SITE_NAME,
      hasApiKey: !!process.env.AZURE_AI_FOUNDRY_API_KEY,
      hasClientId: !!process.env.AZURE_CLIENT_ID
    });
    
    let project;
    
    // APIキーが利用可能な場合はAPIキー認証を優先
    if (process.env.AZURE_AI_FOUNDRY_API_KEY) {
      console.log('Using API Key authentication...');
      console.log('API Key (first 10 chars):', process.env.AZURE_AI_FOUNDRY_API_KEY.substring(0, 10) + '...');
      
      try {
        const keyCredential = new AzureKeyCredential(process.env.AZURE_AI_FOUNDRY_API_KEY);
        project = new AIProjectClient(projectEndpoint, keyCredential);
        console.log('AIProjectClient created successfully with API key');
      } catch (clientError) {
        console.error('Failed to create AIProjectClient with API key:', clientError);
        throw new Error(`AIProjectClient作成に失敗: ${clientError instanceof Error ? clientError.message : '不明なエラー'}`);
      }
    } else {
      // フォールバックとしてManaged Identity認証
      console.log('Using DefaultAzureCredential with Entra authentication...');
      
      // App Service環境でのManaged Identity設定
      const credentialOptions = {
        managedIdentityClientId: process.env.AZURE_CLIENT_ID || undefined,
        loggingOptions: {
          enableLogging: true,
          logLevel: 'info'
        },
        retryOptions: {
          maxRetries: 5,
          retryDelayInMs: 800
        },
        allowInsecureConnection: true
      };
      
      const credential = new DefaultAzureCredential(credentialOptions);
      project = new AIProjectClient(projectEndpoint, credential);
    }
    
    // エージェントを取得
    try {
      const agent = await project.agents.getAgent(agentId);
      console.log(`Retrieved agent: ${agent.name}`);
    } catch (agentError) {
      console.error('Failed to retrieve agent:', agentError);
      throw new Error(`エージェントの取得に失敗しました: ${agentError instanceof Error ? agentError.message : '不明なエラー'}`);
    }

    // スレッドを取得または作成
    let thread;
    if (threadId) {
      try {
        // 既存のスレッドを使用
        thread = await project.agents.threads.get(threadId);
        console.log(`Using existing thread, ID: ${thread.id}`);
      } catch (error) {
        console.log('Existing thread not found, creating new thread');
        thread = await project.agents.threads.create();
        console.log(`Created new thread, ID: ${thread.id}`);
      }
    } else {
      // 新しいスレッドを作成
      thread = await project.agents.threads.create();
      console.log(`Created new thread, ID: ${thread.id}`);
    }

    // メッセージを作成（検索クエリを文字列として明示的に送信）
    const searchMessage = `Search for: "${searchText}"`;
    const message = await project.agents.messages.create(thread.id, "user", searchMessage);
    console.log(`Created message, ID: ${message.id}`);

    // ランを作成
    let run = await project.agents.runs.create(thread.id, agent.id);
    console.log(`Created run, ID: ${run.id}`);

    // ランが完了するまでポーリング（最大120秒）
    let pollCount = 0;
    const maxPolls = 120; // 120秒
    
    while (run.status === "queued" || run.status === "in_progress") {
      if (pollCount >= maxPolls) {
        throw new Error('ランがタイムアウトしました（120秒）');
      }
      
      // 1秒待機
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await project.agents.runs.get(thread.id, run.id);
      pollCount++;
      console.log(`Run status: ${run.status} (${pollCount}/${maxPolls})`);
    }

    if (run.status === "failed") {
      console.error(`Run failed: `, run.lastError);
      throw new Error(`Agent run failed: ${run.lastError?.message || 'Unknown error'}`);
    }

    console.log(`Run completed with status: ${run.status}`);

    // ランからメタデータを取得
    const runDetails = await project.agents.runs.get(thread.id, run.id);
    console.log('Run details:', JSON.stringify(runDetails, null, 2));

    // メタデータからURLを抽出
    const metadataUrls: string[] = [];
    if (runDetails.metadata) {
      console.log('Run metadata:', JSON.stringify(runDetails.metadata, null, 2));
      
      // メタデータからURLを探す
      const extractUrlsFromMetadata = (obj: any): string[] => {
        const urls: string[] = [];
        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            if (key === 'urls' && Array.isArray(value)) {
              urls.push(...value);
            } else if (key === 'url' && typeof value === 'string') {
              urls.push(value);
            } else if (typeof value === 'object') {
              urls.push(...extractUrlsFromMetadata(value));
            }
          }
        }
        return urls;
      };
      
      metadataUrls.push(...extractUrlsFromMetadata(runDetails.metadata));
    }

    // ツールリソースからURLを抽出
    if (runDetails.toolResources) {
      console.log('Tool resources:', JSON.stringify(runDetails.toolResources, null, 2));
      
      // ツールリソースからURLを探す
      const extractUrlsFromToolResources = (obj: any): string[] => {
        const urls: string[] = [];
        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            if (key === 'urls' && Array.isArray(value)) {
              urls.push(...value);
            } else if (key === 'url' && typeof value === 'string') {
              urls.push(value);
            } else if (typeof value === 'object') {
              urls.push(...extractUrlsFromToolResources(value));
            }
          }
        }
        return urls;
      };
      
      metadataUrls.push(...extractUrlsFromToolResources(runDetails.toolResources));
    }

    // メッセージの内容からURLを抽出（詳細ログ付き）
    try {
      const messages = await project.agents.messages.list(thread.id, { order: "asc" });
      
      for await (const message of messages) {
        console.log('Message:', JSON.stringify(message, null, 2));
        
        if (message.role === "assistant" && message.content) {
          for (const content of message.content) {
            console.log('Content:', JSON.stringify(content, null, 2));
            
            // テキストコンテンツからURLを抽出
            if (content.type === "text" && "text" in content) {
              const textValue = (content as any).text.value;
              const annotations = (content as any).text.annotations;
              
              // annotationsからURLを抽出
              if (annotations && Array.isArray(annotations)) {
                for (const annotation of annotations) {
                  if (annotation.type === "url_citation" && annotation.urlCitation) {
                    const url = annotation.urlCitation.url;
                    const title = annotation.urlCitation.title;
                    console.log('Found URL citation:', { url, title });
                    metadataUrls.push(url);
                  }
                }
              }
              
              // テキストからもURLを抽出（フォールバック）
              const urls = this.extractUrls(textValue);
              if (urls.length > 0) {
                console.log('Found URLs in text:', urls);
                metadataUrls.push(...urls);
              }
            }
            
            // その他のコンテンツタイプも確認
            if (content.type !== "text") {
              console.log('Non-text content type:', content.type);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get message content:', error);
    }

    // メッセージを取得
    const messages = await project.agents.messages.list(thread.id, { order: "asc" });

    // メッセージを処理
    const searchResults: Array<{
      name: string;
      snippet: string;
      url: string;
      sortOrder: number;
    }> = [];
    let assistantResponseText = '';
    for await (const m of messages) {
      const content = m.content.find((c: any) => c.type === "text" && "text" in c);
      if (content && m.role === "assistant" && "text" in content) {
        const textValue = (content as any).text.value;
        console.log(`Assistant response: ${textValue}`);
        
        // Assistantの回答テキストを保存
        assistantResponseText = textValue;
        
        // メタデータから取得したURLを優先し、テキストからも抽出
        let urls = metadataUrls.length > 0 ? metadataUrls : this.extractUrls(textValue);
        
        // AI回答のテキストからソース情報を抽出（【3:1†source】形式）
        const sourceUrls = this.extractSourceUrls(textValue);
        if (sourceUrls.length > 0) {
          // 重複を除去
          const uniqueUrls = Array.from(new Set([...urls, ...sourceUrls]));
          urls = uniqueUrls;
        }
        
        // annotationsからURLとタイトルのマッピングを作成
        const urlTitleMap = new Map<string, string>();
        if (content.type === "text" && "text" in content) {
          const annotations = (content as any).text.annotations;
          if (annotations && Array.isArray(annotations)) {
            for (const annotation of annotations) {
              if (annotation.type === "url_citation" && annotation.urlCitation) {
                urlTitleMap.set(annotation.urlCitation.url, annotation.urlCitation.title);
              }
            }
          }
        }
        
        // 取得したURLを個別の検索結果として追加
        urls.forEach((url: string, index: number) => {
          // URLのタイトルを取得（annotationsから）
          const title = urlTitleMap.get(url);
          
          // URLの説明を抽出（URLの前後のテキストから）
          const urlDescription = this.extractUrlDescription(textValue, url);
          
          searchResults.push({
            name: title || urlDescription || `関連リンク ${index + 1}`,
            snippet: urlDescription || title || `「${searchText}」に関する関連情報です。`,
            url: url,
            sortOrder: index + 1
          });
        });
      }
    }

    // スレッドを削除しない（メモリ機能のため保持）
    console.log(`Keeping thread for memory: ${thread.id}`);
    
    // スレッドIDを返す（後で使用するため）
    return {
      searchResults: {
        webPages: {
          value: searchResults.length > 0 ? searchResults : [
            {
              name: '検索結果',
              snippet: '検索結果が見つかりませんでした。',
              url: '#',
              sortOrder: 0
            }
          ]
        }
      },
      assistantResponse: assistantResponseText,
      threadId: thread.id
    };
    
    // Assistantの回答がない場合はエラーを投げる
    if (!assistantResponseText || assistantResponseText.trim() === '') {
      console.error('No Assistant response received');
      throw new Error('Assistantの回答を取得できませんでした。');
    }
  }

  private extractUrls(text: string): string[] {
    // URLを抽出する正規表現
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    return urls;
  }

  private extractUrlDescription(text: string, url: string): string {
    // URLの前後のテキストから説明を抽出
    const urlIndex = text.indexOf(url);
    if (urlIndex === -1) return '';
    
    // URLの前後50文字を取得
    const start = Math.max(0, urlIndex - 50);
    const end = Math.min(text.length, urlIndex + url.length + 50);
    const context = text.substring(start, end);
    
    // URLを除去して説明部分を抽出
    const description = context.replace(url, '').trim();
    
    // 説明が短すぎる場合は空文字を返す
    if (description.length < 10) return '';
    
    // 説明を適切な長さに切り詰める
    return description.length > 100 ? description.substring(0, 100) + '...' : description;
  }

  private extractSourceUrls(text: string): string[] {
    // 【3:1†source】形式のソース情報からURLを抽出
    const sourceRegex = /【(\d+):(\d+)†source】/g;
    const matches = text.match(sourceRegex);
    
    if (!matches) return [];
    
    // 現在はソース番号のみを返す（実際のURLは別途取得が必要）
    // 将来的には、ソース番号とURLのマッピングを実装
    const sourceNumbers = matches.map(match => {
      const numbers = match.match(/(\d+):(\d+)/);
      return numbers ? `${numbers[1]}:${numbers[2]}` : '';
    }).filter(num => num !== '');
    
    console.log('Extracted source numbers:', sourceNumbers);
    
    // ソース番号からURLを生成（仮の実装）
    // 実際のURLは、Bing検索の結果から取得する必要があります
    return sourceNumbers.map(num => `https://example.com/source/${num}`);
  }

}