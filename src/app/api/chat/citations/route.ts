import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { options as authOptions } from "@/features/auth/auth-api";
import { CitationItem } from "@/features/chat/chat-ui/citation-panel";
import { FindAllChatsInThread } from "@/features/reporting/reporting-service";
import { similaritySearchVectorWithScore } from "@/features/chat/chat-services/azure-cog-search/azure-cog-vector-store";
import { getDepartment } from "@/features/documents/cosmos-db-dept-service";
import { FindChatThreadByID } from "@/features/chat/chat-services/chat-thread-service";

// Citationデータを取得するAPIエンドポイント
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatThreadId = searchParams.get('chatThreadId');

    if (!chatThreadId) {
      return NextResponse.json({ error: "チャットスレッドIDが必要です" }, { status: 400 });
    }

    // チャット履歴から最後のメッセージを取得
    const chats = await FindAllChatsInThread(chatThreadId);
    if (chats.length === 0) {
      return NextResponse.json({ citations: [] });
    }

    // 最後のAssistantメッセージを探す
    const lastAssistantMessage = chats.filter(chat => chat.role === 'assistant').pop();
    
    console.log('Citation API: Last assistant message found:', !!lastAssistantMessage);
    if (lastAssistantMessage) {
      console.log('Citation API: Assistant message context length:', lastAssistantMessage.context?.length || 0);
    }

    // チャットスレッドを取得してチャットタイプを判定
    const chatThread = await FindChatThreadByID(chatThreadId);
    const chatType = chatThread?.chatType || 'normal';
    
    let citations: CitationItem[] = [];
    
    console.log('Citation API: Chat thread found:', !!chatThread);
    console.log('Citation API: Chat type detected:', chatType);
    
    // 保存されたCitationデータを優先して使用
    if (lastAssistantMessage && lastAssistantMessage.context) {
      try {
        console.log('Citation API: Trying to parse saved citation data');
        const savedData = JSON.parse(lastAssistantMessage.context);
        
        if (savedData.citations && Array.isArray(savedData.citations)) {
          console.log('Citation API: Found saved citations:', savedData.citations.length);
          console.log('Citation API: Sample saved citation:', savedData.citations[0]);
          
          return NextResponse.json({
            success: true,
            citations: savedData.citations,
            source: 'saved_data'
          });
        }
      } catch (parseError) {
        console.log('Citation API: Failed to parse saved data, falling back to search');
      }
    }
    
    // フォールバック: AI Searchで再検索
    const lastUserMessage = chats.filter(chat => chat.role === 'user').pop();
    if (!lastUserMessage) {
      return NextResponse.json({ citations: [] });
    }
    
    console.log('Citation API: Using fallback search for:', lastUserMessage.content);
    
    if (chatType === 'doc') {
      // 社内FAQ検索
      console.log('Citation API: Performing doc search');
      console.log('Citation API: Search query:', lastUserMessage.content);
      console.log('Citation API: Search filter:', `chatType eq 'doc'`);
      
      const relevantDocuments = await similaritySearchVectorWithScore(lastUserMessage.content, 10, {
        filter: `chatType eq 'doc'`,
      });
      
      console.log('Citation API: Found documents:', relevantDocuments.length);
      console.log('Citation API: Raw search results:', relevantDocuments.map(doc => ({
        id: doc.id,
        metadata: doc.metadata,
        fileName: doc.fileName,
        chatType: doc.chatType,
        score: doc['@search.score'],
        hasPageContent: !!doc.pageContent,
        pageContentLength: doc.pageContent?.length || 0,
        pageContentPreview: doc.pageContent?.substring(0, 50) + '...'
      })));
      
      citations = relevantDocuments.map((doc, index) => {
        console.log(`Citation API: Processing doc result ${index}:`, {
          id: doc.id,
          metadata: doc.metadata,
          fileName: doc.fileName,
          pageContent: doc.pageContent?.substring(0, 100) + '...',
          score: doc['@search.score'],
          hasPageContent: !!doc.pageContent,
          pageContentType: typeof doc.pageContent
        });
        
        return {
          id: doc.id || `doc-${index}`,
          metadata: doc.fileName || doc.metadata || '不明なファイル',
          pageContent: doc.pageContent || 'コンテンツが見つかりません',
          sasUrl: doc.sasUrl,
          score: doc['@search.score'],
          deptName: doc.deptName,
          documentId: doc.chatThreadId,
        };
      });
    } else if (chatType === 'data') {
      // ファイル読み込み検索
      console.log('Citation API: Performing data search');
      const relevantDocuments = await similaritySearchVectorWithScore(lastUserMessage.content, 10, {
        filter: `user eq '${session.user.id}' and chatThreadId eq '${chatThreadId}' and chatType eq 'data'`,
      });
      
      console.log('Citation API: Found documents:', relevantDocuments.length);
      
      citations = relevantDocuments.map((doc, index) => {
        console.log('Citation API: Processing data result:', {
          id: doc.id,
          metadata: doc.metadata,
          fileName: doc.fileName,
          pageContent: doc.pageContent?.substring(0, 100) + '...',
          score: doc['@search.score']
        });
        
        return {
          id: doc.id || `data-${index}`,
          metadata: doc.fileName || doc.metadata || '不明なファイル',
          pageContent: doc.pageContent || 'コンテンツが見つかりません',
          sasUrl: doc.sasUrl,
          score: doc['@search.score'],
          deptName: doc.deptName,
          documentId: doc.chatThreadId,
        };
      });
    } else {
      console.log('Citation API: No search performed for chat type:', chatType);
    }

    return NextResponse.json({
      success: true,
      citations: citations
    });

  } catch (error) {
    console.error("Citation取得エラー:", error);
    return NextResponse.json(
      { error: "Citationデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// Citationデータを設定するAPIエンドポイント（既存）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { citations, chatThreadId } = await request.json();

    if (!Array.isArray(citations)) {
      return NextResponse.json({ error: "Citationデータが不正です" }, { status: 400 });
    }

    // ここでCitationデータを保存またはキャッシュする処理を実装
    // 現在は単純にレスポンスを返す
    console.log('Setting citations for chat thread:', chatThreadId);
    console.log('Citations count:', citations.length);

    return NextResponse.json({
      success: true,
      message: "Citationデータが設定されました",
      citations: citations
    });

  } catch (error) {
    console.error("Citation設定エラー:", error);
    return NextResponse.json(
      { error: "Citationデータの設定に失敗しました" },
      { status: 500 }
    );
  }
}
