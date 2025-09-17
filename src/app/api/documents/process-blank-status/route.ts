import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { options as authOptions } from "@/features/auth/auth-api";
import { processBlankStatusDocuments } from "@/features/documents/document-intelligence-service";

// statusがブランクのドキュメントを一括処理するAPIエンドポイント
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    console.log('=== BLANK OR ERROR STATUS PROCESSING REQUESTED ===');
    console.log('User:', session.user.email);

    // バックグラウンドで処理を開始
    console.log('Starting background processing of blank or error status documents...');
    
    // 非同期で処理を実行（レスポンスを待たない）
    processBlankStatusDocuments()
      .then((results) => {
        console.log('Background processing completed:', results);
      })
      .catch((error) => {
        console.error('Background processing failed:', error);
      });

    // 即座にレスポンスを返す
    return NextResponse.json({
      success: true,
      message: "statusがブランクまたはerrorのドキュメントの処理をバックグラウンドで開始しました",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("ブランクステータス処理エラー:", error);
    return NextResponse.json(
      { 
        error: "ブランクステータスドキュメントの処理に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 処理状況を確認するAPIエンドポイント
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    // statusがブランクまたはerrorのドキュメント数を確認
    const { getDocumentsWithBlankOrErrorStatus } = await import('@/features/documents/cosmos-db-document-service');
    const targetDocuments = await getDocumentsWithBlankOrErrorStatus();

    return NextResponse.json({
      success: true,
      blankOrErrorStatusCount: targetDocuments.length,
      documents: targetDocuments.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        departmentName: doc.departmentName,
        uploadedAt: doc.uploadedAt,
        status: doc.status || 'blank'
      }))
    });

  } catch (error) {
    console.error("ブランクステータス確認エラー:", error);
    return NextResponse.json(
      { 
        error: "ブランクステータスドキュメントの確認に失敗しました",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
