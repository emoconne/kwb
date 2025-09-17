import { NextRequest, NextResponse } from "next/server";

// iframe内での動作状況を確認するAPIエンドポイント
export async function GET(request: NextRequest) {
  try {
    const headers = request.headers;
    
    // iframe内からのアクセスかどうかを判定
    const isInIframe = headers.get('sec-fetch-dest') === 'iframe' || 
                      headers.get('sec-fetch-mode') === 'navigate' ||
                      headers.get('referer') !== null;
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      iframe: {
        detected: isInIframe,
        allowEmbedding: process.env.ALLOW_IFRAME_EMBEDDING === 'true',
        allowedFrameAncestors: process.env.ALLOWED_FRAME_ANCESTORS || '*'
      },
      headers: {
        referer: headers.get('referer'),
        secFetchDest: headers.get('sec-fetch-dest'),
        secFetchMode: headers.get('sec-fetch-mode'),
        secFetchSite: headers.get('sec-fetch-site'),
        userAgent: headers.get('user-agent'),
        xForwardedProto: headers.get('x-forwarded-proto')
      },
      message: isInIframe ? 'iframe内からのアクセスです' : '直接アクセスです'
    };

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/json');
    
    // CORSヘッダーを追加
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // iframe埋め込み許可時は適切なヘッダーを設定
    if (process.env.ALLOW_IFRAME_EMBEDDING === 'true') {
      responseHeaders.set('Content-Security-Policy', `frame-ancestors ${process.env.ALLOWED_FRAME_ANCESTORS || '*'}`);
      responseHeaders.set('X-Content-Type-Options', 'nosniff');
    }
    
    return NextResponse.json(response, { headers: responseHeaders });

  } catch (error) {
    console.error("iframe status check error:", error);
    return NextResponse.json(
      { 
        error: "iframe status check failed",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// OPTIONSリクエストに対応（CORS preflight）
export async function OPTIONS(request: NextRequest) {
  const responseHeaders = new Headers();
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return new NextResponse(null, { status: 200, headers: responseHeaders });
}
