// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE — Home Screen
// ═══════════════════════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { StatusBar, ChatInput, Card, StanceIndicator } from '../components/ui';
import { useChatStore, useAppStore } from '../stores';
import { modules, stanceColors, staggerContainer, staggerItem } from '../utils/theme';
import { cn, formatRelativeTime } from '../utils';
import type { Stance, ModuleType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const { sendMessage, conversations, isLoading } = useChatStore();
  const { enterModuleMode, setActiveStance } = useAppStore();

  const handleSendMessage = async (message: string) => {
    const response = await sendMessage(message);
    if (response) {
      // Check if we should enter a special mode
      if (response.gateResults?.intent?.output?.safety_signal === 'high') {
        navigate('/control');
      } else if (response.gateResults?.intent?.output?.learning_intent && response.stance === 'sword') {
        navigate('/sword');
      } else {
        navigate('/chat');
      }
    }
  };

  const handleModuleClick = (moduleId: ModuleType) => {
    enterModuleMode(moduleId);
    navigate(`/module/${moduleId}`);
  };

  const handleStanceClick = (stance: Stance) => {
    setActiveStance(stance);
    if (stance === 'sword') {
      navigate('/sword');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <StatusBar />

      {/* Header */}
      <div className="px-4 pt-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
            N
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">Nova</h1>
            <p className="text-gray-500 text-xs">Your Constitutional AI</p>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="px-4 pb-3">
        <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Modules</p>
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-4 gap-2"
        >
          {modules.map((mod) => (
            <motion.button
              key={mod.id}
              variants={staggerItem}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleModuleClick(mod.id as ModuleType)}
              className="flex flex-col items-center p-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-all border border-gray-700/50 hover:border-gray-600"
            >
              <span className="text-xl mb-1">{mod.icon}</span>
              <span className="text-gray-400 text-[10px]">{mod.name}</span>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Stances */}
      <div className="px-4 pb-3">
        <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Stances</p>
        <div className="flex gap-2">
          {(['shield', 'lens', 'sword'] as const).map((stance) => (
            <motion.button
              key={stance}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleStanceClick(stance)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg border border-opacity-30 transition-all',
                stanceColors[stance].bg,
                stanceColors[stance].border
              )}
            >
              <span className={cn('text-xs font-medium capitalize', stanceColors[stance].text)}>
                {stance}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="flex-1 px-4 overflow-hidden">
        <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Recent</p>
        <div className="space-y-2 overflow-y-auto max-h-[200px]">
          {conversations.length > 0 ? (
            conversations.slice(0, 5).map((conv) => (
              <motion.button
                key={conv.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="w-full text-left p-3 rounded-xl bg-gray-800/30 border border-gray-700/30 hover:bg-gray-800/50 transition-colors"
              >
                <p className="text-gray-300 text-sm truncate">
                  {conv.title || 'Conversation'}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {formatRelativeTime(conv.updatedAt)} • {conv.messageCount} messages
                </p>
              </motion.button>
            ))
          ) : (
            <>
              <Card variant="outlined" padding="md">
                <p className="text-gray-300 text-sm">How do I start investing?</p>
                <p className="text-gray-500 text-xs mt-1">2 hours ago • Lens</p>
              </Card>
              <Card variant="outlined" padding="md">
                <p className="text-gray-300 text-sm">Set up my workout plan</p>
                <p className="text-gray-500 text-xs mt-1">Yesterday • Sword</p>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Chat Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        placeholder="Ask Nova anything..."
        stance="lens"
      />
    </div>
  );
}

export default DashboardPage;
