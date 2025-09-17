"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useChatContext } from "../chat-context";
import { CitationItem } from "../citation-panel";

interface CitationSliderProps {
  index: number;
  name: string;
  id: string;
}

export function CitationSlider({ index, name, id }: CitationSliderProps) {
  const { setIsCitationPanelOpen, setSelectedCitation } = useChatContext();

  const handleCitationClick = async () => {
    console.log('CitationSlider clicked:', { index, name, id });
    
    try {
      // 現在のチャットスレッドIDを取得（URLから）
      const pathParts = window.location.pathname.split('/');
      const chatThreadId = pathParts[pathParts.length - 1];
      console.log('ChatThreadId:', chatThreadId);
      
      // Citationデータを取得
      const response = await fetch(`/api/chat/citations?chatThreadId=${chatThreadId}`);
      console.log('Citation API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        const citations = data.citations || [];
        console.log('Citations found:', citations.length);
        console.log('Looking for citation with id:', id);
        console.log('Available citation IDs:', citations.map((c: CitationItem) => c.id));
        
        // IDに基づいてCitationを検索
        let selectedCitation = citations.find((citation: CitationItem) => citation.id === id);
        
        // IDが見つからない場合、名前で検索を試行
        if (!selectedCitation) {
          console.log('Citation not found by ID, trying to match by name:', name);
          selectedCitation = citations.find((citation: CitationItem) => 
            citation.metadata === name || citation.metadata.includes(name)
          );
        }
        
        // それでも見つからない場合、インデックスで検索
        if (!selectedCitation && citations.length >= index) {
          console.log('Citation not found by name, using index:', index - 1);
          selectedCitation = citations[index - 1];
        }
        
        console.log('Selected citation:', selectedCitation);
        console.log('Selected citation details:', selectedCitation ? {
          id: selectedCitation.id,
          metadata: selectedCitation.metadata,
          hasPageContent: !!selectedCitation.pageContent,
          pageContentLength: selectedCitation.pageContent?.length || 0,
          pageContentPreview: selectedCitation.pageContent?.substring(0, 100) + '...',
          score: selectedCitation.score,
          sasUrl: selectedCitation.sasUrl
        } : 'No citation selected');
        
        if (selectedCitation) {
          console.log('Setting citation and opening panel');
          console.log('About to call setSelectedCitation and setIsCitationPanelOpen(true)');
          
          // pageContentが空の場合の詳細調査
          if (!selectedCitation.pageContent || selectedCitation.pageContent === 'コンテンツが見つかりません') {
            console.log('WARNING: Citation has no pageContent or default message');
            console.log('Citation raw data:', JSON.stringify(selectedCitation, null, 2));
            
            // より詳細な情報をCitationに追加
            selectedCitation.pageContent = `この参考資料の詳細情報を取得できませんでした。\n\n詳細情報:\n- Citation ID: ${selectedCitation.id}\n- メタデータ: ${selectedCitation.metadata}\n- スコア: ${selectedCitation.score}\n- SAS URL: ${selectedCitation.sasUrl ? '有り' : '無し'}`;
          }
          
          console.log('Calling setSelectedCitation with:', selectedCitation);
          setSelectedCitation(selectedCitation);
          
          console.log('Calling setIsCitationPanelOpen(true)');
          setIsCitationPanelOpen(true);
          
          // 状態変更後の確認
          setTimeout(() => {
            console.log('Citation panel should now be open. Checking context state...');
          }, 100);
        } else {
          console.log('Citation not found with any method');
          console.log('Creating fallback citation and opening panel');
          
          // フォールバック：基本的なCitationオブジェクトを作成
          const fallbackCitation: CitationItem = {
            id: id,
            metadata: name,
            pageContent: `この参考資料の詳細情報を取得できませんでした。\n\nデバッグ情報:\n- 検索ID: ${id}\n- ファイル名: ${name}\n- インデックス: ${index}\n- 利用可能Citation数: ${citations.length}`,
            sasUrl: '',
            score: 0,
            deptName: '',
            documentId: ''
          };
          
          console.log('Calling setSelectedCitation with fallback:', fallbackCitation);
          setSelectedCitation(fallbackCitation);
          
          console.log('Calling setIsCitationPanelOpen(true) for fallback');
          setIsCitationPanelOpen(true);
        }
      } else {
        console.error('Citation API error:', response.status, response.statusText);
        console.log('Creating error fallback citation and opening panel');
        
        // エラーの場合もフォールバックCitationを表示
        const fallbackCitation: CitationItem = {
          id: id,
          metadata: name,
          pageContent: `この参考資料の詳細情報を取得中にエラーが発生しました。\n\nエラー詳細:\n- ステータス: ${response.status}\n- エラー: ${response.statusText}`,
          sasUrl: '',
          score: 0,
          deptName: '',
          documentId: ''
        };
        
        console.log('Calling setSelectedCitation with error fallback:', fallbackCitation);
        setSelectedCitation(fallbackCitation);
        
        console.log('Calling setIsCitationPanelOpen(true) for error fallback');
        setIsCitationPanelOpen(true);
      }
    } catch (error) {
      console.error('Error fetching citation data:', error);
      console.log('Creating catch error fallback citation and opening panel');
      
      // エラーの場合もフォールバックCitationを表示
      const fallbackCitation: CitationItem = {
        id: id,
        metadata: name,
        pageContent: `この参考資料の詳細情報を取得中にエラーが発生しました。\n\nエラー詳細:\n- エラー: ${error instanceof Error ? error.message : String(error)}`,
        sasUrl: '',
        score: 0,
        deptName: '',
        documentId: ''
      };
      
      console.log('Calling setSelectedCitation with catch error fallback:', fallbackCitation);
      setSelectedCitation(fallbackCitation);
      
      console.log('Calling setIsCitationPanelOpen(true) for catch error fallback');
      setIsCitationPanelOpen(true);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-2 cursor-pointer"
      onClick={handleCitationClick}
    >
      <FileText className="w-4 h-4" />
      <span className="text-xs">{name}</span>
      <span className="text-xs text-gray-500">({index})</span>
    </Button>
  );
}
