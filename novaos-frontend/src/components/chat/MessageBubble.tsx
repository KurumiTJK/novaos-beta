// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE — Chat Message Display
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { cn } from '../../utils';
import { Card, StanceBadge } from '../ui';
import type { Message, Stance } from '../../types';
import { getStanceColors } from '../../utils/theme';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
  isLatest?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function MessageBubble({ message, isLatest = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const stance = message.stance || 'lens';
  const colors = getStanceColors(stance);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] bg-blue-600 rounded-2xl rounded-br-md px-4 py-2">
          <p className="text-white text-sm">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <Card
        stance={stance}
        variant="outlined"
        padding="md"
        className={cn(
          'max-w-[85%] rounded-2xl rounded-bl-md',
          stance === 'shield' && 'border-2'
        )}
      >
        {/* Stance indicator */}
        <div className="flex items-center gap-2 mb-2">
          <StanceBadge stance={stance} />
        </div>

        {/* Message content */}
        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>

        {/* Metadata */}
        {message.metadata && (
          <div className="mt-3 p-2 bg-gray-900/50 rounded-lg">
            {message.metadata.confidence && (
              <p className="text-gray-400 text-xs">
                📊 Confidence: {message.metadata.confidence}
              </p>
            )}
            {message.metadata.freshness && (
              <p className="text-gray-400 text-xs">
                🕐 Freshness: {message.metadata.freshness}
              </p>
            )}
            {message.metadata.liveData && (
              <p className="text-gray-400 text-xs">
                🌐 Includes live data
              </p>
            )}
          </div>
        )}

        {/* Expansion prompt for lens mode */}
        {stance === 'lens' && isLatest && (
          <p className="text-gray-400 text-xs mt-2">
            Would you like me to expand on this?
          </p>
        )}

        {/* Shield warning actions */}
        {stance === 'shield' && isLatest && (
          <div className="mt-3 flex gap-2">
            <button className="flex-1 py-2 px-3 rounded-lg bg-gray-800 text-gray-300 text-xs border border-gray-700 hover:bg-gray-700 transition-colors">
              Review Alternatives
            </button>
            <button className={cn(
              'flex-1 py-2 px-3 rounded-lg text-xs border transition-colors',
              colors.bg, colors.text, colors.borderLight,
              'hover:opacity-80'
            )}>
              Override
            </button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export default MessageBubble;
