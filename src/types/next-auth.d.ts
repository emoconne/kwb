import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            isAdmin: string,
            showFAQ?: boolean  // FAQの表示設定を追加
        } & DefaultSession["user"]
        accessToken?: string  // ここで accessToken を任意のプロパティとして追加
    }

    interface User {
        isAdmin: string,
        showFAQ?: boolean  // FAQの表示設定を追加
    }
}

// JWTにもshowFAQプロパティを追加
declare module "next-auth/jwt" {
    interface JWT {
        isAdmin?: string | boolean,
        showFAQ?: boolean
    }
}