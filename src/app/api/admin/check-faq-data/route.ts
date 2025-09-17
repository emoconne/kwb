import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { options as authOptions } from "@/features/auth/auth-api";

// 社内FAQデータの存在確認APIエンドポイント
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

    console.log('=== DEBUG: Checking FAQ data in index ===');
    console.log('Index:', indexName);
    console.log('Endpoint:', endpoint);

    const results = {};

    // 1. 全ドキュメント数の確認
    try {
      const allDocsUrl = `${endpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
      const allDocsBody = {
        search: "*",
        top: 0,
        count: true
      };

      const allDocsResponse = await fetch(allDocsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(allDocsBody)
      });

      if (allDocsResponse.ok) {
        const allDocsData = await allDocsResponse.json();
        results.totalDocuments = allDocsData['@odata.count'] || 0;
      } else {
        results.totalDocuments = { error: `${allDocsResponse.status} ${allDocsResponse.statusText}` };
      }
    } catch (error) {
      results.totalDocuments = { error: error instanceof Error ? error.message : String(error) };
    }

    // 2. chatType別ドキュメント数の確認
    const chatTypes = ['doc', 'document', 'data', 'simple', 'web'];
    results.chatTypeBreakdown = {};

    for (const chatType of chatTypes) {
      try {
        const typeUrl = `${endpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
        const typeBody = {
          search: "*",
          filter: `chatType eq '${chatType}'`,
          top: 0,
          count: true
        };

        const typeResponse = await fetch(typeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify(typeBody)
        });

        if (typeResponse.ok) {
          const typeData = await typeResponse.json();
          results.chatTypeBreakdown[chatType] = typeData['@odata.count'] || 0;
        } else {
          results.chatTypeBreakdown[chatType] = { error: `${typeResponse.status} ${typeResponse.statusText}` };
        }
      } catch (error) {
        results.chatTypeBreakdown[chatType] = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    // 3. 社内FAQ（chatType='doc'）のサンプルデータ確認
    try {
      const faqUrl = `${endpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
      const faqBody = {
        search: "*",
        filter: "chatType eq 'doc'",
        top: 5,
        select: "id,metadata,chatType,deptName,pageContent"
      };

      const faqResponse = await fetch(faqUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(faqBody)
      });

      if (faqResponse.ok) {
        const faqData = await faqResponse.json();
        results.faqSamples = faqData.value?.map((doc: any) => ({
          id: doc.id,
          metadata: doc.metadata,
          chatType: doc.chatType,
          deptName: doc.deptName,
          pageContentPreview: doc.pageContent?.substring(0, 200) + '...'
        })) || [];
      } else {
        results.faqSamples = { error: `${faqResponse.status} ${faqResponse.statusText}` };
      }
    } catch (error) {
      results.faqSamples = { error: error instanceof Error ? error.message : String(error) };
    }

    // 4. 部門別の分布確認
    try {
      const deptUrl = `${endpoint}/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
      const deptBody = {
        search: "*",
        filter: "chatType eq 'doc'",
        top: 0,
        facets: ["deptName"]
      };

      const deptResponse = await fetch(deptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(deptBody)
      });

      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        results.departmentBreakdown = deptData['@search.facets']?.deptName || [];
      } else {
        results.departmentBreakdown = { error: `${deptResponse.status} ${deptResponse.statusText}` };
      }
    } catch (error) {
      results.departmentBreakdown = { error: error instanceof Error ? error.message : String(error) };
    }

    return NextResponse.json({
      success: true,
      indexName: indexName,
      endpoint: endpoint,
      timestamp: new Date().toISOString(),
      ...results
    });

  } catch (error) {
    console.error("FAQ データ確認エラー:", error);
    return NextResponse.json(
      { 
        error: "FAQ データの確認に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
