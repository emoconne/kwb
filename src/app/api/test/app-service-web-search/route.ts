import { NextRequest, NextResponse } from 'next/server';
import { BingSearchResult } from '@/features/chat/chat-services/Azure-bing-search/bing';

export async function GET(request: NextRequest) {
  try {
    console.log('=== App Service Web Search Test ===');
    
    const searchText = 'Microsoft';
    console.log(`Testing web search with query: ${searchText}`);
    
    // BingSearchResultインスタンスを作成
    const bingSearch = new BingSearchResult();
    
    // Web検索を実行
    const result = await bingSearch.SearchWeb(searchText);
    
    console.log('Search result:', result);
    
    // 戻り値の構造を判定（Azure AI Foundry形式 vs フォールバック形式）
    const isAzureAIResult = result && 'searchResults' in result && 'assistantResponse' in result;
    const isFallbackResult = result && 'webPages' in result;
    
    let searchResultsCount = 0;
    let assistantResponseLength = 0;
    let hasSearchResults = false;
    let hasAssistantResponse = false;
    
    if (isAzureAIResult) {
      // Azure AI Foundry形式の結果
      searchResultsCount = result.searchResults?.webPages?.value?.length || 0;
      assistantResponseLength = result.assistantResponse?.length || 0;
      hasSearchResults = !!result.searchResults;
      hasAssistantResponse = !!result.assistantResponse;
    } else if (isFallbackResult) {
      // フォールバック形式の結果
      searchResultsCount = result.webPages?.value?.length || 0;
      assistantResponseLength = 0;
      hasSearchResults = !!result.webPages;
      hasAssistantResponse = false;
    }
    
    return NextResponse.json({
      success: true,
      searchText,
      result: {
        hasSearchResults,
        hasAssistantResponse,
        threadId: result?.threadId,
        searchResultsCount,
        assistantResponseLength,
        resultType: isAzureAIResult ? 'azure-ai-foundry' : isFallbackResult ? 'fallback' : 'unknown'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('App Service Web Search Test Error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
