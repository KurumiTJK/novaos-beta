// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP ALL — Delete ALL sword data from Redis (nuclear option)
// Run with: npx tsx src/cleanup-all.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { Redis } from 'ioredis';

async function cleanup() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CLEANUP: Delete ALL Sword Data');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('❌ REDIS_URL not set!');
    process.exit(1);
  }
  
  const redis = new Redis(redisUrl, {
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  });
  
  await new Promise<void>((resolve) => {
    redis.on('ready', resolve);
  });
  
  console.log('Connected to Redis\n');
  
  // Find ALL nova:sword keys using SCAN
  console.log('Finding all nova:sword:* keys...\n');
  
  let cursor = '0';
  let allKeys: string[] = [];
  
  do {
    const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'nova:sword:*', 'COUNT', 100);
    cursor = newCursor;
    allKeys = [...allKeys, ...keys];
  } while (cursor !== '0');
  
  console.log(`Found ${allKeys.length} keys to delete\n`);
  
  if (allKeys.length === 0) {
    console.log('Nothing to delete!');
    await redis.quit();
    process.exit(0);
  }
  
  // Show keys
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  KEYS TO DELETE');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  allKeys.sort().forEach(k => console.log('  ', k));
  
  // Delete all keys
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  DELETING...');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  let deleted = 0;
  for (const key of allKeys) {
    try {
      const result = await redis.del(key);
      if (result > 0) {
        deleted++;
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  console.log(`  ✅ Deleted ${deleted} keys\n`);
  
  // Verify
  const remaining = await redis.keys('nova:sword:*');
  if (remaining.length === 0) {
    console.log('  All sword data has been cleared!\n');
  } else {
    console.log(`  ⚠️ ${remaining.length} keys remain (will try again)...`);
    for (const key of remaining) {
      await redis.del(key);
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DONE');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('  1. Restart your server');
  console.log('  2. Create a new goal: "I want to learn Python"');
  console.log('  3. Ask "what\'s my practice today?" to verify\n');
  
  await redis.quit();
  process.exit(0);
}

cleanup().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
