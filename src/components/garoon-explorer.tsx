import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Folder, 
  File, 
  Download, 
  ArrowLeft, 
  RefreshCw, 
  Settings,
  Home,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { GaroonConfig } from '@/features/documents/garoon-file-service';
import { GaroonSettingsService } from '@/features/documents/garoon-settings-service';
import { GaroonDebugModal } from '@/components/garoon-debug-modal';

interface GaroonFileInfo {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  size?: string;
  updatedAt: string;
  version?: string;
  depth: number;
  url?: string;
  mimeType?: string;
}

interface GaroonExplorerProps {
  onFileSelect?: (file: GaroonFileInfo) => void;
  onFolderSelect?: (folder: GaroonFileInfo) => void;
}

export const GaroonExplorer: React.FC<GaroonExplorerProps> = ({ 
  onFileSelect, 
  onFolderSelect 
}) => {
  const [configs, setConfigs] = useState<GaroonConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<GaroonConfig | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [files, setFiles] = useState<GaroonFileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  const garoonService = GaroonSettingsService.getInstance();

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (selectedConfig) {
      loadFiles();
    }
  }, [selectedConfig, currentPath]);

  const loadConfigs = async () => {
    try {
      setIsLoading(true);
      const configsData = await garoonService.getGaroonSettings();
      const activeConfigs = configsData.filter(config => config.isActive);
      setConfigs(activeConfigs);
      
      if (activeConfigs.length > 0 && !selectedConfig) {
        setSelectedConfig(activeConfigs[0]);
      }
    } catch (error) {
      console.error('設定一覧の読み込みエラー:', error);
      setErrorMessage('設定一覧の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFiles = async () => {
    if (!selectedConfig) return;

    try {
      setIsLoading(true);
      setErrorMessage('');
      
      console.log('=== GaroonExplorer Debug ===');
      console.log('Selected Config:', selectedConfig);
      console.log('Current Path:', currentPath);
      
      const requestBody = {
        configId: selectedConfig.id,
        path: currentPath
      };
      console.log('Request Body:', requestBody);
      
      const response = await fetch('/api/garoon/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response Status:', response.status);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const data = await response.json();
        console.log('Response Data:', data);
        setFiles(data.files || []);
        setSuccessMessage(`${data.files?.length || 0}件のアイテムを取得しました`);
      } else {
        const errorData = await response.json();
        console.error('Error Response:', errorData);
        setErrorMessage(errorData.message || 'ファイル一覧の取得に失敗しました');
      }
    } catch (error) {
      console.error('ファイル一覧取得エラー:', error);
      setErrorMessage('ファイル一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (configId: string) => {
    const config = configs.find(c => c.id === configId);
    if (config) {
      setSelectedConfig(config);
      setCurrentPath('/');
      setPathHistory([]);
      setFiles([]);
    }
  };

  const handleFolderClick = async (folder: GaroonFileInfo) => {
    if (onFolderSelect) {
      onFolderSelect(folder);
    }
    
    // フォルダIDを使用してファイル一覧を取得
    if (folder.id) {
      try {
        setIsLoading(true);
        setErrorMessage('');
        
        const response = await fetch('/api/garoon/files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            configId: selectedConfig?.id,
            folderId: folder.id
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setFiles(data.files || []);
          setSuccessMessage(`${data.files?.length || 0}件のファイルを取得しました`);
          
          // パス履歴を更新
          const newPath = folder.path === '/' ? folder.name : `${currentPath}/${folder.name}`;
          setPathHistory([...pathHistory, currentPath]);
          setCurrentPath(newPath);
        } else {
          const errorData = await response.json();
          setErrorMessage(errorData.message || 'ファイル一覧の取得に失敗しました');
        }
      } catch (error) {
        console.error('フォルダ内ファイル取得エラー:', error);
        setErrorMessage('ファイル一覧の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFileClick = (file: GaroonFileInfo) => {
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleBackClick = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setCurrentPath(previousPath);
      setPathHistory(pathHistory.slice(0, -1));
    } else {
      setCurrentPath('/');
    }
  };

  const handleHomeClick = () => {
    setCurrentPath('/');
    setPathHistory([]);
  };

  const handleDownload = async (file: GaroonFileInfo) => {
    if (!selectedConfig) return;

    try {
      const response = await fetch('/api/garoon/files/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configId: selectedConfig.id,
          filePath: file.path
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setSuccessMessage(`ファイル「${file.name}」をダウンロードしました`);
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.message || 'ファイルのダウンロードに失敗しました');
      }
    } catch (error) {
      console.error('ファイルダウンロードエラー:', error);
      setErrorMessage('ファイルのダウンロードに失敗しました');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ja-JP');
  };

  const getPathBreadcrumb = () => {
    if (currentPath === '/') return ['ホーム'];
    return ['ホーム', ...currentPath.split('/').filter(Boolean)];
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Garoonドキュメント管理</h2>
          <p className="text-gray-600 mt-1">Garoonシステムからドキュメントを閲覧・ダウンロードします</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedConfig?.id || ''}
            onValueChange={handleConfigChange}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Garoon設定を選択" />
            </SelectTrigger>
            <SelectContent>
              {configs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  <div className="flex items-center gap-2">
                    <span>{config.name}</span>
                    <Badge variant={config.isConnected ? 'default' : 'secondary'} className="text-xs">
                      {config.isConnected ? '接続済み' : '未接続'}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={loadFiles}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            更新
          </Button>
          <GaroonDebugModal configId={selectedConfig?.id} />
        </div>
      </div>

      {/* メッセージ */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {!selectedConfig ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Garoon設定を選択してください</p>
              <p className="text-sm mt-1">まず設定画面でGaroon設定を作成してください</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* パスナビゲーション */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleHomeClick}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Home className="h-4 w-4" />
                  ホーム
                </Button>
                {pathHistory.length > 0 && (
                  <Button
                    onClick={handleBackClick}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    戻る
                  </Button>
                )}
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  {getPathBreadcrumb().map((segment, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && <ChevronRight className="h-4 w-4" />}
                      <span>{segment}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ファイル一覧 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                ファイル一覧
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <CardDescription>
                {selectedConfig.name} - {files.length}件のアイテム
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600">読み込み中...</span>
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Folder className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>フォルダが空です</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {files.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => item.isFolder ? handleFolderClick(item) : handleFileClick(item)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {item.isFolder ? (
                            <Folder className="h-8 w-8 text-blue-500" />
                          ) : (
                            <File className="h-8 w-8 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate" title={item.name}>
                            {item.name}
                          </h3>
                          <div className="text-xs text-gray-500 mt-1">
                            {!item.isFolder && (
                              <>
                                <div>サイズ: {item.size || '-'}</div>
                                <div>更新日: {formatDate(item.updatedAt)}</div>
                              </>
                            )}
                            {item.isFolder && (
                              <div>フォルダ</div>
                            )}
                          </div>
                        </div>
                        {!item.isFolder && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(item);
                            }}
                            className="flex-shrink-0"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};