const fs = require('fs');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    esmExternals: 'loose'
  },
  // HTTPS設定（開発環境用）
  ...(process.env.NODE_ENV === 'development' && {
    server: {
      https: {
        key: fs.readFileSync(path.join(__dirname, 'certs/localhost+2-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'certs/localhost+2.pem')),
      },
    },
  }),
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'node-fetch': 'commonjs node-fetch'
      });
    }
    return config;
  },
  async headers() {
    // iframe埋め込み許可の設定（環境変数で制御可能）
    const allowIframeEmbedding = process.env.ALLOW_IFRAME_EMBEDDING === 'true';
    const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS || '*';
    
    console.log('Next.js headers config:', {
      allowIframeEmbedding,
      allowedFrameAncestors,
      nodeEnv: process.env.NODE_ENV
    });
    
    const headers = [];
    
    if (allowIframeEmbedding) {
      // iframe埋め込みを許可する場合
      console.log('Setting iframe-friendly headers');
      
      // X-Frame-Optionsヘッダーを明示的に削除（設定しない）
      // Content-Security-Policyでframe-ancestorsを設定
      headers.push({
        key: 'Content-Security-Policy',
        value: `frame-ancestors ${allowedFrameAncestors}; default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data: https:;`
      });
      
      // iframe内での動作を改善するため、追加のヘッダーを設定
      headers.push({
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      });
      headers.push({
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      });
      
      // CORSヘッダーを追加
      headers.push({
        key: 'Access-Control-Allow-Origin',
        value: '*'
      });
      headers.push({
        key: 'Access-Control-Allow-Methods',
        value: 'GET, POST, OPTIONS'
      });
      headers.push({
        key: 'Access-Control-Allow-Headers',
        value: 'Content-Type, Authorization'
      });
      
    } else {
      // iframe埋め込みを制限する場合（デフォルト）
      console.log('Setting restrictive iframe headers');
      
      headers.push({
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      });
      headers.push({
        key: 'Content-Security-Policy',
        value: "frame-ancestors 'self' https://view.officeapps.live.com https://docs.google.com"
      });
    }
    
    console.log('Final headers configuration:', headers);
    
    return [
      {
        source: '/(.*)',
        headers: headers
      }
    ];
  }
};

module.exports = nextConfig;
