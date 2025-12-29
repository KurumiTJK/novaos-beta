// ═══════════════════════════════════════════════════════════════════════════════
// CHECK STORAGE — Diagnose storage configuration
// Run with: npx tsx src/check-storage.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { Redis } from 'ioredis';

async function check() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  STORAGE CONFIGURATION CHECK');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Check environment
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  ENVIRONMENT');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  const redisUrl = process.env.REDIS_URL;
  console.log('  REDIS_URL:', redisUrl ? redisUrl.substring(0, 60) + '...' : '❌ NOT SET');
  console.log('  ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ NOT SET');
  console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');
  
  if (!redisUrl) {
    console.log('\n⚠️  REDIS_URL not set! App will use in-memory store (data lost on restart).\n');
    process.exit(0);
  }
  
  // Try direct Redis connection
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  DIRECT REDIS CONNECTION TEST');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  try {
    console.log('  Connecting to Redis...');
    
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    });
    
    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      redis.on('ready', () => {
        console.log('  ✅ Connected to Redis!\n');
        resolve();
      });
      redis.on('error', (err) => {
        console.log('  ❌ Redis error:', err.message);
        reject(err);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
    
    // Test operations
    console.log('  Testing Redis operations...');
    
    // PING
    const pong = await redis.ping();
    console.log('  PING:', pong);
    
    // INFO
    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    if (versionMatch) {
      console.log('  Redis version:', versionMatch[1]);
    }
    
    // DBSIZE
    const dbsize = await redis.dbsize();
    console.log('  Keys in database:', dbsize);
    
    // KEYS
    const keys = await redis.keys('*');
    console.log('  Keys found with KEYS *:', keys.length);
    
    if (keys.length > 0) {
      console.log('\n  Sample keys:');
      keys.slice(0, 10).forEach(k => console.log('    ', k));
    }
    
    // Test write
    console.log('\n  Testing write...');
    await redis.set('novaos:test:ping', 'pong', 'EX', 60);
    const testValue = await redis.get('novaos:test:ping');
    console.log('  Write/Read test:', testValue === 'pong' ? '✅ PASSED' : '❌ FAILED');
    await redis.del('novaos:test:ping');
    
    // Check SCAN for sword keys
    console.log('\n  Scanning for sword:* keys...');
    let cursor = '0';
    let swordKeys: string[] = [];
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'sword:*', 'COUNT', 100);
      cursor = newCursor;
      swordKeys = swordKeys.concat(keys);
    } while (cursor !== '0');
    console.log('  sword:* keys found:', swordKeys.length);
    
    // Check SCAN for spark:* keys  
    console.log('  Scanning for spark:* keys...');
    cursor = '0';
    let sparkKeys: string[] = [];
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'spark:*', 'COUNT', 100);
      cursor = newCursor;
      sparkKeys = sparkKeys.concat(keys);
    } while (cursor !== '0');
    console.log('  spark:* keys found:', sparkKeys.length);
    
    // Check SCAN for goal:* keys
    console.log('  Scanning for goal:* keys...');
    cursor = '0';
    let goalKeys: string[] = [];
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', '*goal*', 'COUNT', 100);
      cursor = newCursor;
      goalKeys = goalKeys.concat(keys);
    } while (cursor !== '0');
    console.log('  *goal* keys found:', goalKeys.length);
    
    if (goalKeys.length > 0) {
      console.log('  Goal key examples:');
      goalKeys.slice(0, 5).forEach(k => console.log('    ', k));
    }
    
    await redis.quit();
    
  } catch (error) {
    console.log('  ❌ Redis connection failed:', error instanceof Error ? error.message : error);
  }
  
  // Check storeManager
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  STORE MANAGER CHECK');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  try {
    const { storeManager } = await import('./storage/index.js');
    const store = storeManager.getStore();
    
    console.log('  Store type:', store.constructor.name);
    
    // Try to get keys through storeManager
    const keys = await store.keys('*');
    console.log('  Keys via storeManager:', keys.length);
    
    if (keys.length > 0) {
      console.log('  Sample keys:');
      keys.slice(0, 10).forEach((k: string) => console.log('    ', k));
    }
    
  } catch (error) {
    console.log('  ❌ storeManager error:', error instanceof Error ? error.message : error);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('  If Redis shows 0 keys but your app was showing data:');
  console.log('  → Your app is using IN-MEMORY storage (data lost on restart)');
  console.log('');
  console.log('  To fix, ensure your dev server has REDIS_URL set when starting.');
  console.log('  Check src/storage/index.ts for fallback logic.\n');
  
  process.exit(0);
}

check().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
