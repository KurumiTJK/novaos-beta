// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL STORE — Crisis Mode State Management
// ═══════════════════════════════════════════════════════════════════════════════
//
// Control Mode triggers when safety_signal: 'high' in Shield Gate.
// Pipeline HALTS → enters persistent crisis resolution session.
//
// Aggregates:
// - Health vitals (heart rate, HRV, SpO2) from Apple Watch/Oura/Fitbit
// - Location data with nearby emergency services
// - Threat scan from web/news for local dangers
// - Step-by-step crisis resolution action plan
//
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { 
  CrisisState, 
  VitalSigns, 
  LocationData, 
  NearbyService, 
  ThreatAlert,
  CrisisActionStep,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface ControlState extends CrisisState {
  // Session info
  sessionId: string | null;
  lastUpdate: number | null;

  // Loading states
  isLoadingVitals: boolean;
  isLoadingLocation: boolean;
  isLoadingThreats: boolean;

  // Actions
  activateCrisis: (reason?: string) => void;
  deactivateCrisis: () => void;
  updateVitals: (vitals: VitalSigns) => void;
  updateLocation: (location: LocationData) => void;
  setNearbyServices: (services: NearbyService[]) => void;
  addThreat: (threat: ThreatAlert) => void;
  clearThreats: () => void;
  setActionPlan: (plan: CrisisActionStep[]) => void;
  completeActionStep: (stepNumber: number) => void;
  advanceToNextStep: () => void;

  // Data fetching triggers
  fetchVitals: () => Promise<void>;
  fetchLocation: () => Promise<void>;
  fetchThreats: () => Promise<void>;
  fetchNearbyServices: () => Promise<void>;
  refreshAllData: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK DATA (Replace with actual integrations)
// ─────────────────────────────────────────────────────────────────────────────────

const mockVitals: VitalSigns = {
  heartRate: 142,
  hrv: 28,
  spo2: 96,
  timestamp: Date.now(),
  source: 'apple_watch',
};

const mockLocation: LocationData = {
  latitude: 34.0522,
  longitude: -118.2437,
  accuracy: 10,
  address: '123 Main Street',
  city: 'Los Angeles',
  timestamp: Date.now(),
};

const mockNearbyServices: NearbyService[] = [
  { type: 'hospital', name: 'Cedars-Sinai Medical Center', distance: 0.8, address: '8700 Beverly Blvd', phone: '310-423-3277' },
  { type: 'police', name: 'LAPD Central', distance: 1.2, address: '251 E 6th St', phone: '213-486-6000' },
  { type: 'pharmacy', name: 'CVS Pharmacy', distance: 0.3, address: '456 Oak Ave', phone: '213-555-0123' },
];

const mockThreats: ThreatAlert[] = [
  { type: 'power', severity: 'medium', title: 'Power outage reported', description: 'DTLA area affected', source: 'LA DWP', timestamp: Date.now() - 15 * 60 * 1000 },
  { type: 'weather', severity: 'low', title: 'Heat advisory active', description: 'Until 8PM - Stay hydrated', source: 'NWS', timestamp: Date.now() - 60 * 60 * 1000 },
];

const defaultActionPlan: CrisisActionStep[] = [
  { step: 1, action: 'Find a cool, safe location nearby', icon: '🏢', status: 'current' },
  { step: 2, action: 'Hydrate - drink water slowly', icon: '💧', status: 'pending' },
  { step: 3, action: 'Practice breathing: 4-7-8 pattern', icon: '🧘', status: 'pending' },
  { step: 4, action: 'Contact trusted person', icon: '📱', status: 'pending' },
];

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useControlStore = create<ControlState>()((set, get) => ({
  // Initial crisis state
  active: false,
  triggeredAt: undefined,
  vitals: undefined,
  location: undefined,
  nearbyServices: [],
  threats: [],
  actionPlan: [],

  // Session
  sessionId: null,
  lastUpdate: null,

  // Loading states
  isLoadingVitals: false,
  isLoadingLocation: false,
  isLoadingThreats: false,

  // Activate crisis mode
  activateCrisis: (reason?: string) => {
    const sessionId = `crisis-${Date.now()}`;
    console.log(`[CONTROL] Crisis activated: ${reason || 'unknown trigger'}`);
    
    set({
      active: true,
      triggeredAt: Date.now(),
      sessionId,
      actionPlan: defaultActionPlan,
    });

    // Auto-fetch all data
    get().refreshAllData();
  },

  // Deactivate crisis mode
  deactivateCrisis: () => {
    console.log('[CONTROL] Crisis deactivated');
    set({
      active: false,
      triggeredAt: undefined,
      sessionId: null,
      vitals: undefined,
      location: undefined,
      nearbyServices: [],
      threats: [],
      actionPlan: [],
    });
  },

  // Update vitals
  updateVitals: (vitals) => {
    set({ vitals, lastUpdate: Date.now() });
  },

  // Update location
  updateLocation: (location) => {
    set({ location, lastUpdate: Date.now() });
  },

  // Set nearby services
  setNearbyServices: (services) => {
    set({ nearbyServices: services });
  },

  // Add threat alert
  addThreat: (threat) => {
    set((state) => ({
      threats: [...state.threats, threat],
    }));
  },

  // Clear threats
  clearThreats: () => {
    set({ threats: [] });
  },

  // Set action plan
  setActionPlan: (plan) => {
    set({ actionPlan: plan });
  },

  // Complete a specific action step
  completeActionStep: (stepNumber) => {
    set((state) => ({
      actionPlan: state.actionPlan.map((step) => {
        if (step.step === stepNumber) {
          return { ...step, status: 'complete' };
        }
        if (step.step === stepNumber + 1) {
          return { ...step, status: 'current' };
        }
        return step;
      }),
    }));
  },

  // Advance to next step
  advanceToNextStep: () => {
    const { actionPlan } = get();
    const currentStep = actionPlan.find((s) => s.status === 'current');
    if (currentStep) {
      get().completeActionStep(currentStep.step);
    }
  },

  // Fetch vitals from health device
  fetchVitals: async () => {
    set({ isLoadingVitals: true });
    
    try {
      // TODO: Integrate with Apple HealthKit / Oura API / Fitbit API
      // For now, use mock data
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      set({
        vitals: {
          ...mockVitals,
          timestamp: Date.now(),
          // Simulate slight variations
          heartRate: mockVitals.heartRate + Math.floor(Math.random() * 10) - 5,
          hrv: mockVitals.hrv + Math.floor(Math.random() * 6) - 3,
        },
        isLoadingVitals: false,
        lastUpdate: Date.now(),
      });
    } catch (error) {
      console.error('[CONTROL] Failed to fetch vitals:', error);
      set({ isLoadingVitals: false });
    }
  },

  // Fetch current location
  fetchLocation: async () => {
    set({ isLoadingLocation: true });
    
    try {
      // Try to get real location from browser
      if ('geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        
        set({
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          },
          isLoadingLocation: false,
          lastUpdate: Date.now(),
        });
      } else {
        // Fallback to mock
        set({
          location: { ...mockLocation, timestamp: Date.now() },
          isLoadingLocation: false,
        });
      }
    } catch (error) {
      console.error('[CONTROL] Failed to fetch location:', error);
      set({
        location: { ...mockLocation, timestamp: Date.now() },
        isLoadingLocation: false,
      });
    }
  },

  // Fetch nearby threats from web/news
  fetchThreats: async () => {
    set({ isLoadingThreats: true });
    
    try {
      // TODO: Integrate with news API / emergency alert API
      // For now, use mock data
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      set({
        threats: mockThreats.map((t) => ({ ...t, timestamp: Date.now() - Math.random() * 60 * 60 * 1000 })),
        isLoadingThreats: false,
        lastUpdate: Date.now(),
      });
    } catch (error) {
      console.error('[CONTROL] Failed to fetch threats:', error);
      set({ isLoadingThreats: false });
    }
  },

  // Fetch nearby emergency services
  fetchNearbyServices: async () => {
    try {
      // TODO: Integrate with Google Places API / Maps API
      // For now, use mock data
      await new Promise((resolve) => setTimeout(resolve, 600));
      
      set({
        nearbyServices: mockNearbyServices,
        lastUpdate: Date.now(),
      });
    } catch (error) {
      console.error('[CONTROL] Failed to fetch nearby services:', error);
    }
  },

  // Refresh all crisis data
  refreshAllData: async () => {
    const { fetchVitals, fetchLocation, fetchThreats, fetchNearbyServices } = get();
    
    await Promise.all([
      fetchVitals(),
      fetchLocation(),
      fetchThreats(),
      fetchNearbyServices(),
    ]);
  },
}));

export default useControlStore;
