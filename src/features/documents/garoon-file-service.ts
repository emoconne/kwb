export interface GaroonFileInfo {
  id: string;
  name: string;
  path: string;
  parentPath?: string;
  isFolder: boolean;
  size?: string;
  updatedAt: string;
  version?: string;
  depth: number;
  url?: string;
  mimeType?: string;
  folderId?: string;
  parentId?: string;
}

export interface GaroonConfig {
  id?: string;
  name: string;
  url: string;
  username: string;
  password: string;
  departmentId?: string;
  departmentName?: string;
  isConnected: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GaroonCabinetInfo {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  size?: string;
  updatedAt: string;
  version?: string;
  depth: number;
  children?: GaroonCabinetInfo[];
}

export class GaroonFileService {
  private static instance: GaroonFileService;
  private config: GaroonConfig;

  constructor(config?: GaroonConfig) {
    this.config = config || {
      name: '',
      url: '',
      username: '',
      password: '',
      isConnected: false,
      isActive: false
    };
  }

  static getInstance(): GaroonFileService {
    if (!GaroonFileService.instance) {
      GaroonFileService.instance = new GaroonFileService();
    }
    return GaroonFileService.instance;
  }

  setConfig(config: GaroonConfig): void {
    console.log('GaroonFileService setConfig called:', {
      id: config.id,
      name: config.name,
      url: config.url,
      username: config.username,
      hasPassword: !!config.password,
      isConnected: config.isConnected
    });
    this.config = config;
  }

  /**
   * GaroonのSOAP APIを使用してフォルダ一覧を取得
   */
  async getCabinetList(config?: GaroonConfig, targetRootId?: string): Promise<GaroonFileInfo[]> {
    try {
      const currentConfig = config || this.config;
      
      // Pythonの実装に合わせてtarget_root_idを使用（デフォルトは'14'）
      const hid = targetRootId || '14';
      
      console.log('=== getCabinetList Debug ===');
      console.log('Config URL:', currentConfig.url);
      console.log('Target Root ID (hid):', hid);
      console.log('Method: CabinetGetFolderInfo');
      console.log('Python equivalent: get_folders(target_root_id="14")');
      
      // CabinetGetFolderInfoはパラメータなしで呼び出し
      const soapEnvelope = this.createSoapEnvelope('CabinetGetFolderInfo', {});
      const response = await this.makeSoapRequest(soapEnvelope, currentConfig);
      
      return this.parseCabinetFolderResponse(response, hid);
    } catch (error) {
      console.error('Garoon Cabinet List取得エラー:', error);
      throw new Error(`Garoon Cabinet List取得に失敗しました: ${error}`);
    }
  }

  /**
   * 指定されたフォルダ内のファイル一覧を取得
   */
  async getCabinetFiles(folderId: string, config?: GaroonConfig): Promise<GaroonFileInfo[]> {
    try {
      const currentConfig = config || this.config;
      
      console.log('=== getCabinetFiles Debug ===');
      console.log('Folder ID (hid):', folderId);
      console.log('Config:', currentConfig);
      console.log('Method: CabinetGetFileInfo');
      console.log('Python equivalent: get_file_info(folder_id)');
      
      // Pythonの実装に合わせてhidパラメータを使用
      const soapEnvelope = this.createSoapEnvelope('CabinetGetFileInfo', { hid: folderId });
      const response = await this.makeSoapRequest(soapEnvelope, currentConfig);
      
      return this.parseCabinetFilesResponse(response);
    } catch (error) {
      console.error('Garoon Cabinet Files取得エラー:', error);
      throw new Error(`Garoon Cabinet Files取得に失敗しました: ${error}`);
    }
  }

  /**
   * ファイルのダウンロードURLを取得
   */
  async getFileDownloadUrl(fileId: string): Promise<string> {
    try {
      const soapEnvelope = this.createSoapEnvelope('GetCabinetFileDownloadUrl', {
        fileId: fileId
      });
      
      const response = await this.makeSoapRequest(soapEnvelope);
      
      return this.parseDownloadUrlResponse(response);
    } catch (error) {
      console.error('Garoon File Download URL取得エラー:', error);
      throw new Error(`Garoon File Download URL取得に失敗しました: ${error}`);
    }
  }

  /**
   * SOAPエンベロープを作成（Python完全準拠形式）
   */
  private createSoapEnvelope(method: string, parameters: any = {}): string {
    const currentConfig = this.config;
    
    console.log('=== SOAP Envelope Creation Debug ===');
    console.log('Method:', method);
    console.log('Parameters:', parameters);
    
    // Pythonの実装に完全に合わせたSOAP形式
    let paramsXml = '';
    if (Object.keys(parameters).length > 0) {
      if (method === 'CabinetGetFileInfo') {
        // CabinetGetFileInfoの場合はparametersタグを使用
        const hid = parameters.hid || parameters.folderId;
        paramsXml = `<parameters hid="${hid}"></parameters>`;
        console.log('CabinetGetFileInfo parameters:', { hid });
      } else {
        // その他の場合は直接パラメータを展開
        paramsXml = Object.entries(parameters)
          .map(([key, value]) => `<${key}>${value}</${key}>`)
          .join('');
      }
    }

    // Pythonの実装と同じnamespaceを使用
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:cabinet="http://wsdl.cybozu.co.jp/cabinet/2008">
  <soap:Header>
    <Action>${method}</Action>
    <Security>
      <UsernameToken>
        <Username>${currentConfig.username}</Username>
        <Password>${currentConfig.password}</Password>
      </UsernameToken>
    </Security>
    <Timestamp>
      <Created>2010-08-12T14:45:00Z</Created>
      <Expires>2037-08-12T14:45:00Z</Expires>
    </Timestamp>
    <Locale>ja</Locale>
  </soap:Header>
  <soap:Body>
    <cabinet:${method}>
      ${paramsXml}
    </cabinet:${method}>
  </soap:Body>
</soap:Envelope>`;

    console.log('Generated SOAP Envelope (Python compatible):', soapEnvelope);
    console.log('Namespaces used:', {
      soap: 'http://www.w3.org/2003/05/soap-envelope',
      cabinet: 'http://wsdl.cybozu.co.jp/cabinet/2008'
    });
    console.log('=== End SOAP Envelope Creation ===');
    
    return soapEnvelope;
  }

  /**
   * SOAPヘッダーを作成
   */
  private getSoapHeader(action: string): string {
    const currentConfig = this.config;
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 27 * 365 * 24 * 60 * 60 * 1000).toISOString(); // 27年後

    return `
  <soap:Header>
    <Action>${action}</Action>
    <Security>
      <UsernameToken>
        <Username>${currentConfig.username}</Username>
        <Password>${currentConfig.password}</Password>
      </UsernameToken>
    </Security>
    <Timestamp>
      <Created>${now}</Created>
      <Expires>${expires}</Expires>
    </Timestamp>
    <Locale>ja</Locale>
  </soap:Header>`;
  }

  /**
   * セッション認証を取得
   */
  private async getSessionAuth(): Promise<string> {
    try {
      // まずログインしてセッションを取得
      const loginUrl = `${this.config.url.replace('/g/cabinet/index.csp?sp=0&hid=7', '')}/g/login/login.csp`;
      
      const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Garoon-Integration/1.0'
        },
        body: new URLSearchParams({
          _account: this.config.username,
          _password: this.config.password
        })
      });

      if (!loginResponse.ok) {
        throw new Error(`Login failed: ${loginResponse.status}`);
      }

      // セッションCookieを取得
      const cookies = loginResponse.headers.get('set-cookie');
      if (!cookies) {
        throw new Error('No session cookie received');
      }

      return cookies;
    } catch (error) {
      console.error('Session authentication error:', error);
      throw error;
    }
  }

  /**
   * URLからhidパラメータを抽出
   */
  private extractHidFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const hid = urlObj.searchParams.get('hid');
      console.log('Extracted HID from URL:', { url, hid });
      return hid || '14'; // デフォルト値
    } catch (error) {
      console.error('URL parsing error:', error);
      return '14'; // デフォルト値
    }
  }

  /**
   * ベースURLを取得（レガシー対応）
   */
  private getBaseUrl(url: string): string {
    console.log('getBaseUrl called with:', url);
    console.log('URL type:', typeof url);
    console.log('URL length:', url ? url.length : 'undefined');
    
    if (!url) {
      console.error('URL is empty or undefined');
      return 'https://jbccdemo.cybozu.com';
    }
    
    try {
      // GaroonのURLから直接ベースURLを抽出
      if (url.includes('cybozu.com')) {
        // cybozu.comの場合は、ドメイン部分を抽出
        const match = url.match(/https?:\/\/([^\/]+)/);
        if (match) {
          const baseUrl = `https://${match[1]}`;
          console.log('Extracted base URL:', baseUrl);
          return baseUrl;
        }
      }
      
      // 一般的なURL解析
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      console.log('Parsed base URL:', baseUrl);
      return baseUrl;
    } catch (error) {
      console.error('URL解析エラー:', error);
      console.error('URL:', url);
      
      // フォールバック: cybozu.comの場合は直接返す
      if (url.includes('cybozu.com')) {
        console.log('Using fallback for cybozu.com');
        return 'https://jbccdemo.cybozu.com';
      }
      
      // 文字列置換によるフォールバック
      const fallbackUrl = url.replace('/g/cabinet/index.csp?sp=0&hid=7', '')
                             .replace('/g/cabinet/index.csp', '');
      console.log('Using string replacement fallback:', fallbackUrl);
      return fallbackUrl;
    }
  }

  /**
   * SOAPリクエストを実行
   */
  private async makeSoapRequest(soapEnvelope: string, config?: GaroonConfig): Promise<string> {
    const currentConfig = config || this.config;
    
    // テストプログラムと同じ方式で直接SOAP呼び出し
    const soapUrl = 'https://jbccdemo.cybozu.com/g/cbpapi/cabinet/api.csp?';
    
    console.log('=== SOAP Request Debug (Test Compatible) ===');
    console.log('Config:', {
      url: currentConfig.url,
      soapUrl: soapUrl,
      username: currentConfig.username,
      hasPassword: !!currentConfig.password
    });
    console.log('SOAP Envelope:', soapEnvelope);
    
    try {
      // テストプログラムと同じヘッダーを使用
      const response = await fetch(soapUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'CabinetGetFolderInfo', // テストと同じSOAPAction
          'User-Agent': 'Garoon-SOAP-Client/1.0'
        },
        body: soapEnvelope
      });

      console.log('=== SOAP Response Debug ===');
      console.log('Response Status:', response.status);
      console.log('Response Status Text:', response.statusText);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP Error Response:', errorText);
        throw new Error(`HTTP Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('SOAP Response Body:', responseText);
      console.log('=== End SOAP Debug ===');
      return responseText;
    } catch (error) {
      console.error('SOAP Request Error:', error);
      throw error;
    }
  }

  /**
   * Cabinet Folderのレスポンスをパース
   */
  private parseCabinetFolderResponse(response: string, targetRootId: string): GaroonFileInfo[] {
    try {
      console.log('=== Cabinet Folder Response Parsing (Python Compatible) ===');
      console.log('Response:', response);
      console.log('Target Root ID:', targetRootId);
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response, 'text/xml');
      
      // Pythonの実装と同じnamespaceを使用
      console.log('Parsing with Python-compatible namespaces');
      
      // SOAPエラーのチェック
      const fault = xmlDoc.getElementsByTagName('soap:Fault')[0];
      if (fault) {
        const faultString = fault.getElementsByTagName('faultstring')[0]?.textContent;
        throw new Error(`SOAP Fault: ${faultString}`);
      }

      // Pythonの実装と同じパスで要素を取得
      const body = xmlDoc.getElementsByTagName('soap:Body')[0];
      if (!body) {
        throw new Error('SOAP Body not found');
      }

      // Python: response_element = body.find('cabinet:CabinetGetFolderInfoResponse', self.namespaces)
      const responseElement = Array.from(body.getElementsByTagName('*')).find(el => 
        el.tagName.includes('CabinetGetFolderInfoResponse')
      );

      if (!responseElement) {
        console.error('CabinetGetFolderInfoResponse not found');
        console.log('Available elements in body:', Array.from(body.children).map(el => el.tagName));
        throw new Error('CabinetGetFolderInfoResponse not found');
      }

      // Python: returns = response_element.find('returns')
      const returns = responseElement.getElementsByTagName('returns')[0];
      if (!returns) {
        throw new Error('returns element not found');
      }

      // Python: folder_information = returns.find('folder_information')
      const folderInformation = returns.getElementsByTagName('folder_information')[0];
      if (!folderInformation) {
        throw new Error('folder_information not found');
      }

      // Python: root_element = folder_information.find('root')
      const rootElement = folderInformation.getElementsByTagName('root')[0];
      if (!rootElement) {
        throw new Error('root element not found');
      }

      // Python: folders_element = root_element.find('folders')
      const foldersElement = rootElement.getElementsByTagName('folders')[0];
      if (!foldersElement) {
        console.log('No folders found');
        return [];
      }

      console.log('Found folders element, parsing with test-compatible logic...');
      const files: GaroonFileInfo[] = [];
      const rootFolders = new Set<string>();
      
      // テストプログラムと同じ解析ロジックを使用
      this.parseFoldersTestCompatible(foldersElement, targetRootId, files, rootFolders);

      console.log('解析されたフォルダ数:', files.length);
      console.log('フォルダ一覧:', files);

      return files;
    } catch (error) {
      console.error('Cabinet Folder解析エラー:', error);
      console.error('レスポンス内容:', response);
      throw new Error(`Cabinet Folder解析に失敗しました: ${error}`);
    }
  }

  /**
   * フォルダを再帰的にパース（テストプログラム準拠）
   */
  private parseFoldersTestCompatible(foldersElement: Element, targetRootId: string, items: GaroonFileInfo[], rootFolders: Set<string>): void {
    const parentId = foldersElement.getAttribute('parent_id');
    console.log('Parsing folders with parent_id:', parentId, 'target_root_id:', targetRootId);

    const folderElements = foldersElement.getElementsByTagName('folder');
    console.log('Found folder elements:', folderElements.length);

    for (let i = 0; i < folderElements.length; i++) {
      const folderElement = folderElements[i];
      const folderId = folderElement.getAttribute('id');
      const titleElement = folderElement.getElementsByTagName('title')[0];
      const title = titleElement ? titleElement.textContent || '' : '';

      console.log('Processing folder:', { folderId, title, parentId });

      if (parentId === targetRootId) {
        rootFolders.add(folderId || '');
        items.push({
          id: folderId || '',
          name: title,
          path: `/${title}`,
          parentPath: parentId ? `/${parentId}` : '/',
          isFolder: true,
          size: '0',
          updatedAt: new Date().toISOString(),
          depth: 0,
          folderId: folderId || '',
          parentId: parentId || ''
        });
        console.log('Added root folder:', { folderId, title });
      } else if (parentId && rootFolders.has(parentId)) {
        items.push({
          id: folderId || '',
          name: title,
          path: `/${title}`,
          parentPath: parentId ? `/${parentId}` : '/',
          isFolder: true,
          size: '0',
          updatedAt: new Date().toISOString(),
          depth: 1,
          folderId: folderId || '',
          parentId: parentId || ''
        });
        if (folderId) {
          rootFolders.add(folderId);
        }
        console.log('Added subfolder:', { folderId, title });
      }

      // サブフォルダを再帰的に処理
      const subfoldersElement = folderElement.getElementsByTagName('folders')[0];
      if (subfoldersElement) {
        this.parseFoldersTestCompatible(subfoldersElement, targetRootId, items, rootFolders);
      }
    }
  }

  /**
   * フォルダ情報を再帰的にパース（旧バージョン）
   */
  private parseFolders(
    foldersElement: Element, 
    targetRootId: string, 
    items: GaroonFileInfo[], 
    rootFolders: Set<string>
  ): void {
    if (!foldersElement) return;

    const parentId = foldersElement.getAttribute('parent_id') || '';
    const folderElements = foldersElement.getElementsByTagName('folder');

    for (let i = 0; i < folderElements.length; i++) {
      const folderElement = folderElements[i];
      const folderId = folderElement.getAttribute('id') || '';
      const titleElement = folderElement.getElementsByTagName('title')[0];
      const title = titleElement?.textContent || '';

      if (parentId === targetRootId) {
        rootFolders.add(folderId);
        items.push({
          id: folderId,
          name: title,
          path: `/${title}`,
          isFolder: true,
          parentId: parentId,
          folderId: folderId,
          updatedAt: new Date().toLocaleDateString('ja-JP'),
          depth: 0
        });
      } else if (rootFolders.has(parentId)) {
        items.push({
          id: folderId,
          name: title,
          path: `/${title}`,
          isFolder: true,
          parentId: parentId,
          folderId: folderId,
          updatedAt: new Date().toLocaleDateString('ja-JP'),
          depth: 1
        });
        rootFolders.add(folderId);
      }

      // サブフォルダを再帰的に処理
      const subFoldersElement = folderElement.getElementsByTagName('folders')[0];
      if (subFoldersElement) {
        this.parseFolders(subFoldersElement, targetRootId, items, rootFolders);
      }
    }
  }

  /**
   * Cabinet Filesのレスポンスをパース
   */
  private parseCabinetFilesResponse(response: string): GaroonFileInfo[] {
    try {
      console.log('Cabinet Files SOAPレスポンス:', response);
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response, 'text/xml');
      
      // SOAPエラーのチェック
      const fault = xmlDoc.getElementsByTagName('soap:Fault')[0];
      if (fault) {
        const faultString = fault.getElementsByTagName('faultstring')[0]?.textContent;
        throw new Error(`SOAP Fault: ${faultString}`);
      }

      // CabinetGetFileInfoResponseを探す
      const body = xmlDoc.getElementsByTagName('soap:Body')[0];
      if (!body) {
        throw new Error('SOAP Body not found');
      }

      const responseElement = Array.from(body.getElementsByTagName('*')).find(el => 
        el.tagName.includes('CabinetGetFileInfoResponse')
      );

      if (!responseElement) {
        throw new Error('CabinetGetFileInfoResponse not found');
      }

      const returns = responseElement.getElementsByTagName('returns')[0];
      if (!returns) {
        throw new Error('returns element not found');
      }

      const fileInformation = returns.getElementsByTagName('file_information')[0];
      if (!fileInformation) {
        console.log('No file_information found');
        return [];
      }

      const filesElement = fileInformation.getElementsByTagName('files')[0];
      if (!filesElement) {
        console.log('No files found');
        return [];
      }

      const fileElements = filesElement.getElementsByTagName('file');
      const files: GaroonFileInfo[] = [];

      for (let i = 0; i < fileElements.length; i++) {
        const fileElement = fileElements[i];
        const folderId = fileElement.getAttribute('folder_id') || '';
        const id = fileElement.getAttribute('id') || '';
        const nameElement = fileElement.getElementsByTagName('name')[0];
        const name = nameElement?.textContent || '';
        const mimeTypeElement = fileElement.getElementsByTagName('mime_type')[0];
        const mimeType = mimeTypeElement?.textContent || '';

        if (id && name) {
          // ファイルのURLを構築
          const baseUrl = this.config.url.replace('/g/cabinet/index.csp?sp=0&hid=7', '');
          const fileUrl = `${baseUrl}/g/cabinet/view.csp?hid=${folderId}&fid=${id}`;

          files.push({
            id,
            name,
            path: `/${name}`,
            isFolder: false,
            folderId: folderId,
            updatedAt: new Date().toLocaleDateString('ja-JP'),
            depth: 1,
            url: fileUrl,
            mimeType: mimeType || undefined
          });
        }
      }

      console.log('解析されたファイル数:', files.length);
      console.log('ファイル一覧:', files);

      return files;
    } catch (error) {
      console.error('Cabinet Files解析エラー:', error);
      throw new Error(`Cabinet Files解析に失敗しました: ${error}`);
    }
  }

  /**
   * ダウンロードURLのレスポンスをパース
   */
  private parseDownloadUrlResponse(response: string): string {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response, 'text/xml');
      
      // SOAPエラーのチェック
      const fault = xmlDoc.getElementsByTagName('soap:Fault')[0];
      if (fault) {
        const faultString = fault.getElementsByTagName('faultstring')[0]?.textContent;
        throw new Error(`SOAP Fault: ${faultString}`);
      }

      const urlElement = xmlDoc.getElementsByTagName('url')[0];
      if (!urlElement) {
        throw new Error('ダウンロードURLが見つかりません');
      }

      return urlElement.textContent || '';
    } catch (error) {
      console.error('Download URL解析エラー:', error);
      throw new Error(`Download URL解析に失敗しました: ${error}`);
    }
  }

  /**
   * 日付フォーマット
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing Garoon connection...');
      console.log('Config:', {
        url: this.config.url,
        username: this.config.username,
        password: this.config.password ? '***' : 'not set',
        hasUrl: !!this.config.url,
        hasUsername: !!this.config.username,
        hasPassword: !!this.config.password,
        urlType: typeof this.config.url,
        usernameType: typeof this.config.username,
        passwordType: typeof this.config.password
      });

      // 設定値の検証
      if (!this.config.url || !this.config.username || !this.config.password) {
        console.error('Missing required configuration:', {
          url: this.config.url || 'undefined',
          username: this.config.username || 'undefined',
          password: this.config.password ? '***' : 'undefined'
        });
        return false;
      }

      // まず基本的なHTTP接続をテスト
      console.log('Current config before getBaseUrl:', this.config);
      const baseUrl = this.getBaseUrl(this.config.url);
      const testUrl = `${baseUrl}/g/`;
      
      console.log('Testing basic HTTP connection to:', testUrl);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Garoon-Integration/1.0'
        }
      });

      console.log('HTTP Response Status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      // ログインページにアクセスできることを確認
      const loginUrl = `${baseUrl}/g/login/login.csp`;
      console.log('Testing login page access:', loginUrl);
      
      const loginResponse = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Garoon-Integration/1.0'
        }
      });

      console.log('Login Page Response Status:', loginResponse.status);
      
      if (loginResponse.ok) {
        console.log('Garoon connection test successful - server is reachable');
        return true;
      } else {
        throw new Error(`Login page not accessible: ${loginResponse.status}`);
      }
    } catch (error) {
      console.error('Garoon接続テストエラー:', error);
      return false;
    }
  }
}
