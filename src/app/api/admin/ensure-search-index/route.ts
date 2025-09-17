import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { options as authOptions } from "@/features/auth/auth-api";
import { ensureIndexIsCreated, forceRecreateIndex } from "@/features/chat/chat-services/azure-cog-search/azure-cog-vector-store";

// Azure Cognitive Searchインデックスを作成するAPIエンドポイント
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { forceRecreate = false } = await request.json().catch(() => ({}));

    console.log('=== DEBUG: Manual index operation requested ===');
    console.log('User:', session.user.email);
    console.log('Force recreate:', forceRecreate);
    
    // 環境変数の確認
    console.log('=== DEBUG: Environment Variables Check ===');
    const envVars = {
      AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT ? 'SET' : 'NOT_SET',
      AZURE_SEARCH_INDEX_NAME: process.env.AZURE_SEARCH_INDEX_NAME || 'NOT_SET',
      AZURE_SEARCH_API_KEY: process.env.AZURE_SEARCH_API_KEY ? 'SET' : 'NOT_SET',
      AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY ? 'SET' : 'NOT_SET',
      AZURE_SEARCH_API_VERSION: process.env.AZURE_SEARCH_API_VERSION || 'NOT_SET',
    };
    
    console.log('Environment variables:', envVars);
    
    // 必須環境変数のチェック
    const endpoint = process.env.AZURE_SEARCH_ENDPOINT;
    const indexName = process.env.AZURE_SEARCH_INDEX_NAME;
    const apiKey = process.env.AZURE_SEARCH_API_KEY || process.env.AZURE_SEARCH_KEY;
    const apiVersion = process.env.AZURE_SEARCH_API_VERSION;
    
    if (!endpoint || !indexName || !apiKey || !apiVersion) {
      return NextResponse.json({
        error: "Azure Search環境変数が不足しています",
        missing: {
          endpoint: !endpoint,
          indexName: !indexName,
          apiKey: !apiKey,
          apiVersion: !apiVersion
        },
        envVars
      }, { status: 400 });
    }

    // インデックス操作実行
    if (forceRecreate) {
      console.log('Starting FORCE index recreation (WARNING: This will delete all data)...');
      await forceRecreateIndex();
      console.log('Index force recreation completed successfully');
      
      return NextResponse.json({
        success: true,
        message: "Azure Cognitive Searchインデックスが強制的に再作成されました（既存データは削除されました）",
        operation: "force_recreate",
        indexName: indexName,
        endpoint: endpoint
      });
    } else {
      console.log('Starting safe index creation (existing index will be preserved)...');
      await ensureIndexIsCreated();
      console.log('Safe index creation completed successfully');
      
      return NextResponse.json({
        success: true,
        message: "Azure Cognitive Searchインデックスが正常に確認/作成されました",
        operation: "safe_ensure",
        indexName: indexName,
        endpoint: endpoint
      });
    }

  } catch (error) {
    console.error("インデックス操作エラー:", error);
    return NextResponse.json(
      { 
        error: "インデックス操作に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// インデックスの状態を確認するAPIエンドポイント
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
        error: "Azure Search環境変数が不足しています",
        envVars: {
          AZURE_SEARCH_ENDPOINT: endpoint ? 'SET' : 'NOT_SET',
          AZURE_SEARCH_INDEX_NAME: indexName || 'NOT_SET',
          AZURE_SEARCH_API_KEY: process.env.AZURE_SEARCH_API_KEY ? 'SET' : 'NOT_SET',
          AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY ? 'SET' : 'NOT_SET',
          AZURE_SEARCH_API_VERSION: apiVersion || 'NOT_SET',
        }
      }, { status: 400 });
    }

    // インデックスの存在確認
    const indexUrl = `${endpoint}/indexes/${indexName}?api-version=${apiVersion}`;
    const response = await fetch(indexUrl, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
    });

    if (response.ok) {
      const indexInfo = await response.json();
      return NextResponse.json({
        exists: true,
        indexName: indexName,
        endpoint: endpoint,
        fieldsCount: indexInfo.fields?.length || 0,
        message: "インデックスが存在します"
      });
    } else if (response.status === 404) {
      return NextResponse.json({
        exists: false,
        indexName: indexName,
        endpoint: endpoint,
        message: "インデックスが存在しません"
      });
    } else {
      return NextResponse.json({
        error: "インデックスの状態確認に失敗しました",
        status: response.status,
        statusText: response.statusText
      }, { status: 500 });
    }

  } catch (error) {
    console.error("インデックス状態確認エラー:", error);
    return NextResponse.json(
      { 
        error: "インデックスの状態確認に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
