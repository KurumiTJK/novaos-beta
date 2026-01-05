// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL FEATURE — Control Page (Crisis Mode)
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { StatusBar, Button } from '../../../shared/components';
import {
  VitalsCard,
  LocationCard,
  ThreatsCard,
  ActionPlanCard,
} from './components';
import { useControlStore } from './controlStore';
import { useInterval } from '../../../shared/hooks';

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ControlPage() {
  const navigate = useNavigate();

  const {
    isActive,
    vitals,
    location,
    nearbyServices,
    threats,
    actionPlan,
    currentStepIndex,
    isLoading,
    activateCrisis,
    deactivateCrisis,
    fetchVitals,
    refreshAllData,
    advanceToNextStep,
  } = useControlStore();

  // Activate crisis mode if not already active
  useEffect(() => {
    if (!isActive) {
      activateCrisis();
    }
  }, [isActive, activateCrisis]);

  // Auto-refresh vitals every 30 seconds
  useInterval(() => {
    fetchVitals();
  }, 30000);

  const handleExit = () => {
    deactivateCrisis();
    navigate('/');
  };

  const handleTalkToNova = () => {
    navigate('/chat');
  };

  const handleCallEmergency = () => {
    window.location.href = 'tel:911';
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-red-950/30 via-gray-950 to-gray-950">
      <StatusBar variant="crisis" />

      {/* Header */}
      <div className="px-4 py-3 border-b border-red-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-3 h-3 bg-red-500 rounded-full"
            />
            <div>
              <h1 className="text-red-400 font-bold">Control Mode</h1>
              <p className="text-red-400/60 text-xs">Crisis stabilization active</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            className="text-gray-400"
          >
            Exit
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Loading overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2"
              />
              <p className="text-gray-400 text-sm">Gathering data...</p>
            </div>
          </div>
        )}

        {/* Vitals */}
        <VitalsCard vitals={vitals} onRefresh={fetchVitals} />

        {/* Location & Services */}
        <LocationCard location={location} services={nearbyServices} />

        {/* Threats */}
        <ThreatsCard threats={threats} />

        {/* Action Plan */}
        {actionPlan.length > 0 && (
          <ActionPlanCard
            steps={actionPlan}
            currentIndex={currentStepIndex}
            onAdvance={advanceToNextStep}
          />
        )}

        {/* Breathing exercise suggestion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50"
        >
          <p className="text-gray-400 text-sm mb-3">
            💨 Need to calm down? Try box breathing:
          </p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 bg-gray-700/50 rounded-lg">
              <p className="text-white font-bold">4s</p>
              <p className="text-gray-500">Inhale</p>
            </div>
            <div className="p-2 bg-gray-700/50 rounded-lg">
              <p className="text-white font-bold">4s</p>
              <p className="text-gray-500">Hold</p>
            </div>
            <div className="p-2 bg-gray-700/50 rounded-lg">
              <p className="text-white font-bold">4s</p>
              <p className="text-gray-500">Exhale</p>
            </div>
            <div className="p-2 bg-gray-700/50 rounded-lg">
              <p className="text-white font-bold">4s</p>
              <p className="text-gray-500">Hold</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Emergency Footer */}
      <div className="px-4 py-4 border-t border-red-900/30 bg-gray-950/80 backdrop-blur-xl safe-bottom">
        <div className="flex gap-3">
          <Button
            variant="danger"
            className="flex-1"
            onClick={handleCallEmergency}
            leftIcon={<span>📞</span>}
          >
            Call Emergency
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleTalkToNova}
            leftIcon={<span>💬</span>}
          >
            Talk to Nova
          </Button>
        </div>
      </div>
    </div>
  );
}
