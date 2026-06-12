import { xianxiaContent } from "../web-runtime/src/content-registry/index.js";
import { readFileSync } from "node:fs";

const meta = xianxiaContent.metaProgression;
const errors = [];
const sourceFiles = [
  "../web-runtime/src/bootstrap/runtime/query.js",
  "../web-runtime/src/bootstrap/runtime/ui-shell.js",
  "../web-runtime/src/main.js",
  "../web-runtime/src/meta/progression/build-planner.js",
  "../web-runtime/src/ui/home/actions.js",
  "../web-runtime/src/ui/home/controller.js",
  "../web-runtime/src/ui/home/renderers.js",
  "../web-runtime/src/ui/home/state.js",
  "../web-runtime/src/meta/progression/meta-store.js",
  "../web-runtime/src/meta/progression/quests-goals.js",
  "../web-runtime/src/meta/progression/rewards-summary.js",
  "../web-runtime/src/gameplay/run-events.js",
  "../web-runtime/src/gameplay/run-runtime.js",
];
const combinedSource = sourceFiles
  .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
  .join("\n");

const allowedEffectTargets = new Set([
  "weapon.keyboard.burst",
  "weapon.keyboard.damage",
  "weapon.keyboard.damageMultiplier",
  "weapon.keyboard.level",
  "weapon.coffee.unlocked",
  "weapon.coffee.level",
  "weapon.coffee.radius",
  "weapon.coffee.damage",
  "weapon.invoice.unlocked",
  "weapon.invoice.level",
  "weapon.invoice.damage",
  "energy.value",
  "energy.gainMultiplier",
  "ultimate.damageMultiplier",
  "player.pickupRadius",
  "player.maxHp",
  "player.hp",
  "player.damageReduction",
  "player.speedMultiplier",
  "spellPowerBonus",
  "run.xpMultiplier",
  "run.healMultiplier",
  "run.killHeal",
  "run.energyRegen",
  "run.eliteDamageBonus",
  "reward.spiritStoneMultiplier",
]);

function byId(items = []) {
  return new Set(items.map((item) => item.id));
}

const ids = {
  chapters: byId(meta.chapters),
  artifacts: byId(meta.artifacts),
  startingTalents: byId(meta.startingTalents),
  cultivations: byId(meta.cultivations),
  talentTrees: byId(meta.talentTrees),
  facilities: byId(meta.facilities),
  difficulties: byId(meta.difficulties),
  styleTags: new Set(Object.keys(meta.styleTags || {})),
  currencies: new Set(Object.keys(meta.currencies || {})),
};

function assertRef(kind, id, owner) {
  if (!id || ids[kind]?.has(id)) return;
  errors.push(`${owner} references missing ${kind}: ${id}`);
}

function checkEffects(owner, effects = []) {
  for (const effect of effects) {
    if (!allowedEffectTargets.has(effect.target)) errors.push(`${owner} uses unsupported effect target: ${effect.target}`);
    if (!["add", "set", "multiply", undefined].includes(effect.op)) errors.push(`${owner} uses unsupported op: ${effect.op}`);
  }
}

function checkMilestoneEffects(owner, maxLevel, milestoneEffects = {}) {
  for (const [level, effects] of Object.entries(milestoneEffects)) {
    const numericLevel = Number(level);
    if (!Number.isInteger(numericLevel) || numericLevel < 1 || numericLevel > maxLevel) {
      errors.push(`${owner} has invalid milestone level: ${level}`);
    }
    checkEffects(`${owner} milestone ${level}`, effects);
  }
}

function checkMilestoneCopy(owner, maxLevel, milestones = {}, milestoneEffects = {}) {
  for (const [level, effects] of Object.entries(milestoneEffects)) {
    if (!effects?.length) continue;
    if (!milestones[level] || typeof milestones[level] !== "string" || !milestones[level].trim()) {
      errors.push(`${owner} milestone ${level} is missing display copy`);
    }
  }
  for (const level of Object.keys(milestones)) {
    const numericLevel = Number(level);
    if (!Number.isInteger(numericLevel) || numericLevel < 1 || numericLevel > maxLevel) {
      errors.push(`${owner} has invalid milestone copy level: ${level}`);
    }
  }
}

function checkRewards(owner, rewards = {}) {
  for (const [currency, amount] of Object.entries(rewards)) {
    if (!ids.currencies.has(currency)) errors.push(`${owner} rewards missing currency: ${currency}`);
    if (!Number.isFinite(amount) || amount < 0) errors.push(`${owner} has invalid reward amount for ${currency}: ${amount}`);
  }
}

for (const chapter of meta.chapters) {
  for (const tag of chapter.recommendedTags || []) assertRef("styleTags", tag, `chapter ${chapter.id}`);
  for (const id of chapter.firstClearUnlocks?.chapters || []) assertRef("chapters", id, `chapter ${chapter.id}`);
  for (const id of chapter.firstClearUnlocks?.artifacts || []) assertRef("artifacts", id, `chapter ${chapter.id}`);
  for (const id of chapter.firstClearUnlocks?.startingTalents || []) assertRef("startingTalents", id, `chapter ${chapter.id}`);
  for (const id of chapter.firstClearUnlocks?.cultivations || []) assertRef("cultivations", id, `chapter ${chapter.id}`);
  for (const event of chapter.runEvents || []) {
    checkEffects(`chapter ${chapter.id} runEvent ${event.id} blessing`, event.blessing?.effects || []);
    if (event.secretFollowup?.eventId) {
      assertRef("chapters", chapter.id, `chapter ${chapter.id} runEvent ${event.id}`);
      const sameChapterEventIds = new Set((chapter.runEvents || []).map((item) => item.id));
      if (!sameChapterEventIds.has(event.secretFollowup.eventId)) {
        errors.push(`chapter ${chapter.id} runEvent ${event.id} secretFollowup references missing same-chapter event ${event.secretFollowup.eventId}`);
      }
      if (event.secretFollowup.eventId === event.id) {
        errors.push(`chapter ${chapter.id} runEvent ${event.id} secretFollowup cannot target itself`);
      }
      for (const [difficultyId, chance] of Object.entries(event.secretFollowup.chanceByDifficulty || {})) {
        if (!ids.difficulties.has(difficultyId)) errors.push(`chapter ${chapter.id} runEvent ${event.id} secretFollowup uses unknown difficulty ${difficultyId}`);
        if (!(chance >= 0 && chance <= 1)) errors.push(`chapter ${chapter.id} runEvent ${event.id} secretFollowup has invalid chance ${difficultyId}:${chance}`);
      }
    }
    for (const choice of event.choices || []) {
      checkEffects(`chapter ${chapter.id} runEvent ${event.id} choice ${choice.id} blessing`, choice.blessing?.effects || []);
    }
    for (const [difficultyId, choices] of Object.entries(event.choicesByDifficulty || {})) {
      if (!ids.difficulties.has(difficultyId)) errors.push(`chapter ${chapter.id} runEvent ${event.id} uses unknown choice difficulty ${difficultyId}`);
      for (const choice of choices || []) {
        checkEffects(`chapter ${chapter.id} runEvent ${event.id} choice ${difficultyId}.${choice.id} blessing`, choice.blessing?.effects || []);
      }
    }
  }
}

for (const preset of meta.loadoutPresets || []) {
  assertRef("artifacts", preset.artifactId, `preset ${preset.id}`);
  assertRef("cultivations", preset.cultivationId, `preset ${preset.id}`);
  for (const id of preset.talentIds || []) assertRef("startingTalents", id, `preset ${preset.id}`);
  for (const id of preset.recommendedChapters || []) assertRef("chapters", id, `preset ${preset.id}`);
  for (const tag of preset.tags || []) assertRef("styleTags", tag, `preset ${preset.id}`);
}

for (const quest of meta.quests || []) {
  if (!["runs", "totalKills", "highestRealmLevel", "chapterClear", "comboSeen", "comboBest"].includes(quest.type)) {
    errors.push(`quest ${quest.id} has unsupported type: ${quest.type}`);
  }
  if (quest.type === "chapterClear") {
    assertRef("chapters", quest.chapterId, `quest ${quest.id}`);
    assertRef("difficulties", quest.difficultyId, `quest ${quest.id}`);
  } else if (!Number.isFinite(quest.target) || quest.target <= 0) {
    errors.push(`quest ${quest.id} has invalid target: ${quest.target}`);
  }
  checkRewards(`quest ${quest.id}`, quest.rewards);
}

for (const difficulty of meta.difficulties || []) {
  const mods = difficulty.bossSkillMods || {};
  for (const key of ["cooldown", "telegraph", "damage", "duration"]) {
    if (typeof mods[key] !== "undefined" && (!(mods[key] > 0) || mods[key] > 3)) {
      errors.push(`difficulty ${difficulty.id} has invalid bossSkillMods.${key}: ${mods[key]}`);
    }
  }
  if (typeof mods.countBonus !== "undefined" && (!Number.isInteger(mods.countBonus) || mods.countBonus < 0 || mods.countBonus > 4)) {
    errors.push(`difficulty ${difficulty.id} has invalid bossSkillMods.countBonus: ${mods.countBonus}`);
  }
}

for (const artifact of meta.artifacts) {
  checkEffects(`artifact ${artifact.id}`, artifact.effects);
  checkMilestoneEffects(`artifact ${artifact.id}`, artifact.maxLevel, artifact.milestoneEffects);
  checkMilestoneCopy(`artifact ${artifact.id}`, artifact.maxLevel, artifact.milestones, artifact.milestoneEffects);
}

for (const talent of meta.startingTalents) checkEffects(`startingTalent ${talent.id}`, talent.effects);

for (const tree of meta.talentTrees) {
  checkEffects(`talentTree ${tree.id}`, tree.effects);
  checkMilestoneEffects(`talentTree ${tree.id}`, tree.maxLevel, tree.milestoneEffects);
  checkMilestoneCopy(`talentTree ${tree.id}`, tree.maxLevel, tree.milestones, tree.milestoneEffects);
}

for (const facility of meta.facilities) {
  checkEffects(`facility ${facility.id}`, facility.effects);
  checkMilestoneCopy(`facility ${facility.id}`, facility.maxLevel, facility.milestones, facility.milestoneEffects);
}
for (const cultivation of meta.cultivations) checkEffects(`cultivation ${cultivation.id}`, cultivation.effects);
for (const cultivation of meta.cultivations) {
  checkMilestoneEffects(`cultivation ${cultivation.id}`, cultivation.maxLevel, cultivation.milestoneEffects);
  checkMilestoneCopy(`cultivation ${cultivation.id}`, cultivation.maxLevel, cultivation.milestones, cultivation.milestoneEffects);
  if (Object.keys(cultivation.milestones || {}).length < 2) {
    errors.push(`cultivation ${cultivation.id} needs at least 2 milestone previews`);
  }
}

if (!combinedSource.includes("next-milestone")) {
  errors.push("milestone UI is missing next milestone preview");
}

if (!combinedSource.includes("nextMilestoneBenefit(")) {
  errors.push("milestone UI is missing next milestone benefit summary");
}

if (!combinedSource.includes("nextMilestoneCostPlan(")) {
  errors.push("milestone UI is missing next milestone cost plan");
}

if (!combinedSource.includes("rushMilestone(")) {
  errors.push("milestone UI is missing rush-to-next milestone action");
}

if (!combinedSource.includes("milestone-materials")) {
  errors.push("milestone UI is missing material shortcut for blocked rushes");
}

if (!combinedSource.includes("focusedMaterials")) {
  errors.push("materials UI is missing focused material highlights");
}

if (!combinedSource.includes("focusedMaterials = []")) {
  errors.push("materials UI must clear focused material highlights on normal tab switches");
}

if (!combinedSource.includes("material-card-icon")) {
  errors.push("materials UI should render currency icon headers for faster scanning");
}

if (!combinedSource.includes("material-card-balance")) {
  errors.push("materials UI should separate material balance from descriptive copy");
}

if (!combinedSource.includes("materialNeedAmount(")) {
  errors.push("materials UI should calculate near-term material demand amounts");
}

if (!combinedSource.includes("material-need-amount")) {
  errors.push("materials UI should render near-term material demand amounts");
}

if (!combinedSource.includes("material-farm-route")) {
  errors.push("materials UI is missing per-material farm route estimates");
}

if (!combinedSource.includes("farm-material-route")) {
  errors.push("materials UI is missing actionable farm route shortcuts");
}

if (!combinedSource.includes("data-focus-materials=\"${(row.focusMaterials || [])")) {
  errors.push("recommendation material shortcuts must carry focused material keys");
}

if (!combinedSource.includes('debugMetaMode === "shortage"')) {
  errors.push("debug meta state is missing shortage scenario for material recommendation checks");
}

if (!combinedSource.includes('debugMetaMode === "cleared"')) {
  errors.push("debug meta state is missing cleared scenario for repeat material route checks");
}

if (combinedSource.includes('debugMetaMode === "combos" && debugFinishOnStart')) {
  errors.push("debug finish should work for every debug meta scenario");
}

if (
  !combinedSource.includes("if (debugFinishOnStart && metaConfig) startRunFromHome()")
  && !combinedSource.includes("if (debugFinishOnStart && metaConfig) {\n  runtime.startRunFromHome();\n}")
) {
  errors.push("debug finish should auto-start meta runs for result panel checks");
}

if (!combinedSource.includes("chapter-material-target")) {
  errors.push("chapter UI is missing material route context after farm shortcuts");
}

if (!combinedSource.includes("materialPreviewDifficultyId")) {
  errors.push("materials UI is missing reward difficulty preview controls");
}

if (!combinedSource.includes("materialRouteLockReason(")) {
  errors.push("materials UI is missing explicit farm route lock reasons");
}

if (!combinedSource.includes("materialRouteLockRank(")) {
  errors.push("materials UI should rank farm route locks by actionability");
}

if (!combinedSource.includes("materialRouteUnlockHint(")) {
  errors.push("materials UI should explain how to unlock locked farm routes");
}

if (!combinedSource.includes("unlock-material-route")) {
  errors.push("locked material routes should offer an unlock jump action");
}

if (!combinedSource.includes("nearestUnlockedChapterFor(")) {
  errors.push("locked material route unlock jumps should target an unlocked prerequisite chapter");
}

if (!combinedSource.includes("renderRewardSourceBreakdown(")) {
  errors.push("result UI should explain reward sources after a run");
}

if (!combinedSource.includes("exportMetaSave(")) {
  errors.push("home UI should support exporting local meta save data");
}

if (!combinedSource.includes("importMetaSave(")) {
  errors.push("home UI should support importing sanitized meta save data");
}

if (!combinedSource.includes("runMaterialGoal(")) {
  errors.push("run goals should preserve material route context after starting a run");
}

if (!combinedSource.includes("materialResultRecommendation(")) {
  errors.push("result next steps should return material-route runs back to materials");
}

if (!combinedSource.includes("debugMaterialDifficulty")) {
  errors.push("debug material result checks should support preview difficulty restoration");
}

if (!combinedSource.includes("targetMaterialDifficulty")) {
  errors.push("material route result shortcuts should remember the intended preview difficulty");
}

if (!combinedSource.includes("data-preview-difficulty")) {
  errors.push("result material shortcuts should carry preview difficulty back to materials");
}

if (!combinedSource.includes("materialRouteRewardNote(")) {
  errors.push("material farm routes should explain first-clear versus repeat-farm value");
}

if (!combinedSource.includes("materialRouteRunsText(")) {
  errors.push("materials UI should estimate runs needed to cover material shortages");
}

if (!combinedSource.includes("material-route-runs")) {
  errors.push("materials UI should render material shortage run estimates");
}

if (!combinedSource.includes("复刷收益")) {
  errors.push("material farm routes should label repeat material yield explicitly");
}

if (combinedSource.includes("（待扩展）")) {
  errors.push("milestone UI must not label configured milestones as pending expansion");
}

if (!combinedSource.includes("milestoneSummary(facility")) {
  errors.push("facility UI is missing shared milestone preview");
}

if (!combinedSource.includes("calculateRewardSourceBreakdown(")) {
  errors.push("result UI should calculate per-currency reward source details");
}

if (!combinedSource.includes("reward-source-cards")) {
  errors.push("result UI should render per-currency reward source cards");
}

if (!combinedSource.includes("chapterRewardHighlights(")) {
  errors.push("chapter UI should highlight first-clear versus repeat value");
}

if (!combinedSource.includes("chapter-reward-highlights")) {
  errors.push("chapter UI should render difficulty reward and first-clear highlight pills");
}

if (!combinedSource.includes("renderBestiaryRewardHighlights(")) {
  errors.push("bestiary UI should mirror chapter reward highlights");
}

if (!combinedSource.includes("chapterRewardChipRows(")) {
  errors.push("chapter UI should render iconized reward chips for drops and first-clear unlocks");
}

if (!combinedSource.includes("reward-chip")) {
  errors.push("reward chip styling should be present for chapter and bestiary rewards");
}

if (!combinedSource.includes("primaryMissingMaterial(")) {
  errors.push("upgrade cost hints should choose a primary missing material route");
}

if (!combinedSource.includes("cost-hint-actions")) {
  errors.push("upgrade cost hints should render shortcut actions");
}

if (!combinedSource.includes("renderFirstClearRewardSummary(")) {
  errors.push("result UI should render a dedicated first-clear reward summary");
}

if (!combinedSource.includes("first-clear-reward-summary")) {
  errors.push("result UI should style the first-clear reward summary block");
}

if (!combinedSource.includes("spawnMaterialPickup(")) {
  errors.push("battle rewards should render collectible material pickups");
}

if (!combinedSource.includes("spawnRewardPickups(")) {
  errors.push("battle rewards should group live drops into pickup spawns");
}

if (!combinedSource.includes("rewardPickupsForEnemy(")) {
  errors.push("elite and boss defeats should route into live pickup rewards");
}

if (!combinedSource.includes("debugSpawnMaterialDrops(")) {
  errors.push("debug API should expose a material pickup spawn helper");
}

if (!combinedSource.includes("currentRunEvents(") || !combinedSource.includes("recordRunEvent(")) {
  errors.push("chapter-themed run events should be driven by shared event helpers");
}

if (!combinedSource.includes("renderRunEventPreview(") || !combinedSource.includes("chapterBuildContextTags(")) {
  errors.push("chapter and bestiary flows should surface event previews and event-driven build context");
}

if (!combinedSource.includes("spawnEventAmbush(") || !combinedSource.includes("debugSpawnRunEvent(") || !combinedSource.includes("ambushSummaryText(")) {
  errors.push("risk-reward run events should expose ambush helpers and debug hooks");
}

if (!combinedSource.includes("startEventChallenge(") || !combinedSource.includes("updateEventChallenge(") || !combinedSource.includes("runEventChallengeGoal(")) {
  errors.push("timed run event challenges should wire through battle runtime and goal tracking");
}

if (!combinedSource.includes("eventChallengeId")) {
  errors.push("challenge ambush enemies should preserve eventChallengeId for kill tracking");
}

if (!combinedSource.includes("openRunEventChoice(") || !combinedSource.includes("selectRunEventChoice(") || !combinedSource.includes("debugChooseEventChoice(")) {
  errors.push("choice-based run events should expose selection helpers and debug hooks");
}

if (!combinedSource.includes("renderRunBlessingsSummary(") || !combinedSource.includes("activeEventChoice")) {
  errors.push("choice-based blessings should render in battle summaries and track active event choice state");
}

if (!combinedSource.includes("maybeTriggerRunEventFollowups(") || !combinedSource.includes("followupEventId")) {
  errors.push("choice-based run events should support chained follow-up event routes");
}

if (!combinedSource.includes("secretFollowup") || !combinedSource.includes("隐秘机缘")) {
  errors.push("run events should support hidden rare follow-up routes without spoiling labels");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("xianxia config ok");
}
