// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL FEATURE — Crisis Mode Store
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface VitalSigns {
  heartRate: number;
  hrv: number;
  spo2: number;
  lastUpdated: Date;
  isElevated: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  lastUpdated: Date;
}

export interface NearbyService {
  type: 'hospital' | 'police' | 'pharmacy';
  name: string;
  distance: string;
  address: string;
}

export interface ThreatAlert {
  id: string;
  type: 'power_outage' | 'weather' | 'crime' | 'health';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export interface CrisisActionStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'current' | 'complete';
}

// ─────────────────────────────────────────────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

interface ControlState {
  isActive: boolean;
  vitals: VitalSigns | null;
  location: LocationData | null;
  nearbyServices: NearbyService[];
  threats: ThreatAlert[];
  actionPlan: CrisisActionStep[];
  currentStepIndex: number;
  isLoading: boolean;

  // Actions
  activateCrisis: () => void;
  deactivateCrisis: () => void;
  fetchVitals: () => Promise<void>;
  fetchLocation: () => Promise<void>;
  fetchThreats: () => Promise<void>;
  advanceToNextStep: () => void;
  completeStep: (stepId: string) => void;
  refreshAllData: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK DATA GENERATORS
// ─────────────────────────────────────────────────────────────────────────────────

function generateMockVitals(): VitalSigns {
  const heartRate = 60 + Math.floor(Math.random() * 40);
  return {
    heartRate,
    hrv: 30 + Math.floor(Math.random() * 40),
    spo2: 95 + Math.floor(Math.random() * 5),
    lastUpdated: new Date(),
    isElevated: heartRate > 90,
  };
}

function generateMockLocation(): LocationData {
  return {
    latitude: 33.6846 + Math.random() * 0.01,
    longitude: -117.8265 + Math.random() * 0.01,
    city: 'Irvine, CA',
    lastUpdated: new Date(),
  };
}

function generateMockServices(): NearbyService[] {
  return [
    { type: 'hospital', name: 'Hoag Hospital Irvine', distance: '2.3 mi', address: '16200 Sand Canyon Ave' },
    { type: 'police', name: 'Irvine Police Department', distance: '1.8 mi', address: '1 Civic Center Plaza' },
    { type: 'pharmacy', name: 'CVS Pharmacy', distance: '0.4 mi', address: '4255 Campus Dr' },
  ];
}

function generateMockThreats(): ThreatAlert[] {
  const threats: ThreatAlert[] = [];
  
  if (Math.random() > 0.7) {
    threats.push({
      id: '1',
      type: 'weather',
      title: 'Heat Advisory',
      description: 'High temperatures expected. Stay hydrated.',
      severity: 'medium',
      timestamp: new Date(),
    });
  }

  if (Math.random() > 0.8) {
    threats.push({
      id: '2',
      type: 'power_outage',
      title: 'Scheduled Maintenance',
      description: 'Brief power interruption possible 2-4pm.',
      severity: 'low',
      timestamp: new Date(),
    });
  }

  return threats;
}

function generateActionPlan(): CrisisActionStep[] {
  return [
    {
      id: '1',
      title: 'Assess your surroundings',
      description: 'Find a safe, quiet space if needed.',
      status: 'current',
    },
    {
      id: '2',
      title: 'Breathe slowly',
      description: 'Take 4 deep breaths: 4 seconds in, 4 seconds hold, 4 seconds out.',
      status: 'pending',
    },
    {
      id: '3',
      title: 'Ground yourself',
      description: 'Name 5 things you can see, 4 you can touch, 3 you can hear.',
      status: 'pending',
    },
    {
      id: '4',
      title: 'Reach out if needed',
      description: 'Contact a trusted person or call a helpline.',
      status: 'pending',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useControlStore = create<ControlState>((set, get) => ({
  isActive: false,
  vitals: null,
  location: null,
  nearbyServices: [],
  threats: [],
  actionPlan: [],
  currentStepIndex: 0,
  isLoading: false,

  activateCrisis: () => {
    set({
      isActive: true,
      actionPlan: generateActionPlan(),
      currentStepIndex: 0,
    });
    // Immediately fetch all data
    get().refreshAllData();
  },

  deactivateCrisis: () => {
    set({
      isActive: false,
      vitals: null,
      location: null,
      nearbyServices: [],
      threats: [],
      actionPlan: [],
      currentStepIndex: 0,
    });
  },

  fetchVitals: async () => {
    // TODO: Integrate with Apple HealthKit / Oura API
    await new Promise((r) => setTimeout(r, 500));
    set({ vitals: generateMockVitals() });
  },

  fetchLocation: async () => {
    // TODO: Use browser geolocation + Google Places API
    await new Promise((r) => setTimeout(r, 300));
    set({
      location: generateMockLocation(),
      nearbyServices: generateMockServices(),
    });
  },

  fetchThreats: async () => {
    // TODO: Integrate with news/weather APIs
    await new Promise((r) => setTimeout(r, 400));
    set({ threats: generateMockThreats() });
  },

  advanceToNextStep: () => {
    const { actionPlan, currentStepIndex } = get();
    if (currentStepIndex < actionPlan.length - 1) {
      const newPlan = actionPlan.map((step, i) => ({
        ...step,
        status: i < currentStepIndex + 1
          ? 'complete' as const
          : i === currentStepIndex + 1
            ? 'current' as const
            : 'pending' as const,
      }));
      set({
        actionPlan: newPlan,
        currentStepIndex: currentStepIndex + 1,
      });
    }
  },

  completeStep: (stepId: string) => {
    const { actionPlan } = get();
    const stepIndex = actionPlan.findIndex((s) => s.id === stepId);
    if (stepIndex !== -1) {
      const newPlan = actionPlan.map((step, i) => ({
        ...step,
        status: i <= stepIndex
          ? 'complete' as const
          : i === stepIndex + 1
            ? 'current' as const
            : step.status,
      }));
      set({
        actionPlan: newPlan,
        currentStepIndex: Math.min(stepIndex + 1, actionPlan.length - 1),
      });
    }
  },

  refreshAllData: async () => {
    set({ isLoading: true });
    await Promise.all([
      get().fetchVitals(),
      get().fetchLocation(),
      get().fetchThreats(),
    ]);
    set({ isLoading: false });
  },
}));
