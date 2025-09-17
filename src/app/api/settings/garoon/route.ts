import { NextRequest, NextResponse } from 'next/server';
import { CosmosContainerHelper } from '@/features/documents/cosmos-container-helper';
import { GaroonConfig } from '@/features/documents/garoon-file-service';

// Garoon設定の保存
export async function POST(request: NextRequest) {
  try {
    const config: Partial<GaroonConfig> = await request.json();
    console.log('Garoon設定保存リクエスト:', { 
      name: config.name, 
      url: config.url, 
      username: config.username,
      hasPassword: !!config.password,
      departmentId: config.departmentId 
    });

    // 設定の検証
    console.log('設定検証開始:', {
      hasName: !!config.name,
      hasUrl: !!config.url,
      hasUsername: !!config.username,
      hasPassword: !!config.password,
      nameValue: config.name,
      urlValue: config.url,
      usernameValue: config.username,
      passwordLength: config.password?.length || 0
    });

    const missingFields = [];
    if (!config.name) missingFields.push('設定名');
    if (!config.url) missingFields.push('URL');
    if (!config.username) missingFields.push('ユーザー名');
    if (!config.password) missingFields.push('パスワード');

    if (missingFields.length > 0) {
      console.log('設定検証エラー: 必須項目が不足', missingFields);
      return NextResponse.json(
        { message: `${missingFields.join('、')}は必須です` },
        { status: 400 }
      );
    }

    // URLの形式チェック
    try {
      new URL(config.url);
    } catch {
      console.log('URL形式エラー:', config.url);
      return NextResponse.json(
        { message: '有効なURLを入力してください' },
        { status: 400 }
      );
    }

    console.log('Cosmos DB接続開始');
    const containerHelper = CosmosContainerHelper.getInstance();
    
    // コンテナを取得（存在しない場合は作成）
    const container = await containerHelper.ensureContainer('garoon', '/id');

    // 新しい設定を作成
    const newConfig: GaroonConfig = {
      id: crypto.randomUUID(),
      name: config.name,
      url: config.url,
      username: config.username,
      password: config.password,
      departmentId: config.departmentId,
      departmentName: config.departmentName,
      isConnected: false,
      isActive: config.isActive ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('設定保存実行:', { 
      id: newConfig.id, 
      name: newConfig.name,
      url: newConfig.url,
      username: newConfig.username,
      hasPassword: !!newConfig.password,
      departmentId: newConfig.departmentId
    });
    
    const { resource } = await container.items.create(newConfig);
    console.log('設定保存成功:', {
      id: resource?.id,
      name: resource?.name,
      url: resource?.url,
      username: resource?.username,
      hasPassword: !!resource?.password
    });

    return NextResponse.json({ 
      message: '設定が保存されました',
      setting: resource 
    });
  } catch (error) {
    console.error('Garoon設定保存エラー:', error);
    
    // より詳細なエラーメッセージを提供
    let errorMessage = 'Garoon設定の保存に失敗しました';
    if (error instanceof Error) {
      if (error.message.includes('Database with id')) {
        errorMessage = 'データベースが見つかりません。管理者にお問い合わせください。';
      } else if (error.message.includes('Container with id')) {
        errorMessage = 'データコンテナが見つかりません。管理者にお問い合わせください。';
      } else if (error.message.includes('Unauthorized')) {
        errorMessage = 'データベースへのアクセス権限がありません。管理者にお問い合わせください。';
      }
    }
    
    return NextResponse.json(
      { 
        message: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}
