// ═══════════════════════════════════════════════════════════════════════════════
// MODULES FEATURE — Module Page
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StatusBar,
  Card,
  ChatInput,
  BackButton,
  Badge,
  SectionHeader,
} from '../../../shared/components';
import { MessageBubble } from '../../chat';
import { cn, moduleColors, generateId } from '../../../shared/utils';
import type { ModuleType, Message } from '../../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE CONFIGS
// ─────────────────────────────────────────────────────────────────────────────────

const moduleConfigs: Record<ModuleType, {
  title: string;
  description: string;
  quickActions: string[];
}> = {
  finance: {
    title: 'Finance',
    description: 'Track spending, investments, and budgets',
    quickActions: ['Show my portfolio', 'Recent transactions', 'Budget status'],
  },
  health: {
    title: 'Health',
    description: 'Monitor vitals, activity, and wellness',
    quickActions: ['Today\'s steps', 'Sleep analysis', 'Heart rate trends'],
  },
  calendar: {
    title: 'Calendar',
    description: 'Manage events and schedule',
    quickActions: ['Today\'s events', 'This week', 'Add event'],
  },
  weather: {
    title: 'Weather',
    description: 'Forecasts and conditions',
    quickActions: ['Current weather', '5-day forecast', 'Rain alerts'],
  },
  reminders: {
    title: 'Reminders',
    description: 'Tasks and to-dos',
    quickActions: ['Due today', 'Add reminder', 'All tasks'],
  },
  email: {
    title: 'Email',
    description: 'Inbox and messages',
    quickActions: ['Unread emails', 'Important', 'Draft email'],
  },
  maps: {
    title: 'Maps',
    description: 'Navigation and places',
    quickActions: ['Nearby places', 'Directions home', 'Traffic'],
  },
  abilities: {
    title: 'Abilities',
    description: 'Nova\'s skills and integrations',
    quickActions: ['Available tools', 'Connect service', 'Settings'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const module = moduleId as ModuleType;
  const config = moduleConfigs[module];
  const colors = moduleColors[module];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!config) {
    navigate('/');
    return null;
  }

  const handleSend = async (content: string) => {
    // Add user message
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // TODO: Send to backend with module context
    // For now, add mock response
    setTimeout(() => {
      const assistantMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: getMockResponse(module, content),
        timestamp: new Date(),
        stance: 'lens',
        confidence: 0.9,
        freshness: 'verified',
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 1000);
  };

  const handleQuickAction = (action: string) => {
    handleSend(action);
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <StatusBar />

      {/* Header */}
      <div className={cn('px-4 py-3 border-b border-gray-800', colors.bg)}>
        <div className="flex items-center gap-3">
          <BackButton to="/" />
          <div className="flex items-center gap-2">
            <span className="text-2xl">{colors.icon}</span>
            <div>
              <h1 className={cn('font-bold', colors.text)}>{config.title}</h1>
              <p className="text-gray-500 text-xs">{config.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <ModuleHome
            module={module}
            config={config}
            colors={colors}
            onQuickAction={handleQuickAction}
          />
        ) : (
          <div className="px-4 py-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <Card className="px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 bg-gray-500 rounded-full"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isLoading}
        placeholder={`Ask about ${config.title.toLowerCase()}...`}
        stance="lens"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE HOME
// ─────────────────────────────────────────────────────────────────────────────────

interface ModuleHomeProps {
  module: ModuleType;
  config: typeof moduleConfigs[ModuleType];
  colors: typeof moduleColors[ModuleType];
  onQuickAction: (action: string) => void;
}

function ModuleHome({ module, config, colors, onQuickAction }: ModuleHomeProps) {
  return (
    <div className="px-4 py-6 space-y-6">
      {/* Widget */}
      <ModuleWidget module={module} />

      {/* Quick Actions */}
      <div>
        <SectionHeader title="Quick Actions" />
        <div className="space-y-2">
          {config.quickActions.map((action) => (
            <motion.button
              key={action}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickAction(action)}
              className={cn(
                'w-full p-3 rounded-xl text-left',
                'bg-gray-800/50 border border-gray-700/50',
                'hover:bg-gray-800 transition-colors'
              )}
            >
              <span className="text-gray-200 text-sm">{action}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE WIDGETS
// ─────────────────────────────────────────────────────────────────────────────────

function ModuleWidget({ module }: { module: ModuleType }) {
  switch (module) {
    case 'finance':
      return <FinanceWidget />;
    case 'health':
      return <HealthWidget />;
    case 'weather':
      return <WeatherWidget />;
    default:
      return null;
  }
}

function FinanceWidget() {
  return (
    <Card variant="gradient" stance="sword">
      <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">
        Portfolio Overview
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">$124,582</span>
        <Badge variant="success" size="sm">+2.4%</Badge>
      </div>
      <p className="text-gray-500 text-xs mt-1">Total value • Updated just now</p>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center p-2 bg-gray-800/50 rounded-lg">
          <p className="text-emerald-400 text-sm font-bold">$82,340</p>
          <p className="text-gray-500 text-xs">Stocks</p>
        </div>
        <div className="text-center p-2 bg-gray-800/50 rounded-lg">
          <p className="text-blue-400 text-sm font-bold">$31,200</p>
          <p className="text-gray-500 text-xs">Crypto</p>
        </div>
        <div className="text-center p-2 bg-gray-800/50 rounded-lg">
          <p className="text-amber-400 text-sm font-bold">$11,042</p>
          <p className="text-gray-500 text-xs">Cash</p>
        </div>
      </div>
    </Card>
  );
}

function HealthWidget() {
  return (
    <Card variant="gradient" stance="control">
      <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">
        Today's Activity
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-3xl font-bold text-white">8,432</p>
          <p className="text-gray-500 text-xs">steps</p>
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-rose-500 rounded-full" style={{ width: '84%' }} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-white">72</p>
          <p className="text-gray-500 text-xs">avg BPM</p>
          <p className="text-emerald-400 text-xs mt-2">Normal</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-white">7.2</p>
          <p className="text-gray-500 text-xs">hrs sleep</p>
          <p className="text-amber-400 text-xs mt-2">Fair</p>
        </div>
      </div>
    </Card>
  );
}

function WeatherWidget() {
  return (
    <Card variant="gradient">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs">Irvine, CA</p>
          <p className="text-5xl font-bold text-white mt-1">72°</p>
          <p className="text-gray-400 text-sm mt-1">Partly Cloudy</p>
        </div>
        <span className="text-6xl">⛅</span>
      </div>

      <div className="grid grid-cols-5 gap-2 mt-4">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => (
          <div key={day} className="text-center p-2 bg-gray-800/50 rounded-lg">
            <p className="text-gray-500 text-xs">{day}</p>
            <span className="text-lg">{['☀️', '⛅', '☀️', '🌧️', '☀️'][i]}</span>
            <p className="text-white text-xs font-medium">{72 + i * 2}°</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK RESPONSES
// ─────────────────────────────────────────────────────────────────────────────────

function getMockResponse(module: ModuleType, query: string): string {
  const responses: Record<ModuleType, Record<string, string>> = {
    finance: {
      'Show my portfolio': 'Your portfolio is valued at $124,582, up 2.4% from last week. Your top performers are AAPL (+5.2%) and NVDA (+4.8%). Would you like a detailed breakdown?',
      'Recent transactions': 'Here are your last 5 transactions:\n\n1. Starbucks - $6.45 (Today)\n2. Amazon - $34.99 (Yesterday)\n3. Uber - $18.22 (2 days ago)\n4. Whole Foods - $87.32 (3 days ago)\n5. Netflix - $15.99 (5 days ago)\n\nTotal spent this week: $162.97',
      'Budget status': 'You\'ve spent $1,234 of your $2,000 monthly budget (62%). At this pace, you\'ll end the month under budget by ~$180. Categories:\n\n• Food: $420 / $500 (84%)\n• Transport: $180 / $300 (60%)\n• Entertainment: $95 / $200 (48%)',
      default: 'I can help you track your finances. Try asking about your portfolio, transactions, or budget status.',
    },
    health: {
      'Today\'s steps': 'You\'ve walked 8,432 steps today, which is 84% of your 10,000 step goal. You\'ve burned approximately 342 calories from walking. Keep it up!',
      'Sleep analysis': 'Last night you slept 7.2 hours (11:30 PM - 6:42 AM).\n\n• Deep sleep: 1.8 hrs (25%)\n• REM sleep: 1.5 hrs (21%)\n• Light sleep: 3.9 hrs (54%)\n\nYour sleep efficiency was 89%, which is good. Try to get to bed 30 minutes earlier for optimal rest.',
      'Heart rate trends': 'Your resting heart rate this week averaged 68 BPM, which is in the normal range. During your workout yesterday, you reached a max of 156 BPM. Your HRV is 45ms, indicating good recovery.',
      default: 'I can help you monitor your health metrics. Ask about steps, sleep, heart rate, or other vitals.',
    },
    weather: {
      'Current weather': 'It\'s currently 72°F and partly cloudy in Irvine, CA. Humidity is 45% and winds are light at 5 mph from the west. UV index is moderate (5).',
      '5-day forecast': 'Here\'s your 5-day forecast for Irvine:\n\n• Mon: 72°F ☀️\n• Tue: 74°F ⛅\n• Wed: 76°F ☀️\n• Thu: 68°F 🌧️ (40% chance rain)\n• Fri: 71°F ☀️\n\nOverall, a pleasant week ahead!',
      'Rain alerts': 'There\'s a 40% chance of rain on Thursday. I\'ll send you a reminder Wednesday evening if the forecast holds.',
      default: 'I can provide weather information. Ask about current conditions, forecasts, or weather alerts.',
    },
    calendar: {
      default: 'I can help manage your calendar. Try asking about today\'s events, this week\'s schedule, or adding new events.',
    },
    reminders: {
      default: 'I can help with your reminders and tasks. Ask about due items, or tell me what you\'d like to be reminded about.',
    },
    email: {
      default: 'I can help with your email. Ask about unread messages, important emails, or draft a new message.',
    },
    maps: {
      default: 'I can help with navigation and places. Ask about nearby locations, directions, or traffic conditions.',
    },
    abilities: {
      default: 'Here are Nova\'s current abilities:\n\n• Finance tracking (connected)\n• Health monitoring (connected)\n• Weather forecasts (connected)\n• Calendar management (ready to connect)\n• Email (ready to connect)\n• Maps & navigation (connected)\n\nWould you like to connect additional services?',
    },
  };

  const moduleResponses = responses[module];
  return moduleResponses[query] || moduleResponses.default;
}
