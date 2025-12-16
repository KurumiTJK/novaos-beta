// ═══════════════════════════════════════════════════════════════════════════════
// K6 LOAD TEST — Performance & Load Testing for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Run with: k6 run src/tests/load/k6-load-test.ts
//
// Or with options:
//   k6 run --vus 50 --duration 5m src/tests/load/k6-load-test.ts
//
// Environment variables:
//   K6_BASE_URL - API base URL (default: http://localhost:3000)
//   K6_API_KEY - API key for authentication
//
// ═══════════════════════════════════════════════════════════════════════════════

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.K6_API_KEY || '';

// Test scenarios
export const options = {
  scenarios: {
    // Smoke test - quick sanity check
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
      exec: 'smokeTest',
    },
    
    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },  // Ramp up to 20 users
        { duration: '5m', target: 20 },  // Stay at 20 users
        { duration: '2m', target: 50 },  // Ramp up to 50 users
        { duration: '5m', target: 50 },  // Stay at 50 users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      tags: { test_type: 'load' },
      exec: 'loadTest',
      startTime: '35s', // Start after smoke test
    },
    
    // Stress test - beyond normal capacity
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '5m', target: 150 },
        { duration: '5m', target: 0 },
      ],
      tags: { test_type: 'stress' },
      exec: 'stressTest',
      startTime: '20m', // Start after load test
    },
    
    // Spike test - sudden surge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '10s', target: 0 },
      ],
      tags: { test_type: 'spike' },
      exec: 'spikeTest',
      startTime: '40m', // Start after stress test
    },
  },
  
  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    'http_req_duration{endpoint:health}': ['p(95)<100'],
    'http_req_duration{endpoint:chat}': ['p(95)<5000'],
    'http_req_duration{endpoint:goals}': ['p(95)<500'],
    
    // Error rate thresholds
    http_req_failed: ['rate<0.05'],  // Less than 5% failure rate
    'http_req_failed{test_type:smoke}': ['rate<0.01'],
    
    // Custom metrics
    errors: ['count<100'],
    successful_chats: ['rate>0.90'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────────────────────────

const errors = new Counter('errors');
const successfulChats = new Rate('successful_chats');
const chatLatency = new Trend('chat_latency');
const goalCreateLatency = new Trend('goal_create_latency');
const activeUsers = new Gauge('active_users');

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  
  return headers;
}

function checkResponse(res, name) {
  const success = check(res, {
    [`${name}: status is 200`]: (r) => r.status === 200 || r.status === 201,
    [`${name}: response time < 5s`]: (r) => r.timings.duration < 5000,
  });
  
  if (!success) {
    errors.add(1);
  }
  
  return success;
}

function registerUser() {
  const email = `loadtest_${randomString(8)}@example.com`;
  
  const res = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ email, tier: 'free' }),
    { headers: getHeaders() }
  );
  
  if (res.status === 200) {
    const data = res.json();
    return {
      userId: data.userId,
      token: data.token,
      apiKey: data.apiKey,
    };
  }
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SMOKE TEST
// ─────────────────────────────────────────────────────────────────────────────────

export function smokeTest() {
  group('Smoke Test', () => {
    // Health check
    group('Health Check', () => {
      const res = http.get(`${BASE_URL}/health`, {
        tags: { endpoint: 'health' },
      });
      checkResponse(res, 'health');
    });
    
    // Version check
    group('Version Check', () => {
      const res = http.get(`${BASE_URL}/api/v1/version`, {
        tags: { endpoint: 'version' },
      });
      checkResponse(res, 'version');
    });
    
    // API health
    group('API Health', () => {
      const res = http.get(`${BASE_URL}/api/v1/health`, {
        tags: { endpoint: 'api_health' },
      });
      checkResponse(res, 'api_health');
    });
  });
  
  sleep(1);
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOAD TEST
// ─────────────────────────────────────────────────────────────────────────────────

export function loadTest() {
  activeUsers.add(1);
  
  // Register a user for this VU
  const user = registerUser();
  
  if (!user) {
    errors.add(1);
    sleep(1);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
  };
  
  group('Load Test - User Flow', () => {
    // Check auth status
    group('Auth Status', () => {
      const res = http.get(`${BASE_URL}/api/v1/auth/status`, {
        headers,
        tags: { endpoint: 'auth_status' },
      });
      checkResponse(res, 'auth_status');
    });
    
    sleep(randomIntBetween(1, 3));
    
    // Send chat message
    group('Chat Message', () => {
      const startTime = Date.now();
      
      const res = http.post(
        `${BASE_URL}/api/v1/chat`,
        JSON.stringify({ message: `Load test message ${randomString(10)}` }),
        { headers, tags: { endpoint: 'chat' } }
      );
      
      const success = checkResponse(res, 'chat');
      successfulChats.add(success);
      chatLatency.add(Date.now() - startTime);
    });
    
    sleep(randomIntBetween(2, 5));
    
    // List goals
    group('List Goals', () => {
      const res = http.get(`${BASE_URL}/api/v1/goals`, {
        headers,
        tags: { endpoint: 'goals' },
      });
      checkResponse(res, 'list_goals');
    });
    
    sleep(randomIntBetween(1, 2));
    
    // Create a memory
    group('Create Memory', () => {
      const res = http.post(
        `${BASE_URL}/api/v1/memories`,
        JSON.stringify({
          category: 'fact',
          key: `loadtest_${randomString(5)}`,
          value: `Test value ${randomString(10)}`,
        }),
        { headers, tags: { endpoint: 'memories' } }
      );
      checkResponse(res, 'create_memory');
    });
    
    sleep(randomIntBetween(1, 3));
    
    // Get profile
    group('Get Profile', () => {
      const res = http.get(`${BASE_URL}/api/v1/profile`, {
        headers,
        tags: { endpoint: 'profile' },
      });
      checkResponse(res, 'get_profile');
    });
  });
  
  activeUsers.add(-1);
  sleep(randomIntBetween(5, 10));
}

// ─────────────────────────────────────────────────────────────────────────────────
// STRESS TEST
// ─────────────────────────────────────────────────────────────────────────────────

export function stressTest() {
  activeUsers.add(1);
  
  const user = registerUser();
  
  if (!user) {
    errors.add(1);
    sleep(0.5);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
  };
  
  group('Stress Test - Rapid Operations', () => {
    // Rapid chat messages
    for (let i = 0; i < 3; i++) {
      const res = http.post(
        `${BASE_URL}/api/v1/chat`,
        JSON.stringify({ message: `Stress test ${i} - ${randomString(20)}` }),
        { headers, tags: { endpoint: 'chat' } }
      );
      
      const success = res.status === 200 || res.status === 201 || res.status === 429;
      successfulChats.add(res.status === 200 || res.status === 201);
      
      if (res.status === 429) {
        // Rate limited - back off
        sleep(5);
      } else {
        sleep(0.5);
      }
    }
    
    // Create goal
    const startTime = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/goals`,
      JSON.stringify({
        title: `Stress Goal ${randomString(8)}`,
        description: 'Created during stress test',
        desiredOutcome: 'Complete stress testing',
      }),
      { headers, tags: { endpoint: 'goals' } }
    );
    goalCreateLatency.add(Date.now() - startTime);
    checkResponse(res, 'create_goal');
    
    // Rapid memory operations
    for (let i = 0; i < 5; i++) {
      http.post(
        `${BASE_URL}/api/v1/memories`,
        JSON.stringify({
          category: 'fact',
          key: `stress_${i}_${randomString(5)}`,
          value: randomString(50),
        }),
        { headers, tags: { endpoint: 'memories' } }
      );
      sleep(0.1);
    }
  });
  
  activeUsers.add(-1);
  sleep(randomIntBetween(1, 3));
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPIKE TEST
// ─────────────────────────────────────────────────────────────────────────────────

export function spikeTest() {
  activeUsers.add(1);
  
  const user = registerUser();
  
  if (!user) {
    errors.add(1);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
  };
  
  group('Spike Test - Burst Operations', () => {
    // Immediate burst of requests
    const requests = [
      ['GET', `${BASE_URL}/api/v1/health`, null],
      ['GET', `${BASE_URL}/api/v1/profile`, null],
      ['GET', `${BASE_URL}/api/v1/goals`, null],
      ['POST', `${BASE_URL}/api/v1/chat`, { message: `Spike ${randomString(10)}` }],
    ];
    
    for (const [method, url, body] of requests) {
      if (method === 'GET') {
        http.get(url, { headers, tags: { endpoint: 'spike' } });
      } else {
        http.post(url, JSON.stringify(body), { headers, tags: { endpoint: 'spike' } });
      }
    }
  });
  
  activeUsers.add(-1);
  sleep(0.5);
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT FUNCTION (runs if no scenario specified)
// ─────────────────────────────────────────────────────────────────────────────────

export default function() {
  loadTest();
}

// ─────────────────────────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ─────────────────────────────────────────────────────────────────────────────────

export function setup() {
  // Verify the API is reachable
  const res = http.get(`${BASE_URL}/health`);
  
  if (res.status !== 200) {
    throw new Error(`API not reachable at ${BASE_URL}`);
  }
  
  console.log(`Load test starting against ${BASE_URL}`);
  
  return {
    startTime: Date.now(),
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)}s`);
}
