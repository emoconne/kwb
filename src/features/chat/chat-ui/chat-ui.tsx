"use client";

import { FC } from "react";
import { useState } from "react";
import { useChatContext } from "./chat-context";
import { ChatMessageEmptyState } from "./chat-empty-state/chat-message-empty-state";
import ChatPromptEmptyState from "./chat-prompt/chat-prompt-empty-state";
import ChatInput from "./chat-input/chat-input";
import { ChatMessageContainer } from "./chat-message-container";
import { CitationPanel } from "./citation-panel";
import { WebSearchDebugPanel } from "./web-search-debug-panel";
interface Prop {}
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import {
  MessageCircle,
  Lightbulb,
} from "lucide-react";

import Box from '@mui/material/Box';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

export const ChatUI: FC<Prop> = () => {
  const { 
    messages, 
    isCitationPanelOpen, 
    setIsCitationPanelOpen,
    selectedCitation,
    setSelectedCitation,
    isWebSearchDebugPanelOpen,
    setIsWebSearchDebugPanelOpen,
    webSearchDebugInfo,
    chatBody
  } = useChatContext();
  const [value, setValue] = useState(0);

  // チャットタイプを取得
  const chatType = chatBody?.chatType || 'normal';
  
  // 参考資料ボタンを表示するチャットタイプ
  const showCitationPanel = chatType === 'doc' || chatType === 'data';
  
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  // Tailwind CSS変数を使用して統一された色を取得
  const getForegroundColor = () => 'hsl(var(--foreground))';
  const getMutedForegroundColor = () => 'hsl(var(--muted-foreground))';
  const getBorderColor = () => 'hsl(var(--border))';

  return (
    <div className="h-full relative overflow-auto flex-1 bg-card rounded-md shadow-md">
      <Tabs 
        value={value} 
        onChange={handleChange} 
        aria-label="設定画面"
        sx={{
          '& .MuiTabs-indicator': {
            backgroundColor: 'hsl(var(--primary))',
          },
          '& .MuiTab-root': {
            color: getMutedForegroundColor(),
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            minHeight: 48,
            transition: 'color 0.2s ease-in-out',
            '&:hover': {
              color: getForegroundColor(),
            },
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
            '& svg': {
              color: 'inherit',
            }
          },
          '& .MuiTab-root.Mui-selected': {
            color: getForegroundColor(),
            '& .MuiSvgIcon-root': {
              color: 'inherit',
            },
            '& svg': {
              color: 'inherit',
            }
          },
        }}
      >
        <Tab 
          icon={<MessageCircle size={18} />} 
          label="チャット画面" 
          {...a11yProps(0)} 
        />
        <Tab 
          icon={<Lightbulb size={18} />} 
          label="プロンプト集" 
          {...a11yProps(1)} 
        />
      </Tabs>

      <CustomTabPanel value={value} index={0}>
        {messages.length !== 0 ? (
          <ChatMessageContainer />
        ) : (
          <ChatMessageEmptyState />
        )}
        <div className="flex flex-col h-full overflow-auto">
          {/* Other content here */}
          <div className="mt-auto">
            <br/><br/><br/>
            <ChatInput />
          </div>
        </div>   
      </CustomTabPanel>

      <CustomTabPanel value={value} index={1}>
        <ChatPromptEmptyState />
      </CustomTabPanel>

               {/* Citation Panel（社内FAQとファイル読み込みのみ表示） */}
         {showCitationPanel && (
           <CitationPanel
             citations={[]}
             isOpen={isCitationPanelOpen}
             onClose={() => {
               setIsCitationPanelOpen(false);
               setSelectedCitation(null);
             }}
             selectedCitation={selectedCitation}
           />
         )}

      {/* Web Search Debug Panel */}
      <WebSearchDebugPanel
        isOpen={isWebSearchDebugPanelOpen}
        onClose={() => setIsWebSearchDebugPanelOpen(false)}
        debugInfo={webSearchDebugInfo || undefined}
      />
    </div>
  );
};