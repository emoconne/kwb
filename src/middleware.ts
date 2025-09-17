import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const requireAuth: string[] = ["/chat", "/api","/reporting", "/documents", "/prompt","/unauthorized"];
const allowPublic: string[] = ["/iframe-embed", "/api/iframe-test", "/api/iframe-status", "/api/headers-test"];
const requireAdmin: string[] = ["/reporting", "/documents"];


export async function middleware(request: NextRequest) {

    const res = NextResponse.next();
    const pathname = request.nextUrl.pathname;

    // iframe埋め込み許可時のヘッダー制御
    const allowIframeEmbedding = process.env.ALLOW_IFRAME_EMBEDDING === 'true';
    const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS || '*';

    if (allowIframeEmbedding) {
        // X-Frame-Optionsヘッダーを明示的に削除
        res.headers.delete('X-Frame-Options');
        
        // Content-Security-Policyを設定
        res.headers.set('Content-Security-Policy', 
            `frame-ancestors ${allowedFrameAncestors}; default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data: https:;`
        );
        
        // CORSヘッダーを設定
        res.headers.set('Access-Control-Allow-Origin', '*');
        res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // パブリックアクセス許可パスをチェック
    if (allowPublic.some((path) => pathname.startsWith(path))) {
        return res;
    }

    if (requireAuth.some((path) => pathname.startsWith(path))) {

        const token = await getToken({
            req: request
        });

        //check not logged in
        if (!token) {
            const url = new URL(`/`, request.url);
            return NextResponse.redirect(url);
        }

        if (requireAdmin.some((path) => pathname.startsWith(path))) {
            //check if not authorized
            if (!token.isAdmin) {
                const url = new URL(`/unauthorized`, request.url);
                return NextResponse.rewrite(url);
            }
        }
    }

    return res;
}

// note that middleware is not applied to api/auth as this is required to logon (i.e. requires anon access)
// iframe設定のため、すべてのルートにミドルウェアを適用（api/authは除外）
export const config = { 
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (NextAuth.js)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
    ],
};
