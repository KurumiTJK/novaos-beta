// ═══════════════════════════════════════════════════════════════════════════════
// CHECK REDIS — See ALL keys in Redis
// Run with: npx tsx src/check-redis.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { storeManager } from './storage/index.js';

async function check() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  REDIS KEY INSPECTOR');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const store = storeManager.getStore();
  
  // Get ALL keys
  const allKeys = await store.keys('*');
  
  console.log(`Total keys in Redis: ${allKeys.length}\n`);
  
  if (allKeys.length === 0) {
    console.log('⚠️  Redis is EMPTY!');
    console.log('');
    console.log('This means either:');
    console.log('  1. Data was never written');
    console.log('  2. Data was cleared/expired');
    console.log('  3. Wrong Redis instance (check REDIS_URL)');
    console.log('');
    console.log('Your REDIS_URL:', process.env.REDIS_URL?.substring(0, 50) + '...');
    process.exit(0);
  }
  
  // Group keys by prefix
  const prefixCounts: Record<string, number> = {};
  const prefixExamples: Record<string, string[]> = {};
  
  for (const key of allKeys) {
    // Extract prefix (first part before :)
    const prefix = key.split(':')[0] + ':';
    prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
    
    if (!prefixExamples[prefix]) {
      prefixExamples[prefix] = [];
    }
    if (prefixExamples[prefix]!.length < 3) {
      prefixExamples[prefix]!.push(key);
    }
  }
  
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  KEYS BY PREFIX');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  // Sort by count descending
  const sortedPrefixes = Object.entries(prefixCounts)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [prefix, count] of sortedPrefixes) {
    console.log(`  ${prefix}*  →  ${count} keys`);
    for (const example of prefixExamples[prefix] || []) {
      console.log(`      ${example}`);
    }
    console.log('');
  }
  
  // Show all keys if less than 50
  if (allKeys.length <= 50) {
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('  ALL KEYS');
    console.log('─────────────────────────────────────────────────────────────────\n');
    
    allKeys.sort().forEach(k => console.log('  ', k));
  }
  
  // Check for goal-like keys with different patterns
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  SEARCHING FOR GOAL DATA');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  const goalPatterns = ['goal', 'Goal', 'GOAL', 'spark', 'Spark', 'learn', 'skill', 'quest'];
  
  for (const pattern of goalPatterns) {
    const matches = allKeys.filter(k => k.toLowerCase().includes(pattern.toLowerCase()));
    if (matches.length > 0) {
      console.log(`  Keys containing "${pattern}": ${matches.length}`);
      matches.slice(0, 3).forEach(k => console.log(`      ${k}`));
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  process.exit(0);
}

check().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
