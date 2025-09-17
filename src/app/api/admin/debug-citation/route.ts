import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { options as authOptions } from "@/features/auth/auth-api";
import { similaritySearchVectorWithScore } from "@/features/chat/chat-services/azure-cog-search/azure-cog-vector-store";

// Citation問題のデバッグ用APIエンドポイント
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { query, citationId } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "検索クエリが必要です" }, { status: 400 });
    }

    console.log('=== DEBUG: Citation debugging requested ===');
    console.log('Query:', query);
    console.log('Citation ID:', citationId);
    console.log('User:', session.user.email);

    const debugResults = {};

    // 1. 基本的な社内FAQ検索
    try {
      console.log('=== Testing: Basic doc search ===');
      const docResults = await similaritySearchVectorWithScore(query, 10, {
        filter: `chatType eq 'doc'`
      });
      
      debugResults.basicDocSearch = {
        resultCount: docResults.length,
        results: docResults.map(doc => ({
          id: doc.id,
          metadata: doc.metadata,
          fileName: doc.fileName,
          chatType: doc.chatType,
          deptName: doc.deptName,
          score: doc['@search.score'],
          hasPageContent: !!doc.pageContent,
          pageContentLength: doc.pageContent?.length || 0,
          pageContentPreview: doc.pageContent?.substring(0, 200) + '...',
          sasUrl: doc.sasUrl
        }))
      };
    } catch (error) {
      debugResults.basicDocSearch = {
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // 2. 特定のCitation IDでの検索
    if (citationId) {
      try {
        console.log('=== Testing: Citation ID search ===');
        const idResults = await similaritySearchVectorWithScore(query, 50, {
          filter: `chatType eq 'doc'`
        });
        
        const matchingCitation = idResults.find(doc => doc.id === citationId);
        
        debugResults.citationIdSearch = {
          searchedFor: citationId,
          found: !!matchingCitation,
          totalResults: idResults.length,
          matchingCitation: matchingCitation ? {
            id: matchingCitation.id,
            metadata: matchingCitation.metadata,
            fileName: matchingCitation.fileName,
            chatType: matchingCitation.chatType,
            deptName: matchingCitation.deptName,
            score: matchingCitation['@search.score'],
            hasPageContent: !!matchingCitation.pageContent,
            pageContentLength: matchingCitation.pageContent?.length || 0,
            pageContentFull: matchingCitation.pageContent,
            sasUrl: matchingCitation.sasUrl
          } : null,
          allIds: idResults.map(doc => doc.id)
        };
      } catch (error) {
        debugResults.citationIdSearch = {
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    // 3. インデックス内のサンプルデータ確認
    try {
      console.log('=== Testing: Sample data check ===');
      const sampleResults = await similaritySearchVectorWithScore("*", 5, {
        filter: `chatType eq 'doc'`
      });
      
      debugResults.sampleData = {
        resultCount: sampleResults.length,
        samples: sampleResults.map(doc => ({
          id: doc.id,
          metadata: doc.metadata,
          fileName: doc.fileName,
          chatType: doc.chatType,
          deptName: doc.deptName,
          hasPageContent: !!doc.pageContent,
          pageContentLength: doc.pageContent?.length || 0,
          pageContentSample: doc.pageContent?.substring(0, 100) + '...'
        }))
      };
    } catch (error) {
      debugResults.sampleData = {
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // 4. 環境情報
    debugResults.environment = {
      AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT ? 'SET' : 'NOT_SET',
      AZURE_SEARCH_INDEX_NAME: process.env.AZURE_SEARCH_INDEX_NAME || 'NOT_SET',
      AZURE_SEARCH_API_KEY: process.env.AZURE_SEARCH_API_KEY ? 'SET' : 'NOT_SET',
      AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY ? 'SET' : 'NOT_SET',
      AZURE_SEARCH_API_VERSION: process.env.AZURE_SEARCH_API_VERSION || 'NOT_SET',
    };

    return NextResponse.json({
      success: true,
      query: query,
      citationId: citationId,
      debugResults: debugResults
    });

  } catch (error) {
    console.error("Citation デバッグエラー:", error);
    return NextResponse.json(
      { 
        error: "Citation デバッグに失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Citation データの直接確認
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const citationId = searchParams.get('citationId');

    const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
    const indexName = process.env.AZURE_SEARCH_INDEX_NAME;
    const apiKey = process.env.AZURE_SEARCH_API_KEY || process.env.AZURE_SEARCH_KEY;
    const apiVersion = process.env.AZURE_SEARCH_API_VERSION;
    
    if (!endpoint || !indexName || !apiKey || !apiVersion) {
      return NextResponse.json({
        error: "Azure Search環境変数が不足しています"
      }, { status: 400 });
    }

    let result = {};

    if (citationId) {
      // 特定のCitation IDでドキュメントを直接取得
      try {
        const docUrl = `${endpoint}/indexes/${indexName}/docs/${encodeURIComponent(citationId)}?api-version=${apiVersion}`;
        const response = await fetch(docUrl, {
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
        });

        if (response.ok) {
          const doc = await response.json();
          result.directLookup = {
            found: true,
            document: {
              id: doc.id,
              metadata: doc.metadata,
              fileName: doc.fileName,
              chatType: doc.chatType,
              deptName: doc.deptName,
              hasPageContent: !!doc.pageContent,
              pageContentLength: doc.pageContent?.length || 0,
              pageContentFull: doc.pageContent,
              sasUrl: doc.sasUrl
            }
          };
        } else {
          result.directLookup = {
            found: false,
            error: `${response.status} ${response.statusText}`
          };
        }
      } catch (error) {
        result.directLookup = {
          found: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return NextResponse.json({
      success: true,
      citationId: citationId,
      result: result
    });

  } catch (error) {
    console.error("Citation 直接確認エラー:", error);
    return NextResponse.json(
      { 
        error: "Citation 直接確認に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
