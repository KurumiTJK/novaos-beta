// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG GOAL — Inspect Redis Data for Goals and Skills
// Run with: npx tsx src/debug-goal.ts [goalId]
// ═══════════════════════════════════════════════════════════════════════════════

import { storeManager } from './storage/index.js';
import { SwordKeys } from './infrastructure/redis/keys.js';
import type { GoalId, SkillId, QuestId } from './types/branded.js';

async function debug() {
  const goalIdArg = process.argv[2];
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  NOVAOS DEBUG: Goal & Skill Inspector');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\nConnecting to Redis...\n');
  
  const store = storeManager.getStore();
  
  // Get all sword keys
  const allKeys = await store.keys('sword:*');
  console.log(`Total sword keys in Redis: ${allKeys.length}\n`);
  
  // Categorize keys
  const goalKeys = allKeys.filter((k: string) => k.match(/^sword:goal:[^:]+$/));
  const skillKeys = allKeys.filter((k: string) => k.match(/^sword:skill:[^:]+$/));
  const questKeys = allKeys.filter((k: string) => k.match(/^sword:quest:[^:]+$/));
  const drillKeys = allKeys.filter((k: string) => k.match(/^sword:drill:[^:]+$/));
  const weekKeys = allKeys.filter((k: string) => k.includes(':week'));
  const planKeys = allKeys.filter((k: string) => k.includes(':learningplan:'));
  
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('  KEY COUNTS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`  Goals:         ${goalKeys.length}`);
  console.log(`  Quests:        ${questKeys.length}`);
  console.log(`  Skills:        ${skillKeys.length}`);
  console.log(`  Drills:        ${drillKeys.length}`);
  console.log(`  Week Plans:    ${weekKeys.length}`);
  console.log(`  Learning Plans: ${planKeys.length}`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LIST ALL GOALS
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ALL GOALS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const goals: Array<{ id: string; title: string; status: string; createdAt: string }> = [];
  
  for (const key of goalKeys) {
    try {
      const data = await store.get(key);
      if (data) {
        const goal = JSON.parse(data);
        goals.push({
          id: goal.id,
          title: goal.title,
          status: goal.status,
          createdAt: goal.createdAt,
        });
      }
    } catch (e) {
      console.log(`  [ERROR] Could not parse ${key}`);
    }
  }
  
  // Sort by createdAt descending
  goals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i]!;
    console.log(`\n  [${i + 1}] ${g.title}`);
    console.log(`      ID: ${g.id}`);
    console.log(`      Status: ${g.status}`);
    console.log(`      Created: ${g.createdAt}`);
    
    // Count skills for this goal
    const skillIndexKey = SwordKeys.goalSkills(g.id as GoalId);
    const skillIds = await store.smembers(skillIndexKey);
    console.log(`      Skills: ${skillIds.length}`);
  }
  
  if (goals.length === 0) {
    console.log('\n  No goals found in Redis.');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INSPECT SPECIFIC GOAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  const targetGoalId = goalIdArg || goals[0]?.id;
  
  if (!targetGoalId) {
    console.log('\n\nNo goal to inspect. Create a goal first!');
    process.exit(0);
  }
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  INSPECTING GOAL: ${targetGoalId}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Get goal details
  const goalKey = SwordKeys.goal(targetGoalId as GoalId);
  const goalData = await store.get(goalKey);
  
  if (!goalData) {
    console.log('\n  Goal not found!');
    process.exit(1);
  }
  
  const goal = JSON.parse(goalData);
  console.log(`\n  Title: ${goal.title}`);
  console.log(`  Description: ${goal.description?.substring(0, 100) || 'N/A'}...`);
  console.log(`  Status: ${goal.status}`);
  console.log(`  User Level: ${goal.learningConfig?.userLevel || 'N/A'}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTS FOR THIS GOAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  QUESTS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const questIndexKey = SwordKeys.goalQuests(targetGoalId as GoalId);
  const questIds = await store.smembers(questIndexKey);
  
  const quests: Array<{ id: string; title: string; order: number }> = [];
  
  for (const questId of questIds) {
    try {
      const questKey = SwordKeys.quest(questId as QuestId);
      const questData = await store.get(questKey);
      if (questData) {
        const quest = JSON.parse(questData);
        quests.push({
          id: quest.id,
          title: quest.title,
          order: quest.order,
        });
      }
    } catch (e) {
      // Skip
    }
  }
  
  quests.sort((a, b) => a.order - b.order);
  
  for (const q of quests) {
    console.log(`\n  [Quest ${q.order}] ${q.title}`);
    console.log(`      ID: ${q.id}`);
  }
  
  if (quests.length === 0) {
    console.log('\n  No quests found for this goal.');
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SKILLS FOR THIS GOAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  SKILLS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const skillIndexKey = SwordKeys.goalSkills(targetGoalId as GoalId);
  const skillIds = await store.smembers(skillIndexKey);
  
  console.log(`\n  Total skills indexed to this goal: ${skillIds.length}`);
  
  if (skillIds.length === 0) {
    console.log('\n  ⚠️  NO SKILLS FOUND!');
    console.log('  This means skill decomposition did not run or failed.');
    console.log('  Check server logs for [CAPABILITY_GEN] and [SKILL_DECOMPOSITION] messages.');
  } else {
    console.log('\n  First 5 skills:');
    
    for (const skillId of skillIds.slice(0, 5)) {
      try {
        const skillKey = SwordKeys.skill(skillId as SkillId);
        const skillData = await store.get(skillKey);
        if (skillData) {
          const skill = JSON.parse(skillData);
          console.log(`\n  [${skill.id}]`);
          console.log(`      Title: ${skill.title}`);
          console.log(`      Action: ${skill.action?.substring(0, 60)}...`);
          console.log(`      Type: ${skill.skillType}`);
          console.log(`      Mastery: ${skill.mastery}`);
          console.log(`      GoalId: ${skill.goalId}`);
          
          // Check if goalId matches
          if (skill.goalId !== targetGoalId) {
            console.log(`      ⚠️  MISMATCH! Skill goalId doesn't match target goal!`);
          }
        }
      } catch (e) {
        console.log(`  [ERROR] Could not parse skill ${skillId}`);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LEARNING PLAN
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  LEARNING PLAN');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const planKey = SwordKeys.learningPlan(targetGoalId as GoalId);
  const planData = await store.get(planKey);
  
  if (!planData) {
    console.log('\n  ⚠️  NO LEARNING PLAN FOUND!');
    console.log('  This means initializePlan() did not run or failed.');
  } else {
    const plan = JSON.parse(planData);
    console.log(`\n  Total Weeks: ${plan.totalWeeks}`);
    console.log(`  Total Skills: ${plan.totalSkills}`);
    console.log(`  Total Drills: ${plan.totalDrills}`);
    console.log(`  Estimated Completion: ${plan.estimatedCompletionDate}`);
    
    if (plan.questSkillMapping?.length > 0) {
      console.log('\n  Quest → Skill Mapping:');
      for (const mapping of plan.questSkillMapping) {
        console.log(`    Quest ${mapping.questOrder}: "${mapping.questTitle}" → ${mapping.skillCount} skills`);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CURRENT WEEK PLAN
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('  WEEK PLANS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const weekIndexKey = SwordKeys.goalWeeks(targetGoalId as GoalId);
  const weekPlanIds = await store.smembers(weekIndexKey);
  
  console.log(`\n  Week plans for this goal: ${weekPlanIds.length}`);
  
  for (const weekId of weekPlanIds.slice(0, 2)) {
    try {
      const weekKey = `sword:weekplan:${weekId}`;
      const weekData = await store.get(weekKey);
      if (weekData) {
        const week = JSON.parse(weekData);
        console.log(`\n  [Week ${week.weekNumber}]`);
        console.log(`      Status: ${week.status}`);
        console.log(`      Start: ${week.startDate}`);
        console.log(`      End: ${week.endDate}`);
        console.log(`      Scheduled Skills: ${week.scheduledSkillIds?.length || 0}`);
        console.log(`      Carry Forward: ${week.carryForwardSkillIds?.length || 0}`);
      }
    } catch (e) {
      // Skip
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSIS
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DIAGNOSIS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const issues: string[] = [];
  
  if (quests.length === 0) {
    issues.push('No quests created for goal');
  }
  
  if (skillIds.length === 0) {
    issues.push('No skills decomposed - check if triggerSkillDecomposition() ran');
  }
  
  if (!planData) {
    issues.push('No learning plan - check if initializePlan() ran');
  }
  
  if (weekPlanIds.length === 0) {
    issues.push('No week plans - learning plan initialization incomplete');
  }
  
  // Check for mismatched skills (skills that don't belong to this goal)
  let mismatchCount = 0;
  for (const skillId of skillIds.slice(0, 10)) {
    try {
      const skillKey = SwordKeys.skill(skillId as SkillId);
      const skillData = await store.get(skillKey);
      if (skillData) {
        const skill = JSON.parse(skillData);
        if (skill.goalId !== targetGoalId) {
          mismatchCount++;
        }
      }
    } catch (e) {
      // Skip
    }
  }
  
  if (mismatchCount > 0) {
    issues.push(`${mismatchCount} skills have mismatched goalId - index corruption`);
  }
  
  if (issues.length === 0) {
    console.log('\n  ✅ No obvious issues detected.');
    console.log('  If skills show wrong content, the CapabilityGenerator may have');
    console.log('  generated wrong stages. Check [CAPABILITY_GEN] logs.');
  } else {
    console.log('\n  ⚠️  Issues detected:');
    for (const issue of issues) {
      console.log(`    • ${issue}`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  process.exit(0);
}

debug().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
