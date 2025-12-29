// ═══════════════════════════════════════════════════════════════════════════════
// INSPECT NOVA DATA — See actual data in Redis with nova: prefix
// Run with: npx tsx src/inspect-nova-data.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { Redis } from 'ioredis';

async function inspect() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  NOVA DATA INSPECTOR');
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
  
  // Get all nova:sword keys
  const allKeys = await redis.keys('nova:sword:*');
  console.log(`Total nova:sword:* keys: ${allKeys.length}\n`);
  
  // Categorize keys
  const goalKeys = allKeys.filter(k => k.match(/nova:sword:goal:[^:]+$/));
  const questKeys = allKeys.filter(k => k.includes(':quest:') && !k.includes(':quests'));
  const skillKeys = allKeys.filter(k => k.includes(':skill:'));
  const drillKeys = allKeys.filter(k => k.includes(':drill:'));
  const weekKeys = allKeys.filter(k => k.includes(':week'));
  const indexKeys = allKeys.filter(k => k.includes(':quests') || k.includes(':skills'));
  
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  KEY COUNTS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`  Goals:      ${goalKeys.length}`);
  console.log(`  Quests:     ${questKeys.length}`);
  console.log(`  Skills:     ${skillKeys.length}`);
  console.log(`  Drills:     ${drillKeys.length}`);
  console.log(`  Week Plans: ${weekKeys.length}`);
  console.log(`  Indexes:    ${indexKeys.length}`);
  console.log('');
  
  // Show all keys grouped
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  ALL NOVA:SWORD KEYS');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  allKeys.sort().forEach(k => console.log('  ', k));
  
  // Inspect goals
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  GOALS');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  for (const key of goalKeys) {
    try {
      const data = await redis.get(key);
      if (data) {
        const goal = JSON.parse(data);
        console.log(`  [${goal.id}]`);
        console.log(`    Title: ${goal.title}`);
        console.log(`    Status: ${goal.status}`);
        console.log(`    Created: ${goal.createdAt}`);
        
        // Check for skills index
        const skillsIndexKey = `nova:sword:goal:${goal.id}:skills`;
        const skillIds = await redis.smembers(skillsIndexKey);
        console.log(`    Skills indexed: ${skillIds.length}`);
        
        // Check for quests index
        const questsIndexKey = `nova:sword:goal:${goal.id}:quests`;
        const questIds = await redis.smembers(questsIndexKey);
        console.log(`    Quests indexed: ${questIds.length}`);
        console.log('');
      }
    } catch (e) {
      console.log(`  Error parsing ${key}:`, e);
    }
  }
  
  // Inspect skills
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  SKILLS (first 5)');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  for (const key of skillKeys.slice(0, 5)) {
    try {
      const data = await redis.get(key);
      if (data) {
        const skill = JSON.parse(data);
        console.log(`  [${skill.id}]`);
        console.log(`    Title: ${skill.title}`);
        console.log(`    Action: ${skill.action?.substring(0, 60)}...`);
        console.log(`    GoalId: ${skill.goalId}`);
        console.log(`    QuestId: ${skill.questId}`);
        console.log(`    Type: ${skill.skillType}`);
        console.log(`    Mastery: ${skill.mastery}`);
        console.log('');
      }
    } catch (e) {
      console.log(`  Error parsing ${key}:`, e);
    }
  }
  
  // Inspect drills
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  DRILLS');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  for (const key of drillKeys) {
    try {
      const data = await redis.get(key);
      if (data) {
        const drill = JSON.parse(data);
        console.log(`  [${drill.id}]`);
        console.log(`    Date: ${drill.scheduledDate}`);
        console.log(`    Skill: ${drill.skillTitle}`);
        console.log(`    Action: ${drill.action?.substring(0, 60)}...`);
        console.log(`    Status: ${drill.status}`);
        console.log(`    Outcome: ${drill.outcome || 'none'}`);
        console.log('');
      }
    } catch (e) {
      console.log(`  Error parsing ${key}:`, e);
    }
  }
  
  // Check week plans
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  WEEK PLANS');
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  for (const key of weekKeys) {
    if (key.includes(':activeweek')) {
      const weekPlanId = await redis.get(key);
      console.log(`  Active Week: ${weekPlanId}`);
    }
  }
  
  // Diagnosis
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('  KEY PREFIX ISSUE:');
  console.log('    Data stored with: nova:sword:*');
  console.log('    Code looks for:   sword:*');
  console.log('');
  console.log('  FIX NEEDED:');
  console.log('    1. Update SwordKeys to use "nova:sword:" prefix, OR');
  console.log('    2. Fix storeManager to use Redis instead of MemoryStore');
  console.log('');
  console.log('  The data IS in Redis. Your app just can\'t find it.\n');
  
  await redis.quit();
  process.exit(0);
}

inspect().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
