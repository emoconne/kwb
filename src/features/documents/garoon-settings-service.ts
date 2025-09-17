import { GaroonConfig } from './garoon-file-service';
import { Department } from './cosmos-db-dept-service';

export class GaroonSettingsService {
  private static instance: GaroonSettingsService;
  private cosmosEndpoint: string;
  private cosmosKey: string;
  private cosmosDatabaseId: string;
  private cosmosContainerId: string = 'garoon';

  constructor() {
    this.cosmosEndpoint = process.env.AZURE_COSMOSDB_URI || '';
    this.cosmosKey = process.env.AZURE_COSMOSDB_KEY || '';
    this.cosmosDatabaseId = process.env.AZURE_COSMOSDB_DB_NAME || 'azurechat';
  }

  static getInstance(): GaroonSettingsService {
    if (!GaroonSettingsService.instance) {
      GaroonSettingsService.instance = new GaroonSettingsService();
    }
    return GaroonSettingsService.instance;
  }

  /**
   * Garoon設定一覧を取得
   */
  async getGaroonSettings(): Promise<GaroonConfig[]> {
    try {
      const response = await fetch('/api/settings/garoon/list');
      if (response.ok) {
        const data = await response.json();
        return data.settings || [];
      }
      throw new Error('設定一覧の取得に失敗しました');
    } catch (error) {
      console.error('Garoon設定一覧取得エラー:', error);
      throw error;
    }
  }

  /**
   * Garoon設定一覧を取得（getAllGaroonSettingsのエイリアス）
   */
  async getAllGaroonSettings(): Promise<GaroonConfig[]> {
    return this.getGaroonSettings();
  }

  /**
   * Garoon設定を取得（ID指定）
   */
  async getGaroonSetting(id: string): Promise<GaroonConfig> {
    try {
      const response = await fetch(`/api/settings/garoon/${id}`);
      if (response.ok) {
        const data = await response.json();
        return data.setting;
      }
      throw new Error('設定の取得に失敗しました');
    } catch (error) {
      console.error('Garoon設定取得エラー:', error);
      throw error;
    }
  }

  /**
   * Garoon設定を保存
   */
  async saveGaroonSetting(config: GaroonConfig): Promise<GaroonConfig> {
    try {
      const response = await fetch('/api/settings/garoon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        return data.setting;
      }
      throw new Error('設定の保存に失敗しました');
    } catch (error) {
      console.error('Garoon設定保存エラー:', error);
      throw error;
    }
  }

  /**
   * Garoon設定を更新
   */
  async updateGaroonSetting(id: string, config: Partial<GaroonConfig>): Promise<GaroonConfig> {
    try {
      const response = await fetch(`/api/settings/garoon/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        return data.setting;
      }
      throw new Error('設定の更新に失敗しました');
    } catch (error) {
      console.error('Garoon設定更新エラー:', error);
      throw error;
    }
  }

  /**
   * Garoon設定を削除
   */
  async deleteGaroonSetting(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/settings/garoon/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('設定の削除に失敗しました');
      }
    } catch (error) {
      console.error('Garoon設定削除エラー:', error);
      throw error;
    }
  }

  /**
   * 部門一覧を取得
   */
  async getDepartments(): Promise<Department[]> {
    try {
      const response = await fetch('/api/settings/departments');
      if (response.ok) {
        const data = await response.json();
        return data.departments || [];
      }
      throw new Error('部門一覧の取得に失敗しました');
    } catch (error) {
      console.error('部門一覧取得エラー:', error);
      throw error;
    }
  }

  /**
   * 接続テストを実行
   */
  async testConnection(config: GaroonConfig): Promise<boolean> {
    try {
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

      if (response.ok) {
        const data = await response.json();
        return data.connected || false;
      }
      return false;
    } catch (error) {
      console.error('接続テストエラー:', error);
      return false;
    }
  }
}
