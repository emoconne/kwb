import { NextRequest, NextResponse } from 'next/server';
import { GaroonFileService } from '@/features/documents/garoon-file-service';
import { GaroonSettingsService } from '@/features/documents/garoon-settings-service';
import { GaroonConfig } from '@/features/documents/garoon-file-service';

// Garoonファイル一覧を取得（POST）
export async function POST(request: NextRequest) {
  try {
    const { configId, path = '/', folderId } = await request.json();
    
    console.log('=== API /api/garoon/files POST ===');
    console.log('Request Body:', { configId, path });

    if (!configId) {
      console.error('ConfigId is missing');
      return NextResponse.json(
        { message: '設定IDが必要です' },
        { status: 400 }
      );
    }

    // 設定を取得
    const garoonSettingsService = GaroonSettingsService.getInstance();
    const config = await garoonSettingsService.getGaroonSetting(configId);
    
    console.log('Retrieved Config:', {
      id: config?.id,
      name: config?.name,
      url: config?.url,
      username: config?.username,
      isConnected: config?.isConnected
    });

    if (!config) {
      return NextResponse.json(
        { message: '指定された設定が見つかりません' },
        { status: 404 }
      );
    }

    if (!config.isConnected) {
      return NextResponse.json(
        { message: '指定された設定は接続されていません' },
        { status: 400 }
      );
    }

    // Garoonファイルサービスを使用してファイル一覧を取得
    const garoonService = GaroonFileService.getInstance();
    const garoonConfig = {
      url: config.url,
      username: config.username,
      password: config.password,
      isConnected: config.isConnected
    };

    // パスまたはfolderIdに基づいてファイル一覧を取得
    let files;
    if (folderId) {
      console.log('Calling getCabinetFiles with config:', garoonConfig, 'folderId:', folderId);
      files = await garoonService.getCabinetFiles(folderId, garoonConfig);
    } else {
      // URLからhidを抽出してtargetRootIdとして使用
      const url = new URL(config.url);
      const hid = url.searchParams.get('hid') || '14';
      console.log('Calling getCabinetList with config:', garoonConfig, 'targetRootId:', hid);
      files = await garoonService.getCabinetList(garoonConfig, hid);
    }
    
    console.log('Retrieved files:', files);
    
    return NextResponse.json({
      files: files,
      configName: config.name,
      currentPath: path
    });
  } catch (error) {
    console.error('Garoonファイル一覧取得エラー:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { message: 'ファイル一覧の取得に失敗しました', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// レガシー対応（GETメソッド）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    // 設定を取得（実際の実装では、データベースやKey Vaultから取得）
    const config = {
      url: process.env.GAROON_URL || '',
      username: process.env.GAROON_USERNAME || '',
      password: process.env.GAROON_PASSWORD || '',
      isConnected: false
    };

    if (!config.url || !config.username || !config.password) {
      return NextResponse.json(
        { message: 'Garoon設定が不完全です。設定画面で設定を行ってください。' },
        { status: 400 }
      );
    }

    const garoonService = GaroonFileService.getInstance();

    let files;
    if (folderId) {
      files = await garoonService.getCabinetFiles(folderId, config);
    } else {
      files = await garoonService.getCabinetList(config);
    }

    return NextResponse.json(files);
  } catch (error) {
    console.error('Garoonファイル一覧取得エラー:', error);
    return NextResponse.json(
      { message: `ファイル一覧の取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    );
  }
}
