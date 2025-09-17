import NextAuth, { NextAuthOptions } from "next-auth";
import { Provider } from "next-auth/providers";
import AzureADProvider from "next-auth/providers/azure-ad";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { hashValue } from "./helpers";
import { getUserProfile, getUserProfileByEmail, isUserAdmin, isUserAdminByEmail } from "@/features/settings/user-settings-service";

const configureIdentityProvider = () => {
  const providers: Array<Provider> = [];

  const adminEmails = process.env.ADMIN_EMAIL_ADDRESS?.split(",").map(email => email.toLowerCase().trim());

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.AUTH_GITHUB_ID!,
        clientSecret: process.env.AUTH_GITHUB_SECRET!,
        async profile(profile) {
          const newProfile = {
            ...profile,
            isAdmin: adminEmails?.includes(profile.email.toLowerCase())
          }
          return newProfile;
        }
      })
    );
  }

  if (
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  ) {
    providers.push(
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
        tenantId: process.env.AZURE_AD_TENANT_ID!,
        async profile(profile) {

          const newProfile = {
            ...profile,
            // throws error without this - unsure of the root cause (https://stackoverflow.com/questions/76244244/profile-id-is-missing-in-google-oauth-profile-response-nextauth)
            id: profile.sub,
            //isAdmin: adminEmails?.includes(profile.email.toLowerCase()) || adminEmails?.includes(profile.preferred_username.toLowerCase())
            isAdmin: adminEmails?.includes(profile.preferred_username.toLowerCase())
          }
          return newProfile;
        }
      })
    );
  }

  // If NEXT_PUBLIC_DEBUG is true, add a basic credential provider option as well
  // (Useful when a dev doesn't have access to create app registration in their tenant)
  // This currently takes any username and makes a user with it, ignores password
  // Refer to: https://next-auth.js.org/configuration/providers/credentials
  if (process.env.NEXT_PUBLIC_DEBUG === "true") {
    providers.push(
      CredentialsProvider({
        name: "localdev",
        credentials: {
          username: { label: "Username", type: "text", placeholder: "dev" },
          password: { label: "Password", type: "password" },
        },    
        async authorize(credentials, req): Promise<any> {
          // You can put logic here to validate the credentials and return a user.
          // We're going to take any username and make a new user with it
          // Create the id as the hash of the email as per userHashedId (helpers.ts)
          const username = credentials?.username || "dev";
          const email = username + "@localhost";
          const user = {
              id: hashValue(email),
              name: username,
              email: email,
              isAdmin: true,
              image: "",
            };
          console.log("=== DEV USER LOGGED IN:\n", JSON.stringify(user, null, 2));
          return user;
        }
      })
    );
  }

  return providers;
};

export const options: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [...configureIdentityProvider()],
  callbacks: {
    async jwt({token, user, account, profile, isNewUser, session}) {
      // ADMIN_EMAIL_ADDRESSに登録されているメールアドレスに無条件でadmin権限を与える
      const adminEmails = process.env.ADMIN_EMAIL_ADDRESS?.split(",").map(email => email.toLowerCase().trim());
      const isAdminFromEmail = token.email && adminEmails?.includes(token.email.toLowerCase());
      
      if (user?.isAdmin) {
        token.isAdmin = user.isAdmin;
      }
      
      // ユーザーIDが設定されている場合、CosmosDBからユーザー情報を取得
      // 一時的にコメントアウト - 繰り返し処理を停止
      /*
      if (token.sub) {
        try {
          // まずユーザーIDで検索
          let userProfile = await getUserProfile(token.sub);
          let isAdminFromSettings = await isUserAdmin(token.sub);
          
          // ユーザーIDで見つからない場合、メールアドレスで検索
          if (!userProfile && token.email) {
            console.log('ユーザーIDで見つからないため、メールアドレスで検索:', token.email);
            userProfile = await getUserProfileByEmail(token.email);
            isAdminFromSettings = await isUserAdminByEmail(token.email);
          }
          
          if (userProfile) {
            token.userType = userProfile.userType;
            token.adminRole = userProfile.adminRole;
            token.displayName = userProfile.displayName;
            token.department = userProfile.department;
            token.jobTitle = userProfile.jobTitle;
          }
          
          // 管理者権限をチェック（ADMIN_EMAIL_ADDRESSを最優先、次にCosmosDBのadminRole）
          token.isAdmin = isAdminFromEmail || user?.isAdmin || isAdminFromSettings;
          
          console.log('認証デバッグ:', {
            tokenSub: token.sub,
            tokenEmail: token.email,
            isAdminFromEmail,
            userProfile: userProfile ? 'found' : 'not found',
            isAdminFromSettings,
            finalIsAdmin: token.isAdmin
          });
        } catch (error) {
          console.error('ユーザープロファイル取得エラー:', error);
          // エラーが発生した場合はADMIN_EMAIL_ADDRESSの権限のみを使用
          token.isAdmin = isAdminFromEmail || user?.isAdmin;
        }
      }
      */
      
      // 一時的に基本的な管理者権限設定のみを使用
      token.isAdmin = isAdminFromEmail || user?.isAdmin;
      
      return token;
    },
    async session({session, token, user }) {
      session.user.isAdmin = token.isAdmin as boolean;
      session.user.userType = token.userType as string;
      session.user.adminRole = token.adminRole as string;
      session.user.displayName = token.displayName as string;
      session.user.department = token.department as string;
      session.user.jobTitle = token.jobTitle as string;
      return session;
    }
  },
  session: {
    strategy: "jwt",
  },
};

export const handlers = NextAuth(options);
