"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Activity,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Download,
  ChevronLeft,
  ChevronRight,
  Folder
} from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSession } from "next-auth/react";
import { useGlobalMessageContext } from "@/features/global-message/global-message-context";
import { Department } from "@/features/documents/cosmos-db-dept-service";
import { DepartmentTable } from "./department-table";
import { GaroonSettingsList } from "./garoon-settings-list";


interface DepartmentFormData {
  name: string;
  description: string;
  blobContainerName: string;
  isActive: boolean;
}

export const SettingsManagement = () => {
  const { data: session } = useSession();
  const { showSuccess, showError } = useGlobalMessageContext();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [containers, setContainers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<DepartmentFormData>({
    name: '',
    description: '',
    blobContainerName: '',
    isActive: true,
  });
  
  // BLOBコンテナ管理用の状態
  const [newContainerName, setNewContainerName] = useState('');
  const [isContainerLoading, setIsContainerLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionResult, setConnectionResult] = useState<any>(null);

  // レポート機能用の状態
  const [chatThreads, setChatThreads] = useState<any[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportPageNumber, setReportPageNumber] = useState(0);
  const [reportPageSize] = useState(10);
  const [hasMoreResults, setHasMoreResults] = useState(false);

  // グラフ機能用の状態
  const [graphData, setGraphData] = useState<any[]>([]);
  const [graphPeriod, setGraphPeriod] = useState<'daily' | 'monthly'>('daily');
  const [isGraphLoading, setIsGraphLoading] = useState(false);





  // 部門一覧を取得
  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      } else {
        const errorData = await response.json();
        showError(errorData.error || '部門一覧の取得に失敗しました');
      }
    } catch (error) {
      showError('部門一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // BLOBコンテナ一覧を取得
  const fetchContainers = async () => {
    try {
      const response = await fetch('/api/settings/containers');
      if (response.ok) {
        const data = await response.json();
        setContainers(data.containers || []);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'コンテナ一覧の取得に失敗しました');
      }
    } catch (error) {
      showError('コンテナ一覧の取得に失敗しました');
    }
  };

  // BLOBコンテナ接続テスト
  const testConnection = async () => {
    try {
      setIsContainerLoading(true);
      setConnectionStatus('testing');
      setConnectionResult(null);
      
      const response = await fetch('/api/settings/containers/test', {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus('success');
        setConnectionResult(data);
        showSuccess({
          title: '接続テスト',
          description: '接続テストが成功しました'
        });
      } else {
        const errorData = await response.json();
        setConnectionStatus('error');
        setConnectionResult(errorData);
        showError(errorData.error || '接続テストに失敗しました');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionResult({ error: '接続テストに失敗しました' });
      showError('接続テストに失敗しました');
    } finally {
      setIsContainerLoading(false);
    }
  };

  // BLOBコンテナを追加
  const addContainer = async () => {
    if (!newContainerName.trim()) {
              showError('コンテナ名を入力してください');
      return;
    }

    try {
      setIsContainerLoading(true);
      
      const response = await fetch('/api/settings/containers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newContainerName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
                  showSuccess({
            title: 'コンテナ作成',
            description: data.message || 'コンテナが作成されました'
          });
        setNewContainerName('');
        fetchContainers();
      } else {
        const errorData = await response.json();
                  showError(errorData.error || 'コンテナの作成に失敗しました');
        }
      } catch (error) {
        showError('コンテナの作成に失敗しました');
    } finally {
      setIsContainerLoading(false);
    }
  };

  // BLOBコンテナを削除
  const deleteContainer = async (containerName: string) => {
    if (!confirm(`コンテナ「${containerName}」を削除しますか？\n\n注意: この操作は取り消せません。`)) {
      return;
    }

    try {
      setIsContainerLoading(true);
      
      const response = await fetch(`/api/settings/containers?name=${encodeURIComponent(containerName)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
                  showSuccess({
            title: 'コンテナ削除',
            description: data.message || 'コンテナが削除されました'
          });
        fetchContainers();
      } else {
        const errorData = await response.json();
                  showError(errorData.error || 'コンテナの削除に失敗しました');
        }
      } catch (error) {
        showError('コンテナの削除に失敗しました');
    } finally {
      setIsContainerLoading(false);
    }
  };

  // レポート機能 - チャット履歴を取得
  const fetchChatThreads = async (pageNumber: number = 0) => {
    try {
      setIsReportLoading(true);
      const response = await fetch(`/api/reporting?pageSize=${reportPageSize}&pageNumber=${pageNumber}`);
      if (response.ok) {
        const data = await response.json();
        setChatThreads(data.resources || []);
        setHasMoreResults(data.resources && data.resources.length === reportPageSize);
        setReportPageNumber(pageNumber);
      } else {
                  showError('チャット履歴の取得に失敗しました');
        }
      } catch (error) {
        showError('チャット履歴の取得に失敗しました');
    } finally {
      setIsReportLoading(false);
    }
  };

  // グラフ機能 - 利用状況データを取得
  const fetchGraphData = async () => {
    try {
      setIsGraphLoading(true);
      const response = await fetch(`/api/reporting/graph?period=${graphPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setGraphData(data.data || []);
      } else {
                  showError('利用状況データの取得に失敗しました');
        }
      } catch (error) {
        showError('利用状況データの取得に失敗しました');
    } finally {
      setIsGraphLoading(false);
    }
  };





  // CSVダウンロード
  const downloadCSV = async () => {
    try {
      const response = await fetch('/api/reporting/csv');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        showError('CSVダウンロードに失敗しました');
      }
    } catch (error) {
      showError('CSVダウンロードに失敗しました');
    }
  };

  // 部門を保存
  const handleSaveDepartment = async () => {
    if (!formData.name || !formData.blobContainerName) {
              showError('部門名とBLOBコンテナ名は必須です');
      return;
    }

    try {
      setIsLoading(true);
      
      const url = editingDepartment 
        ? '/api/settings/departments' 
        : '/api/settings/departments';
      
      const method = editingDepartment ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingDepartment 
          ? { id: editingDepartment.id, ...formData }
          : formData
        ),
      });

      if (response.ok) {
        const data = await response.json();
        showSuccess({
          title: '部門管理',
          description: data.message || (editingDepartment ? '部門が更新されました' : '部門が作成されました')
        });
        
        setFormData({
          name: '',
          description: '',
          blobContainerName: '',
          isActive: true,
        });
        setEditingDepartment(null);
        setIsEditing(false);
        fetchDepartments();
      } else {
        const errorData = await response.json();
                  showError(errorData.error || '部門の保存に失敗しました');
        }
      } catch (error) {
        showError('部門の保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 部門を削除
  const handleDeleteDepartment = async (departmentId: string) => {
    if (!confirm('この部門を削除しますか？')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/settings/departments?id=${departmentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        showSuccess({
          title: '部門削除',
          description: data.message || '部門が削除されました'
        });
        fetchDepartments();
      } else {
        const errorData = await response.json();
                  showError(errorData.error || '部門の削除に失敗しました');
        }
      } catch (error) {
        console.error('Delete department error:', error);
        showError('部門の削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 編集モードを開始
  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      blobContainerName: department.blobContainerName,
      isActive: department.isActive,
    });
    setIsEditing(true);
  };

  // 編集をキャンセル
  const handleCancelEdit = () => {
    setEditingDepartment(null);
    setFormData({
      name: '',
      description: '',
      blobContainerName: '',
      isActive: true,
    });
    setIsEditing(false);
  };

  // 部門の並び替え処理
  const handleDepartmentReorder = async (reorderedDepartments: Department[]) => {
    try {
      const response = await fetch('/api/settings/departments/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          departments: reorderedDepartments.map((dept, index) => ({
            id: dept.id,
            sortOrder: index + 1
          }))
        }),
      });

      if (response.ok) {
        setDepartments(reorderedDepartments);
        showSuccess({
          title: '並び替え完了',
          description: '部門の並び替えが完了しました'
        });
      } else {
        const errorData = await response.json();
        showError(errorData.error || '部門の並び替えに失敗しました');
      }
    } catch (error) {
      showError('部門の並び替えに失敗しました');
    }
  };



  useEffect(() => {
    fetchDepartments();
    fetchContainers();
    fetchChatThreads();
    fetchGraphData();
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [graphPeriod]);

  if (!session?.user?.isAdmin) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">アクセス権限がありません</h2>
              <p className="text-muted-foreground">この機能は管理者のみが利用できます。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl p-6 pb-12 space-y-6 h-screen">
      <div>
        <h1 className="text-3xl font-bold mb-2">システム設定</h1>
        <p className="text-muted-foreground">
          システムの各種設定を管理します
        </p>
      </div>

      <Tabs defaultValue="logs" className="space-y-6 h-[calc(100vh-200px)] overflow-y-auto">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            利用ログ
          </TabsTrigger>
          <TabsTrigger value="graph" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            利用状況グラフ
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            部門設定
          </TabsTrigger>
          <TabsTrigger value="garoon" className="flex items-center gap-2">
            <Folder className="w-4 h-4" />
            Garoon連携
          </TabsTrigger>
        </TabsList>

        {/* 部門設定タブ */}
        <TabsContent value="departments" className="space-y-6 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  部門設定
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">
                    有効
                  </label>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 部門追加・編集フォーム */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">部門名 *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="部門名を入力"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">BLOBコンテナ名 *</label>
                  <Input
                    value={formData.blobContainerName}
                    onChange={(e) => setFormData({ ...formData, blobContainerName: e.target.value })}
                    placeholder="コンテナ名を入力"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">説明</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="部門の説明を入力"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveDepartment}
                  disabled={isLoading || (!formData.name || !formData.blobContainerName)}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingDepartment ? '更新' : '追加'}
                </Button>
                {isEditing && (
                  <Button 
                    onClick={handleCancelEdit}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    キャンセル
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 部門一覧 */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">読み込み中...</p>
                </div>
              ) : (
                <DepartmentTable
                  departments={departments}
                  onEdit={handleEditDepartment}
                  onDelete={handleDeleteDepartment}
                  onReorder={handleDepartmentReorder}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>




        {/* 利用ログタブ */}
        <TabsContent value="logs" className="space-y-6 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                利用ログ
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button onClick={downloadCSV} variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  CSVダウンロード
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isReportLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">読み込み中...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>会話日時</TableHead>
                        <TableHead className="w-[200px]">ユーザー名</TableHead>
                        <TableHead className="w-[300px]">タイトル</TableHead>
                        <TableHead className="w-[150px]">チャットタイプ</TableHead>
                        <TableHead className="w-[200px]">チャットドキュメント</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chatThreads.map((chatThread) => (
                        <TableRow key={chatThread.id}>
                          <TableCell>
                            <Link href={`/reporting/${chatThread.id}`} className="hover:underline">
                              {new Date(chatThread.createdAt).toLocaleDateString("ja-JP")} {new Date(chatThread.createdAt).toLocaleTimeString()}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/reporting/${chatThread.id}`} className="hover:underline">
                              {chatThread.useName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/reporting/${chatThread.id}`} className="hover:underline">
                              {chatThread.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/reporting/${chatThread.id}`} className="hover:underline">
                              {chatThread.chatType || '-'}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/reporting/${chatThread.id}`} className="hover:underline">
                              {chatThread.chatDoc || '-'}
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex gap-2 justify-end">
                    {reportPageNumber > 0 && (
                      <Button onClick={() => fetchChatThreads(reportPageNumber - 1)} size="sm" variant="outline">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                    )}
                    {hasMoreResults && (
                      <Button onClick={() => fetchChatThreads(reportPageNumber + 1)} size="sm" variant="outline">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>




        {/* Garoon連携タブ */}
        <TabsContent value="garoon" className="space-y-6 pb-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* Garoon設定一覧 */}
          <GaroonSettingsList onConfigChange={(configs) => {
            // 設定変更時の処理（必要に応じて追加）
            console.log('Garoon設定が変更されました:', configs);
          }} />
        </TabsContent>

        {/* 利用状況グラフタブ */}
        <TabsContent value="graph" className="space-y-6 pb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                利用状況グラフ
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setGraphPeriod('daily')} 
                  variant={graphPeriod === 'daily' ? 'default' : 'outline'} 
                  size="sm"
                >
                  日別
                </Button>
                <Button 
                  onClick={() => setGraphPeriod('monthly')} 
                  variant={graphPeriod === 'monthly' ? 'default' : 'outline'} 
                  size="sm"
                >
                  月別
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isGraphLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">読み込み中...</p>
                </div>
              ) : (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
