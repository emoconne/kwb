import { NextRequest, NextResponse } from 'next/server';
import { CosmosContainerHelper } from '@/features/documents/cosmos-container-helper';
import { GaroonConfig } from '@/features/documents/garoon-file-service';

// Garoon設定を取得（ID指定）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const containerHelper = CosmosContainerHelper.getInstance();
    const container = await containerHelper.ensureContainer('garoon', '/id');

    const { resource } = await container.item(params.id, params.id).read<GaroonConfig>();

    if (!resource) {
      return NextResponse.json(
        { message: '設定が見つかりません' },
        { status: 404 }
      );
    }

    console.log('Garoon設定取得成功:', {
      id: resource.id,
      name: resource.name,
      url: resource.url,
      username: resource.username,
      hasPassword: !!resource.password,
      departmentId: resource.departmentId
    });

    return NextResponse.json({ setting: resource });
  } catch (error) {
    console.error('Garoon設定取得エラー:', error);
    return NextResponse.json(
      { message: '設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// Garoon設定を更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const containerHelper = CosmosContainerHelper.getInstance();
    const container = await containerHelper.ensureContainer('garoon', '/id');

    const updateData = await request.json();
    
    // 既存の設定を取得
    const { resource: existingConfig } = await container.item(params.id, params.id).read<GaroonConfig>();
    
    if (!existingConfig) {
      return NextResponse.json(
        { message: '設定が見つかりません' },
        { status: 404 }
      );
    }

    // 更新データをマージ
    const updatedConfig: GaroonConfig = {
      ...existingConfig,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    const { resource } = await container.items.upsert(updatedConfig);

    return NextResponse.json({ 
      message: '設定が更新されました',
      setting: resource 
    });
  } catch (error) {
    console.error('Garoon設定更新エラー:', error);
    return NextResponse.json(
      { message: '設定の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// Garoon設定を削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const containerHelper = CosmosContainerHelper.getInstance();
    const container = await containerHelper.ensureContainer('garoon', '/id');

    await container.item(params.id, params.id).delete();

    return NextResponse.json({ message: '設定が削除されました' });
  } catch (error) {
    console.error('Garoon設定削除エラー:', error);
    return NextResponse.json(
      { message: '設定の削除に失敗しました' },
      { status: 500 }
    );
  }
}
