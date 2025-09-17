import { NextRequest, NextResponse } from 'next/server';
import { GaroonFileService } from '@/features/documents/garoon-file-service';
import { GaroonSettingsService } from '@/features/documents/garoon-settings-service';
import { CosmosContainerHelper } from '@/features/documents/cosmos-container-helper';

interface DebugStep {
  step: string;
  status: 'running' | 'success' | 'error';
  message: string;
  details?: any;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  const debugSteps: DebugStep[] = [];
  
  try {
    const { configId } = await request.json();
    
    console.log('=== Garoon Debug API Start ===');
    console.log('ConfigId:', configId);
    
    // ステップ0: CosmosDB接続確認
    debugSteps.push({
      step: 'cosmos_check',
      status: 'running',
      message: 'CosmosDB接続状況を確認しています...',
      timestamp: new Date().toISOString()
    });

    try {
      const cosmosHelper = CosmosContainerHelper.getInstance();
      const container = await cosmosHelper.ensureContainer('garoon');
      
      debugSteps.push({
        step: 'cosmos_check',
        status: 'success',
        message: 'CosmosDB接続が正常です',
        details: {
          containerId: 'garoon',
          databaseId: process.env.AZURE_COSMOSDB_DB_NAME || 'azurechat',
          hasEndpoint: !!process.env.AZURE_COSMOSDB_URI,
          hasKey: !!process.env.AZURE_COSMOSDB_KEY
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      debugSteps.push({
        step: 'cosmos_check',
        status: 'error',
        message: 'CosmosDB接続に失敗しました',
        details: {
          error: error instanceof Error ? error.message : String(error),
          endpoint: process.env.AZURE_COSMOSDB_URI ? '設定済み' : '未設定',
          key: process.env.AZURE_COSMOSDB_KEY ? '設定済み' : '未設定',
          database: process.env.AZURE_COSMOSDB_DB_NAME || '未設定'
        },
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({
        success: false,
        steps: debugSteps,
        error: 'CosmosDB接続に失敗しました'
      });
    }
    
    if (!configId) {
      debugSteps.push({
        step: 'validation',
        status: 'error',
        message: '設定IDが指定されていません',
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({
        success: false,
        steps: debugSteps,
        error: '設定IDが必要です'
      });
    }

    // ステップ1: 設定取得
    debugSteps.push({
      step: 'config_retrieval',
      status: 'running',
      message: 'Garoon設定を取得しています...',
      timestamp: new Date().toISOString()
    });

    console.log('=== Debug: Getting Garoon Setting ===');
    console.log('ConfigId:', configId);
    console.log('ConfigId type:', typeof configId);

    const garoonSettingsService = GaroonSettingsService.getInstance();
    
    // CosmosDBから全設定を取得して確認
    debugSteps.push({
      step: 'config_list',
      status: 'running',
      message: 'CosmosDBから全設定一覧を取得しています...',
      timestamp: new Date().toISOString()
    });

    try {
      // 直接CosmosDBから設定一覧を取得
      const cosmosHelper = CosmosContainerHelper.getInstance();
      const container = await cosmosHelper.ensureContainer('garoon', '/id');
      
      const { resources: allConfigs } = await container.items.readAll().fetchAll();
      console.log('Direct CosmosDB All Configs:', allConfigs);
      
      debugSteps.push({
        step: 'config_list',
        status: 'success',
        message: `${allConfigs.length}件の設定が見つかりました`,
        details: {
          totalConfigs: allConfigs.length,
          configIds: allConfigs.map((c: any) => ({ 
            id: c.id, 
            name: c.name,
            url: c.url,
            username: c.username,
            hasPassword: !!c.password
          }))
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      debugSteps.push({
        step: 'config_list',
        status: 'error',
        message: '設定一覧の取得に失敗しました',
        details: {
          error: error instanceof Error ? error.message : String(error)
        },
        timestamp: new Date().toISOString()
      });
    }

    // 特定の設定を取得（直接CosmosDBから）
    debugSteps.push({
      step: 'config_specific',
      status: 'running',
      message: `設定ID「${configId}」の詳細を取得しています...`,
      timestamp: new Date().toISOString()
    });

    let config: any = null;
    try {
      const cosmosHelper = CosmosContainerHelper.getInstance();
      const container = await cosmosHelper.ensureContainer('garoon', '/id');
      
      const { resource } = await container.item(configId, configId).read();
      config = resource;
      
      console.log('Direct CosmosDB Retrieved Config:', config);
      console.log('Config details:', {
        id: config?.id,
        name: config?.name,
        url: config?.url,
        username: config?.username,
        hasPassword: !!config?.password,
        isActive: config?.isActive
      });
      
      debugSteps.push({
        step: 'config_direct',
        status: 'success',
        message: 'CosmosDBから直接設定を取得しました',
        details: {
          config: config,
          rawConfig: JSON.stringify(config, null, 2),
          hasUrl: !!config?.url,
          hasUsername: !!config?.username,
          hasPassword: !!config?.password,
          configKeys: config ? Object.keys(config) : []
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (directError) {
      debugSteps.push({
        step: 'config_direct',
        status: 'error',
        message: 'CosmosDBからの直接取得に失敗しました',
        details: {
          error: directError instanceof Error ? directError.message : String(directError)
        },
        timestamp: new Date().toISOString()
      });
      
      // フォールバック: API経由で取得
      debugSteps.push({
        step: 'config_api_fallback',
        status: 'running',
        message: 'API経由で設定を取得しています...',
        timestamp: new Date().toISOString()
      });
      
      try {
        config = await garoonSettingsService.getGaroonSetting(configId);
        console.log('API Retrieved Config:', config);
        
        debugSteps.push({
          step: 'config_api_fallback',
          status: 'success',
          message: 'API経由で設定を取得しました',
          details: {
            config: config
          },
          timestamp: new Date().toISOString()
        });
      } catch (apiError) {
        debugSteps.push({
          step: 'config_api_fallback',
          status: 'error',
          message: 'API経由の取得にも失敗しました',
          details: {
            error: apiError instanceof Error ? apiError.message : String(apiError)
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (!config) {
      debugSteps.push({
        step: 'config_specific',
        status: 'error',
        message: '指定された設定が見つかりません',
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({
        success: false,
        steps: debugSteps,
        error: '設定が見つかりません'
      });
    }

    // 設定値の検証
    debugSteps.push({
      step: 'config_validation',
      status: 'running',
      message: '設定値の検証を実行しています...',
      details: {
        validationCheck: {
          url: { value: config.url, hasValue: !!config.url },
          username: { value: config.username, hasValue: !!config.username },
          password: { hasValue: !!config.password, length: config.password ? config.password.length : 0 },
          name: { value: config.name, hasValue: !!config.name }
        }
      },
      timestamp: new Date().toISOString()
    });

    const validationErrors = [];
    if (!config.url) validationErrors.push('URLが設定されていません');
    if (!config.username) validationErrors.push('ユーザー名が設定されていません');
    if (!config.password) validationErrors.push('パスワードが設定されていません');

    if (validationErrors.length > 0) {
      debugSteps.push({
        step: 'config_validation',
        status: 'error',
        message: '設定値に不備があります',
        details: {
          errors: validationErrors,
          fullConfig: config,
          validationDetails: {
            url: { 
              value: config.url, 
              type: typeof config.url,
              isEmpty: !config.url || config.url.trim() === ''
            },
            username: { 
              value: config.username, 
              type: typeof config.username,
              isEmpty: !config.username || config.username.trim() === ''
            },
            password: { 
              hasValue: !!config.password,
              type: typeof config.password,
              length: config.password ? config.password.length : 0,
              isEmpty: !config.password || config.password.trim() === ''
            },
            name: { 
              value: config.name, 
              type: typeof config.name,
              isEmpty: !config.name || config.name.trim() === ''
            }
          }
        },
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({
        success: false,
        steps: debugSteps,
        error: validationErrors.join(', ')
      });
    }

    debugSteps.push({
      step: 'config_validation',
      status: 'success',
      message: '設定値の検証が完了しました',
      timestamp: new Date().toISOString()
    });

    debugSteps.push({
      step: 'config_retrieval',
      status: 'success',
      message: `設定「${config.name || '名前なし'}」を取得しました`,
      details: {
        rawConfig: JSON.stringify(config, null, 2),
        configDetails: {
          id: config.id,
          name: config.name,
          url: config.url,
          username: config.username,
          password: config.password ? '***' : '未設定',
          hasPassword: !!config.password,
          isActive: config.isActive,
          departmentId: config.departmentId,
          departmentName: config.departmentName,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        },
        validationResults: {
          hasName: !!config.name,
          hasUrl: !!config.url,
          hasUsername: !!config.username,
          hasPassword: !!config.password,
          nameValue: config.name || 'undefined',
          urlValue: config.url || 'undefined',
          usernameValue: config.username || 'undefined',
          passwordLength: config.password ? config.password.length : 0
        }
      },
      timestamp: new Date().toISOString()
    });

    // ステップ2: 接続テスト
    debugSteps.push({
      step: 'connection_test',
      status: 'running',
      message: 'Garoon接続テストを実行しています...',
      timestamp: new Date().toISOString()
    });

    const garoonService = GaroonFileService.getInstance();
    const garoonConfig = {
      url: config.url,
      username: config.username,
      password: config.password,
      isConnected: false,
      isActive: false,
      name: config.name
    };
    
    garoonService.setConfig(garoonConfig);
    
    debugSteps.push({
      step: 'service_config',
      status: 'success',
      message: 'GaroonFileServiceに設定を設定しました',
      details: {
        config: garoonConfig
      },
      timestamp: new Date().toISOString()
    });

    const connectionTest = await garoonService.testConnection();
    
    if (!connectionTest) {
      debugSteps.push({
        step: 'connection_test',
        status: 'error',
        message: '接続テストに失敗しました',
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({
        success: false,
        steps: debugSteps,
        error: '接続テストに失敗しました'
      });
    }

    debugSteps.push({
      step: 'connection_test',
      status: 'success',
      message: '接続テストが成功しました',
      details: {
        url: config.url,
        testResult: 'Connected successfully'
      },
      timestamp: new Date().toISOString()
    });

    // ステップ3: フォルダ一覧取得
    debugSteps.push({
      step: 'folder_list',
      status: 'running',
      message: 'CabinetGetFolderInfoを実行しています...',
      timestamp: new Date().toISOString()
    });

    try {
      const folders = await garoonService.getCabinetList(garoonConfig);

      debugSteps.push({
        step: 'folder_list',
        status: 'success',
        message: `${folders.length}件のフォルダを取得しました`,
        details: {
          folderCount: folders.length,
          folders: folders.slice(0, 5).map(f => ({
            id: f.id,
            name: f.name,
            isFolder: f.isFolder
          }))
        },
        timestamp: new Date().toISOString()
      });

      // ステップ4: ファイル一覧取得（最初のフォルダがある場合）
      if (folders.length > 0) {
        const firstFolder = folders.find(f => f.isFolder);
        if (firstFolder) {
          debugSteps.push({
            step: 'file_list',
            status: 'running',
            message: `フォルダ「${firstFolder.name}」内のファイルを取得しています...`,
            timestamp: new Date().toISOString()
          });

          try {
            const files = await garoonService.getCabinetFiles(firstFolder.id, garoonConfig);

            debugSteps.push({
              step: 'file_list',
              status: 'success',
              message: `${files.length}件のファイルを取得しました`,
              details: {
                folderId: firstFolder.id,
                folderName: firstFolder.name,
                fileCount: files.length,
                files: files.slice(0, 5).map(f => ({
                  id: f.id,
                  name: f.name,
                  isFolder: f.isFolder,
                  url: f.url
                }))
              },
              timestamp: new Date().toISOString()
            });
          } catch (fileError) {
            debugSteps.push({
              step: 'file_list',
              status: 'error',
              message: 'ファイル一覧の取得に失敗しました',
              details: {
                error: fileError instanceof Error ? fileError.message : String(fileError)
              },
              timestamp: new Date().toISOString()
            });
          }
        }
      }

    } catch (folderError) {
      debugSteps.push({
        step: 'folder_list',
        status: 'error',
        message: 'フォルダ一覧の取得に失敗しました',
        details: {
          error: folderError instanceof Error ? folderError.message : String(folderError)
        },
        timestamp: new Date().toISOString()
      });
    }

    // ステップ5: 完了
    debugSteps.push({
      step: 'completion',
      status: 'success',
      message: 'デバッグテストが完了しました',
      details: {
        totalSteps: debugSteps.length,
        successfulSteps: debugSteps.filter(s => s.status === 'success').length,
        failedSteps: debugSteps.filter(s => s.status === 'error').length
      },
      timestamp: new Date().toISOString()
    });

    console.log('=== Garoon Debug API End ===');
    console.log('Total steps:', debugSteps.length);
    console.log('Successful steps:', debugSteps.filter(s => s.status === 'success').length);

    return NextResponse.json({
      success: true,
      steps: debugSteps,
      summary: {
        totalSteps: debugSteps.length,
        successfulSteps: debugSteps.filter(s => s.status === 'success').length,
        failedSteps: debugSteps.filter(s => s.status === 'error').length,
        duration: debugSteps.length > 0 ? 
          new Date(debugSteps[debugSteps.length - 1].timestamp).getTime() - new Date(debugSteps[0].timestamp).getTime() : 0
      }
    });

  } catch (error) {
    console.error('Garoon Debug API Error:', error);
    
    debugSteps.push({
      step: 'error',
      status: 'error',
      message: 'デバッグ実行中にエラーが発生しました',
      details: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: false,
      steps: debugSteps,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました'
    });
  }
}

// デバッグログをリアルタイムで取得するためのGETエンドポイント
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');
    
    if (!configId) {
      return NextResponse.json({
        success: false,
        error: '設定IDが必要です'
      });
    }

    // 設定の基本情報を返す
    const garoonSettingsService = GaroonSettingsService.getInstance();
    const config = await garoonSettingsService.getGaroonSetting(configId);
    
    if (!config) {
      return NextResponse.json({
        success: false,
        error: '設定が見つかりません'
      });
    }

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        name: config.name,
        url: config.url,
        username: config.username,
        isActive: config.isActive
      }
    });

  } catch (error) {
    console.error('Garoon Debug GET Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '不明なエラーが発生しました'
    });
  }
}