import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  XCircle, 
  Settings, 
  TestTube, 
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  RefreshCw
} from 'lucide-react';
import { GaroonConfig } from '@/features/documents/garoon-file-service';
import { Department } from '@/features/documents/cosmos-db-dept-service';
import { GaroonSettingsService } from '@/features/documents/garoon-settings-service';

interface GaroonSettingsListProps {
  onConfigChange?: (configs: GaroonConfig[]) => void;
}

export const GaroonSettingsList: React.FC<GaroonSettingsListProps> = ({ onConfigChange }) => {
  const [configs, setConfigs] = useState<GaroonConfig[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingConfig, setEditingConfig] = useState<GaroonConfig | null>(null);
  const [formData, setFormData] = useState<Partial<GaroonConfig>>({
    name: '',
    url: 'https://jbccdemo.cybozu.com/g/cabinet/index.csp?sp=0&hid=7',
    username: '',
    password: '',
    departmentId: '',
    isActive: true
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const garoonService = GaroonSettingsService.getInstance();

  useEffect(() => {
    loadConfigs();
    loadDepartments();
  }, []);

  const loadConfigs = async () => {
    try {
      setIsLoading(true);
      const configsData = await garoonService.getGaroonSettings();
      setConfigs(configsData);
      onConfigChange?.(configsData);
    } catch (error) {
      console.error('設定一覧の読み込みエラー:', error);
      setErrorMessage('設定一覧の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const departmentsData = await garoonService.getDepartments();
      setDepartments(departmentsData);
    } catch (error) {
      console.error('部門一覧の読み込みエラー:', error);
    }
  };

  const handleInputChange = (field: keyof GaroonConfig, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleEdit = (config: GaroonConfig) => {
    setEditingConfig(config);
    setFormData({
      id: config.id,
      name: config.name,
      url: config.url,
      username: config.username,
      password: config.password,
      departmentId: config.departmentId,
      isActive: config.isActive
    });
    setIsEditing(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleCancelEdit = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      url: 'https://jbccdemo.cybozu.com/g/cabinet/index.csp?sp=0&hid=7',
      username: '',
      password: '',
      departmentId: '',
      isActive: true
    });
    setIsEditing(false);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSave = async () => {
    if (!formData.name || !formData.url || !formData.username || !formData.password) {
      setErrorMessage('設定名、URL、ユーザー名、パスワードは必須です');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const selectedDepartment = departments.find(d => d.id === formData.departmentId);
      const configToSave: GaroonConfig = {
        ...formData,
        departmentName: selectedDepartment?.name,
        isConnected: false,
        updatedAt: new Date().toISOString()
      } as GaroonConfig;

      console.log('設定保存開始:', { 
        name: configToSave.name, 
        url: configToSave.url, 
        username: configToSave.username,
        hasPassword: !!configToSave.password,
        departmentId: configToSave.departmentId 
      });

      if (editingConfig) {
        await garoonService.updateGaroonSetting(editingConfig.id!, configToSave);
        setSuccessMessage('設定が更新されました');
      } else {
        configToSave.createdAt = new Date().toISOString();
        await garoonService.saveGaroonSetting(configToSave);
        setSuccessMessage('設定が保存されました');
      }

      await loadConfigs();
      handleCancelEdit();
    } catch (error) {
      console.error('設定保存エラー:', error);
      
      // エラーメッセージの詳細化
      let errorMsg = '設定の保存に失敗しました';
      if (error instanceof Error) {
        if (error.message.includes('データベース接続設定が不完全')) {
          errorMsg = 'データベース接続設定が不完全です。管理者にお問い合わせください。';
        } else if (error.message.includes('データベースが見つかりません')) {
          errorMsg = 'データベースが見つかりません。管理者にお問い合わせください。';
        } else if (error.message.includes('データコンテナが見つかりません')) {
          errorMsg = 'データコンテナが見つかりません。管理者にお問い合わせください。';
        } else if (error.message.includes('アクセス権限がありません')) {
          errorMsg = 'データベースへのアクセス権限がありません。管理者にお問い合わせください。';
        } else {
          errorMsg = `設定の保存に失敗しました: ${error.message}`;
        }
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`設定「${name}」を削除しますか？`)) {
      return;
    }

    setIsLoading(true);
    try {
      await garoonService.deleteGaroonSetting(id);
      setSuccessMessage('設定が削除されました');
      await loadConfigs();
    } catch (error) {
      console.error('設定削除エラー:', error);
      setErrorMessage('設定の削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async (config: GaroonConfig) => {
    setConnectionStatus('testing');
    setErrorMessage('');
    
    try {
      const isConnected = await garoonService.testConnection(config);
      if (isConnected) {
        setConnectionStatus('success');
        setSuccessMessage(`設定「${config.name}」の接続テストが成功しました`);
        // 設定を更新して接続状態を保存
        await garoonService.updateGaroonSetting(config.id!, { isConnected: true });
        await loadConfigs();
      } else {
        setConnectionStatus('error');
        setErrorMessage(`設定「${config.name}」の接続テストに失敗しました`);
      }
    } catch (error) {
      console.error('接続テストエラー:', error);
      setConnectionStatus('error');
      setErrorMessage('接続テストに失敗しました');
    }
  };

  const getStatusIcon = (config: GaroonConfig) => {
    if (config.isConnected) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (config: GaroonConfig) => {
    return config.isConnected ? '接続済み' : '未接続';
  };

  const handleDebugInfo = async () => {
    try {
      const response = await fetch('/api/settings/garoon/debug');
      const data = await response.json();
      setDebugInfo(data);
      console.log('デバッグ情報:', data);
    } catch (error) {
      console.error('デバッグ情報取得エラー:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Garoon連携設定</h2>
          <p className="text-gray-600 mt-1">複数のGaroon環境との連携設定を管理します</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            新規設定
          </Button>
          <Button
            onClick={handleDebugInfo}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            デバッグ情報
          </Button>
        </div>
      </div>

      {/* メッセージ */}
      {errorMessage && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* デバッグ情報 */}
      {debugInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              デバッグ情報
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">環境変数</h4>
                <div className="bg-gray-100 p-3 rounded text-sm">
                  <div>AZURE_COSMOSDB_URI: {debugInfo.environmentVariables?.AZURE_COSMOSDB_URI}</div>
                  <div>AZURE_COSMOSDB_KEY: {debugInfo.environmentVariables?.AZURE_COSMOSDB_KEY}</div>
                  <div>AZURE_COSMOSDB_DB_NAME: {debugInfo.environmentVariables?.AZURE_COSMOSDB_DB_NAME}</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Cosmos DB接続状況</h4>
                <div className="bg-gray-100 p-3 rounded text-sm">
                  <div>ステータス: {debugInfo.cosmosConnection?.status}</div>
                  <div>データベース存在: {debugInfo.cosmosConnection?.databaseExists ? 'Yes' : 'No'}</div>
                  <div>コンテナ存在: {debugInfo.cosmosConnection?.containerExists ? 'Yes' : 'No'}</div>
                  {debugInfo.cosmosConnection?.error && (
                    <div className="text-red-600 mt-2">エラー: {debugInfo.cosmosConnection.error}</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 設定フォーム */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {editingConfig ? '設定を編集' : '新規設定'}
            </CardTitle>
            <CardDescription>
              Garoonシステムとの連携設定を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="config-name">設定名 *</Label>
                <Input
                  id="config-name"
                  placeholder="例: 本番環境"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="garoon-url">Garoon URL *</Label>
                <Input
                  id="garoon-url"
                  type="url"
                  placeholder="https://jbccdemo.cybozu.com/g/cabinet/index.csp?sp=0&hid=7"
                  value={formData.url || ''}
                  onChange={(e) => handleInputChange('url', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="garoon-username">ユーザー名 *</Label>
                <Input
                  id="garoon-username"
                  placeholder="ユーザー名を入力"
                  value={formData.username || ''}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="garoon-password">パスワード *</Label>
                <Input
                  id="garoon-password"
                  type="password"
                  placeholder="パスワードを入力"
                  value={formData.password || ''}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="department-select">部門</Label>
                <Select
                  value={formData.departmentId || ''}
                  onValueChange={(value) => handleInputChange('departmentId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="部門を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is-active"
                  checked={formData.isActive || false}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="rounded"
                  title="設定を有効にする"
                />
                <Label htmlFor="is-active">有効</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={isLoading || !formData.name || !formData.url || !formData.username || !formData.password}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    保存
                  </>
                )}
              </Button>
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 設定一覧 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                設定一覧
              </CardTitle>
              <CardDescription>
                {configs.length}件の設定が登録されています
              </CardDescription>
            </div>
            <Button
              onClick={loadConfigs}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              更新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-600">読み込み中...</span>
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>設定が登録されていません</p>
              <p className="text-sm mt-1">「新規設定」ボタンから設定を追加してください</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>設定名</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>ユーザー名</TableHead>
                    <TableHead>部門</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>有効</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{config.name}</TableCell>
                      <TableCell>
                        <span className="truncate block max-w-xs" title={config.url}>
                          {config.url}
                        </span>
                      </TableCell>
                      <TableCell>{config.username}</TableCell>
                      <TableCell>{config.departmentName || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(config)}
                          <span className="text-sm">{getStatusText(config)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.isActive ? 'default' : 'secondary'}>
                          {config.isActive ? '有効' : '無効'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestConnection(config)}
                            disabled={connectionStatus === 'testing'}
                            className="flex items-center gap-1"
                          >
                            <TestTube className="h-3 h-3" />
                            テスト
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(config)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 h-3" />
                            編集
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(config.id!, config.name)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-3 h-3" />
                            削除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
