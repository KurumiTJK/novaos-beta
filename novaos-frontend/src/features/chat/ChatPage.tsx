// ═══════════════════════════════════════════════════════════════════════════════
// CHAT FEATURE — Chat Page
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StatusBar,
  ChatInput,
  BackButton,
  StanceIndicator,
  Button,
} from '../../shared/components';
import { MessageBubble } from './components';
import { useChatStore } from './chatStore';
import { useControlStore } from '../control';
import { cn } from '../../shared/utils';

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ChatPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    currentStance,
    isLoading,
    detectedCrisis,
    detectedLearning,
    sendMessage,
    loadConversation,
    resetDetectedModes,
  } = useChatStore();

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

  // Handle crisis detection
  useEffect(() => {
    if (detectedCrisis) {
      activateCrisis();
      navigate('/control');
      resetDetectedModes();
    }
  }, [detectedCrisis, activateCrisis, navigate, resetDetectedModes]);

  // Handle learning mode detection
  useEffect(() => {
    if (detectedLearning) {
      navigate('/sword');
      resetDetectedModes();
    }
  }, [detectedLearning, navigate, resetDetectedModes]);

  const handleSend = async (content: string) => {
    await sendMessage(content);
  };

  const handleExpand = () => {
    // Re-send with expansion request
    sendMessage('Please expand on that with more details.');
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <StatusBar />

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/" />
          <div className="flex items-center gap-2">
            <StanceIndicator stance={currentStance} size="md" />
            <span className="text-white font-medium">Nova</span>
          </div>
        </div>

        <button className="text-gray-400 hover:text-white transition-colors">
          <MoreIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyChat />
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onExpand={message.role === 'assistant' && message.stance === 'lens' ? handleExpand : undefined}
              />
            ))}
          </AnimatePresence>
        )}

        {/* Module suggestion */}
        {messages.length > 0 && (messages[messages.length - 1]?.gateResults?.tools?.tools_called?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/module/finance')}
            >
              Open in Finance Module →
            </Button>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        stance={currentStance}
        showAttach
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────────

function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
        <span className="text-2xl">N</span>
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">Nova is ready</h2>
      <p className="text-gray-400 text-sm mb-6">
        Your Shield, Lens, and Sword. Ask anything to get started.
      </p>

      {/* Quick prompts */}
      <div className="space-y-2 w-full max-w-xs">
        {[
          'Help me plan my day',
          'What should I focus on?',
          'Analyze my spending',
        ].map((prompt) => (
          <button
            key={prompt}
            onClick={() => useChatStore.getState().sendMessage(prompt)}
            className={cn(
              'w-full p-3 rounded-xl text-left text-sm',
              'bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50',
              'text-gray-300 hover:text-white transition-colors'
            )}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────────

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}
