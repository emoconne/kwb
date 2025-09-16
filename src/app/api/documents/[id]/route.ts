import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { options as authOptions } from "@/features/auth/auth-api";
import { deleteDocument } from "@/features/documents/document-management-service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json({ error: "ドキュメントIDが必要です" }, { status: 400 });
    }

    console.log('API: Deleting document:', documentId);
    await deleteDocument(documentId);

    return NextResponse.json({
      success: true,
      message: "ドキュメントが正常に削除されました",
      documentId
    });

  } catch (error) {
    console.error("ドキュメント削除エラー:", error);
    
    // エラーメッセージを詳細に返す
    const errorMessage = error instanceof Error ? error.message : "ドキュメントの削除に失敗しました";
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 