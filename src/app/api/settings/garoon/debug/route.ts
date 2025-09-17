import { NextRequest, NextResponse } from 'next/server';
import { CosmosContainerHelper } from '@/features/documents/cosmos-container-helper';

// Garoon設定のデバッグ情報を取得
export async function GET() {
  try {
    const debugInfo = {
      environmentVariables: {
        AZURE_COSMOSDB_URI: process.env.AZURE_COSMOSDB_URI ? 'SET' : 'NOT SET',
        AZURE_COSMOSDB_KEY: process.env.AZURE_COSMOSDB_KEY ? 'SET' : 'NOT SET',
        AZURE_COSMOSDB_DB_NAME: process.env.AZURE_COSMOSDB_DB_NAME ? 'SET' : 'NOT SET',
      },
      cosmosConnection: {
        status: 'unknown',
        error: null as string | null,
        databaseExists: false,
        containerExists: false
      }
    };

    // Cosmos DB接続テスト
    try {
      const containerHelper = CosmosContainerHelper.getInstance();
      
      // データベースの存在確認
      debugInfo.cosmosConnection.databaseExists = await containerHelper.databaseExists();
      
      // コンテナの存在確認
      if (debugInfo.cosmosConnection.databaseExists) {
        debugInfo.cosmosConnection.containerExists = await containerHelper.containerExists('garoon');
        
        // コンテナが存在しない場合は作成を試行
        if (!debugInfo.cosmosConnection.containerExists) {
          try {
            await containerHelper.ensureContainer('garoon', '/id');
            debugInfo.cosmosConnection.containerExists = true;
            debugInfo.cosmosConnection.status = 'connected';
          } catch (error) {
            debugInfo.cosmosConnection.error = `コンテナ "garoon" の作成に失敗しました: ${error}`;
          }
        } else {
          debugInfo.cosmosConnection.status = 'connected';
        }
      } else {
        debugInfo.cosmosConnection.error = 'データベースが見つかりません';
      }

    } catch (error) {
      debugInfo.cosmosConnection.status = 'error';
      debugInfo.cosmosConnection.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('デバッグ情報取得エラー:', error);
    return NextResponse.json(
      { 
        message: 'デバッグ情報の取得に失敗しました',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
