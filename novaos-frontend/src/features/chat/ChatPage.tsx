// ═══════════════════════════════════════════════════════════════════════════════
// CHAT PAGE — Dark Mode with Sidebar Navigation + Typing Animation
// With SwordGate Confirmation Buttons
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUIStore, useChatStore } from '@/shared/stores';
import { useHaptic } from '@/shared/hooks';
import { LoadingDots } from '@/shared/components';

// ─────────────────────────────────────────────────────────────────────────────────
// iOS KEYBOARD DETECTION HOOK
// ─────────────────────────────────────────────────────────────────────────────────

function useKeyboardOpen() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          const active = document.activeElement as HTMLElement;
          if (!active?.isContentEditable && active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
            setIsKeyboardOpen(false);
          }
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isKeyboardOpen;
}
import {
  MenuIcon,
  EditIcon,
  AttachIcon,
  HomeIcon,
  LockIcon,
  MicIcon,
  VoiceWaveIcon,
  SendIcon,
  RefreshIcon,
  CopyIcon,
  ShareIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  SearchIcon,
  MoreIcon,
  MoreHorizontalIcon,
  ArchiveIcon,
  TrashIcon,
} from '@/shared/components/Icons';
import { ConfirmationButtons, ActionTakenIndicator } from './components';
// ─────────────────────────────────────────────────────────────────────────────────
// TYPING ANIMATION CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

const TYPING_CONFIG = {
  // Chunk size (characters per chunk)
  chunkSize: 3,
  // Base delay between chunks (ms)
  baseDelay: 20,
  // Max animation time (ms) - prevents slow reveals for long responses
  maxAnimationTime: 2000,
  // Short response threshold - render instantly below this
  instantThreshold: 50,
};

// ─────────────────────────────────────────────────────────────────────────────────
// TYPED MESSAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

interface TypedMessageProps {
  content: string;
  messageId: string;
  onTypingComplete?: () => void;
}

function TypedMessage({ content, messageId: _messageId, onTypingComplete }: TypedMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const animationRef = useRef<number | null>(null);
  const initialContentRef = useRef(content);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    // Use the initial content only - ignore any updates
    const textToType = initialContentRef.current;
    
    // Already completed, don't restart
    if (hasCompletedRef.current) return;

    // Short responses: render instantly
    if (textToType.length <= TYPING_CONFIG.instantThreshold) {
      setDisplayedContent(textToType);
      setIsComplete(true);
      hasCompletedRef.current = true;
      onTypingComplete?.();
      return;
    }

    // Calculate delay to fit within maxAnimationTime
    const totalChunks = Math.ceil(textToType.length / TYPING_CONFIG.chunkSize);
    const calculatedDelay = Math.min(
      TYPING_CONFIG.baseDelay,
      TYPING_CONFIG.maxAnimationTime / totalChunks
    );

    let currentIndex = 0;
    const startTime = Date.now();

    const typeNextChunk = () => {
      if (currentIndex >= textToType.length) {
        setIsComplete(true);
        hasCompletedRef.current = true;
        onTypingComplete?.();
        return;
      }

      // Adaptive speed: go faster if we're behind schedule
      const elapsed = Date.now() - startTime;
      const expectedProgress = elapsed / TYPING_CONFIG.maxAnimationTime;
      const actualProgress = currentIndex / textToType.length;
      
      // If behind, catch up by increasing chunk size
      let chunkSize = TYPING_CONFIG.chunkSize;
      if (actualProgress < expectedProgress * 0.8) {
        chunkSize = Math.ceil(TYPING_CONFIG.chunkSize * 2);
      }

      const nextIndex = Math.min(currentIndex + chunkSize, textToType.length);
      setDisplayedContent(textToType.slice(0, nextIndex));
      currentIndex = nextIndex;

      animationRef.current = window.setTimeout(typeNextChunk, calculatedDelay);
    };

    // Start typing after a small delay
    animationRef.current = window.setTimeout(typeNextChunk, 50);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  // Only run once on mount - ignore all prop changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div 
      className="text-[17px] leading-[1.7]"
      style={{ color: '#FFFFFF' }}
    >
      <span dangerouslySetInnerHTML={{ __html: formatResponse(displayedContent) }} />
      {!isComplete && (
        <span className="inline-block w-0.5 h-5 bg-white/70 ml-0.5 animate-pulse" />
      )}
    </div>
  );
}

// Mock chat history data
const chatHistory = [
  { id: '1', title: 'Investment Strategy Q4', date: 'Today' },
  { id: '2', title: 'Health Goals Review', date: 'Today' },
  { id: '3', title: 'Calendar Planning', date: 'Yesterday' },
];

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN CHAT PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ChatPage() {
  const { closeChat, setActiveTab } = useUIStore();
  const { messages, isLoading, sendMessage, clearMessages } = useChatStore();
  const haptic = useHaptic();
  const isKeyboardOpen = useKeyboardOpen();
  
  const [inputValue, setInputValue] = useState('');
  const [isIncognito, setIsIncognito] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [typingMessageIds, setTypingMessageIds] = useState<Set<string>>(new Set());
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [shouldScrollToUser, setShouldScrollToUser] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);

  // Track which messages are new (for typing animation)
  const seenMessagesRef = useRef<Set<string>>(new Set());
  // Track if user has manually scrolled up
  const userScrolledRef = useRef(false);
  // Track if this is the initial mount
  const isInitialMountRef = useRef(true);

  // Mark existing messages as seen on mount (no auto-focus to prevent keyboard popup)
  useEffect(() => {
    // Mark all existing messages as already seen on initial mount
    // This prevents re-animation when returning to chat
    if (isInitialMountRef.current) {
      messages.forEach(msg => {
        if (msg.role === 'assistant' && !msg.isLoading) {
          seenMessagesRef.current.add(msg.id);
        }
      });
      isInitialMountRef.current = false;
    }
  }, []);

  // FIX: Scroll to bottom on initial mount (instant, no animation)
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = messagesContainerRef.current;
      if (container) {
        const messageElements = container.querySelectorAll('[data-message]');
        if (messageElements.length > 0) {
          const lastMessage = messageElements[messageElements.length - 1] as HTMLElement;
          lastMessage.scrollIntoView({ behavior: 'instant', block: 'end' });
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Check if scrolled to bottom
  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Find the last message element
    const messageElements = container.querySelectorAll('[data-message]');
    if (messageElements.length === 0) {
      setShowScrollButton(false);
      return;
    }
    
    const lastMessage = messageElements[messageElements.length - 1] as HTMLElement;
    const containerRect = container.getBoundingClientRect();
    const lastMsgRect = lastMessage.getBoundingClientRect();
    
    // Show button if bottom of last message is below the visible area
    const lastMsgBottomVisible = lastMsgRect.bottom <= containerRect.bottom + 50;
    
    setShowScrollButton(!lastMsgBottomVisible);
    userScrolledRef.current = !lastMsgBottomVisible;
  }, []);

  // Handle scroll events
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollPosition);
    return () => container.removeEventListener('scroll', checkScrollPosition);
  }, [checkScrollPosition]);

  // Check scroll position when messages change (but don't auto-scroll)
  useEffect(() => {
    checkScrollPosition();
  }, [messages, checkScrollPosition]);

  // Scroll to bottom function - scrolls to last message
  const scrollToBottom = useCallback(() => {
    haptic('light');
    const container = messagesContainerRef.current;
    if (container) {
      const messageElements = container.querySelectorAll('[data-message]');
      if (messageElements.length > 0) {
        const lastMessage = messageElements[messageElements.length - 1] as HTMLElement;
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
    setShowScrollButton(false);
    userScrolledRef.current = false;
  }, [haptic]);

  // Dynamic bottom padding - just enough to scroll last message to top
  const [bottomPadding, setBottomPadding] = useState(500); // Start with enough padding
  
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) {
      setBottomPadding(500); // Keep padding for scroll room
      return;
    }
    
    const calculatePadding = () => {
      const wrapper = container.firstElementChild as HTMLElement;
      if (!wrapper) return;
      
      const containerHeight = container.clientHeight;
      const messageElements = container.querySelectorAll('[data-message]');
      if (messageElements.length === 0) return;
      
      const lastMessage = messageElements[messageElements.length - 1] as HTMLElement;
      if (!lastMessage) return;
      
      // Get current values
      const lastMsgTop = lastMessage.offsetTop;
      const lastMsgHeight = lastMessage.offsetHeight;
      const currentScrollHeight = wrapper.scrollHeight;
      const currentPad = bottomPadding;
      
      // Content height without our dynamic padding
      const contentHeight = currentScrollHeight - currentPad;
      
      // Buffer = last message height + margin, so the whole last message stays visible
      const buffer = lastMsgHeight + 40;
      
      const neededPadding = Math.max(0, lastMsgTop - buffer + containerHeight - contentHeight);
      
      // Only update if significantly different to avoid loops
      if (Math.abs(neededPadding - currentPad) > 5) {
        setBottomPadding(neededPadding);
      }
    };
    
    // Calculate quickly after DOM updates
    const timer = setTimeout(calculatePadding, 150);
    
    return () => clearTimeout(timer);
  }, [messages.length, bottomPadding]); // Only recalc on message count change

  // Scroll to position user message at top of viewport
  useEffect(() => {
    if (shouldScrollToUser) {
      // Wait for DOM update and padding calculation
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          // Find all user messages and get the last one
          const userMessages = container.querySelectorAll('[data-user-message="true"]');
          const lastUserMsg = userMessages[userMessages.length - 1] as HTMLElement;
          
          if (lastUserMsg) {
            lastUserMsg.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          }
        }
        setShouldScrollToUser(false);
      }, 300);
    }
  }, [shouldScrollToUser, messages]);

  // Track new assistant messages for typing animation
  useEffect(() => {
    messages.forEach(msg => {
      // Only add to typing if:
      // 1. It's an assistant message
      // 2. Not loading
      // 3. Not already seen
      // 4. Not already in typing queue
      if (
        msg.role === 'assistant' && 
        !msg.isLoading && 
        !seenMessagesRef.current.has(msg.id) &&
        !typingMessageIds.has(msg.id)
      ) {
        // Mark as seen immediately to prevent double-adding
        seenMessagesRef.current.add(msg.id);
        setTypingMessageIds(prev => new Set(prev).add(msg.id));
        checkScrollPosition();
      }
    });
  }, [messages, checkScrollPosition, typingMessageIds]);

  const handleTypingComplete = useCallback((messageId: string) => {
    setTypingMessageIds(prev => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
    checkScrollPosition();
  }, [checkScrollPosition]);

  const handleOpenSidebar = () => {
    haptic('light');
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    haptic('light');
    setIsSidebarOpen(false);
  };

  const handleExit = () => {
    haptic('light');
    closeChat();
    setActiveTab('home');
  };

  const handleIncognitoToggle = () => {
    haptic('light');
    setIsIncognito(!isIncognito);
  };

  const handleContentEditableInput = () => {
    if (inputRef.current) {
      const text = inputRef.current.innerText || '';
      setInputValue(text);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    haptic('medium');
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.innerText = '';
      inputRef.current.blur(); // Close keyboard
    }

    // Set flag to scroll after message is added
    setShouldScrollToUser(true);

    // Start sending (don't await - let it happen in background)
    sendMessage(text);
  };

  const handleNewChat = () => {
    haptic('medium');
    setIsSidebarOpen(false);
    setIsMenuOpen(false);
    clearMessages();
  };

  const handleOpenMenu = () => {
    haptic('light');
    setIsMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  const handleMenuAction = (action: string) => {
    haptic('light');
    setIsMenuOpen(false);
    console.log('Menu action:', action);
    // TODO: Implement menu actions
  };

  const hasInput = inputValue.trim().length > 0;

  return (
    <div 
      className="fixed inset-0 max-w-[430px] mx-auto flex z-50"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/50 z-40"
          onClick={handleCloseSidebar}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`absolute top-0 left-0 h-full w-[85%] max-w-[320px] z-50 transform transition-transform duration-300 ease-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#FFFFFF' }}
      >
        <div 
          className="flex flex-col h-full"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* Search Bar */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-100 rounded-xl">
              <SearchIcon size={18} className="text-gray-400" />
              <span className="text-gray-400 text-[15px]">Search</span>
            </div>
          </div>

          {/* Nova Option */}
          <div className="px-4 py-2">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 rounded-xl">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">N</span>
              </div>
              <span className="text-black font-medium">Nova 1</span>
            </button>
          </div>

          {/* Explore / Modules */}
          <div className="px-4 py-2">
            <button 
              onClick={() => { handleCloseSidebar(); closeChat(); setActiveTab('modules'); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:bg-gray-100"
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <span className="text-black">Explore Modules</span>
            </button>
          </div>

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-gray-200" />

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto px-4">
            {chatHistory.map((chat, index) => (
              <div key={chat.id}>
                {(index === 0 || chatHistory[index - 1].date !== chat.date) && (
                  <p className="text-xs text-gray-400 mt-4 mb-2 px-2">{chat.date}</p>
                )}
                <button className="w-full text-left px-4 py-3 rounded-xl active:bg-gray-100">
                  <span className="text-black text-[15px]">{chat.title}</span>
                </button>
              </div>
            ))}
          </div>

          {/* User Profile */}
          <div 
            className="px-4 py-4 border-t border-gray-200"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
          >
            <button className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">V</span>
                </div>
                <span className="text-black font-medium">Vant</span>
              </div>
              <MoreIcon size={20} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header - Fixed */}
        <div 
          className="flex-shrink-0 flex items-center justify-between px-4 py-3"
          style={{ 
            paddingTop: 'calc(12px + env(safe-area-inset-top))',
            backgroundColor: '#000000'
          }}
        >
          {/* Left: Menu button + Nova 1 pill */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSidebar}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 active:bg-white/10"
              style={{ color: '#FFFFFF' }}
            >
              <MenuIcon size={20} />
            </button>

            <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 active:bg-white/10">
              <span className="text-[15px] font-medium" style={{ color: '#FFFFFF' }}>Nova 1</span>
            </button>
          </div>

          {/* Right: New chat + More menu */}
          <div className="flex items-center gap-0.5">
            <button 
              onClick={handleNewChat}
              className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10"
              style={{ color: '#FFFFFF' }}
            >
              <EditIcon size={20} />
            </button>
            <button 
              onClick={handleOpenMenu}
              className="w-10 h-10 flex items-center justify-center rounded-xl active:bg-white/10"
              style={{ color: '#FFFFFF' }}
            >
              <MoreHorizontalIcon size={20} />
            </button>
          </div>
        </div>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <>
            <div 
              className="fixed inset-0 z-50"
              onClick={handleCloseMenu}
            />
            <div 
              className="absolute right-4 z-50 w-56 rounded-2xl overflow-hidden shadow-xl"
              style={{ 
                top: 'calc(60px + env(safe-area-inset-top))',
                backgroundColor: '#2C2C2E',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              {/* Menu Header */}
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-white font-medium text-sm">Nova Chat</p>
              </div>
              
              {/* Menu Items */}
              <div className="py-1">
                <button 
                  onClick={() => handleMenuAction('share')}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <ShareIcon size={18} className="text-white/70" />
                  <span className="text-white text-[15px]">Share</span>
                </button>
                <button 
                  onClick={() => handleMenuAction('rename')}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <EditIcon size={18} className="text-white/70" />
                  <span className="text-white text-[15px]">Rename</span>
                </button>
                <button 
                  onClick={() => handleMenuAction('archive')}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <ArchiveIcon size={18} className="text-white/70" />
                  <span className="text-white text-[15px]">Archive</span>
                </button>
                <button 
                  onClick={() => handleMenuAction('delete')}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/10"
                >
                  <TrashIcon size={18} className="text-red-400" />
                  <span className="text-red-400 text-[15px]">Delete</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Messages - Scrollable, ChatGPT style with bottom padding for scroll room */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto min-h-0"
        >
          {/* Messages wrapper - dynamic bottom padding allows scrolling last message to top */}
          <div className="px-5 pt-5" style={{ paddingBottom: bottomPadding }}>
          {messages.map((message, index) => {
            // Check if this is the last user message in the array
            const lastUserIndex = messages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i !== -1).pop();
            const isLastUserMessage = message.role === 'user' && index === lastUserIndex;
            
            return (
              <div 
                key={message.id} 
                className="mb-5"
                ref={isLastUserMessage ? lastUserMessageRef : null}
                data-message="true"
                data-user-message={message.role === 'user' ? 'true' : undefined}
              >
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
                    {typingMessageIds.has(message.id) ? (
                      <TypedMessage
                        content={message.content}
                        messageId={message.id}
                        onTypingComplete={() => handleTypingComplete(message.id)}
                      />
                    ) : (
                      <>
                        <div 
                          className="text-[17px] leading-[1.7]"
                          style={{ color: '#FFFFFF' }}
                          dangerouslySetInnerHTML={{ 
                            __html: formatResponse(message.content) 
                          }}
                        />
                        
                        {/* Confirmation Buttons for Pending Actions */}
                        {message.pendingAction && (
                          <ConfirmationButtons 
                            messageId={message.id} 
                            pendingAction={message.pendingAction} 
                          />
                        )}
                        
                        {/* Show indicator after action taken */}
                        {message.actionTaken && (
                          <ActionTakenIndicator action={message.actionTaken} />
                        )}
                        
                        {/* Normal message actions (only if no pending action) */}
                        {!message.pendingAction && !message.actionTaken && (
                          <MessageActions />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Container - Fixed at bottom */}
        <div 
          className="flex-shrink-0 px-3 relative"
          style={{ 
            paddingTop: '8px',
            paddingBottom: isKeyboardOpen ? '0px' : 'calc(8px + env(safe-area-inset-bottom))',
            backgroundColor: '#000000'
          }}
        >
          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="absolute -top-12 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-[#2C2C2E] border border-white/20 flex items-center justify-center shadow-lg active:bg-[#3C3C3E] transition-all"
              style={{ color: '#FFFFFF' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
              </svg>
            </button>
          )}
          {/* Dark Card */}
          <div 
            className="rounded-[28px] overflow-hidden"
            style={{ 
              backgroundColor: '#1C1C1E',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {/* Input area */}
            <div className="px-4 pt-3 pb-2">
              <div
                ref={inputRef}
                contentEditable
                onInput={handleContentEditableInput}
                onPaste={handlePaste}
                data-placeholder="Ask Anything"
                className="w-full bg-transparent text-[16px] outline-none leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-white/40 break-words"
                style={{ 
                  color: '#FFFFFF',
                  minHeight: '24px', 
                  maxHeight: '120px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              />
            </div>

            {/* Bottom toolbar */}
            <div className="flex items-center px-2 pb-2 gap-1.5">
              {/* Attach button */}
              <button 
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                className="w-9 h-9 flex items-center justify-center rounded-full border border-white/20"
                style={{ color: '#FFFFFF' }}
              >
                <AttachIcon size={18} />
              </button>

              {/* Incognito pill - toggleable */}
              <button 
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => { e.preventDefault(); handleIncognitoToggle(); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                  isIncognito 
                    ? 'bg-white text-black border border-white' 
                    : 'border border-white/20 text-white'
                }`}
              >
                <LockIcon size={14} />
                <span>Incognito</span>
              </button>

              {/* Exit pill - goes to home */}
              <button 
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => { e.preventDefault(); handleExit(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/20 text-xs font-medium active:bg-white/10"
                style={{ color: '#FFFFFF' }}
              >
                <HomeIcon size={14} />
                <span>Exit</span>
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Mic button */}
              <button 
                tabIndex={-1} 
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                className="w-8 h-8 flex items-center justify-center text-white/40"
              >
                <MicIcon size={18} />
              </button>

              {/* Voice/Send/Stop button */}
              {isLoading ? (
                <button 
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  <div className="w-3 h-3 bg-black rounded-sm" />
                </button>
              ) : hasInput ? (
                <button
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => { e.preventDefault(); handleSend(); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-black active:opacity-80"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  <SendIcon size={16} />
                </button>
              ) : (
                <button 
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-black"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  <VoiceWaveIcon size={16} />
                </button>
              )}
            </div>
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
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in animation after mount
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleAction = (action: string) => {
    haptic('light');
    console.log('Action:', action);
  };

  return (
    <div 
      className={`flex gap-1 mt-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
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
          className="w-8 h-8 flex items-center justify-center text-white/50 rounded-lg active:bg-white/10 hover:text-white/70 transition-colors"
          title={title}
        >
          <Icon size={16} />
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
