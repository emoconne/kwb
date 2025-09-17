import { NextRequest, NextResponse } from 'next/server';
import { CosmosContainerHelper } from '@/features/documents/cosmos-container-helper';
import { GaroonConfig } from '@/features/documents/garoon-file-service';

// Garoon設定一覧を取得
export async function GET() {
  try {
    const containerHelper = CosmosContainerHelper.getInstance();
    
    // コンテナを取得（存在しない場合は作成）
    const container = await containerHelper.ensureContainer('garoon', '/id');

    const { resources } = await container.items
      .query<GaroonConfig>({
        query: 'SELECT * FROM c ORDER BY c.createdAt DESC'
      })
      .fetchAll();

    console.log('Garoon設定一覧取得成功:', {
      totalCount: resources?.length || 0,
      settings: resources?.map(r => ({
        id: r.id,
        name: r.name,
        url: r.url,
        username: r.username,
        hasPassword: !!r.password,
        isActive: r.isActive
      })) || []
    });

    return NextResponse.json({
      settings: resources || []
    });
  } catch (error) {
    console.error('Garoon設定一覧取得エラー:', error);
    return NextResponse.json(
      { message: '設定一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}
