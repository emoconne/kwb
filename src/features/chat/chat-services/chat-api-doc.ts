import { userHashedId } from "@/features/auth/helpers";
import { OpenAIInstance } from "@/features/common/openai";
import { AI_NAME } from "@/features/theme/customise";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { similaritySearchVectorWithScore, ensureIndexIsCreated, AzureCogDocumentIndex } from "./azure-cog-search/azure-cog-vector-store";
import { initAndGuardChatSession } from "./chat-thread-service";
import { CosmosDBChatMessageHistory } from "./cosmosdb/cosmosdb";
import { PromptGPTProps } from "./models";
import { getDepartment } from "@/features/documents/cosmos-db-dept-service";
import { CitationItem } from "@/features/chat/chat-ui/citation-panel";

// 検索結果の型定義
interface DocumentSearchModel {
  '@search.score': number;
}

type SearchResultDocument = AzureCogDocumentIndex & DocumentSearchModel;

const SYSTEM_PROMPT = `あなたは ${AI_NAME} です。企業内ドキュメント検索アシスタントとして、以下の指針に従って対応します：

1. 正確性：ドキュメントから得られた情報のみを回答に含め、推測や想像は避けます
2. 明確性：専門用語を使う場合は解説を付け、分かりやすい表現を心がけます
3. 構造化：重要な情報から順に論理的に情報を提示します
4. 透明性：情報源を明示し、複数の文書から情報を取得した場合は出典を区別して示します
5. 適切な範囲：ユーザーの権限レベルに応じた情報のみを提供します
6. 丁寧さ：敬語を用い、プロフェッショナルな対応を維持します

回答できない内容については、「その情報は提供されたドキュメントには含まれていません」と率直に伝えてください。
常に回答の最後には情報源の引用を必ず含めてください。`;

const CONTEXT_PROMPT = ({
  context,
  userQuestion,
}: {
  context: string;
  userQuestion: string;
}) => {
  return `
- Given the following extracted parts of a long document, create a final answer. \n
- If you don't know the answer, just say that you don't know. Don't try to make up an answer.\n
- You must always include a citation at the end of your answer and don't include full stop.\n
- Use the format for your citation {% citation items=[{name:"filename 1",id:"file id"}, {name:"filename 2",id:"file id"}] /%}\n 
----------------\n 
context:\n 
${context}
----------------\n 
question: ${userQuestion}`;
};

export const ChatAPIDoc = async (props: PromptGPTProps) => {
  const { lastHumanMessage, id, chatThread } = await initAndGuardChatSession(
    props
  );

  const openAI = OpenAIInstance();

  const userId = await userHashedId();

  let chatAPIModel = process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME || "gpt-4o";
 // console.log("Model_doc: ", process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME);
 // console.log("PromptGPTProps_doc: ", props.chatAPIModel);

  const chatHistory = new CosmosDBChatMessageHistory({
    sessionId: chatThread.id,
    userId: userId,
  });

  const history = await chatHistory.getMessages();
  const topHistory = history.slice(history.length - 30, history.length);

  // デバッグ用：チャット履歴の情報を出力
  console.log('=== DEBUG: Chat History Information ===');
  console.log('Total messages in history:', history.length);
  console.log('Top history messages:', topHistory.length);
  console.log('Current user message:', lastHumanMessage.content);
  console.log('Chat thread ID:', id);

  let relevantDocuments: SearchResultDocument[] = [];
  try {
    console.log('=== DEBUG: Starting findRelevantDocuments ===');
    relevantDocuments = await findRelevantDocuments(
      lastHumanMessage.content,
      id,
      props.selectedDepartmentId
    );
    console.log('Relevant documents found:', relevantDocuments.length);
  } catch (searchError) {
    console.error('=== ERROR: findRelevantDocuments failed ===');
    console.error('Search error details:', {
      error: searchError instanceof Error ? {
        name: searchError.name,
        message: searchError.message,
        stack: searchError.stack
      } : searchError,
      query: lastHumanMessage.content,
      chatThreadId: id,
      selectedDepartmentId: props.selectedDepartmentId
    });
    // エラーが発生した場合は空の配列を返す
    relevantDocuments = [];
  }
  console.log('=== DEBUG: Search Results Details ===');
  relevantDocuments.forEach((doc, index) => {
    console.log(`Document ${index}:`, {
      id: doc.id,
      metadata: doc.metadata,
      score: doc['@search.score'],
      pageContentLength: doc.pageContent?.length || 0,
      hasSasUrl: !!doc.sasUrl
    });
  });
  console.log('First document sample:', relevantDocuments[0] ? {
    id: relevantDocuments[0].id,
    fileName: relevantDocuments[0].fileName,
    metadata: relevantDocuments[0].metadata,
    hasSasUrl: !!relevantDocuments[0].sasUrl,
    sasUrl: relevantDocuments[0].sasUrl
  } : 'No documents found');

  // 検索結果が空の場合の処理
  if (relevantDocuments.length === 0) {
    console.log('=== DEBUG: No relevant documents found ===');
    console.log('=== DEBUG: Providing suggestions for no results ===');
    
    // より詳細な情報を含むメッセージ
    let noResultMessage = `申し訳ございませんが、「${lastHumanMessage.content}」に関する情報は社内ドキュメントから見つかりませんでした。\n\n`;
    
    // 検索のヒントを追加
    noResultMessage += `以下をお試しください：\n`;
    noResultMessage += `• より一般的なキーワードで検索\n`;
    noResultMessage += `• 異なる表現や同義語を使用\n`;
    noResultMessage += `• 部門を「すべて」に変更して検索範囲を拡大\n\n`;
    
    // デバッグ情報（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      noResultMessage += `\n[デバッグ情報]\n`;
      noResultMessage += `• 検索クエリ: ${lastHumanMessage.content}\n`;
      noResultMessage += `• 選択部門ID: ${props.selectedDepartmentId || 'なし'}\n`;
      noResultMessage += `\n管理者向け詳細確認: /api/admin/check-faq-data`;
    }
    
    // チャット履歴に追加
    await chatHistory.addMessage({
      content: lastHumanMessage.content,
      role: "user",
    } as any);

    // 空の Citation データを保存
    const emptyCitationData = JSON.stringify({ citations: [] });

    await chatHistory.addMessage({
      content: noResultMessage,
      role: "assistant",
    } as any, emptyCitationData);
    
    // ストリーミングレスポンスを模擬
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(noResultMessage));
        controller.close();
      }
    });

    return new StreamingTextResponse(stream);
  }

  const context = relevantDocuments
    .map((result, index) => {
      const content = result.pageContent.replace(/(\r\n|\n|\r)/gm, "");
      const context = `[${index}]. file name: ${result.metadata} \n file id: ${result.id} \n ${content}`;
      return context;
    })
    .join("\n------\n");

  console.log('=== DEBUG: Context created ===');
  console.log('Context length:', context.length);
  console.log('Context preview:', context.substring(0, 300) + '...');

  try {
    console.log('=== DEBUG: Calling OpenAI API ===');
    const response = await openAI.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...topHistory,
        {
          role: "user",
          content: CONTEXT_PROMPT({
            context,
            userQuestion: lastHumanMessage.content,
          }),
        },
      ],
      //model: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
      model: chatAPIModel,
      stream: true,
      max_tokens: 4000,
      temperature: 0.7
    });

                const stream = OpenAIStream(response as any, {
              async onCompletion(completion) {
                try {
                  console.log('onCompletion started, processing completion...');
                  let processedCompletion = completion;
                  
                  for (const doc of relevantDocuments) {
                    try {
                      console.log(`Processing document ${doc.id}, has sasUrl: ${!!doc.sasUrl}`);
                      
                      // AI Searchの結果にsasUrlが含まれている場合は直接使用
                      if (doc.sasUrl) {
                        const placeholder = `SAS_URL_PLACEHOLDER_${doc.id}`;
                        processedCompletion = processedCompletion.replace(new RegExp(placeholder, 'g'), doc.sasUrl);
                        console.log(`Replaced placeholder for ${doc.id} with existing sasUrl`);
                      } else {
                        console.log(`No sasUrl found for document ${doc.id}, skipping replacement`);
                      }
                    } catch (error) {
                      console.error(`Failed to process SAS URL for document ${doc.id}:`, error);
                    }
                  }
              
                  console.log('Adding messages to chat history...');
                  await chatHistory.addMessage({
                    content: lastHumanMessage.content,
                    role: "user",
                  } as any);

                  // Citation データを JSON 形式で保存
                  const citationData = JSON.stringify({
                    citations: relevantDocuments.map(doc => ({
                      id: doc.id,
                      metadata: doc.fileName || doc.metadata || '不明なファイル',
                      pageContent: doc.pageContent || '',
                      sasUrl: doc.sasUrl,
                      score: doc['@search.score'],
                      deptName: doc.deptName,
                      documentId: doc.chatThreadId,
                    }))
                  });

                  await chatHistory.addMessage(
                    {
                      content: processedCompletion,
                      role: "assistant",
                    } as any,
                    citationData
                  );
                  console.log('Messages added to chat history successfully');
                } catch (error) {
                  console.error('Error in onCompletion callback:', error);
                }
              },
            });

    return new StreamingTextResponse(stream);
  } catch (e: unknown) {
    if (e instanceof Error) {
      return new Response(e.message, {
        status: 500,
        statusText: e.toString(),
      });
    } else {
      return new Response("An unknown error occurred.", {
        status: 500,
        statusText: "Unknown Error",
      });
    }
  }
};

const findRelevantDocuments = async (query: string, chatThreadId: string, selectedDepartmentId?: string): Promise<SearchResultDocument[]> => {
  console.log('=== DEBUG: findRelevantDocuments called ===');
  console.log('Query:', query);
  console.log('ChatThreadId:', chatThreadId);
  console.log('SelectedDepartmentId:', selectedDepartmentId);
  
  // 環境変数の確認
  console.log('=== DEBUG: Azure Search Environment Variables ===');
  console.log('AZURE_SEARCH_ENDPOINT:', process.env.AZURE_SEARCH_ENDPOINT ? 'SET' : 'NOT_SET');
  console.log('AZURE_SEARCH_INDEX_NAME:', process.env.AZURE_SEARCH_INDEX_NAME || 'NOT_SET');
  console.log('AZURE_SEARCH_API_KEY:', process.env.AZURE_SEARCH_API_KEY ? 'SET' : 'NOT_SET');
  console.log('AZURE_SEARCH_KEY:', process.env.AZURE_SEARCH_KEY ? 'SET' : 'NOT_SET');
  console.log('AZURE_SEARCH_API_VERSION:', process.env.AZURE_SEARCH_API_VERSION || 'NOT_SET');
  
  let filter = `chatType eq 'doc'`;
  
  try {
    // 部門が選択されている場合は、その部門のドキュメントのみを検索
    if (selectedDepartmentId && selectedDepartmentId.trim() !== "" && selectedDepartmentId !== "all") {
      console.log('=== DEBUG: Getting department information ===');
      // 部門IDから部門名を取得
      const department = await getDepartment(selectedDepartmentId);
      if (department) {
        filter += ` and deptName eq '${department.name}'`;
        console.log('Filtering by department:', department.name);
      } else {
        console.log('Department not found for ID:', selectedDepartmentId);
      }
    } else {
      console.log('No department selected or "all" selected, searching all departments');
    }
    
    console.log('AI Search filter:', filter);
  } catch (deptError) {
    console.error('=== ERROR: Department lookup failed ===');
    console.error('Department error:', deptError);
    console.log('Continuing with basic filter (no department filtering)');
  }
  
  try {
    // インデックスの存在確認と作成
    console.log('=== DEBUG: Ensuring Azure Search index exists ===');
    try {
      await ensureIndexIsCreated();
      console.log('Azure Search index verified/created successfully');
    } catch (indexError) {
      console.error('Failed to ensure index exists:', indexError);
      // インデックス作成に失敗した場合でも検索を試行
    }
    
    // デバッグ用：まずフィルターなしで全ドキュメントを確認
    console.log('=== DEBUG: Checking all documents in AI Search (no filter) ===');
    const allDocumentsNoFilter = await similaritySearchVectorWithScore(query, 10);
    console.log('All documents (no filter) found:', allDocumentsNoFilter.length);
    allDocumentsNoFilter.slice(0, 3).forEach((doc, index) => {
      console.log(`Document ${index} (no filter):`, {
        id: doc.id,
        chatType: doc.chatType,
        deptName: doc.deptName,
        metadata: doc.metadata,
        fileName: doc.fileName,
        pageContentLength: doc.pageContent?.length || 0,
        score: doc['@search.score']
      });
    });
    
    // デバッグ用：chatType='doc'フィルターで検索
    console.log('=== DEBUG: Checking documents with chatType=doc filter ===');
    const allDocuments = await similaritySearchVectorWithScore(query, 10, {
      filter: `chatType eq 'doc'`,
    });
    console.log('Documents with chatType=doc found:', allDocuments.length);
    allDocuments.forEach((doc, index) => {
      console.log(`Document ${index} (chatType=doc):`, {
        id: doc.id,
        chatType: doc.chatType,
        deptName: doc.deptName,
        metadata: doc.metadata,
        fileName: doc.fileName,
        pageContentLength: doc.pageContent?.length || 0,
        score: doc['@search.score']
      });
    });
    
    // さらに詳細なデバッグ：chatType別の検索
    console.log('=== DEBUG: Checking documents by different chatTypes ===');
    const chatTypesToCheck = ['doc', 'document', 'data', 'simple', 'web'];
    
    for (const chatType of chatTypesToCheck) {
      try {
        const typeResults = await similaritySearchVectorWithScore(query, 5, {
          filter: `chatType eq '${chatType}'`,
        });
        console.log(`Documents with chatType "${chatType}":`, typeResults.length);
        if (typeResults.length > 0) {
          console.log(`Sample document for chatType "${chatType}":`, {
            id: typeResults[0].id,
            metadata: typeResults[0].metadata,
            deptName: typeResults[0].deptName,
            score: typeResults[0]['@search.score'],
            pageContentPreview: typeResults[0].pageContent?.substring(0, 100) + '...'
          });
        }
      } catch (error) {
        console.log(`Error checking chatType "${chatType}":`, error);
      }
    }
    
    console.log('=== DEBUG: Performing final search ===');
    const finalSearchResults = await similaritySearchVectorWithScore(query, 10, {
      filter: filter,
    });
    
    console.log('Filtered documents found:', finalSearchResults.length);
    console.log('=== DEBUG: Final Search Results ===');
    finalSearchResults.forEach((doc, index) => {
      console.log(`Final Result ${index}:`, {
        id: doc.id,
        metadata: doc.metadata,
        score: doc['@search.score'],
        chatType: doc.chatType,
        deptName: doc.deptName
      });
    });
    return finalSearchResults;
  } catch (searchError) {
    console.error('=== ERROR: AI Search failed ===');
    console.error('Search error details:', {
      error: searchError instanceof Error ? {
        name: searchError.name,
        message: searchError.message,
        stack: searchError.stack
      } : searchError,
      query: query,
      filter: filter
    });
    
    // インデックスが見つからない場合の特別な処理
    if (searchError instanceof Error && searchError.message.includes('was not found')) {
      console.log('=== DEBUG: Index not found, attempting to create it ===');
      try {
        await ensureIndexIsCreated();
        console.log('Index created successfully, retrying search...');
        
        // インデックス作成後に再度検索を試行
        const retryDocuments = await similaritySearchVectorWithScore(query, 10, {
          filter: filter,
        });
        
        console.log('Retry search results:', retryDocuments.length);
        return retryDocuments;
      } catch (retryError) {
        console.error('Failed to create index or retry search:', retryError);
      }
    }
    
    // エラーが発生した場合は空の配列を返す
    return [];
  }
};

// AI Searchの結果をCitationItemに変換
const convertToCitationItems = (documents: SearchResultDocument[]): CitationItem[] => {
  return documents.map((doc) => ({
    id: doc.id,
    metadata: doc.fileName || doc.metadata || '不明なファイル',
    pageContent: doc.pageContent || '',
    sasUrl: doc.sasUrl,
    score: doc['@search.score'],
    deptName: doc.deptName,
    documentId: doc.chatThreadId, // chatThreadIdがdocumentIdとして使用されている
  }));
};

