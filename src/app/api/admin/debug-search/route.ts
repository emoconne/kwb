import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { options as authOptions } from "@/features/auth/auth-api";
import { similaritySearchVectorWithScore } from "@/features/chat/chat-services/azure-cog-search/azure-cog-vector-store";

// Azure Cognitive Searchのデバッグ用APIエンドポイント
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { query, filter, limit = 10 } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "検索クエリが必要です" }, { status: 400 });
    }

    console.log('=== DEBUG: Search debugging requested ===');
    console.log('Query:', query);
    console.log('Filter:', filter);
    console.log('Limit:', limit);
    console.log('User:', session.user.email);

    const results = [];

    // 1. フィルターなしで全検索
    try {
      console.log('=== Testing: No filter search ===');
      const noFilterResults = await similaritySearchVectorWithScore(query, limit);
      results.push({
        testName: "フィルターなし検索",
        filter: "なし",
        resultCount: noFilterResults.length,
        results: noFilterResults.map(doc => ({
          id: doc.id,
          metadata: doc.metadata,
          chatType: doc.chatType,
          deptName: doc.deptName,
          score: doc['@search.score'],
          pageContentPreview: doc.pageContent?.substring(0, 100) + '...'
        }))
      });
    } catch (error) {
      results.push({
        testName: "フィルターなし検索",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 2. chatType='doc'フィルター
    try {
      console.log('=== Testing: chatType doc filter ===');
      const docFilterResults = await similaritySearchVectorWithScore(query, limit, {
        filter: `chatType eq 'doc'`
      });
      results.push({
        testName: "chatType='doc'フィルター",
        filter: "chatType eq 'doc'",
        resultCount: docFilterResults.length,
        results: docFilterResults.map(doc => ({
          id: doc.id,
          metadata: doc.metadata,
          chatType: doc.chatType,
          deptName: doc.deptName,
          score: doc['@search.score'],
          pageContentPreview: doc.pageContent?.substring(0, 100) + '...'
        }))
      });
    } catch (error) {
      results.push({
        testName: "chatType='doc'フィルター",
        filter: "chatType eq 'doc'",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 3. カスタムフィルター（指定があれば）
    if (filter) {
      try {
        console.log('=== Testing: Custom filter ===');
        const customFilterResults = await similaritySearchVectorWithScore(query, limit, {
          filter: filter
        });
        results.push({
          testName: "カスタムフィルター",
          filter: filter,
          resultCount: customFilterResults.length,
          results: customFilterResults.map(doc => ({
            id: doc.id,
            metadata: doc.metadata,
            chatType: doc.chatType,
            deptName: doc.deptName,
            score: doc['@search.score'],
            pageContentPreview: doc.pageContent?.substring(0, 100) + '...'
          }))
        });
      } catch (error) {
        results.push({
          testName: "カスタムフィルター",
          filter: filter,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 4. 異なるchatTypeの確認
    const chatTypes = ['doc', 'data', 'simple', 'web', 'document'];
    for (const chatType of chatTypes) {
      try {
        console.log(`=== Testing: chatType=${chatType} ===`);
        const typeResults = await similaritySearchVectorWithScore(query, 5, {
          filter: `chatType eq '${chatType}'`
        });
        results.push({
          testName: `chatType='${chatType}'確認`,
          filter: `chatType eq '${chatType}'`,
          resultCount: typeResults.length,
          results: typeResults.slice(0, 3).map(doc => ({
            id: doc.id,
            metadata: doc.metadata,
            chatType: doc.chatType,
            deptName: doc.deptName,
            score: doc['@search.score']
          }))
        });
      } catch (error) {
        results.push({
          testName: `chatType='${chatType}'確認`,
          filter: `chatType eq '${chatType}'`,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return NextResponse.json({
      success: true,
      query: query,
      searchTests: results,
      environment: {
        AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT ? 'SET' : 'NOT_SET',
        AZURE_SEARCH_INDEX_NAME: process.env.AZURE_SEARCH_INDEX_NAME || 'NOT_SET',
        AZURE_SEARCH_API_KEY: process.env.AZURE_SEARCH_API_KEY ? 'SET' : 'NOT_SET',
        AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY ? 'SET' : 'NOT_SET',
        AZURE_SEARCH_API_VERSION: process.env.AZURE_SEARCH_API_VERSION || 'NOT_SET',
      }
    });

  } catch (error) {
    console.error("検索デバッグエラー:", error);
    return NextResponse.json(
      { 
        error: "検索デバッグに失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// インデックス内の全ドキュメント数を確認するエンドポイント
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
    const indexName = process.env.AZURE_SEARCH_INDEX_NAME;
    const apiKey = process.env.AZURE_SEARCH_API_KEY || process.env.AZURE_SEARCH_KEY;
    const apiVersion = process.env.AZURE_SEARCH_API_VERSION;
    
    if (!endpoint || !indexName || !apiKey || !apiVersion) {
      return NextResponse.json({
        error: "Azure Search環境変数が不足しています"
      }, { status: 400 });
    }

    // インデックス内のドキュメント数を取得
    const searchUrl = `${endpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
    const searchBody = {
      search: "*",
      top: 0,
      count: true,
      facets: ["chatType", "deptName"]
    };

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      totalDocuments: data['@odata.count'] || 0,
      facets: data['@search.facets'] || {},
      indexName: indexName,
      endpoint: endpoint
    });

  } catch (error) {
    console.error("インデックス統計取得エラー:", error);
    return NextResponse.json(
      { 
        error: "インデックス統計の取得に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
