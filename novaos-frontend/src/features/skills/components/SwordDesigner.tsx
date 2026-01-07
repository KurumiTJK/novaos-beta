// ═══════════════════════════════════════════════════════════════════════════════
// SWORD DESIGNER — Create Learning Plan
// 4-phase wizard: Exploration → Define Goal → Research → Review
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useUIStore } from '@/shared/stores';

interface SwordDesignerProps {
  topic?: string;
}

type DesignerPhase = 'exploration' | 'define_goal' | 'research' | 'review';

interface PhaseInfo {
  id: DesignerPhase;
  title: string;
  description: string;
  icon: string;
}

const PHASES: PhaseInfo[] = [
  { id: 'exploration', title: 'Exploration', description: 'Tell me what you want to learn', icon: '🔍' },
  { id: 'define_goal', title: 'Define Goal', description: "Let's define what success looks like", icon: '🎯' },
  { id: 'research', title: 'Research', description: 'Finding the best resources for you', icon: '📚' },
  { id: 'review', title: 'Review', description: "Here's your personalized learning plan", icon: '✅' },
];

export function SwordDesigner({ topic }: SwordDesignerProps) {
  const { openSwordRunner } = useUIStore();
  const [currentPhase, setCurrentPhase] = useState<DesignerPhase>('exploration');
  const [inputValue, setInputValue] = useState(topic || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [explorationData, setExplorationData] = useState<string>('');
  const [goalData, setGoalData] = useState<string>('');

  // If topic provided, start with it pre-filled
  useEffect(() => {
    if (topic) {
      setInputValue(topic);
    }
  }, [topic]);

  const currentPhaseIndex = PHASES.findIndex(p => p.id === currentPhase);
  const currentPhaseInfo = PHASES[currentPhaseIndex];

  const handleSubmit = async () => {
    if (!inputValue.trim() && currentPhase !== 'research') return;
    
    setIsProcessing(true);

    try {
      switch (currentPhase) {
        case 'exploration':
          setExplorationData(inputValue);
          // TODO: Call API to validate/process exploration
          // await api.post('/sword/designer/exploration', { message: inputValue });
          setCurrentPhase('define_goal');
          setInputValue('');
          break;
          
        case 'define_goal':
          setGoalData(inputValue);
          // TODO: Call API to run define goal phase
          // await api.post('/sword/designer/goal', { goal: inputValue });
          setCurrentPhase('research');
          setInputValue('');
          break;
          
        case 'research':
          // TODO: Call API to run research phase
          // await api.post('/sword/designer/research');
          await new Promise(resolve => setTimeout(resolve, 2000));
          setCurrentPhase('review');
          break;
          
        case 'review':
          // TODO: Call API to finalize and create plan
          // const { planId } = await api.post('/sword/designer/finalize');
          const mockPlanId = 'plan-' + Date.now();
          openSwordRunner(mockPlanId);
          break;
      }
    } catch (error) {
      console.error('Designer phase error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-5">
      {/* Phase Progress */}
      <div className="flex items-center justify-between mb-6">
        {PHASES.map((phase, index) => (
          <div key={phase.id} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
              ${index < currentPhaseIndex ? 'bg-green-500 text-black' : ''}
              ${index === currentPhaseIndex ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500' : ''}
              ${index > currentPhaseIndex ? 'bg-white/10 text-white/30' : ''}
            `}>
              {index < currentPhaseIndex ? '✓' : index + 1}
            </div>
            {index < PHASES.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${
                index < currentPhaseIndex ? 'bg-green-500' : 'bg-white/10'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Current Phase Card */}
      <div className="bg-[#1C1C1E] rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{currentPhaseInfo.icon}</span>
          <div>
            <div className="text-green-400 text-xs font-medium">
              PHASE {currentPhaseIndex + 1} OF {PHASES.length}
            </div>
            <h2 className="text-lg font-semibold text-white">{currentPhaseInfo.title}</h2>
          </div>
        </div>
        <p className="text-white/50 text-sm">{currentPhaseInfo.description}</p>
      </div>

      {/* Phase Content */}
      <div className="flex-1 flex flex-col">
        {currentPhase === 'exploration' && (
          <ExplorationPhase
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            isProcessing={isProcessing}
          />
        )}
        
        {currentPhase === 'define_goal' && (
          <DefineGoalPhase
            topic={explorationData}
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            isProcessing={isProcessing}
          />
        )}
        
        {currentPhase === 'research' && (
          <ResearchPhase
            topic={explorationData}
            goal={goalData}
            onContinue={handleSubmit}
            isProcessing={isProcessing}
          />
        )}
        
        {currentPhase === 'review' && (
          <ReviewPhase
            topic={explorationData}
            goal={goalData}
            onFinalize={handleSubmit}
            isProcessing={isProcessing}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PHASE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────────

interface PhaseProps {
  isProcessing: boolean;
}

interface InputPhaseProps extends PhaseProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function ExplorationPhase({ value, onChange, onSubmit, isProcessing }: InputPhaseProps) {
  return (
    <>
      <div className="flex-1">
        <label className="text-sm text-white/50 mb-2 block">What do you want to learn?</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., I want to learn guitar, specifically fingerpicking acoustic songs"
          className="w-full bg-[#1C1C1E] rounded-xl p-4 text-white placeholder-white/30 resize-none outline-none focus:ring-1 focus:ring-green-500/50"
          rows={4}
          disabled={isProcessing}
        />
        <p className="text-xs text-white/30 mt-2">
          Be as specific as you'd like. Include your current level, goals, or any context.
        </p>
      </div>
      <button
        onClick={onSubmit}
        disabled={!value.trim() || isProcessing}
        className="mt-4 w-full py-3 bg-green-500 text-black font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition-opacity"
      >
        {isProcessing ? 'Processing...' : 'Continue'}
      </button>
    </>
  );
}

function DefineGoalPhase({ topic, value, onChange, onSubmit, isProcessing }: InputPhaseProps & { topic: string }) {
  return (
    <>
      <div className="flex-1">
        <div className="bg-white/5 rounded-xl p-3 mb-4">
          <div className="text-xs text-white/30 mb-1">LEARNING TOPIC</div>
          <p className="text-white text-sm">{topic}</p>
        </div>
        
        <label className="text-sm text-white/50 mb-2 block">What does success look like?</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., I want to be able to play 5 fingerpicking songs from start to finish"
          className="w-full bg-[#1C1C1E] rounded-xl p-4 text-white placeholder-white/30 resize-none outline-none focus:ring-1 focus:ring-green-500/50"
          rows={4}
          disabled={isProcessing}
        />
        <p className="text-xs text-white/30 mt-2">
          Describe a concrete outcome you'd be proud of achieving.
        </p>
      </div>
      <button
        onClick={onSubmit}
        disabled={!value.trim() || isProcessing}
        className="mt-4 w-full py-3 bg-green-500 text-black font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition-opacity"
      >
        {isProcessing ? 'Building your plan...' : 'Define Goal'}
      </button>
    </>
  );
}

function ResearchPhase({ topic, goal, onContinue, isProcessing }: PhaseProps & { topic: string; goal: string; onContinue: () => void }) {
  // Auto-start research when component mounts
  useEffect(() => {
    if (!isProcessing) {
      onContinue();
    }
  }, []); // Only run once on mount

  return (
    <>
      <div className="flex-1">
        <div className="space-y-3 mb-6">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/30 mb-1">TOPIC</div>
            <p className="text-white text-sm">{topic}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/30 mb-1">GOAL</div>
            <p className="text-white text-sm">{goal}</p>
          </div>
        </div>

        <div className="bg-[#1C1C1E] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            <span className="text-white text-sm">Researching best resources...</span>
          </div>
          <p className="text-white/50 text-xs">
            Finding optimal learning path with curated resources
          </p>
        </div>
      </div>
    </>
  );
}

function ReviewPhase({ topic, goal, onFinalize, isProcessing }: PhaseProps & { topic: string; goal: string; onFinalize: () => void }) {
  return (
    <>
      <div className="flex-1">
        <div className="bg-[#1C1C1E] rounded-xl p-4 mb-4">
          <h3 className="text-white font-medium mb-2">{topic}</h3>
          <p className="text-white/50 text-sm mb-4">{goal}</p>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Estimated duration</span>
              <span className="text-white">~4 weeks</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Sessions</span>
              <span className="text-white">12 lessons</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Daily commitment</span>
              <span className="text-white">15-20 min</span>
            </div>
          </div>
        </div>
        
        <p className="text-white/30 text-xs text-center">
          Your personalized learning plan is ready. Start learning today!
        </p>
      </div>
      
      <button
        onClick={onFinalize}
        disabled={isProcessing}
        className="mt-4 w-full py-3 bg-green-500 text-black font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition-opacity"
      >
        {isProcessing ? 'Creating plan...' : 'Start Learning'}
      </button>
    </>
  );
}
