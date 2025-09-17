import { NextRequest, NextResponse } from 'next/server';

// シンプルなGaroonフォルダ一覧取得テスト
export async function GET(request: NextRequest) {
  try {
    console.log('=== Simple Garoon Folder List Test ===');
    
    // 固定の設定値
    const config = {
      baseUrl: 'https://jbccdemo.cybozu.com',
      soapUrl: 'https://jbccdemo.cybozu.com/g/cbpapi/cabinet/api.csp?',
      username: 'J23353',
      password: 'jbcc1234', // 実際のパスワードに置き換えてください
      hid: '7'
    };

    console.log('Config:', config);

    // Python準拠のSOAPエンベロープを作成
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:cabinet="http://wsdl.cybozu.co.jp/cabinet/2008">
  <soap:Header>
    <Action>CabinetGetFolderInfo</Action>
    <Security>
      <UsernameToken>
        <Username>${config.username}</Username>
        <Password>${config.password}</Password>
      </UsernameToken>
    </Security>
    <Timestamp>
      <Created>2010-08-12T14:45:00Z</Created>
      <Expires>2037-08-12T14:45:00Z</Expires>
    </Timestamp>
    <Locale>ja</Locale>
  </soap:Header>
  <soap:Body>
    <cabinet:CabinetGetFolderInfo>
    </cabinet:CabinetGetFolderInfo>
  </soap:Body>
</soap:Envelope>`;

    console.log('SOAP Envelope:', soapEnvelope);

    // SOAPリクエストを送信
    const response = await fetch(config.soapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'CabinetGetFolderInfo',
        'User-Agent': 'Garoon-SOAP-Test/1.0'
      },
      body: soapEnvelope
    });

    console.log('=== SOAP Response ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP Error Response:', errorText);
      return NextResponse.json({
        success: false,
        error: `HTTP Error: ${response.status} ${response.statusText}`,
        response: errorText
      });
    }

    const responseText = await response.text();
    console.log('Response Body:', responseText);

    // レスポンスをパースしてフォルダ一覧を抽出
    const folders = parseFolderResponse(responseText, config.hid);
    
    console.log('Parsed folders:', folders);

    return NextResponse.json({
      success: true,
      config: config,
      soapEnvelope: soapEnvelope,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      },
      folders: folders,
      folderCount: folders.length
    });

  } catch (error) {
    console.error('Simple Garoon Test Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// フォルダレスポンスをパース（Python準拠）
function parseFolderResponse(response: string, targetRootId: string): any[] {
  try {
    console.log('=== Parsing Folder Response ===');
    console.log('Target Root ID:', targetRootId);
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response, 'text/xml');
    
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

    // CabinetGetFolderInfoResponseを探す
    const responseElement = Array.from(body.getElementsByTagName('*')).find(el => 
      el.tagName.includes('CabinetGetFolderInfoResponse')
    );

    if (!responseElement) {
      console.error('CabinetGetFolderInfoResponse not found');
      console.log('Available elements in body:', Array.from(body.children).map(el => el.tagName));
      throw new Error('CabinetGetFolderInfoResponse not found');
    }

    const returns = responseElement.getElementsByTagName('returns')[0];
    if (!returns) {
      throw new Error('returns element not found');
    }

    const folderInformation = returns.getElementsByTagName('folder_information')[0];
    if (!folderInformation) {
      throw new Error('folder_information not found');
    }

    const rootElement = folderInformation.getElementsByTagName('root')[0];
    if (!rootElement) {
      throw new Error('root element not found');
    }

    const foldersElement = rootElement.getElementsByTagName('folders')[0];
    if (!foldersElement) {
      console.log('No folders found');
      return [];
    }

    console.log('Found folders element, parsing...');
    const folders: any[] = [];
    const rootFolders = new Set<string>();
    
    parseFolders(foldersElement, targetRootId, folders, rootFolders);

    console.log('Parsed folder count:', folders.length);
    return folders;

  } catch (error) {
    console.error('Folder Response Parsing Error:', error);
    return [];
  }
}

// フォルダを再帰的にパース（Pythonのparse_folders関数と同等）
function parseFolders(foldersElement: Element, targetRootId: string, items: any[], rootFolders: Set<string>): void {
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
        parent_id: parentId,
        folder_id: folderId,
        title: title,
        type: 'folder',
        isFolder: true
      });
      console.log('Added root folder:', { folderId, title });
    } else if (parentId && rootFolders.has(parentId)) {
      items.push({
        parent_id: parentId,
        folder_id: folderId,
        title: title,
        type: 'folder',
        isFolder: true
      });
      if (folderId) {
        rootFolders.add(folderId);
      }
      console.log('Added subfolder:', { folderId, title });
    }

    // サブフォルダを再帰的に処理
    const subfoldersElement = folderElement.getElementsByTagName('folders')[0];
    if (subfoldersElement) {
      parseFolders(subfoldersElement, targetRootId, items, rootFolders);
    }
  }
}
