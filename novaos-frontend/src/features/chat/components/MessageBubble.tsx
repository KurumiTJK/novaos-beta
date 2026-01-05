// ═══════════════════════════════════════════════════════════════════════════════
// CHAT FEATURE — Message Bubble Component
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { cn, stanceColors, formatTime } from '../../../shared/utils';
import { Card, StanceIndicator, Badge, LoadingDots } from '../../../shared/components';
import type { Message, Stance } from '../../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
  onOverrideShield?: () => void;
  onExpand?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function MessageBubble({ message, onOverrideShield, onExpand }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return <UserBubble message={message} />;
  }

  return (
    <AssistantBubble
      message={message}
      onOverrideShield={onOverrideShield}
      onExpand={onExpand}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER BUBBLE
// ─────────────────────────────────────────────────────────────────────────────────

function UserBubble({ message }: { message: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] bg-blue-600 rounded-2xl rounded-br-md px-4 py-3">
        <p className="text-white text-sm">{message.content}</p>
        <p className="text-blue-200/60 text-xs mt-1">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSISTANT BUBBLE
// ─────────────────────────────────────────────────────────────────────────────────

interface AssistantBubbleProps {
  message: Message;
  onOverrideShield?: () => void;
  onExpand?: () => void;
}

function AssistantBubble({ message, onOverrideShield, onExpand }: AssistantBubbleProps) {
  const stance = message.stance || 'lens';
  const colors = stanceColors[stance];
  const gateResults = message.gateResults;

  // Check for Shield warnings
  const hasShieldWarning = gateResults?.shield?.action === 'warn';
  const warnings = gateResults?.shield?.warnings || [];
  const conflicts = gateResults?.shield?.interest_conflicts || [];

  // Check for live data
  const hasLiveData = gateResults?.tools?.tools_called?.length > 0;

  if (message.isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-start"
      >
        <Card stance={stance} className="max-w-[85%]">
          <LoadingDots />
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <Card stance={stance} className="max-w-[85%]">
        {/* Stance indicator */}
        <div className="flex items-center justify-between mb-2">
          <StanceIndicator stance={stance} showLabel size="sm" />
          {message.confidence && (
            <ConfidenceBadge confidence={message.confidence} />
          )}
        </div>

        {/* Shield warnings */}
        {hasShieldWarning && warnings.length > 0 && (
          <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-400 text-xs font-medium mb-1">⚠️ Shield Warning</p>
            {warnings.map((warning, i) => (
              <p key={i} className="text-amber-200/80 text-xs">{warning}</p>
            ))}
            {conflicts.length > 0 && (
              <div className="mt-2 space-y-1">
                {conflicts.map((conflict, i) => (
                  <p key={i} className="text-amber-200/60 text-xs">
                    {conflict.higher} vs {conflict.lower}: {conflict.description}
                  </p>
                ))}
              </div>
            )}
            {onOverrideShield && (
              <button
                onClick={onOverrideShield}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline"
              >
                Override and continue
              </button>
            )}
          </div>
        )}

        {/* Message content */}
        <p className="text-gray-200 text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Metadata footer */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-700/50">
          <span className="text-gray-500 text-xs">
            {formatTime(message.timestamp)}
          </span>

          {message.freshness && (
            <FreshnessBadge freshness={message.freshness} />
          )}

          {hasLiveData && (
            <Badge variant="info" size="sm">
              Live Data
            </Badge>
          )}
        </div>

        {/* Lens expansion prompt */}
        {stance === 'lens' && onExpand && (
          <button
            onClick={onExpand}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Expand for more details →
          </button>
        )}
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
  const colors = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-red-400',
  };

  return (
    <span className={cn('text-xs', colors[level])}>
      {Math.round(confidence * 100)}% confident
    </span>
  );
}

function FreshnessBadge({ freshness }: { freshness: 'verified' | 'cached' | 'uncertain' }) {
  const configs = {
    verified: { label: 'Verified', variant: 'success' as const },
    cached: { label: 'Cached', variant: 'warning' as const },
    uncertain: { label: 'Uncertain', variant: 'error' as const },
  };

  const config = configs[freshness];

  return (
    <Badge variant={config.variant} size="sm">
      {config.label}
    </Badge>
  );
}
