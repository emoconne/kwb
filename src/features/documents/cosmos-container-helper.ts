import { CosmosClient, Database, Container } from '@azure/cosmos';

export class CosmosContainerHelper {
  private static instance: CosmosContainerHelper;
  private cosmosClient: CosmosClient | null = null;

  private constructor() {}

  static getInstance(): CosmosContainerHelper {
    if (!CosmosContainerHelper.instance) {
      CosmosContainerHelper.instance = new CosmosContainerHelper();
    }
    return CosmosContainerHelper.instance;
  }

  private getCosmosClient(): CosmosClient {
    if (!this.cosmosClient) {
      if (!process.env.AZURE_COSMOSDB_URI || !process.env.AZURE_COSMOSDB_KEY) {
        throw new Error('Cosmos DB環境変数が設定されていません');
      }
      
      this.cosmosClient = new CosmosClient({
        endpoint: process.env.AZURE_COSMOSDB_URI,
        key: process.env.AZURE_COSMOSDB_KEY
      });
    }
    return this.cosmosClient;
  }

  private getDatabase(): Database {
    const client = this.getCosmosClient();
    const databaseId = process.env.AZURE_COSMOSDB_DB_NAME || 'azurechat';
    return client.database(databaseId);
  }

  /**
   * コンテナを取得し、存在しない場合は作成する
   */
  async ensureContainer(containerId: string, partitionKey: string = '/id'): Promise<Container> {
    try {
      const database = this.getDatabase();
      
      // まずコンテナの存在確認を試行
      try {
        const container = database.container(containerId);
        await container.read();
        console.log(`コンテナ "${containerId}" は既に存在します`);
        return container;
      } catch (error: any) {
        // コンテナが存在しない場合、作成を試行
        if (error.code === 404) {
          console.log(`コンテナ "${containerId}" が見つからないため、作成します`);
          
          const { container } = await database.containers.create({
            id: containerId,
            partitionKey: {
              paths: [partitionKey]
            },
            indexingPolicy: {
              automatic: true,
              indexingMode: 'consistent',
              includedPaths: [
                {
                  path: '/*'
                }
              ],
              excludedPaths: []
            }
          });
          
          console.log(`コンテナ "${containerId}" を作成しました`);
          return container;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(`コンテナ "${containerId}" の取得/作成エラー:`, error);
      throw error;
    }
  }

  /**
   * コンテナが存在するかチェック
   */
  async containerExists(containerId: string): Promise<boolean> {
    try {
      const database = this.getDatabase();
      const container = database.container(containerId);
      await container.read();
      return true;
    } catch (error: any) {
      if (error.code === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * データベースが存在するかチェック
   */
  async databaseExists(): Promise<boolean> {
    try {
      const database = this.getDatabase();
      await database.read();
      return true;
    } catch (error: any) {
      if (error.code === 404) {
        return false;
      }
      throw error;
    }
  }
}
