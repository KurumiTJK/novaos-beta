// ═══════════════════════════════════════════════════════════════════════════════
// SWORD FEATURE — Sword Page (Learning Mode)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StatusBar,
  Button,
  Card,
  Input,
  BackButton,
  ProgressBar,
  Badge,
} from '../../../shared/components';
import { useSwordStore, type LearningGoal, type Quest, type LessonSection } from './swordStore';
import { cn, stanceColors } from '../../../shared/utils';

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function SwordPage() {
  const { currentView } = useSwordStore();

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-emerald-950/20 via-gray-950 to-gray-950">
      <StatusBar />

      <AnimatePresence mode="wait">
        {currentView === 'generator' && <GeneratorView key="generator" />}
        {currentView === 'path' && <PathView key="path" />}
        {currentView === 'lesson' && <LessonView key="lesson" />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATOR VIEW
// ─────────────────────────────────────────────────────────────────────────────────

function GeneratorView() {
  const navigate = useNavigate();
  const { generatePath, isGenerating, currentPath, setView } = useSwordStore();

  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState<LearningGoal['duration']>('3_months');
  const [difficulty, setDifficulty] = useState<LearningGoal['difficulty']>('intermediate');

  // If path exists, show option to continue
  const hasExistingPath = !!currentPath;

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    await generatePath({
      title: goal,
      description: `Learn ${goal} over ${duration.replace('_', ' ')}`,
      duration,
      difficulty,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <BackButton to="/" />
          <div>
            <h1 className="text-emerald-400 font-bold">Sword Mode</h1>
            <p className="text-gray-500 text-xs">Structured learning paths</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {hasExistingPath && (
          <Card stance="sword" className="p-4">
            <p className="text-emerald-400 text-sm font-medium mb-2">
              📚 Continue your current path?
            </p>
            <p className="text-gray-400 text-xs mb-3">
              {currentPath.goal.title} • Day {currentPath.completedDays + 1} of {currentPath.totalDays}
            </p>
            <Button
              variant="stance"
              stance="sword"
              size="sm"
              onClick={() => setView('path')}
            >
              Continue Learning
            </Button>
          </Card>
        )}

        <div className="text-center mb-6">
          <span className="text-4xl mb-3 block">⚔️</span>
          <h2 className="text-xl font-bold text-white mb-2">
            What do you want to learn?
          </h2>
          <p className="text-gray-400 text-sm">
            Nova will create a personalized learning path
          </p>
        </div>

        {/* Goal Input */}
        <div className="space-y-4">
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g., Machine Learning, Spanish, Piano..."
            className="text-center"
          />

          {/* Duration */}
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
              Duration
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['1_month', '3_months', '6_months'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={cn(
                    'p-3 rounded-xl text-sm font-medium transition-colors',
                    duration === d
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  )}
                >
                  {d.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
              Difficulty
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['beginner', 'intermediate', 'advanced'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    'p-3 rounded-xl text-sm font-medium transition-colors capitalize',
                    difficulty === d
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* How it works */}
        <Card variant="outlined" className="p-4">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">
            How it works
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">1.</span>
              <span className="text-gray-300">Set your learning goal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">2.</span>
              <span className="text-gray-300">Nova creates a structured path</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">3.</span>
              <span className="text-gray-300">Complete daily "Sparks" (~15 min)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">4.</span>
              <span className="text-gray-300">Build momentum with streaks</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Generate Button */}
      <div className="px-4 py-4 border-t border-gray-800 safe-bottom">
        <Button
          variant="stance"
          stance="sword"
          className="w-full"
          onClick={handleGenerate}
          disabled={!goal.trim() || isGenerating}
          isLoading={isGenerating}
        >
          {isGenerating ? 'Generating Path...' : 'Generate Learning Path'}
        </Button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PATH VIEW
// ─────────────────────────────────────────────────────────────────────────────────

function PathView() {
  const { currentPath, startQuest, startLesson, setView, clearPath } = useSwordStore();

  if (!currentPath) {
    return null;
  }

  const { goal, quests, completedDays, totalDays, dayStreak } = currentPath;
  const progress = (completedDays / totalDays) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => setView('generator')} />
            <div>
              <h1 className="text-emerald-400 font-bold">{goal.title}</h1>
              <p className="text-gray-500 text-xs">
                {goal.duration.replace('_', ' ')} • {goal.difficulty}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-emerald-400 font-bold">{dayStreak}🔥</p>
            <p className="text-gray-500 text-xs">streak</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Progress Card */}
        <Card stance="sword">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs">Overall Progress</p>
            <p className="text-emerald-400 text-sm font-bold">
              {completedDays}/{totalDays} days
            </p>
          </div>
          <ProgressBar value={progress} color="bg-emerald-500" />
        </Card>

        {/* Quests */}
        <div>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">
            Quests
          </p>
          <div className="space-y-3">
            {quests.map((quest, qIndex) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onStart={() => {
                  startQuest(qIndex);
                  // Start first lesson
                  const firstReadyLesson = quest.lessons.findIndex(
                    (l) => l.status === 'ready' || l.status === 'in_progress'
                  );
                  if (firstReadyLesson !== -1) {
                    startLesson(qIndex, firstReadyLesson);
                  }
                }}
              />
            ))}
          </div>
        </div>

        {/* Today's Spark */}
        <Card variant="gradient" stance="sword">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            Today's Spark
          </p>
          <p className="text-white font-medium">Day {completedDays + 1}</p>
          <p className="text-gray-400 text-sm mb-3">~15 minutes</p>
          <Button
            variant="stance"
            stance="sword"
            size="sm"
            onClick={() => {
              const currentQuest = quests[currentPath.currentQuestIndex];
              const nextLesson = currentQuest.lessons.findIndex(
                (l) => l.status === 'ready' || l.status === 'in_progress'
              );
              if (nextLesson !== -1) {
                startLesson(currentPath.currentQuestIndex, nextLesson);
              }
            }}
          >
            Start Today's Spark ⚡
          </Button>
        </Card>

        {/* Reset option */}
        <button
          onClick={clearPath}
          className="text-gray-500 text-xs hover:text-gray-400 transition-colors"
        >
          Start a different path →
        </button>
      </div>
    </motion.div>
  );
}

function QuestCard({ quest, onStart }: { quest: Quest; onStart: () => void }) {
  const completedLessons = quest.lessons.filter((l) => l.status === 'complete').length;
  const progress = (completedLessons / quest.lessons.length) * 100;
  const isLocked = quest.status === 'locked';
  const isComplete = quest.status === 'complete';

  return (
    <Card
      variant={isLocked ? 'outlined' : 'default'}
      className={cn(
        'p-4',
        isLocked && 'opacity-50'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span>{isComplete ? '✅' : isLocked ? '🔒' : '📖'}</span>
            <h3 className="text-white font-medium">{quest.title}</h3>
          </div>
          <p className="text-gray-500 text-xs mb-2">{quest.description}</p>
          <ProgressBar value={progress} color="bg-emerald-500" size="sm" />
          <p className="text-gray-500 text-xs mt-1">
            {completedLessons}/{quest.lessons.length} lessons
          </p>
        </div>
        {!isLocked && !isComplete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStart}
          >
            Continue
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON VIEW
// ─────────────────────────────────────────────────────────────────────────────────

function LessonView() {
  const navigate = useNavigate();
  const { currentSpark, currentPath, completeSection, completeSpark, setView } = useSwordStore();
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswerWrong, setIsAnswerWrong] = useState(false);

  if (!currentSpark || !currentPath) {
    return null;
  }

  const { sections } = currentSpark;
  const currentSection = sections[currentSectionIndex];
  const completedCount = sections.filter((s) => s.completed).length;
  const isLastSection = currentSectionIndex === sections.length - 1;
  const canProceed = currentSection?.completed;

  const handleAnswer = (index: number) => {
    setSelectedAnswer(index);
    setIsAnswerWrong(false);

    if (currentSection.type === 'quiz') {
      if (index === currentSection.correctIndex) {
        completeSection(currentSection.id, index);
      } else {
        setIsAnswerWrong(true);
      }
    }
  };

  const handleNext = () => {
    if (isLastSection) {
      completeSpark();
      navigate('/sword');
    } else {
      // Mark current section complete if not already
      if (!currentSection.completed && currentSection.type !== 'quiz') {
        completeSection(currentSection.id);
      }
      setCurrentSectionIndex((i) => i + 1);
      setSelectedAnswer(null);
      setIsAnswerWrong(false);
    }
  };

  const handleBack = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((i) => i - 1);
    } else {
      setView('path');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <BackButton onClick={handleBack} />
          <div className="text-center">
            <p className="text-emerald-400 text-xs font-bold">
              Day {currentPath.completedDays + 1}
            </p>
            <div className="flex gap-1 mt-1">
              {sections.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    s.completed ? 'bg-emerald-500' :
                    i === currentSectionIndex ? 'bg-emerald-500/50' :
                    'bg-gray-700'
                  )}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => setView('path')}
            className="text-gray-500 text-xs"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSection.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Section Type Badge */}
            <Badge
              variant={
                currentSection.type === 'insight' ? 'warning' :
                currentSection.type === 'quiz' ? 'info' :
                currentSection.type === 'exercise' ? 'success' :
                'default'
              }
            >
              {currentSection.type}
            </Badge>

            {/* Title */}
            <h2 className="text-xl font-bold text-white">
              {currentSection.title}
            </h2>

            {/* Content */}
            <div
              className={cn(
                'p-4 rounded-xl',
                currentSection.type === 'insight'
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : 'bg-gray-800/50'
              )}
            >
              <p className="text-gray-200 leading-relaxed">
                {currentSection.content}
              </p>
            </div>

            {/* Quiz Options */}
            {currentSection.type === 'quiz' && currentSection.options && (
              <div className="space-y-2">
                {currentSection.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={currentSection.completed}
                    className={cn(
                      'w-full p-4 rounded-xl text-left transition-all',
                      selectedAnswer === i
                        ? currentSection.completed
                          ? 'bg-emerald-500/20 border-emerald-500'
                          : isAnswerWrong
                            ? 'bg-red-500/20 border-red-500'
                            : 'bg-blue-500/20 border-blue-500'
                        : 'bg-gray-800 border-gray-700',
                      'border'
                    )}
                  >
                    <span className="text-gray-200">{option}</span>
                  </button>
                ))}
                {isAnswerWrong && (
                  <p className="text-red-400 text-sm">
                    Try again! Think about the fundamentals.
                  </p>
                )}
              </div>
            )}

            {/* Complete button for non-quiz sections */}
            {currentSection.type !== 'quiz' && !currentSection.completed && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => completeSection(currentSection.id)}
              >
                Mark as Read ✓
              </Button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress & Navigation */}
      <div className="px-4 py-4 border-t border-gray-800 safe-bottom">
        <Card variant="outlined" className="p-3 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {completedCount} of {sections.length} sections
            </span>
            <span className="text-emerald-400">
              ~{Math.max(1, (sections.length - completedCount) * 3)} min left
            </span>
          </div>
          <ProgressBar
            value={(completedCount / sections.length) * 100}
            color="bg-emerald-500"
            size="sm"
            className="mt-2"
          />
        </Card>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={currentSectionIndex === 0}
          >
            Back
          </Button>
          <Button
            variant="stance"
            stance="sword"
            className="flex-1"
            onClick={handleNext}
            disabled={currentSection.type === 'quiz' && !currentSection.completed}
          >
            {isLastSection ? 'Complete Spark ⚡' : 'Continue'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
