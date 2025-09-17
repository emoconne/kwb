import { NextRequest, NextResponse } from 'next/server';
import { GaroonFileService } from '@/features/documents/garoon-file-service';

// Garoon接続テスト
export async function POST(request: NextRequest) {
  try {
    console.log('Garoon connection test API called');
    const requestBody = await request.json();
    console.log('Request body:', {
      url: requestBody.url,
      username: requestBody.username,
      password: requestBody.password ? '***' : 'empty'
    });

    const { url, username, password } = requestBody;

    // 設定の検証
    if (!url || !username || !password) {
      console.log('Validation failed - missing fields:', {
        url: !!url,
        username: !!username,
        password: !!password
      });
      return NextResponse.json(
        { message: 'URL、ユーザー名、パスワードは必須です' },
        { status: 400 }
      );
    }

    console.log('Creating GaroonFileService instance...');
    // GaroonFileServiceインスタンスを作成
    const garoonService = new GaroonFileService({
      url,
      username,
      password,
      isConnected: false
    });

    console.log('Running connection test...');
    // 接続テストを実行
    const isConnected = await garoonService.testConnection();
    console.log('Connection test result:', isConnected);

    if (isConnected) {
      console.log('Connection test successful');
      return NextResponse.json({ 
        message: '接続テストが成功しました',
        connected: true 
      });
    } else {
      console.log('Connection test failed');
      return NextResponse.json(
        { 
          message: '接続テストに失敗しました。URL、ユーザー名、パスワードを確認してください。',
          connected: false 
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Garoon接続テストエラー:', error);
    return NextResponse.json(
      { 
        message: `接続テストに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        connected: false 
      },
      { status: 500 }
    );
  }
}
