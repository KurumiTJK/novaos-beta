// ═══════════════════════════════════════════════════════════════════════════════
// ORIENT PHASE — Chat-based exploration
// User describes what they want to learn through conversation
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';

export function OrientPhase() {
  const {
    orientMessages,
    isLoading,
    sendOrientMessage,
    confirmOrient,
  } = useSwordDesignerStore();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orientMessages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const message = inputValue.trim();
    setInputValue('');
    await sendOrientMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirm = async () => {
    if (isLoading) return;
    await confirmOrient();
  };

  // Need at least 2 exchanges before confirming (1 AI + 1 user response)
  const canConfirm = orientMessages.length >= 3 && !isLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3">
        <h2 className="text-lg font-semibold text-white">What do you want to learn?</h2>
        <p className="text-sm text-white/50 mt-1">
          Tell me about your learning goal. I'll help you clarify it.
        </p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-5 space-y-4">
        {orientMessages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-green-500 text-black'
                  : 'bg-[#1C1C1E] text-white'
              }`}
            >
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1C1C1E] rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-5 py-4 border-t border-white/5">
        {/* Confirm Button (when ready) */}
        {canConfirm && (
          <button
            onClick={handleConfirm}
            className="w-full mb-3 py-2.5 bg-green-500/20 text-green-400 rounded-xl text-sm font-medium border border-green-500/30 active:bg-green-500/30 transition-colors"
          >
            ✓ I've shared enough — let's continue
          </button>
        )}

        {/* Chat Input */}
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-[#1C1C1E] rounded-2xl overflow-hidden">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to learn..."
              disabled={isLoading}
              className="w-full bg-transparent px-4 py-3 text-white text-[15px] placeholder-white/30 resize-none outline-none"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={`
              w-10 h-10 rounded-full flex items-center justify-center transition-all
              ${inputValue.trim() && !isLoading
                ? 'bg-green-500 text-black active:opacity-80'
                : 'bg-white/10 text-white/30'
              }
            `}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>

        {/* Hint */}
        <p className="text-xs text-white/30 mt-2 text-center">
          Share your goals, experience level, and any constraints
        </p>
      </div>
    </div>
  );
}
