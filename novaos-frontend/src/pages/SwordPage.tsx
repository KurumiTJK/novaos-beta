// ═══════════════════════════════════════════════════════════════════════════════
// SWORD PAGE — Learning Mode
// ═══════════════════════════════════════════════════════════════════════════════
//
// Implements Constitution §2.3:
// "Sword enables progress through Path + Spark components"
//
// Two views:
// 1. Path Generator - Create learning paths from goals
// 2. Daily Lesson - Active learning session
//
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusBar, Card, Button, Input } from '../components/ui';
import { useSwordStore, useAppStore } from '../stores';
import { cn } from '../utils';
import { stanceColors, staggerContainer, staggerItem } from '../utils/theme';

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function SwordPage() {
  const { activePath, currentLesson } = useSwordStore();

  // Show lesson view if in an active lesson, otherwise show path/generator
  if (currentLesson) {
    return <LessonView />;
  }

  if (activePath) {
    return <PathView />;
  }

  return <GeneratorView />;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATOR VIEW — Create New Learning Path
// ─────────────────────────────────────────────────────────────────────────────────

function GeneratorView() {
  const navigate = useNavigate();
  const { generatePath, isGenerating } = useSwordStore();
  const { exitCurrentMode } = useAppStore();

  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState('3 months');
  const [difficulty, setDifficulty] = useState('intermediate');

  const handleGenerate = async () => {
    if (goal.trim()) {
      await generatePath(goal, duration, difficulty);
    }
  };

  const handleExit = () => {
    exitCurrentMode();
    navigate('/');
  };

  const colors = stanceColors.sword;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-emerald-950/30 via-gray-950 to-gray-950">
      <StatusBar />

      {/* Header */}
      <div className={cn('px-4 py-3 border-b', colors.borderLight, colors.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-400 text-lg">⚔️</span>
            </span>
            <div>
              <h1 className="text-emerald-400 font-bold text-sm">Sword Mode</h1>
              <p className="text-emerald-300/70 text-xs">Create Learning Path</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExit}>
            Exit
          </Button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
        {/* Goal Input */}
        <Card stance="sword" variant="outlined" padding="lg">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            🎯 Define Your Goal
          </p>
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Learn machine learning fundamentals..."
            className="mb-3"
          />
          <div className="flex gap-2 flex-wrap">
            {['1 month', '3 months', '6 months'].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs transition-colors',
                  duration === d
                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {['beginner', 'intermediate', 'advanced'].map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs capitalize transition-colors',
                  difficulty === d
                    ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </Card>

        {/* How it works */}
        <Card variant="outlined" padding="md">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            How Sword Mode Works
          </p>
          <div className="space-y-2">
            {[
              { icon: '🎯', title: 'Goal', desc: 'Define what you want to learn' },
              { icon: '🗺️', title: 'Path', desc: 'AI generates your learning journey' },
              { icon: '📚', title: 'Quests', desc: 'Themed collections of lessons' },
              { icon: '✨', title: 'Spark', desc: 'Daily minimal action for momentum' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-gray-800/30">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="text-white text-sm font-medium">{item.title}</p>
                  <p className="text-gray-500 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Generate Button */}
      <div className="p-4 border-t border-gray-800">
        <Button
          variant="stance"
          stance="sword"
          fullWidth
          loading={isGenerating}
          disabled={!goal.trim()}
          onClick={handleGenerate}
          className="py-3"
        >
          Generate Learning Path
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PATH VIEW — View Generated Path & Quests
// ─────────────────────────────────────────────────────────────────────────────────

function PathView() {
  const navigate = useNavigate();
  const { activePath, startQuest, startLesson, clearPath } = useSwordStore();
  const { exitCurrentMode } = useAppStore();

  if (!activePath) return null;

  const handleExit = () => {
    clearPath();
    exitCurrentMode();
    navigate('/');
  };

  const handleStartQuest = (questId: string) => {
    startQuest(questId);
    // Start first lesson of quest
    startLesson(`lesson-${questId}-1`);
  };

  const colors = stanceColors.sword;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-emerald-950/30 via-gray-950 to-gray-950">
      <StatusBar />

      {/* Header */}
      <div className={cn('px-4 py-3 border-b', colors.borderLight, colors.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-400 text-lg">⚔️</span>
            </span>
            <div>
              <h1 className="text-emerald-400 font-bold text-sm">Your Path</h1>
              <p className="text-emerald-300/70 text-xs">{activePath.goal.duration}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExit}>
            Exit
          </Button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
        {/* Goal Summary */}
        <Card stance="sword" variant="outlined" padding="md">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            🎯 Your Goal
          </p>
          <p className="text-white font-medium">{activePath.goal.title}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
              {activePath.goal.duration}
            </span>
            <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs capitalize">
              {activePath.goal.difficulty}
            </span>
          </div>
        </Card>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${activePath.totalProgress}%` }}
            />
          </div>
          <span className="text-emerald-400 text-sm font-medium">
            {activePath.totalProgress}%
          </span>
        </div>

        {/* Quests */}
        <div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            📍 Your Quests
          </p>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-2"
          >
            {activePath.quests.map((quest) => (
              <motion.div
                key={quest.id}
                variants={staggerItem}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-colors',
                  quest.status === 'ready' || quest.status === 'in_progress'
                    ? 'bg-emerald-500/20 border border-emerald-500/30 cursor-pointer'
                    : quest.status === 'complete'
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-gray-800/30 border border-gray-700/30'
                )}
                onClick={() =>
                  (quest.status === 'ready' || quest.status === 'in_progress') &&
                  handleStartQuest(quest.id)
                }
              >
                <span className="text-xl">{quest.icon}</span>
                <div className="flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      quest.status === 'locked' ? 'text-gray-400' : 'text-white'
                    )}
                  >
                    {quest.title}
                  </p>
                  <p className="text-gray-500 text-xs">
                    Weeks {quest.weeks} • {quest.lessonCount} lessons
                  </p>
                </div>
                {quest.status === 'ready' ? (
                  <span className="px-2 py-1 rounded-full bg-emerald-500 text-white text-xs">
                    Start
                  </span>
                ) : quest.status === 'in_progress' ? (
                  <span className="text-emerald-400 text-xs">{quest.progress}%</span>
                ) : quest.status === 'complete' ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <span className="text-gray-600">🔒</span>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Today's Spark */}
        <Card variant="gradient" stance="shield" padding="md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">✨</span>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">
              Today's Spark
            </p>
          </div>
          <p className="text-gray-300 text-sm">
            Complete the intro video and answer 3 reflection questions.
          </p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-gray-500 text-xs">~15 minutes</span>
            <Button
              variant="stance"
              stance="shield"
              size="sm"
              onClick={() => startLesson('lesson-intro')}
            >
              Begin Spark →
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON VIEW — Active Learning Session
// ─────────────────────────────────────────────────────────────────────────────────

function LessonView() {
  const navigate = useNavigate();
  const {
    currentLesson,
    currentSectionIndex,
    currentSpark,
    completeSection,
    nextSection,
    previousSection,
    completeLesson,
    completeSpark,
    dayStreak,
    activePath,
  } = useSwordStore();

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  if (!currentLesson) return null;

  const currentSection = currentLesson.sections[currentSectionIndex];
  const isLastSection = currentSectionIndex === currentLesson.sections.length - 1;
  const completedSections = currentLesson.sections.filter((s) => s.completed).length;
  const progress = Math.round((completedSections / currentLesson.sections.length) * 100);

  const handleNext = () => {
    // Complete current section
    if (currentSection.type === 'quiz' && selectedAnswer !== null) {
      completeSection(currentSection.id, selectedAnswer);
    } else {
      completeSection(currentSection.id);
    }
    setSelectedAnswer(null);

    if (isLastSection) {
      completeLesson();
      completeSpark();
      navigate('/sword');
    } else {
      nextSection();
    }
  };

  const colors = stanceColors.sword;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-emerald-950/30 via-gray-950 to-gray-950">
      <StatusBar />

      {/* Lesson Header */}
      <div className={cn('px-4 py-3 border-b', colors.borderLight, colors.bg)}>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/sword')}
            className="text-gray-400 hover:text-white"
          >
            ←
          </button>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-xs">
              Day {currentLesson.dayNumber} of {activePath?.quests.reduce((a, q) => a + q.lessonCount, 0) || 84}
            </span>
            <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${(currentLesson.dayNumber / 84) * 100}%` }}
              />
            </div>
          </div>
          <button className="text-gray-400">⋯</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">📚</span>
          <div>
            <h1 className="text-white font-medium">{currentLesson.title}</h1>
            <p className="text-emerald-400 text-xs">
              Quest 1 • Lesson {currentLesson.dayNumber}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4">
        {/* Section Progress */}
        <div className="flex gap-1">
          {currentLesson.sections.map((section, index) => (
            <div
              key={section.id}
              className={cn(
                'flex-1 h-1 rounded-full',
                section.completed
                  ? 'bg-emerald-500'
                  : index === currentSectionIndex
                  ? 'bg-emerald-500/50'
                  : 'bg-gray-700'
              )}
            />
          ))}
        </div>

        {/* Current Section Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSection.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card variant="outlined" padding="lg">
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                Section {currentSectionIndex + 1} of {currentLesson.sections.length}
              </p>
              <h2 className="text-white font-medium mb-3">{currentSection.title}</h2>

              {currentSection.type === 'quiz' && currentSection.quiz ? (
                // Quiz Section
                <div>
                  <p className="text-gray-300 text-sm mb-3">{currentSection.quiz.question}</p>
                  <div className="space-y-2">
                    {currentSection.quiz.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedAnswer(index)}
                        className={cn(
                          'w-full p-3 rounded-lg text-left text-sm transition-colors',
                          selectedAnswer === index
                            ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300'
                            : 'bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-800'
                        )}
                      >
                        {option}
                        {selectedAnswer === index && (
                          <span className="float-right">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : currentSection.type === 'insight' ? (
                // Insight Section
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-gray-300 text-sm">{currentSection.content}</p>
                </div>
              ) : (
                // Content Section
                <p className="text-gray-300 text-sm leading-relaxed">
                  {currentSection.content}
                </p>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Spark Progress */}
        {currentSpark && (
          <Card variant="gradient" stance="shield" padding="md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <p className="text-amber-400 text-xs font-bold">Spark Progress</p>
                  <p className="text-gray-400 text-xs">
                    {completedSections} of {currentLesson.sections.length} sections
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">{progress}%</p>
                <p className="text-gray-500 text-xs">
                  ~{Math.round(currentLesson.estimatedMinutes * (1 - progress / 100))} min left
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={previousSection}
            disabled={currentSectionIndex === 0}
            className="px-4"
          >
            ← Back
          </Button>
          <Button
            variant="stance"
            stance="sword"
            fullWidth
            onClick={handleNext}
            disabled={currentSection.type === 'quiz' && selectedAnswer === null}
          >
            {isLastSection ? 'Complete Lesson' : 'Continue →'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SwordPage;
