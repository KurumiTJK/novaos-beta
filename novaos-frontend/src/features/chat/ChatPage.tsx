// ═══════════════════════════════════════════════════════════════════════════════
// CHAT PAGE — Dark Mode Grok Design (iPhone 16 Pro Optimized)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useUIStore, useChatStore } from '@/shared/stores';
import { useHaptic, useAutoResize } from '@/shared/hooks';
import { LoadingDots } from '@/shared/components';
import {
  CloseIcon,
  ChevronRightIcon,
  EditIcon,
  AttachIcon,
  SearchIcon,
  LightbulbIcon,
  MicIcon,
  VoiceWaveIcon,
  SendIcon,
  RefreshIcon,
  CopyIcon,
  ShareIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
} from '@/shared/components/Icons';

export function ChatPage() {
  const { closeChat } = useUIStore();
  const { messages, isLoading, sendMessage } = useChatStore();
  const haptic = useHaptic();
  const autoResize = useAutoResize();
  
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClose = () => {
    haptic('light');
    closeChat();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    autoResize(e.target);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    haptic('medium');
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    await sendMessage(text);
  };

  const hasInput = inputValue.trim().length > 0;

  return (
    <div 
      className="fixed inset-0 max-w-[430px] mx-auto flex flex-col z-50"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-5 py-3"
        style={{ 
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          backgroundColor: '#000000'
        }}
      >
        <button
          onClick={handleClose}
          className="w-11 h-11 flex items-center justify-center rounded-xl active:bg-white/10"
          style={{ color: '#FFFFFF' }}
        >
          <CloseIcon size={24} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22C55E' }} />
          <span className="font-semibold text-lg" style={{ color: '#FFFFFF' }}>Nova 1</span>
          <ChevronRightIcon size={16} className="text-white/40" />
        </div>

        <button 
          className="w-11 h-11 flex items-center justify-center rounded-xl active:bg-white/10"
          style={{ color: '#FFFFFF' }}
        >
          <EditIcon size={22} />
        </button>
      </div>

      {/* Messages - scrollable area */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {messages.map((message) => (
          <div key={message.id} className="mb-5">
            {message.role === 'user' ? (
              <div className="flex justify-end">
                <div 
                  className="max-w-[85%] px-5 py-3.5 rounded-3xl text-[17px] leading-relaxed"
                  style={{ backgroundColor: '#1C1C1E', color: '#FFFFFF' }}
                >
                  {message.content}
                </div>
              </div>
            ) : message.isLoading ? (
              <div className="py-2">
                <LoadingDots />
              </div>
            ) : (
              <div className="pr-10">
                <div 
                  className="text-[17px] leading-[1.7]"
                  style={{ color: '#FFFFFF' }}
                  dangerouslySetInnerHTML={{ 
                    __html: formatResponse(message.content) 
                  }}
                />
                <MessageActions />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div 
        className="px-4 pt-2"
        style={{ 
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          backgroundColor: '#000000'
        }}
      >
        {/* Dark Card */}
        <div 
          className="rounded-[32px] overflow-hidden"
          style={{ 
            backgroundColor: '#1C1C1E',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {/* Textarea */}
          <div className="px-5 pt-5 pb-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask Anything"
              rows={1}
              className="w-full bg-transparent text-[17px] placeholder:text-white/40 outline-none resize-none leading-relaxed"
              style={{ 
                color: '#FFFFFF',
                minHeight: '24px', 
                maxHeight: '120px' 
              }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center px-3 pb-3 gap-2">
            {/* Attach button */}
            <button 
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20"
              style={{ color: '#FFFFFF' }}
            >
              <AttachIcon size={20} />
            </button>

            {/* DeepSearch pill - outlined style */}
            <button 
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/20 text-sm font-medium"
              style={{ color: '#FFFFFF' }}
            >
              <SearchIcon size={16} />
              <span>DeepSearch</span>
            </button>

            {/* Think pill - outlined style */}
            <button 
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/20 text-sm font-medium"
              style={{ color: '#FFFFFF' }}
            >
              <LightbulbIcon size={16} />
              <span>Think</span>
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Mic button */}
            <button className="w-10 h-10 flex items-center justify-center text-white/40">
              <MicIcon size={22} />
            </button>

            {/* Voice/Send/Stop button */}
            {isLoading ? (
              <button 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#FFFFFF' }}
              >
                <div className="w-4 h-4 bg-black rounded-sm" />
              </button>
            ) : hasInput ? (
              <button
                onClick={handleSend}
                className="w-12 h-12 rounded-full flex items-center justify-center text-black active:opacity-80"
                style={{ backgroundColor: '#FFFFFF' }}
              >
                <SendIcon size={20} />
              </button>
            ) : (
              <button 
                className="w-12 h-12 rounded-full flex items-center justify-center text-black"
                style={{ backgroundColor: '#FFFFFF' }}
              >
                <VoiceWaveIcon size={22} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// MESSAGE ACTIONS
// ─────────────────────────────────────────────────────────────────────────────────

function MessageActions() {
  const haptic = useHaptic();

  const handleAction = (action: string) => {
    haptic('light');
    console.log('Action:', action);
  };

  return (
    <div className="flex gap-1 mt-5">
      {[
        { action: 'regenerate', Icon: RefreshIcon, title: 'Regenerate' },
        { action: 'copy', Icon: CopyIcon, title: 'Copy' },
        { action: 'share', Icon: ShareIcon, title: 'Share' },
        { action: 'good', Icon: ThumbsUpIcon, title: 'Good' },
        { action: 'bad', Icon: ThumbsDownIcon, title: 'Bad' },
      ].map(({ action, Icon, title }) => (
        <button
          key={action}
          onClick={() => handleAction(action)}
          className="w-9 h-9 flex items-center justify-center text-white/40 rounded-lg active:bg-white/10"
          title={title}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function formatResponse(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-4">')
    .replace(/\n/g, '<br />');
}
