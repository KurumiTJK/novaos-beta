// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL PAGE — Crisis Mode Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
//
// Persistent session triggered by safety_signal: 'high'
// Aggregates vitals, location, threats, and provides action plan
//
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { StatusBar, Card, Button } from '../components/ui';
import { useControlStore, useAppStore } from '../stores';
import { cn } from '../utils';
import { stanceColors, staggerContainer, staggerItem } from '../utils/theme';

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ControlPage() {
  const navigate = useNavigate();
  const {
    active,
    vitals,
    location,
    nearbyServices,
    threats,
    actionPlan,
    activateCrisis,
    deactivateCrisis,
    advanceToNextStep,
    isLoadingVitals,
    isLoadingLocation,
    isLoadingThreats,
    refreshAllData,
  } = useControlStore();
  const { exitCurrentMode } = useAppStore();

  // Activate crisis mode on mount if not already active
  useEffect(() => {
    if (!active) {
      activateCrisis('Manual activation');
    }
  }, [active, activateCrisis]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshAllData, 30000);
    return () => clearInterval(interval);
  }, [refreshAllData]);

  const handleExit = () => {
    deactivateCrisis();
    exitCurrentMode();
    navigate('/');
  };

  const handleEmergencyCall = () => {
    // On mobile, this would trigger phone dialer
    window.open('tel:911', '_self');
  };

  const colors = stanceColors.control;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-red-950/50 via-gray-950 to-gray-950">
      <StatusBar crisis />

      {/* Crisis Header */}
      <div className={cn('px-4 py-2 border-b', colors.borderLight, colors.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center animate-pulse">
              <span className="text-red-400 text-lg">🚨</span>
            </span>
            <div>
              <h1 className="text-red-400 font-bold text-sm uppercase tracking-wider">
                Control Mode
              </h1>
              <p className="text-red-300/70 text-xs">Crisis Resolution Active</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExit}>
            Exit
          </Button>
        </div>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3">
        {/* Vital Signs Card */}
        <Card stance="control" variant="outlined" padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-red-400 text-xs font-bold uppercase tracking-wider">
              Vitals
            </p>
            <span className="text-gray-500 text-xs">
              {isLoadingVitals ? 'Updating...' : 'Live • Apple Watch'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className={cn('text-center p-2 rounded-lg', vitals && vitals.heartRate > 100 ? 'bg-red-500/10' : 'bg-gray-800/50')}>
              <p className={cn('text-lg font-bold', vitals && vitals.heartRate > 100 ? 'text-red-400' : 'text-gray-300')}>
                {vitals?.heartRate || '--'}
              </p>
              <p className="text-gray-500 text-xs">BPM {vitals && vitals.heartRate > 100 && '↑'}</p>
            </div>
            <div className={cn('text-center p-2 rounded-lg', vitals && vitals.hrv < 30 ? 'bg-amber-500/10' : 'bg-gray-800/50')}>
              <p className={cn('text-lg font-bold', vitals && vitals.hrv < 30 ? 'text-amber-400' : 'text-gray-300')}>
                {vitals?.hrv || '--'}
              </p>
              <p className="text-gray-500 text-xs">HRV ms</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-gray-800/50">
              <p className="text-gray-300 text-lg font-bold">{vitals?.spo2 || '--'}%</p>
              <p className="text-gray-500 text-xs">SpO2</p>
            </div>
          </div>
          {vitals && vitals.heartRate > 100 && (
            <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-300 text-xs">
                ⚠️ Elevated heart rate detected. Stress indicators high.
              </p>
            </div>
          )}
        </Card>

        {/* Location & Environment */}
        <Card variant="outlined" padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              Location
            </p>
            <span className="text-emerald-400 text-xs">● Live</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📍</span>
            <div>
              <p className="text-white text-sm">
                {location?.city || 'Locating...'}
              </p>
              <p className="text-gray-500 text-xs">
                {location
                  ? `${location.latitude.toFixed(4)}° N, ${location.longitude.toFixed(4)}° W`
                  : 'Acquiring GPS...'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {nearbyServices.slice(0, 2).map((service) => (
              <div key={service.name} className="p-2 rounded-lg bg-gray-800/50">
                <p className="text-gray-500 text-xs capitalize">Nearest {service.type}</p>
                <p className="text-white text-xs font-medium">{service.distance} mi</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Threat Assessment */}
        <Card stance="shield" variant="outlined" padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">
              Threat Scan
            </p>
            <span className="text-gray-500 text-xs">Web + News</span>
          </div>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
            {threats.length > 0 ? (
              threats.map((threat, index) => (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-lg',
                    threat.severity === 'high' ? 'bg-red-500/10' :
                    threat.severity === 'medium' ? 'bg-amber-500/10' : 'bg-gray-800/50'
                  )}
                >
                  <span className={threat.severity === 'high' ? 'text-red-400' : 'text-amber-400'}>
                    {threat.type === 'power' && '⚡'}
                    {threat.type === 'weather' && '🌡️'}
                    {threat.type === 'crime' && '🚨'}
                    {threat.type === 'traffic' && '🚗'}
                  </span>
                  <div>
                    <p className={cn(
                      'text-xs font-medium',
                      threat.severity === 'high' ? 'text-red-300' : 'text-amber-300'
                    )}>
                      {threat.title}
                    </p>
                    <p className="text-gray-500 text-xs">{threat.description}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-gray-500 text-xs text-center py-2">
                {isLoadingThreats ? 'Scanning...' : 'No immediate threats detected'}
              </p>
            )}
          </motion.div>
        </Card>

        {/* Immediate Action Plan */}
        <Card
          variant="gradient"
          stance="control"
          padding="md"
        >
          <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
            Immediate Actions
          </p>
          <div className="space-y-2">
            {actionPlan.map((item) => (
              <motion.button
                key={item.step}
                whileTap={{ scale: 0.98 }}
                onClick={() => item.status === 'current' && advanceToNextStep()}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                  item.status === 'current'
                    ? 'bg-red-500/20 border border-red-500/30'
                    : item.status === 'complete'
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-gray-800/30'
                )}
              >
                <span
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                    item.status === 'current'
                      ? 'bg-red-500 text-white'
                      : item.status === 'complete'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-700 text-gray-400'
                  )}
                >
                  {item.status === 'complete' ? '✓' : item.step}
                </span>
                <span className="text-lg">{item.icon}</span>
                <p
                  className={cn(
                    'text-sm flex-1',
                    item.status === 'current'
                      ? 'text-white font-medium'
                      : item.status === 'complete'
                      ? 'text-emerald-300 line-through opacity-70'
                      : 'text-gray-400'
                  )}
                >
                  {item.action}
                </p>
                {item.status === 'current' && (
                  <span className="text-red-400 text-xs">NOW</span>
                )}
              </motion.button>
            ))}
          </div>
        </Card>
      </div>

      {/* Emergency Actions Footer */}
      <div className="p-3 border-t border-red-500/30 bg-gray-950">
        <div className="flex gap-2 mb-2">
          <Button
            variant="danger"
            fullWidth
            onClick={handleEmergencyCall}
            className="py-3"
          >
            📞 Call Emergency
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate('/chat')}
            className="py-3"
          >
            💬 Talk to Nova
          </Button>
        </div>
        <p className="text-center text-gray-500 text-xs">
          Nova is monitoring your situation
        </p>
      </div>
    </div>
  );
}

export default ControlPage;
