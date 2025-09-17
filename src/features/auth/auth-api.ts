import NextAuth, { NextAuthOptions } from "next-auth";
import { Provider } from "next-auth/providers";
import AzureADProvider from "next-auth/providers/azure-ad";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { hashValue } from "./helpers";

const configureIdentityProvider = () => {
  const providers: Array<Provider> = [];

  const adminEmails = process.env.ADMIN_EMAIL_ADDRESS?.split(",").map(email => email.toLowerCase().trim());
  
  // FAQ表示設定を取得
  const showFAQ = process.env.NEXT_PUBLIC_FAQ === 'True';

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.AUTH_GITHUB_ID!,
        clientSecret: process.env.AUTH_GITHUB_SECRET!,
        async profile(profile) {
          const newProfile = {
            ...profile,
            isAdmin: adminEmails?.includes(profile.email.toLowerCase()),
            showFAQ: showFAQ // FAQの表示設定を追加
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
            isAdmin: adminEmails?.includes(profile.preferred_username.toLowerCase()),
            showFAQ: showFAQ // FAQの表示設定を追加
          }
          return newProfile;
        }
      })
    );
  }

  // If we're in local dev, add a basic credential provider option as well
  // (Useful when a dev doesn't have access to create app registration in their tenant)
  // This currently takes any username and makes a user with it, ignores password
  // Refer to: https://next-auth.js.org/configuration/providers/credentials
  if (process.env.NODE_ENV === "development") {
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
              showFAQ: showFAQ, // FAQの表示設定を追加
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
      if (user) {
        // ユーザー情報からトークンに値をコピー
        if (user.isAdmin) {
          token.isAdmin = user.isAdmin;
        }
        // FAQの表示設定をトークンに追加
        token.showFAQ = user.showFAQ;
      }
      return token;
    },
    async session({session, token, user }) {
      // トークンからセッションにユーザー情報をコピー
      session.user.isAdmin = token.isAdmin as string;
      // FAQの表示設定をセッションに追加
      session.user.showFAQ = token.showFAQ as boolean;
      return session;
    }
  },
  session: {
    strategy: "jwt",
  },
 
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        path: '/',
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      },
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: {
        path: '/',
        sameSite: 'none',
        secure: true,
      },
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: {
        path: '/',
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      },
    },
  },

  useSecureCookies: process.env.NODE_ENV === "production",
};
export const handlers = NextAuth(options);
