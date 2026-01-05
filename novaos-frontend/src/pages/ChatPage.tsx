// ═══════════════════════════════════════════════════════════════════════════════
// CHAT PAGE — Conversation View
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBar, ChatInput, StanceIndicator, Button } from '../components/ui';
import { MessageBubble } from '../components/chat/MessageBubble';
import { useChatStore, useAppStore, useControlStore } from '../stores';
import { cn } from '../utils';

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ChatPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, isLoading, currentStance, loadConversation, lastIntent } = useChatStore();
  const { enterControlMode, enterSwordMode } = useAppStore();
  const { activateCrisis } = useControlStore();

  // Load conversation if ID provided
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId, loadConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const response = await sendMessage(content);
    
    if (response) {
      // Check for Control mode trigger (safety_signal: high)
      if (response.gateResults?.intent?.output?.safety_signal === 'high') {
        enterControlMode();
        activateCrisis('High safety signal detected');
        navigate('/control');
        return;
      }

      // Check for Sword mode trigger (learning_intent + SWORD stance)
      if (
        response.gateResults?.intent?.output?.learning_intent &&
        response.stance === 'sword'
      ) {
        enterSwordMode();
        navigate('/sword');
        return;
      }
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <StatusBar />

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-800">
        <button
          onClick={handleBack}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <BackIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-medium">Nova</h1>
          <StanceIndicator stance={currentStance} size="sm" />
        </div>
        <button className="text-gray-400 hover:text-white transition-colors text-xl">
          ⋯
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLatest={index === messages.length - 1}
            />
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-gray-800/50 rounded-2xl rounded-bl-md px-4 py-3">
              <LoadingDots />
            </div>
          </motion.div>
        )}

        {/* Module suggestion */}
        {lastIntent?.external_tool && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
              <span>📊</span>
              <span>Open Related Module</span>
              <span className="text-gray-500">→</span>
            </button>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        placeholder="Reply to Nova..."
        stance={currentStance}
        showAttachButton
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────────

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 bg-gray-500 rounded-full"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

export default ChatPage;
