import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// ScrollAreaとSeparatorは使用しないため、コメントアウト
// import { ScrollArea } from '@/components/ui/scroll-area';
// import { Separator } from '@/components/ui/separator';
import { 
  Bug, 
  Play, 
  Square, 
  Download, 
  Trash2, 
  Copy, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react';

interface DebugLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  step: string;
}

interface GaroonDebugModalProps {
  configId?: string;
  onClose?: () => void;
}

export const GaroonDebugModal: React.FC<GaroonDebugModalProps> = ({ 
  configId, 
  onClose 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [error, setError] = useState<string>('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const logLevelIcons = {
    info: <Info className="h-4 w-4 text-blue-500" />,
    success: <CheckCircle className="h-4 w-4 text-green-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />
  };

  const logLevelColors = {
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200'
  };

  const addLog = (level: DebugLog['level'], message: string, step: string, details?: any) => {
    const newLog: DebugLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('ja-JP'),
      level,
      message,
      step,
      details
    };
    
    setLogs(prev => [...prev, newLog]);
    
    // 自動スクロール
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
  };

  const runDebugTest = async () => {
    if (!configId) {
      setError('設定IDが指定されていません');
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setError('');
    setCurrentStep('');

    try {
      addLog('info', 'デバッグテストを開始します', '初期化');
      
      setCurrentStep('設定取得中...');
      addLog('info', 'Garoon設定を取得しています', '設定取得');
      
      // 相対URLを絶対URLに変換
      const baseUrl = window.location.origin;
      const configUrl = `${baseUrl}/api/settings/garoon/${configId}`;
      
      console.log('Config fetch URL:', configUrl);
      
      const configResponse = await fetch(configUrl);
      if (!configResponse.ok) {
        throw new Error('設定の取得に失敗しました');
      }
      const configResult = await configResponse.json();
      const config = configResult.setting; // APIレスポンスの構造に合わせる
      
      // ベースURLを計算
      const extractedBaseUrl = config.url.replace('/g/cabinet/index.csp?sp=0&hid=7', '')
                                         .replace('/g/cabinet/index.csp', '');
      
      addLog('success', `設定「${config.name}」を取得しました`, '設定取得', {
        configId: config.id,
        configName: config.name,
        url: config.url,
        baseUrl: extractedBaseUrl,
        soapUrl: `${extractedBaseUrl}/g/cbpapi/cabinet/api.csp?`,
        username: config.username,
        hasPassword: !!config.password,
        departmentId: config.departmentId
      });

      setCurrentStep('接続テスト中...');
      addLog('info', 'Garoon接続テストを実行しています', '接続テスト');
      
      const testResponse = await fetch('/api/settings/garoon/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: config.url,
          username: config.username,
          password: config.password
        })
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.json();
        throw new Error(errorData.message || '接続テストに失敗しました');
      }

      const testResult = await testResponse.json();
      addLog('success', '接続テストが成功しました', '接続テスト', testResult);

      setCurrentStep('フォルダ一覧取得中...');
      addLog('info', 'CabinetGetFolderInfoを実行しています', 'フォルダ一覧取得');
      
      // URLからhidを抽出
      const url = new URL(config.url);
      const hid = url.searchParams.get('hid') || '7'; // デフォルトは7
      
      // ベースURLを計算
      const folderBaseUrl = config.url.replace('/g/cabinet/index.csp?sp=0&hid=7', '')
                                     .replace('/g/cabinet/index.csp', '');
      
      addLog('info', `URLからhidパラメータを抽出: ${hid}`, 'フォルダ一覧取得', {
        originalUrl: config.url,
        extractedHid: hid,
        baseUrl: folderBaseUrl,
        soapUrl: `${folderBaseUrl}/g/cbpapi/cabinet/api.csp?`,
        soapMethod: 'CabinetGetFolderInfo',
        soapParameters: 'なし（フォルダ一覧取得）',
        pythonEquivalent: `get_folders(target_root_id='${hid}')`,
        expectedSoapStructure: '<cabinet:CabinetGetFolderInfo></cabinet:CabinetGetFolderInfo>',
        namespaces: {
          soap: 'http://www.w3.org/2003/05/soap-envelope',
          cabinet: 'http://wsdl.cybozu.co.jp/cabinet/2008'
        },
        pythonNamespaces: {
          soap: 'http://www.w3.org/2003/05/soap-envelope',
          cabinet: 'http://wsdl.cybozu.co.jp/cabinet/2008'
        }
      });
      
      // テストプログラムと同じ方式で直接SOAP呼び出し
      addLog('info', 'テストプログラムと同じ方式でSOAP呼び出しを実行', 'フォルダ一覧取得');
      
      const foldersResponse = await fetch(`${baseUrl}/api/garoon/test-simple`);
      
      // テストプログラムの結果を直接使用
      if (foldersResponse.ok) {
        const testResult = await foldersResponse.json();
        addLog('success', `テストプログラム経由で${testResult.folderCount || 0}件のフォルダを取得しました`, 'フォルダ一覧取得', {
          folderCount: testResult.folderCount || 0,
          folders: testResult.folders || [],
          testConfig: testResult.config
        });
      } else {
        // フォールバック: 通常のAPI呼び出し
        addLog('warning', 'テストプログラムが失敗、通常のAPI呼び出しにフォールバック', 'フォルダ一覧取得');
        
        const fallbackResponse = await fetch(`${baseUrl}/api/garoon/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configId: configId,
            // folderIdは指定しない（CabinetGetFolderInfoはパラメータなし）
          })
        });
        
        if (!fallbackResponse.ok) {
          const errorData = await fallbackResponse.json();
          throw new Error(errorData.message || 'フォルダ一覧の取得に失敗しました');
        }
        
        const fallbackResult = await fallbackResponse.json();
        addLog('success', `${fallbackResult.files?.length || 0}件のフォルダを取得しました`, 'フォルダ一覧取得', {
          folderCount: fallbackResult.files?.length || 0,
          folders: fallbackResult.files?.map((f: any) => ({ 
            name: f.name, 
            id: f.id, 
            isFolder: f.isFolder,
            type: f.type,
            size: f.size,
            modifiedDate: f.modifiedDate
          })) || []
        });
      }

      // ファイル取得はテストプログラムでは実装していないため、スキップ
      addLog('info', 'ファイル取得はテストプログラムでは実装していないためスキップ', 'ファイル一覧取得');

      setCurrentStep('完了');
      addLog('success', 'すべてのデバッグテストが完了しました', '完了');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      setError(errorMessage);
      addLog('error', errorMessage, currentStep || 'エラー');
      setCurrentStep('エラー');
    } finally {
      setIsRunning(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setError('');
    setCurrentStep('');
  };

  const copyLogsToClipboard = async () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()} [${log.step}] ${log.message}`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(logText);
      addLog('success', 'ログをクリップボードにコピーしました', 'ユーティリティ');
    } catch (error) {
      addLog('error', 'クリップボードへのコピーに失敗しました', 'ユーティリティ');
    }
  };

  const downloadLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()} [${log.step}] ${log.message}` +
      (log.details ? `\n詳細: ${JSON.stringify(log.details, null, 2)}` : '')
    ).join('\n\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garoon-debug-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLog('success', 'ログをファイルにダウンロードしました', 'ユーティリティ');
  };

  const loadCurrentConfig = async () => {
    if (!configId) {
      addLog('warning', '設定IDが指定されていません', '設定表示');
      return;
    }

    try {
      addLog('info', '現在のGaroon設定情報を取得しています', '設定表示');
      
      // 相対URLを絶対URLに変換
      const baseUrl = window.location.origin;
      const configUrl = `${baseUrl}/api/settings/garoon/${configId}`;
      
      console.log('Config fetch URL (loadCurrentConfig):', configUrl);
      
      const configResponse = await fetch(configUrl);
      if (!configResponse.ok) {
        throw new Error('設定の取得に失敗しました');
      }
      const configResult = await configResponse.json();
      const config = configResult.setting; // APIレスポンスの構造に合わせる
      
      // ベースURLを計算
      const displayBaseUrl = config.url ? config.url.replace('/g/cabinet/index.csp?sp=0&hid=7', '')
                                         .replace('/g/cabinet/index.csp', '') : 'URL未設定';
      
      addLog('info', '現在のGaroon設定情報', '設定表示', {
        configName: config.name || '設定名なし',
        url: config.url || 'URL未設定',
        baseUrl: displayBaseUrl,
        soapUrl: config.url ? `${displayBaseUrl}/g/cbpapi/cabinet/api.csp?` : 'URL未設定',
        username: config.username || 'ユーザー名未設定',
        password: config.password ? '***' : 'パスワード未設定',
        hasPassword: !!config.password,
        isActive: config.isActive,
        departmentName: config.departmentName || '部門未設定',
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        validation: {
          hasName: !!config.name,
          hasUrl: !!config.url,
          hasUsername: !!config.username,
          hasPassword: !!config.password,
          urlValue: config.url || 'undefined',
          usernameValue: config.username || 'undefined',
          passwordLength: config.password ? config.password.length : 0
        }
      });
      
    } catch (error) {
      console.error('Config load failed:', error);
      addLog('error', `設定の読み込みに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`, '設定表示');
    }
  };

  // モーダルが開かれた時に設定を読み込む
  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
    }
  }, [isOpen, configId]);

  const getStatusBadge = () => {
    if (isRunning) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Loader2 className="h-3 w-3 animate-spin mr-1" />実行中</Badge>;
    } else if (error) {
      return <Badge variant="destructive">エラー</Badge>;
    } else if (logs.some(log => log.level === 'success')) {
      return <Badge variant="default" className="bg-green-100 text-green-800">成功</Badge>;
    } else {
      return <Badge variant="outline">待機中</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          disabled={!configId}
        >
          <Bug className="h-4 w-4" />
          デバッグ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Garoon デバッグツール
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4">
          {/* コントロールパネル */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">コントロール</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={runDebugTest}
                  disabled={isRunning || !configId}
                  className="flex items-center gap-2"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isRunning ? '実行中...' : 'デバッグ実行'}
                </Button>

                <Button
                  onClick={clearLogs}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  ログクリア
                </Button>

                <Button
                  onClick={copyLogsToClipboard}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={logs.length === 0}
                >
                  <Copy className="h-4 w-4" />
                  コピー
                </Button>

                <Button
                  onClick={downloadLogs}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={logs.length === 0}
                >
                  <Download className="h-4 w-4" />
                  ダウンロード
                </Button>
              </div>

              {currentStep && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <strong>現在の処理:</strong> {currentStep}
                </div>
              )}

              {error && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  <strong>エラー:</strong> {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ログ表示エリア */}
          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                デバッグログ
                <Badge variant="outline">{logs.length}件</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-96 p-4 overflow-auto max-h-96" ref={scrollAreaRef}>
                {logs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Bug className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>デバッグログがありません</p>
                    <p className="text-sm mt-1">「デバッグ実行」ボタンをクリックしてテストを開始してください</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log, index) => (
                      <div key={log.id} className={`border rounded-lg p-3 ${logLevelColors[log.level]}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {logLevelIcons[log.level]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-600 font-mono">{log.timestamp}</span>
                              <Badge variant="outline" className="text-xs">
                                {log.step}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{log.message}</p>
                            {log.details && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                                  詳細を表示
                                </summary>
                                <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
