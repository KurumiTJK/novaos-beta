// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL FEATURE — Components
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { Card, Badge, ProgressBar } from '../../../shared/components';
import { cn } from '../../../shared/utils';
import type { VitalSigns, LocationData, NearbyService, ThreatAlert, CrisisActionStep } from '../controlStore';

// ─────────────────────────────────────────────────────────────────────────────────
// VITALS CARD
// ─────────────────────────────────────────────────────────────────────────────────

interface VitalsCardProps {
  vitals: VitalSigns | null;
  onRefresh: () => void;
}

export function VitalsCard({ vitals, onRefresh }: VitalsCardProps) {
  return (
    <Card stance="control" className="relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <p className="text-red-400 text-xs font-bold uppercase tracking-wider">
          Vitals
        </p>
        <button
          onClick={onRefresh}
          className="text-gray-500 hover:text-gray-300 text-xs"
        >
          ↻ Refresh
        </button>
      </div>

      {vitals ? (
        <div className="grid grid-cols-3 gap-3">
          <VitalItem
            label="Heart Rate"
            value={vitals.heartRate}
            unit="BPM"
            isAlert={vitals.isElevated}
          />
          <VitalItem
            label="HRV"
            value={vitals.hrv}
            unit="ms"
          />
          <VitalItem
            label="SpO2"
            value={vitals.spo2}
            unit="%"
          />
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Loading vitals...</p>
      )}

      {vitals?.isElevated && (
        <p className="text-amber-400 text-xs mt-3">
          ⚠️ Heart rate elevated. Consider breathing exercises.
        </p>
      )}

      <p className="text-gray-600 text-xs mt-2">
        📱 Apple Watch • Last sync: {vitals ? formatTimeAgo(vitals.lastUpdated) : '--'}
      </p>
    </Card>
  );
}

function VitalItem({ label, value, unit, isAlert }: {
  label: string;
  value: number;
  unit: string;
  isAlert?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className={cn(
        'text-xl font-bold',
        isAlert ? 'text-red-400' : 'text-white'
      )}>
        {value}
        <span className="text-xs text-gray-500 ml-1">{unit}</span>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOCATION CARD
// ─────────────────────────────────────────────────────────────────────────────────

interface LocationCardProps {
  location: LocationData | null;
  services: NearbyService[];
}

export function LocationCard({ location, services }: LocationCardProps) {
  return (
    <Card stance="control">
      <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-3">
        Location & Nearby Help
      </p>

      {location ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📍</span>
            <div>
              <p className="text-white text-sm font-medium">{location.city}</p>
              <p className="text-gray-500 text-xs">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {services.map((service, i) => (
              <ServiceItem key={i} service={service} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-sm">Getting location...</p>
      )}
    </Card>
  );
}

function ServiceItem({ service }: { service: NearbyService }) {
  const icons: Record<NearbyService['type'], string> = {
    hospital: '🏥',
    police: '👮',
    pharmacy: '💊',
  };

  return (
    <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-2">
        <span>{icons[service.type]}</span>
        <div>
          <p className="text-white text-xs font-medium">{service.name}</p>
          <p className="text-gray-500 text-xs">{service.address}</p>
        </div>
      </div>
      <span className="text-gray-400 text-xs">{service.distance}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// THREATS CARD
// ─────────────────────────────────────────────────────────────────────────────────

interface ThreatsCardProps {
  threats: ThreatAlert[];
}

export function ThreatsCard({ threats }: ThreatsCardProps) {
  return (
    <Card stance="control">
      <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-3">
        Threat Scan
      </p>

      {threats.length === 0 ? (
        <div className="flex items-center gap-2 text-emerald-400">
          <span>✓</span>
          <p className="text-sm">No active threats detected</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threats.map((threat) => (
            <ThreatItem key={threat.id} threat={threat} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ThreatItem({ threat }: { threat: ThreatAlert }) {
  const severityColors = {
    low: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    medium: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const icons: Record<ThreatAlert['type'], string> = {
    power_outage: '⚡',
    weather: '🌡️',
    crime: '🚨',
    health: '🏥',
  };

  return (
    <div className={cn(
      'p-2 rounded-lg border',
      severityColors[threat.severity]
    )}>
      <div className="flex items-center gap-2">
        <span>{icons[threat.type]}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{threat.title}</p>
          <p className="text-xs opacity-80">{threat.description}</p>
        </div>
        <Badge
          variant={threat.severity === 'high' ? 'error' : threat.severity === 'medium' ? 'warning' : 'default'}
          size="sm"
        >
          {threat.severity}
        </Badge>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTION PLAN CARD
// ─────────────────────────────────────────────────────────────────────────────────

interface ActionPlanCardProps {
  steps: CrisisActionStep[];
  currentIndex: number;
  onAdvance: () => void;
}

export function ActionPlanCard({ steps, currentIndex, onAdvance }: ActionPlanCardProps) {
  const progress = ((currentIndex + 1) / steps.length) * 100;
  const currentStep = steps[currentIndex];

  return (
    <Card stance="control">
      <div className="flex items-center justify-between mb-3">
        <p className="text-red-400 text-xs font-bold uppercase tracking-wider">
          Immediate Action Plan
        </p>
        <span className="text-gray-500 text-xs">
          Step {currentIndex + 1} of {steps.length}
        </span>
      </div>

      <ProgressBar value={progress} color="bg-red-500" size="sm" className="mb-4" />

      <div className="space-y-2">
        {steps.map((step, i) => (
          <StepItem
            key={step.id}
            step={step}
            isCurrent={i === currentIndex}
          />
        ))}
      </div>

      {currentStep && currentStep.status !== 'complete' && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onAdvance}
          className="w-full mt-4 p-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
        >
          Complete: {currentStep.title}
        </motion.button>
      )}
    </Card>
  );
}

function StepItem({ step, isCurrent }: { step: CrisisActionStep; isCurrent: boolean }) {
  const statusIcons = {
    pending: '○',
    current: '◉',
    complete: '✓',
  };

  return (
    <div className={cn(
      'flex items-start gap-3 p-2 rounded-lg transition-colors',
      isCurrent && 'bg-red-500/10 border border-red-500/30',
      step.status === 'complete' && 'opacity-50'
    )}>
      <span className={cn(
        'text-sm',
        step.status === 'complete' ? 'text-emerald-400' :
        isCurrent ? 'text-red-400' : 'text-gray-500'
      )}>
        {statusIcons[step.status]}
      </span>
      <div>
        <p className={cn(
          'text-sm font-medium',
          step.status === 'complete' ? 'text-gray-400 line-through' : 'text-white'
        )}>
          {step.title}
        </p>
        {isCurrent && (
          <p className="text-gray-400 text-xs mt-1">{step.description}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
