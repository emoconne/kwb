"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, AlertCircle, CheckCircle, Globe } from "lucide-react";

// iframe埋め込み専用ページ（認証不要）
export default function IframeEmbedPage() {
  const [iframeStatus, setIframeStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // iframe状況を確認
    const checkIframeStatus = async () => {
      try {
        const response = await fetch('/api/iframe-status');
        const data = await response.json();
        setIframeStatus(data);
      } catch (error) {
        console.error('Failed to check iframe status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkIframeStatus();
  }, []);

  const openMainApp = () => {
    window.open('/', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Globe className="w-6 h-6" />
              ChatGPT iframe埋め込み
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                このページはiframe埋め込み専用です。
              </p>
              
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>設定確認中...</span>
                </div>
              ) : iframeStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    {iframeStatus.iframe?.detected ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <span>
                      {iframeStatus.iframe?.detected ? 'iframe内で動作中' : '直接アクセス'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">埋め込み許可:</span>
                        <Badge variant={iframeStatus.iframe?.allowEmbedding ? "default" : "destructive"}>
                          {iframeStatus.iframe?.allowEmbedding ? '有効' : '無効'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">許可ドメイン:</span>
                        <Badge variant="outline">
                          {iframeStatus.iframe?.allowedFrameAncestors}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        <div>プロトコル: {iframeStatus.headers?.xForwardedProto}</div>
                        <div>リファラー: {iframeStatus.headers?.referer || '無し'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-red-500">
                  <AlertCircle className="w-5 h-5" />
                  <span>設定確認に失敗しました</span>
                </div>
              )}
            </div>
            
            <div className="text-center pt-4">
              <Button onClick={openMainApp} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                メインアプリを新しいタブで開く
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground text-center">
              iframe埋め込みでアクセスしている場合、一部の機能が制限される可能性があります。
              完全な機能を利用するには、上のボタンから直接アクセスしてください。
            </div>
          </CardContent>
        </Card>
        
        {/* デバッグ情報（開発環境のみ） */}
        {process.env.NODE_ENV === 'development' && iframeStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">デバッグ情報</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                {JSON.stringify(iframeStatus, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
