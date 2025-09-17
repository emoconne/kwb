import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const allowIframeEmbedding = process.env.ALLOW_IFRAME_EMBEDDING === 'true';
    const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS || '*';

    // レスポンスヘッダーを設定
    const responseHeaders = new Headers();
    
    if (allowIframeEmbedding) {
      // X-Frame-Optionsを明示的に設定しない（削除）
      responseHeaders.set('Content-Security-Policy', 
        `frame-ancestors ${allowedFrameAncestors}; default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data: https:;`
      );
      
      // CORSヘッダーを追加
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    } else {
      responseHeaders.set('X-Frame-Options', 'SAMEORIGIN');
      responseHeaders.set('Content-Security-Policy', "frame-ancestors 'self'");
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      config: {
        allowIframeEmbedding,
        allowedFrameAncestors,
        nodeEnv: process.env.NODE_ENV
      },
      headers: {
        'X-Frame-Options': responseHeaders.get('X-Frame-Options'),
        'Content-Security-Policy': responseHeaders.get('Content-Security-Policy'),
        'Access-Control-Allow-Origin': responseHeaders.get('Access-Control-Allow-Origin')
      },
      message: allowIframeEmbedding ? 'iframe埋め込み許可設定' : 'iframe埋め込み制限設定'
    };

    return NextResponse.json(response, { headers: responseHeaders });
    
  } catch (error) {
    console.error("headers test error:", error);
    return NextResponse.json(
      { 
        error: "headers test failed",
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
