import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { options as authOptions } from "@/features/auth/auth-api";
import { getUserSettings, saveUserSettings, updateUserSettings } from "@/features/settings/user-settings-service";
import { UserType, AdminRole } from "@/features/settings/user-types";
import { getMicrosoftGraphService } from "@/features/settings/microsoft-graph-service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    // 既存のユーザー設定を取得
    const existingSettings = await getUserSettings();
    
    // Azure Entraからユーザー一覧を取得
    let entraUsers;
    try {
      const graphService = getMicrosoftGraphService();
      entraUsers = await graphService.getUsers();
    } catch (error) {
      console.error("Microsoft Graph API エラー、ダミーデータを使用:", error);
      // エラーが発生した場合はダミーデータを使用
      entraUsers = getFallbackUsers();
    }
    
    // 既存設定とEntraユーザーをマージ
    const mergedUsers = entraUsers.map(entraUser => {
      const existingSetting = existingSettings.find(setting => setting.userId === entraUser.id);
      return {
        ...entraUser,
        userType: existingSetting?.userType || 'other' as UserType,
        adminRole: existingSetting?.adminRole || 'user' as AdminRole,
        isActive: existingSetting?.isActive ?? true,
        settingsId: existingSetting?.id
      };
    });

    return NextResponse.json({
      success: true,
      users: mergedUsers,
      total: mergedUsers.length
    });

  } catch (error) {
    console.error("ユーザー一覧取得エラー:", error);
    return NextResponse.json(
      { error: "ユーザー一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!session.user.isAdmin) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, userType, adminRole, isActive } = body;

    if (!userId || !userType) {
      return NextResponse.json({ error: "ユーザーIDとユーザータイプは必須です" }, { status: 400 });
    }

    // 既存のユーザー設定を確認
    const existingSettings = await getUserSettings();
    const existingSetting = existingSettings.find(setting => setting.userId === userId);

    if (existingSetting) {
      // 既存設定を更新
      await updateUserSettings(existingSetting.id, {
        userType,
        adminRole: adminRole || existingSetting.adminRole,
        isActive: isActive !== undefined ? isActive : existingSetting.isActive,
      });

      return NextResponse.json({
        success: true,
        message: "ユーザー設定が更新されました",
        settingsId: existingSetting.id
      });
    } else {
      // 新規設定を保存（Entraユーザー情報が必要）
      let entraUser;
      try {
        const graphService = getMicrosoftGraphService();
        entraUser = await graphService.getUserById(userId);
      } catch (error) {
        console.error("Microsoft Graph API エラー:", error);
        return NextResponse.json({ error: "ユーザー情報の取得に失敗しました" }, { status: 500 });
      }
      
      if (!entraUser) {
        return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
      }

      const settingsId = await saveUserSettings({
        userId: entraUser.id,
        userPrincipalName: entraUser.userPrincipalName,
        displayName: entraUser.displayName,
        email: entraUser.mail || '',
        userType,
        adminRole: adminRole || 'user',
        department: entraUser.department,
        jobTitle: entraUser.jobTitle,
        isActive: isActive !== undefined ? isActive : true,
      });

      return NextResponse.json({
        success: true,
        message: "ユーザー設定が保存されました",
        settingsId
      });
    }

  } catch (error) {
    console.error("ユーザー設定保存エラー:", error);
    return NextResponse.json(
      { error: "ユーザー設定の保存に失敗しました" },
      { status: 500 }
    );
  }
}

// フォールバック用のダミーデータ
function getFallbackUsers() {
  return [
    {
      id: "1",
      userPrincipalName: "admin@example.com",
      displayName: "管理者 太郎",
      mail: "admin@example.com",
      jobTitle: "システム管理者",
      department: "IT部門",
      accountEnabled: true
    },
    {
      id: "2",
      userPrincipalName: "user1@example.com",
      displayName: "田中 花子",
      mail: "user1@example.com",
      jobTitle: "営業部長",
      department: "営業部",
      accountEnabled: true
    },
    {
      id: "3",
      userPrincipalName: "user2@example.com",
      displayName: "佐藤 次郎",
      mail: "user2@example.com",
      jobTitle: "営業担当",
      department: "営業部",
      accountEnabled: true
    },
    {
      id: "4",
      userPrincipalName: "user3@example.com",
      displayName: "鈴木 三郎",
      mail: "user3@example.com",
      jobTitle: "開発担当",
      department: "開発部",
      accountEnabled: true
    }
  ];
}
