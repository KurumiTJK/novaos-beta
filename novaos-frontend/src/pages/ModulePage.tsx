// ═══════════════════════════════════════════════════════════════════════════════
// MODULE PAGE — Persistent Module Sessions
// ═══════════════════════════════════════════════════════════════════════════════
//
// Modules are contextual interfaces for specific domains:
// Finance, Health, Calendar, Weather, Reminders, Email, Maps, Abilities
//
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { StatusBar, Card, Button, ChatInput } from '../components/ui';
import { useChatStore, useAppStore } from '../stores';
import { cn } from '../utils';
import { moduleColors, modules } from '../utils/theme';
import type { ModuleType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE CONFIGS
// ─────────────────────────────────────────────────────────────────────────────────

const moduleConfigs: Record<ModuleType, {
  title: string;
  icon: string;
  description: string;
  quickActions: Array<{ label: string; prompt: string }>;
}> = {
  finance: {
    title: 'Finance',
    icon: '📊',
    description: 'Portfolio tracking, investments, and financial planning',
    quickActions: [
      { label: 'Portfolio Overview', prompt: 'Show my portfolio performance' },
      { label: 'Recent Transactions', prompt: 'What are my recent transactions?' },
      { label: 'Market Update', prompt: 'Give me a market update' },
    ],
  },
  health: {
    title: 'Health',
    icon: '❤️',
    description: 'Vitals, workouts, nutrition, and wellness tracking',
    quickActions: [
      { label: 'Today\'s Stats', prompt: 'Show my health stats for today' },
      { label: 'Workout Plan', prompt: 'What\'s my workout for today?' },
      { label: 'Sleep Analysis', prompt: 'How was my sleep last night?' },
    ],
  },
  calendar: {
    title: 'Calendar',
    icon: '📅',
    description: 'Schedule management and event planning',
    quickActions: [
      { label: 'Today\'s Schedule', prompt: 'What\'s on my calendar today?' },
      { label: 'This Week', prompt: 'Show my schedule for this week' },
      { label: 'Free Time', prompt: 'When am I free this week?' },
    ],
  },
  weather: {
    title: 'Weather',
    icon: '🌤️',
    description: 'Current conditions and forecasts',
    quickActions: [
      { label: 'Current Weather', prompt: 'What\'s the weather right now?' },
      { label: 'Weekly Forecast', prompt: 'Show me the weekly forecast' },
      { label: 'Rain Check', prompt: 'Will it rain today?' },
    ],
  },
  reminders: {
    title: 'Reminders',
    icon: '⏰',
    description: 'Tasks, to-dos, and reminder management',
    quickActions: [
      { label: 'My Tasks', prompt: 'Show my pending tasks' },
      { label: 'Due Today', prompt: 'What\'s due today?' },
      { label: 'Add Reminder', prompt: 'I need to remember to...' },
    ],
  },
  email: {
    title: 'Email',
    icon: '✉️',
    description: 'Email management and composition',
    quickActions: [
      { label: 'Unread Emails', prompt: 'Do I have any important unread emails?' },
      { label: 'Draft Email', prompt: 'Help me write an email' },
      { label: 'Email Summary', prompt: 'Summarize my recent emails' },
    ],
  },
  maps: {
    title: 'Maps',
    icon: '📍',
    description: 'Directions, places, and navigation',
    quickActions: [
      { label: 'Get Directions', prompt: 'How do I get to...' },
      { label: 'Nearby Places', prompt: 'What restaurants are nearby?' },
      { label: 'Traffic Check', prompt: 'How\'s traffic to work?' },
    ],
  },
  abilities: {
    title: 'Abilities',
    icon: '⚡',
    description: 'Smart home, purchases, and advanced features',
    quickActions: [
      { label: 'Smart Home', prompt: 'Turn on the living room lights' },
      { label: 'Make Purchase', prompt: 'I want to buy...' },
      { label: 'Set Automation', prompt: 'Create an automation for...' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ModulePage() {
  const navigate = useNavigate();
  const { moduleId } = useParams<{ moduleId: ModuleType }>();
  const { sendMessage, isLoading, messages } = useChatStore();
  const { exitCurrentMode, setActiveModule } = useAppStore();

  const module = moduleId ? moduleConfigs[moduleId] : null;
  const colors = moduleId ? moduleColors[moduleId] : moduleColors.finance;

  useEffect(() => {
    if (moduleId) {
      setActiveModule(moduleId);
    }
  }, [moduleId, setActiveModule]);

  if (!module || !moduleId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950">
        <p className="text-gray-400">Module not found</p>
      </div>
    );
  }

  const handleExit = () => {
    exitCurrentMode();
    navigate('/');
  };

  const handleQuickAction = async (prompt: string) => {
    await sendMessage(prompt);
  };

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  // Filter messages for this module session
  const moduleMessages = messages.filter((msg) => {
    // In a real app, you'd filter by module context
    return true;
  });

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <StatusBar />

      {/* Module Header */}
      <div className={cn('px-4 py-3 border-b border-gray-800', colors.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExit}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <BackIcon className="w-5 h-5" />
            </button>
            <span className="text-2xl">{module.icon}</span>
            <div>
              <h1 className={cn('font-bold text-sm', colors.text)}>{module.title}</h1>
              <p className="text-gray-500 text-xs">{module.description}</p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors text-xl">
            ⚙️
          </button>
        </div>
      </div>

      {/* Module Content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
        {/* Quick Actions */}
        {moduleMessages.length === 0 && (
          <Card variant="outlined" padding="md">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
              Quick Actions
            </p>
            <div className="space-y-2">
              {module.quickActions.map((action, index) => (
                <motion.button
                  key={index}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickAction(action.prompt)}
                  className={cn(
                    'w-full p-3 rounded-lg text-left transition-colors',
                    'bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50'
                  )}
                >
                  <p className="text-gray-200 text-sm">{action.label}</p>
                </motion.button>
              ))}
            </div>
          </Card>
        )}

        {/* Module-specific placeholder content */}
        {moduleId === 'finance' && moduleMessages.length === 0 && (
          <FinanceWidget />
        )}

        {moduleId === 'health' && moduleMessages.length === 0 && (
          <HealthWidget />
        )}

        {moduleId === 'weather' && moduleMessages.length === 0 && (
          <WeatherWidget />
        )}

        {/* Messages */}
        {moduleMessages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'p-3 rounded-xl',
              message.role === 'user'
                ? 'bg-blue-600 ml-auto max-w-[80%]'
                : 'bg-gray-800 max-w-[85%]'
            )}
          >
            <p className="text-white text-sm">{message.content}</p>
          </div>
        ))}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800/50 rounded-xl px-4 py-3">
              <LoadingDots />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        placeholder={`Ask about ${module.title.toLowerCase()}...`}
        stance="lens"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER WIDGETS
// ─────────────────────────────────────────────────────────────────────────────────

function FinanceWidget() {
  return (
    <Card variant="gradient" padding="md" className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
      <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
        Portfolio Overview
      </p>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-white text-2xl font-bold">$124,532</span>
        <span className="text-emerald-400 text-sm mb-1">+2.4%</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="p-2 rounded-lg bg-gray-800/50 text-center">
          <p className="text-gray-500 text-xs">Stocks</p>
          <p className="text-white text-sm font-medium">$82,100</p>
        </div>
        <div className="p-2 rounded-lg bg-gray-800/50 text-center">
          <p className="text-gray-500 text-xs">Bonds</p>
          <p className="text-white text-sm font-medium">$28,432</p>
        </div>
        <div className="p-2 rounded-lg bg-gray-800/50 text-center">
          <p className="text-gray-500 text-xs">Cash</p>
          <p className="text-white text-sm font-medium">$14,000</p>
        </div>
      </div>
    </Card>
  );
}

function HealthWidget() {
  return (
    <Card variant="gradient" padding="md" className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
      <p className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
        Today's Health
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-gray-800/50 text-center">
          <p className="text-2xl">🚶</p>
          <p className="text-white text-sm font-medium">8,432</p>
          <p className="text-gray-500 text-xs">steps</p>
        </div>
        <div className="p-2 rounded-lg bg-gray-800/50 text-center">
          <p className="text-2xl">❤️</p>
          <p className="text-white text-sm font-medium">72</p>
          <p className="text-gray-500 text-xs">bpm</p>
        </div>
        <div className="p-2 rounded-lg bg-gray-800/50 text-center">
          <p className="text-2xl">😴</p>
          <p className="text-white text-sm font-medium">7.2h</p>
          <p className="text-gray-500 text-xs">sleep</p>
        </div>
      </div>
    </Card>
  );
}

function WeatherWidget() {
  return (
    <Card variant="gradient" padding="md" className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
      <p className="text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
        Current Weather
      </p>
      <div className="flex items-center gap-4">
        <span className="text-5xl">☀️</span>
        <div>
          <p className="text-white text-3xl font-bold">72°F</p>
          <p className="text-gray-400 text-sm">Sunny, clear skies</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => (
          <div key={day} className="flex-1 p-2 rounded-lg bg-gray-800/50 text-center">
            <p className="text-gray-500 text-xs">{day}</p>
            <p className="text-lg">{['☀️', '⛅', '☀️', '🌧️', '⛅'][i]}</p>
            <p className="text-white text-xs">{72 + i * 2}°</p>
          </div>
        ))}
      </div>
    </Card>
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

export default ModulePage;
