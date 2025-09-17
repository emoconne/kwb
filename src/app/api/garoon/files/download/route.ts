import { NextRequest, NextResponse } from 'next/server';
import { GaroonFileService } from '@/features/documents/garoon-file-service';
import { GaroonSettingsService } from '@/features/documents/garoon-settings-service';

// Garoonファイルダウンロード
export async function POST(request: NextRequest) {
  try {
    const { configId, filePath } = await request.json();

    if (!configId || !filePath) {
      return NextResponse.json(
        { message: '設定IDとファイルパスが必要です' },
        { status: 400 }
      );
    }

    // 設定を取得
    const garoonSettingsService = GaroonSettingsService.getInstance();
    const config = await garoonSettingsService.getGaroonSetting(configId);

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

    const garoonService = GaroonFileService.getInstance();
    const garoonConfig = {
      url: config.url,
      username: config.username,
      password: config.password,
      isConnected: config.isConnected
    };

    // ダウンロードURLを取得
    const downloadUrl = await garoonService.getCabinetFileDownloadUrl(filePath, garoonConfig);

    // ファイルをダウンロード
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Garoon-Integration/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`ファイルダウンロードに失敗しました: ${response.status} ${response.statusText}`);
    }

    const fileBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="garoon-file-${fileId}"`,
      },
    });
  } catch (error) {
    console.error('Garoonファイルダウンロードエラー:', error);
    return NextResponse.json(
      { message: `ファイルダウンロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    );
  }
}
