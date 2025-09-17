import { NextRequest, NextResponse } from "next/server";

// iframe埋め込みテスト用のAPIエンドポイント
export async function GET(request: NextRequest) {
  try {
    // iframe環境での動作確認情報を返す
    const headers = request.headers;
    const userAgent = headers.get('user-agent') || '';
    const referer = headers.get('referer') || '';
    const xForwardedFor = headers.get('x-forwarded-for') || '';
    const xForwardedProto = headers.get('x-forwarded-proto') || '';
    
    // iframe内かどうかの判定
    const isInIframe = headers.get('sec-fetch-dest') === 'iframe' || 
                      headers.get('sec-fetch-mode') === 'navigate';
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      iframe: {
        detected: isInIframe,
        allowEmbedding: process.env.ALLOW_IFRAME_EMBEDDING === 'true',
        allowedFrameAncestors: process.env.ALLOWED_FRAME_ANCESTORS || '*'
      },
      headers: {
        userAgent: userAgent,
        referer: referer,
        xForwardedFor: xForwardedFor,
        xForwardedProto: xForwardedProto,
        secFetchDest: headers.get('sec-fetch-dest'),
        secFetchMode: headers.get('sec-fetch-mode'),
        secFetchSite: headers.get('sec-fetch-site')
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        allowIframeEmbedding: process.env.ALLOW_IFRAME_EMBEDDING
      }
    };

    // iframe埋め込み許可時は適切なヘッダーを設定
    const responseHeaders = new Headers();
    
    if (process.env.ALLOW_IFRAME_EMBEDDING === 'true') {
      responseHeaders.set('Content-Security-Policy', `frame-ancestors ${process.env.ALLOWED_FRAME_ANCESTORS || '*'}`);
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
      responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    
    return NextResponse.json(response, { headers: responseHeaders });

  } catch (error) {
    console.error("iframe test error:", error);
    return NextResponse.json(
      { 
        error: "iframe test failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
