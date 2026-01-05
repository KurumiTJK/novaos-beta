// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD FEATURE — Dashboard Page
// ═══════════════════════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  StatusBar,
  Card,
  StanceIndicator,
  Button,
  SectionHeader,
} from '../../shared/components';
import { useChatStore } from '../chat';
import { useControlStore } from '../control';
import { useSwordStore } from '../sword';
import { cn, stanceColors, moduleColors, animations, formatRelativeTime } from '../../shared/utils';
import type { Stance, ModuleType } from '../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const { conversations, currentStance } = useChatStore();
  const { isActive: isControlActive } = useControlStore();
  const { currentPath } = useSwordStore();

  const recentConversations = conversations.slice(0, 3);

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <StatusBar />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-4 pt-4 pb-6">
          <motion.div {...animations.fadeIn}>
            <p className="text-gray-500 text-sm">Good evening</p>
            <h1 className="text-2xl font-bold text-white mt-1">Nova</h1>
          </motion.div>
        </div>

        {/* Control Mode Alert */}
        {isControlActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-4"
          >
            <Card stance="control" hoverable onClick={() => navigate('/control')}>
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-3 h-3 bg-red-500 rounded-full"
                />
                <div className="flex-1">
                  <p className="text-red-400 font-medium">Control Mode Active</p>
                  <p className="text-red-400/60 text-xs">Tap to return to crisis support</p>
                </div>
                <span className="text-red-400">→</span>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions */}
        <div className="px-4 mb-6">
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-3">
            <QuickActionCard
              title="New Chat"
              subtitle="Ask Nova anything"
              icon="💬"
              stance="lens"
              onClick={() => navigate('/chat')}
            />
            <QuickActionCard
              title="Learn"
              subtitle={currentPath ? `Day ${currentPath.completedDays + 1}` : 'Start a path'}
              icon="⚔️"
              stance="sword"
              onClick={() => navigate('/sword')}
            />
          </div>
        </div>

        {/* Learning Progress (if active) */}
        {currentPath && (
          <div className="px-4 mb-6">
            <SectionHeader title="Learning Progress" />
            <Card stance="sword" hoverable onClick={() => navigate('/sword')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{currentPath.goal.title}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Day {currentPath.completedDays + 1} of {currentPath.totalDays}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold text-lg">
                    {currentPath.dayStreak}🔥
                  </p>
                  <p className="text-gray-500 text-xs">streak</p>
                </div>
              </div>
              <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentPath.completedDays / currentPath.totalDays) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </Card>
          </div>
        )}

        {/* Recent Conversations */}
        <div className="px-4 mb-6">
          <SectionHeader
            title="Recent"
            action={
              <button
                onClick={() => navigate('/chat')}
                className="text-blue-400 text-xs"
              >
                See all
              </button>
            }
          />
          {recentConversations.length > 0 ? (
            <div className="space-y-2">
              {recentConversations.map((conv) => (
                <Card
                  key={conv.id}
                  hoverable
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{conv.title}</p>
                      <p className="text-gray-500 text-xs truncate mt-0.5">
                        {conv.lastMessage || 'No messages'}
                      </p>
                    </div>
                    <p className="text-gray-600 text-xs ml-3">
                      {formatRelativeTime(new Date(conv.updatedAt))}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card variant="outlined" className="text-center py-8">
              <p className="text-gray-500 text-sm">No conversations yet</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/chat')}
                className="mt-2"
              >
                Start chatting →
              </Button>
            </Card>
          )}
        </div>

        {/* Modules */}
        <div className="px-4 mb-6">
          <SectionHeader title="Modules" />
          <div className="grid grid-cols-4 gap-3">
            {(['finance', 'health', 'calendar', 'weather'] as ModuleType[]).map((module) => (
              <ModuleButton
                key={module}
                module={module}
                onClick={() => navigate(`/module/${module}`)}
              />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3">
            {(['reminders', 'email', 'maps', 'abilities'] as ModuleType[]).map((module) => (
              <ModuleButton
                key={module}
                module={module}
                onClick={() => navigate(`/module/${module}`)}
              />
            ))}
          </div>
        </div>

        {/* Stance Indicator */}
        <div className="px-4 pb-8">
          <Card variant="gradient">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StanceIndicator stance={currentStance} size="lg" pulse />
                <div>
                  <p className="text-gray-400 text-xs">Current Mode</p>
                  <p className={cn('font-medium capitalize', stanceColors[currentStance].text)}>
                    {currentStance}
                  </p>
                </div>
              </div>
              <p className="text-gray-600 text-xs">
                Auto-detected
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────────

interface QuickActionCardProps {
  title: string;
  subtitle: string;
  icon: string;
  stance: Stance;
  onClick: () => void;
}

function QuickActionCard({ title, subtitle, icon, stance, onClick }: QuickActionCardProps) {
  const colors = stanceColors[stance];

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'p-4 rounded-2xl text-left transition-colors',
        colors.bgSubtle,
        colors.border,
        'border'
      )}
    >
      <span className="text-2xl">{icon}</span>
      <p className="text-white font-medium mt-2">{title}</p>
      <p className="text-gray-500 text-xs">{subtitle}</p>
    </motion.button>
  );
}

interface ModuleButtonProps {
  module: ModuleType;
  onClick: () => void;
}

function ModuleButton({ module, onClick }: ModuleButtonProps) {
  const colors = moduleColors[module];
  const labels: Record<ModuleType, string> = {
    finance: 'Finance',
    health: 'Health',
    calendar: 'Calendar',
    weather: 'Weather',
    reminders: 'Remind',
    email: 'Email',
    maps: 'Maps',
    abilities: 'Skills',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'p-3 rounded-xl flex flex-col items-center gap-1',
        colors.bg
      )}
    >
      <span className="text-xl">{colors.icon}</span>
      <span className={cn('text-xs', colors.text)}>{labels[module]}</span>
    </motion.button>
  );
}
