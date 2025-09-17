import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Settings, TestTube } from 'lucide-react';
import { GaroonConfig } from '@/features/documents/garoon-file-service';

interface GaroonSettingsProps {
  onConfigChange?: (config: GaroonConfig) => void;
}

export const GaroonSettings: React.FC<GaroonSettingsProps> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<GaroonConfig>({
    url: 'https://jbccdemo.cybozu.com/g/cabinet/index.csp?sp=0&hid=7',
    username: '',
    password: '',
    isConnected: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // 保存された設定を読み込み
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/settings/garoon');
      if (response.ok) {
        const savedConfig = await response.json();
        console.log('Loaded Garoon config:', savedConfig);
        setConfig(savedConfig);
      } else {
        console.log('No saved Garoon config found, using defaults');
        // デフォルトの設定を設定
        setConfig({
          url: 'https://jbccdemo.cybozu.com/g/cabinet/index.csp?sp=0&hid=7',
          username: '',
          password: '',
          isConnected: false
        });
      }
    } catch (error) {
      console.error('Garoon設定の読み込みエラー:', error);
      // エラーの場合もデフォルト設定を使用
      setConfig({
        url: 'https://jbccdemo.cybozu.com/g/cabinet/index.csp?sp=0&hid=7',
        username: '',
        password: '',
        isConnected: false
      });
    }
  };

  const saveConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/garoon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        onConfigChange?.(config);
        setErrorMessage('');
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.message || '設定の保存に失敗しました');
      }
    } catch (error) {
      console.error('Garoon設定の保存エラー:', error);
      setErrorMessage('設定の保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    console.log('Test connection called with config:', {
      url: config.url,
      username: config.username,
      password: config.password ? '***' : 'empty'
    });

    if (!config.url || !config.username || !config.password) {
      const missingFields = [];
      if (!config.url) missingFields.push('URL');
      if (!config.username) missingFields.push('ユーザー名');
      if (!config.password) missingFields.push('パスワード');
      
      setErrorMessage(`${missingFields.join('、')}を入力してください`);
      return;
    }

    setConnectionStatus('testing');
    setErrorMessage('');

    try {
      console.log('Sending connection test request...');
      const response = await fetch('/api/settings/garoon/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: config.url,
          username: config.username,
          password: config.password,
        }),
      });

      console.log('Connection test response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Connection test successful:', result);
        setConnectionStatus('success');
        setConfig(prev => ({ ...prev, isConnected: true }));
      } else {
        const errorData = await response.json();
        console.error('Connection test failed:', errorData);
        setConnectionStatus('error');
        setErrorMessage(errorData.message || '接続テストに失敗しました');
      }
    } catch (error) {
      console.error('Garoon接続テストエラー:', error);
      setConnectionStatus('error');
      setErrorMessage(`接続テストに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

  const handleInputChange = (field: keyof GaroonConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value, isConnected: false }));
    setConnectionStatus('idle');
    setErrorMessage('');
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'testing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'testing':
        return '接続テスト中...';
      case 'success':
        return '接続成功';
      case 'error':
        return '接続失敗';
      default:
        return config.isConnected ? '接続済み' : '未接続';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Garoon連携設定
        </CardTitle>
        <CardDescription>
          Garoonシステムとの連携設定を行います。SOAP APIを使用してフォルダとファイル一覧を取得します。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 接続ステータス */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            {getConnectionStatusIcon()}
            <span className="text-sm font-medium">
              接続ステータス: {getConnectionStatusText()}
            </span>
          </div>
          <Button
            onClick={testConnection}
            disabled={connectionStatus === 'testing'}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            接続テスト
          </Button>
        </div>

        {/* エラーメッセージ */}
        {errorMessage && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* 設定フォーム */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="garoon-url">Garoon URL</Label>
            <Input
              id="garoon-url"
              type="url"
              placeholder="https://jbccdemo.cybozu.com/g/cabinet/index.csp?sp=0&hid=7"
              value={config.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              GaroonのキャビネットURLを入力してください
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="garoon-username">ユーザー名</Label>
            <Input
              id="garoon-username"
              type="text"
              placeholder="ユーザー名を入力"
              value={config.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="garoon-password">パスワード</Label>
            <Input
              id="garoon-password"
              type="password"
              placeholder="パスワードを入力"
              value={config.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={saveConfig}
            disabled={isLoading || !config.url || !config.username || !config.password}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                保存中...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4" />
                設定を保存
              </>
            )}
          </Button>
        </div>

        {/* 参考情報 */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">参考情報</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• GaroonのSOAP APIを使用してフォルダとファイル一覧を取得します</li>
            <li>• 接続テストを実行して設定が正しいことを確認してください</li>
            <li>• 設定は暗号化されて保存されます</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
