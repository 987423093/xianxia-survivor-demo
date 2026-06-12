import { createThemeContentRegistry, themeRegistry } from "./content-registry/index.js";
import { createAssetManager, createImageHtmlHelpers } from "./resources/assets.js";
import { createBuildPlanner } from "./meta/progression/build-planner.js";
import { createHomeActionHandler } from "./ui/home/actions.js";
import { createHomeController } from "./ui/home/controller.js";
import { createHomeRenderers } from "./ui/home/renderers.js";
import { createHomeState } from "./ui/home/state.js";
import { createHomeUiAssets } from "./ui/home/ui-assets.js";
import { createMetaStore } from "./meta/progression/meta-store.js";
import { createQuestsGoals } from "./meta/progression/quests-goals.js";
import { createRenderer } from "./gameplay/renderer.js";
import { createRewardsSummary } from "./meta/progression/rewards-summary.js";
import { createRunEvents } from "./gameplay/run-events.js";
import { createRunRuntime } from "./gameplay/run-runtime.js";
import { readBootConfig } from "./bootstrap/runtime/query.js";
import { collectUi, createPointerState, createUiShell } from "./bootstrap/runtime/ui-shell.js";

const {
  requestedChapter,
  requestedDifficulty,
  debugBossOnLoad,
  debugMetaMode,
  debugFinishOnStart,
  debugSecretRoutes,
  debugResolveEventId,
  debugResolveEventChoice,
  debugResolveEventChain,
  debugOpenTab,
  debugResultMode,
  debugTargetMaterial,
  debugTargetMaterialMode,
  debugTargetMaterialDifficulty,
  theme,
} = readBootConfig(window.location.search, themeRegistry.catalog);

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const ui = collectUi(document);

const keys = new Set();
const pointer = createPointerState();

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const positiveModulo = (value, size) => ((value % size) + size) % size;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const normalize = (x, y) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

const {
  imageAssets,
  optimizedAssetFile,
  loadImageAsset,
  getAsset,
  canUseGeometryFallback,
  preloadThemeAssets,
  preloadCriticalAssets,
  preloadBattleDeferredAssets,
  preloadHomeAssetsForTab,
  preloadNamedAssets,
  waitForAssetKeys,
  drawImageCentered,
  drawSpriteFitted,
} = createAssetManager({ theme, ctx, clamp });
const { optimizedAssetUrl, thumbnailAsset, homeImage } = createImageHtmlHelpers({ theme, optimizedAssetFile });

const themeContent = createThemeContentRegistry(theme);
const metaConfig = themeContent.metaProgression || null;
const homeUiAssets = createHomeUiAssets({ homeVisuals: themeContent.homeVisuals, optimizedAssetUrl });
const homeState = createHomeState({
  debugTargetMaterial,
  debugTargetMaterialMode,
  debugTargetMaterialDifficulty,
});

let homeController;
let buildPlanner;
let runEvents;
let questsGoals;
let rewardsSummary;
let questState = () => ({ progress: { value: 0, target: 1 }, claimed: false, complete: false, claimable: false });

const metaStore = createMetaStore({
  theme,
  metaConfig,
  ui,
  homeState,
  requestedChapter,
  requestedDifficulty,
  debugMetaMode,
  onImportApplied: () => {
    homeController?.updateQuestBadges?.();
    homeController?.renderHomePanel?.();
  },
});
const {
  getMetaState,
  setMetaState,
  createDefaultMetaState,
  sanitizeMetaState,
  saveMetaState,
  exportMetaSave,
  importMetaSave,
  getSelectedChapter,
  getSelectedDifficulty,
  getStartingTalentSlots,
  currencyName,
  currencyConfig,
  currencyToken,
  isUnlocked,
  formatCost,
  formatCostTokens,
  unique,
  mapById,
} = metaStore;

const metaState = new Proxy({}, {
  get(_target, key) {
    return getMetaState()?.[key];
  },
  set(_target, key, value) {
    const current = getMetaState();
    if (current) current[key] = value;
    return true;
  },
});

function realmLabel(level) {
  if (!theme.realms) return `Lv.${level}`;
  const index = realmIndex(level);
  if (index === theme.realms.length - 1) return theme.realms[index];
  const layer = ((level - 1) % 3) + 1;
  return `${theme.realms[index]} ${layer}层`;
}

function compactRealmLabel(level) {
  if (!theme.realms) return `Lv.${level}`;
  const index = realmIndex(level);
  if (index === theme.realms.length - 1) return theme.realms[index];
  return `${theme.realms[index]}${((level - 1) % 3) + 1}`;
}

function realmIndex(level) {
  if (!theme.realms) return 0;
  return Math.min(theme.realms.length - 1, Math.floor((level - 1) / 3));
}

function hudIconHtml(name, label) {
  const file = theme.hudIcons?.[name];
  if (!file) return "";
  return `<img class="hud-icon" src="${optimizedAssetUrl(file)}" alt="" aria-hidden="true" decoding="async" />`;
}

function setHudMetric(element, iconName, text, label = text) {
  if (!element) return;
  element.innerHTML = `${hudIconHtml(iconName, label)}<span class="hud-text">${text}</span>`;
  element.setAttribute("aria-label", label);
  element.setAttribute("title", label);
}

const game = {
  state: "playing",
  time: 0,
  killCount: 0,
  nextEntityId: 1,
  camera: { x: 0, y: 0, shake: 0 },
  player: {},
  weapons: {},
  equipment: {},
  energy: {},
  ultimate: {},
  chapter: null,
  difficulty: null,
  runMods: {},
  runStats: {},
  bossRuntime: null,
  bossTelegraphs: [],
  bossHazards: [],
  bossIntro: null,
  goalToast: null,
  goalToastQueue: [],
  goalToastTimer: null,
  goalTrackingActive: false,
  activeEventChallenge: null,
  activeEventChoice: null,
  balance: null,
  events: {},
  spellPowerBonus: 0,
  breakthroughFx: null,
  enemies: [],
  projectiles: [],
  pickups: [],
  texts: [],
  particles: [],
  spawnedOnce: new Set(),
  waveTimers: new Map(),
  lastFrame: performance.now(),
};

const {
  currentUiMode,
  defaultHomeTab,
  decorateHomeTabs,
  decorateMobileHomeNav,
  decorateSemanticHomeButtons,
  isCompactHud,
  renderHomeBanner,
  scheduleIdle,
  setBootPhase,
  setQuestBadge,
  showBootOverlay,
  syncMobileBattleDrawer,
  syncMobileHomeShellState,
  toggleGrowthPanel,
  updateUiMode,
} = createUiShell({
  windowRef: window,
  documentRef: document,
  ui,
  homeState,
  homeUiAssets,
  homeImage,
  game,
  clamp,
});

const spellCombos = [
  {
    id: "fireThunder",
    name: "火莲引雷",
    recipe: ["业火莲华", "雷符万钧"],
    desc: "业火莲华命中时引动雷符，补一段雷火爆发。",
    unlockText: "解锁业火莲华与雷符万钧后生效",
    plan: {
      artifactId: "red-lotus-lamp",
      cultivationId: "fire-lotus-scripture",
      talentIds: ["talisman-fate", "fire-seed"],
    },
  },
  {
    id: "swordTalisman",
    name: "飞剑附符",
    recipe: ["御剑成阵", "雷符万钧"],
    desc: "飞剑命中时附着雷符，适合飞剑主轴顺带补雷法输出。",
    unlockText: "御剑成阵命中且雷符万钧已解锁后生效",
    plan: {
      cultivationId: "sword-scripture",
      talentIds: ["talisman-fate", "sword-heart"],
    },
  },
];

const runtime = createRunRuntime({
  game,
  ui,
  canvas,
  keys,
  pointer,
  theme,
  metaConfig,
  getMetaState,
  saveMetaState,
  getSelectedChapter,
  getSelectedDifficulty,
  clamp,
  rand,
  distance,
  normalize,
  mapById,
  currencyName,
  loadImageAsset,
  imageAssets,
  setHudMetric,
  isCompactHud,
  compactRealmLabel,
  realmLabel,
  getUiMode: currentUiMode,
  syncMobileBattleDrawer,
  homeController: () => homeController,
  activeBuildSynergies: () => buildPlanner?.activeBuildSynergies?.() || [],
  openUpgradePanel: () => buildPlanner?.openUpgradePanel?.(),
  addCurrencies: (delta) => buildPlanner?.addCurrencies?.(delta),
  unlockProgressAfterRun: () => buildPlanner?.unlockProgressAfterRun?.() || [],
  updateComboRecordsAfterRun: () => buildPlanner?.updateComboRecordsAfterRun?.(),
  ensureChapterRecord: (chapterId) => buildPlanner?.ensureChapterRecord?.(chapterId),
  updateRunEvents: (dt) => runEvents?.updateRunEvents?.(dt),
  updateEventChallenge: () => runEvents?.updateEventChallenge?.(),
  spawnRunEvent: (...args) => runEvents?.spawnRunEvent?.(...args),
  selectRunEventChoice: (...args) => runEvents?.selectRunEventChoice?.(...args),
  collectRunEvent: (...args) => runEvents?.collectRunEvent?.(...args),
  rewardPickupsForEnemy: (...args) => runEvents?.rewardPickupsForEnemy?.(...args),
  addPickupReward: (...args) => runEvents?.addPickupReward?.(...args),
  spawnRewardPickups: (...args) => runEvents?.spawnRewardPickups?.(...args),
  resolveActiveEventChallenge: (...args) => runEvents?.resolveActiveEventChallenge?.(...args),
  clearGoalToastTimer: () => questsGoals?.clearGoalToastTimer?.(),
  renderRunGoals: () => questsGoals?.renderRunGoals?.(),
  updateRunGoalNotices: () => questsGoals?.updateRunGoalNotices?.(),
  renderGoalToast: () => questsGoals?.renderGoalToast?.(),
  renderResultNextSteps: () => questsGoals?.renderResultNextSteps?.(),
  renderQuestCompletionSummary: () => questsGoals?.renderQuestCompletionSummary?.() || "",
  claimableQuestCount: () => questsGoals?.claimableQuestCount?.() || 0,
  calculateRunRewards: () => rewardsSummary?.calculateRunRewards?.() || null,
  renderRewardBreakdown: (...args) => rewardsSummary?.renderRewardBreakdown?.(...args) || "",
  renderRewardSourceBreakdown: () => rewardsSummary?.renderRewardSourceBreakdown?.() || "",
  renderDamageBreakdown: () => rewardsSummary?.renderDamageBreakdown?.() || "",
  renderRunBlessingsSummary: () => rewardsSummary?.renderRunBlessingsSummary?.() || "",
  renderPauseBuildSummary: () => rewardsSummary?.renderPauseBuildSummary?.() || "",
  renderFirstClearRewardSummary: () => rewardsSummary?.renderFirstClearRewardSummary?.() || "",
  equipmentSummaryText: () => buildPlanner?.equipmentSummaryText?.() || "",
  debugMetaMode,
  debugFinishOnStart,
  debugResolveEventId,
  debugResolveEventChoice,
  debugResolveEventChain,
  debugOpenTab,
  debugResultMode,
});
const { startRunFromHome } = runtime;

buildPlanner = createBuildPlanner({
  game,
  ui,
  theme,
  homeState,
  metaConfig,
  getMetaState,
  saveMetaState,
  getSelectedChapter,
  getSelectedDifficulty,
  getStartingTalentSlots,
  currencyName,
  currencyToken,
  formatCost,
  isUnlocked,
  mapById,
  unique,
  homeImage,
  difficultyAllowed: runtime.difficultyAllowed,
  unlockConditionText: runtime.unlockConditionText,
  shouldRevealRunEvent: (...args) => runEvents?.shouldRevealRunEvent?.(...args),
  eventFollowupTargets: (...args) => runEvents?.eventFollowupTargets?.(...args),
  eventFollowupHintText: (...args) => runEvents?.eventFollowupHintText?.(...args),
  resolveEventValue: (...args) => runEvents?.resolveEventValue?.(...args),
  resolveEventAmbush: (...args) => runEvents?.resolveEventAmbush?.(...args),
  resolveEventChallenge: (...args) => runEvents?.resolveEventChallenge?.(...args),
  resolveEventChoices: (...args) => runEvents?.resolveEventChoices?.(...args),
  resolveEventCurrencies: (...args) => runEvents?.resolveEventCurrencies?.(...args),
  followupEventSummary: (...args) => runEvents?.followupEventSummary?.(...args),
  challengeRewardSummary: (...args) => runEvents?.challengeRewardSummary?.(...args),
  ambushSummaryText: (...args) => runEvents?.ambushSummaryText?.(...args),
  effectValue: runtime.effectValue,
  ensurePath: runtime.ensurePath,
  cloneWeapons: runtime.cloneWeapons,
  spellCombos,
  bossSkillModsForDifficulty: runtime.bossSkillModsForDifficulty,
  effectiveBossSkillConfig: runtime.effectiveBossSkillConfig,
  activeRunBlessingRows: (...args) => runEvents?.activeRunBlessingRows?.(...args),
  getQuestState: () => questState,
  addText: runtime.addText,
  uiButtonAttrs: homeUiAssets.buttonAttrs,
});

const {
  firstClearSummary,
  selectedCultivationSpell,
  upgradeSpellKey,
  chooseUpgrades,
  addCurrencies,
  hasCurrency,
  spendCurrency,
  chapterDropEstimate,
  chapterDropSummary,
  materialFarmRoute,
  materialPreviewDifficulty,
  renderMaterialDifficultyPreview,
  renderCostHint,
  ensureChapterRecord,
  unlockProgressAfterRun,
  upgradeCost,
  effectSummary,
  rushMilestone,
  milestoneSummary,
  selectedArtifact,
  selectedCultivation,
  selectedTalents,
  collectBuildTags,
  styleTagToken,
  activeBuildSynergies,
  chapterBuildRecommendation,
  applyChapterBuildRecommendation,
  weaknessPatchPlan,
  applyWeaknessPatchPlan,
  chapterReadinessReport,
  buildPreviewState,
  buildPreviewRows,
  comboPreviewRows,
  comboRecordContext,
  applyComboPlan,
  renderComboPreview,
  renderBuildSynergyPanel,
  presetAvailability,
  chapterRewardHighlights,
  chapterBuildContextTags,
  renderRunEventPreview,
  renderBestiaryRewardHighlights,
  chapterClearCount,
  difficultyProgressCount,
  totalDifficultyCount,
  nextChapterGoal,
  nextQuestGoal,
  nextUpgradeGoal,
  nextEventProgressGoal,
  bossSkillSummary,
  matchingPresetNames,
  bossRecordSummary,
  bossPhaseTimeline,
  renderComboCodex,
  renderBossGuide,
  renderChapterReadiness,
  renderBestiaryPatchAction,
  renderChapterMaterialTarget,
  setSelectedChapterForBuild,
  equipmentSummaryText,
} = buildPlanner;

runEvents = createRunEvents({
  game,
  ui,
  theme,
  metaConfig,
  getMetaState,
  getSelectedDifficulty,
  clamp,
  rand,
  formatCost,
  currencyConfig,
  unique,
  effectSummary,
  debugSecretRoutes,
  spawnEnemyAt: runtime.spawnEnemyAt,
  damagePlayerFromBoss: runtime.damagePlayerFromBoss,
  gainEnergy: runtime.gainEnergy,
  applyEffects: runtime.applyEffects,
  addText: runtime.addText,
  addBurst: runtime.addBurst,
  updateUi: runtime.updateUi,
  pushGoalNotice: (...args) => questsGoals?.pushGoalNotice?.(...args),
});

const {
  eventFollowupTargets,
  hasSeenRunEvent,
  eventFollowupHintText,
  getRunEventConfig,
  challengeRewardSummary,
  ambushSummaryText,
  runEventChoiceSummary,
  runEventBlessingSummary,
  runEventFollowupSummary,
  activeRunBlessingRows,
  challengeStateText,
  updateRunEvents,
  updateEventChallenge,
  spawnRunEvent,
  selectRunEventChoice,
  collectRunEvent,
  rewardPickupsForEnemy,
  addPickupReward,
  spawnRewardPickups,
  resolveActiveEventChallenge,
} = runEvents;

questsGoals = createQuestsGoals({
  game,
  ui,
  theme,
  homeState,
  metaConfig,
  getMetaState,
  clamp,
  formatTime: runtime.formatTime,
  realmLabel,
  mapById,
  unique,
  currencyName,
  currencyToken,
  formatCost,
  formatCostTokens,
  isUnlocked,
  unlockConditionText: runtime.unlockConditionText,
  firstClearSummary,
  recommendChapterForMaterial: buildPlanner.recommendChapterForMaterial,
  nextChapterGoal,
  nextQuestGoal,
  nextUpgradeGoal,
  nextEventProgressGoal,
  chapterClearCount,
  totalDifficultyCount,
  difficultyProgressCount,
  chapterReadinessReport,
  weaknessPatchPlan,
  comboPreviewRows,
  comboRecordContext,
  buildPreviewState,
  resolveEventChoices: (...args) => runEvents.resolveEventChoices(...args),
  eventFollowupTargets,
  hasSeenRunEvent,
  eventFollowupHintText,
  getRunEventConfig,
  getSelectedDifficulty,
  getSelectedChapter,
  challengeRewardSummary,
  chapterDropEstimate,
  addText: runtime.addText,
  uiButtonAttrs: homeUiAssets.buttonAttrs,
});

const {
  questProgress,
  questProgressText,
  questProgressPercent,
  claimableQuestCount,
  renderQuestCompletionSummary,
  journeyRecommendationRows,
  renderComboJourneyPanel,
  renderEventJourneyPanel,
  renderRunGoals,
  clearGoalToastTimer,
  updateRunGoalNotices,
  renderGoalToast,
  renderResultNextSteps,
  pushGoalNotice,
} = questsGoals;
questState = questsGoals.questState;

rewardsSummary = createRewardsSummary({
  game,
  theme,
  metaConfig,
  getMetaState,
  homeImage,
  thumbnailAsset,
  currencyName,
  currencyConfig,
  currencyToken,
  formatCost,
  formatCostTokens,
  chapterDropEstimate,
  getSelectedDifficulty,
  damageSourceName: runtime.damageSourceName,
  selectedArtifact,
  selectedCultivation,
  selectedTalents,
  activeBuildSynergies,
  activeRunBlessingRows,
  runEventChoiceSummary,
  runEventBlessingSummary,
  runEventFollowupSummary,
  challengeStateText,
  enemyAffixes: runtime.enemyAffixes,
  spellCombos,
  selectedCultivationSpell,
  scaledDamage: runtime.scaledDamage,
  realmLabel,
  formatTime: runtime.formatTime,
  ambushSummaryText,
});

const {
  chapterRewardChipRows,
  renderFirstClearRewardSummary,
  calculateRunRewards,
  renderRewardBreakdown,
  renderRewardSourceBreakdown,
  renderDamageBreakdown,
  renderRunBlessingsSummary,
  renderPauseBuildSummary,
} = rewardsSummary;

function getHomeRenderContext() {
  const uiActionIcon = (name, label, className = "action-icon") => {
    const file = metaConfig?.uiIcons?.[name];
    return file ? homeImage(file, label, className) : "";
  };
  return {
    metaConfig,
    metaState,
    game,
    theme,
    homeState,
    clamp,
    homeImage,
    optimizedAssetUrl,
    uiPanelAttrs: homeUiAssets.panelAttrs,
    uiButtonAttrs: homeUiAssets.buttonAttrs,
    uiActionIcon,
    thumbnailAsset,
    renderHomeBanner,
    getSelectedDifficulty,
    getSelectedChapter,
    getStartingTalentSlots,
    formatTime: runtime.formatTime,
    formatCost,
    formatCostTokens,
    isUnlocked,
    currencyName,
    chapterDropEstimate,
    chapterRewardChipRows,
    chapterRewardHighlights,
    renderRunEventPreview,
    renderChapterMaterialTarget,
    renderBossGuide,
    renderChapterReadiness,
    unlockConditionText: runtime.unlockConditionText,
    firstClearSummary,
    difficultyAllowed: runtime.difficultyAllowed,
    renderMaterialDifficultyPreview,
    materialPreviewDifficulty,
    materialFarmRoute,
    chapterDropSummary,
    selectedArtifact,
    selectedCultivation,
    selectedTalents,
    collectBuildTags,
    styleTagToken,
    upgradeCost,
    unique,
    currencyToken,
    currencyName,
    buildPreviewRows,
    chapterBuildRecommendation,
    chapterReadinessReport,
    weaknessPatchPlan,
    mapById,
    presetAvailability,
    renderComboPreview,
    renderBuildSynergyPanel,
    effectSummary,
    milestoneSummary,
    hasCurrency,
    renderCostHint,
    chapterClearCount,
    totalDifficultyCount,
    difficultyProgressCount,
    claimableQuestCount,
    nextChapterGoal,
    nextQuestGoal,
    nextUpgradeGoal,
    questProgressText,
    journeyRecommendationRows,
    renderEventJourneyPanel,
    renderComboJourneyPanel,
    realmLabel,
    renderQuestCompletionSummary,
    questState,
    questProgressPercent,
    renderComboCodex,
    bossRecordSummary,
    matchingPresetNames,
    chapterBuildContextTags,
    bossPhaseTimeline,
    bossSkillSummary,
    renderBestiaryRewardHighlights,
    renderBestiaryPatchAction,
  };
}

const homeRenderers = createHomeRenderers(getHomeRenderContext);
homeController = createHomeController({
  ui,
  game,
  metaConfig,
  homeState,
  getUiMode: currentUiMode,
  getMetaState,
  setMetaState,
  sanitizeMetaState,
  optimizedAssetUrl,
  assetBase: theme.assetBase || "",
  preloadHomeAssetsForTab,
  preloadHomeUiAssetsForTab: (tab) => preloadNamedAssets(homeUiAssets.preloadRowsForTab(tab)),
  preloadMobileNavAssets: () => preloadNamedAssets(homeUiAssets.preloadMobileNavRows()),
  claimableQuestCount,
  setQuestBadge,
  renderers: homeRenderers,
  clearGoalToastTimer,
  updateUi: runtime.updateUi,
});

const handleHomeAction = createHomeActionHandler({
  homeState,
  getUiMode: currentUiMode,
  getMetaState,
  getMetaConfig: () => metaConfig,
  setSelectedChapterForBuild,
  difficultyAllowed: runtime.difficultyAllowed,
  getSelectedChapter,
  getSelectedDifficulty,
  applyWeaknessPatchPlan,
  mapById,
  presetAvailability,
  isUnlocked,
  getStartingTalentSlots,
  applyChapterBuildRecommendation,
  applyComboPlan,
  rushMilestone,
  upgradeCost,
  spendCurrency,
  questState,
  addCurrencies,
  unique,
  saveMetaState,
  homeController,
  startRunFromHome,
});

window.demoGame = {
  snapshot() {
    return {
      uiMode: currentUiMode(),
      state: game.state,
      time: game.time,
      killCount: game.killCount,
      level: game.player.level,
      hp: game.player.hp,
      xp: game.player.xp,
      nextXp: game.player.nextXp,
      energy: game.energy.value,
      energyMax: game.energy.max,
      realmIndex: realmIndex(game.player.level),
      realmLabel: realmLabel(game.player.level),
      equipmentSummary: equipmentSummaryText(),
      balance: runtime.getBalanceSnapshot(),
      chapter: game.chapter ? { id: game.chapter.id, name: game.chapter.name } : null,
      difficulty: game.difficulty ? { id: game.difficulty.id, name: game.difficulty.name } : null,
      runStats: structuredClone(game.runStats || {}),
      combos: structuredClone(game.runStats?.combos || {}),
      dash: {
        cooldown: Number((game.player.dashCooldown || 0).toFixed(2)),
        duration: Number((game.player.dashDuration || 0).toFixed(2)),
        count: game.runStats?.dashes || 0,
        invincible: Number((game.player.invincible || 0).toFixed(2)),
      },
      affixes: {
        stats: structuredClone(game.runStats?.affixes || {}),
        active: game.enemies
          .filter((enemy) => enemy.affix)
          .map((enemy) => ({ id: enemy.affix.id, name: enemy.affix.name, type: enemy.type, hp: enemy.hp, speed: Math.round(enemy.speed) })),
      },
      events: {
        active: game.pickups.filter((pickup) => pickup.type === "event").map((pickup) => ({
          type: pickup.eventType,
          label: pickup.label,
          x: Math.round(pickup.x),
          y: Math.round(pickup.y),
          age: Number((pickup.age || 0).toFixed(2)),
        })),
        stats: structuredClone(game.runStats?.events || {}),
        nextAt: game.events?.nextAt || 0,
      },
      eventChallenge: game.activeEventChallenge
        ? {
            label: game.activeEventChallenge.label,
            eventId: game.activeEventChallenge.eventId,
            targetCount: game.activeEventChallenge.targetCount,
            defeated: game.activeEventChallenge.defeated,
            remaining: Number(Math.max(0, game.activeEventChallenge.endsAt - game.time).toFixed(2)),
            result: game.activeEventChallenge.result,
          }
        : null,
      eventChoice: game.activeEventChoice
        ? {
            eventId: game.activeEventChoice.config.id,
            label: game.activeEventChoice.config.label,
            options: game.activeEventChoice.options.map((option) => ({
              id: option.id,
              label: option.label,
              summary: option.summary || "",
            })),
          }
        : null,
      boss: game.bossRuntime
        ? {
            id: game.bossRuntime.id,
            phase: game.bossRuntime.phase,
            intro: game.bossIntro ? { title: game.bossIntro.title, age: game.bossIntro.age } : null,
            activeTelegraphs: game.bossTelegraphs.length,
            activeHazards: game.bossHazards.length,
          }
        : null,
      meta: metaState
        ? {
            currencies: structuredClone(metaState.currencies),
            selected: structuredClone(metaState.selected),
            unlocks: structuredClone(metaState.unlocks),
            talentSlots: getStartingTalentSlots(),
          }
        : null,
      enemies: game.enemies.length,
      projectiles: game.projectiles.length,
      pickups: game.pickups.length,
      pickupSummary: game.pickups
        .filter((pickup) => pickup.type === "material")
        .map((pickup) => ({
          type: pickup.type,
          currencyKey: pickup.currencyKey,
          label: pickup.label,
          value: pickup.value,
          x: Math.round(pickup.x),
          y: Math.round(pickup.y),
        })),
      runGoals: ui.runGoals
        ? {
            hidden: ui.runGoals.classList.contains("hidden"),
            text: ui.runGoals.textContent.replace(/\s+/g, " ").trim(),
            rows: [...ui.runGoals.querySelectorAll("span")].map((row) => row.textContent.replace(/\s+/g, " ").trim()),
          }
        : null,
      goalToast: game.goalToast
        ? { title: game.goalToast.title, detail: game.goalToast.detail, startedAt: game.goalToast.startedAt, life: game.goalToast.life }
        : null,
      goalToastQueue: game.goalToastQueue?.length || 0,
      texts: game.texts.slice(-5).map((item) => item.text),
      weapons: structuredClone(game.weapons),
      equipment: structuredClone(game.equipment),
    };
  },
  setVisualDebugState(options = {}) {
    if (typeof options.level === "number") game.player.level = Math.max(1, options.level);
    for (const [slot, tier] of Object.entries(options.equipment || {})) {
      if (!game.equipment[slot]) continue;
      const maxTier = theme.equipmentSlots?.[slot]?.maxTier || 3;
      game.equipment[slot] = { tier: clamp(Number(tier) || 0, 0, maxTier) };
    }
    if (typeof options.energy === "number") game.energy.value = clamp(options.energy, 0, game.energy.max || 100);
    game.breakthroughFx = { age: 0, life: 1.2, type: "debug", label: realmLabel(game.player.level) };
    runtime.updateUi();
  },
  debugSpawnBoss() {
    if (game.state === "home") runtime.startRunFromHome();
    game.enemies = game.enemies.filter((enemy) => enemy.type !== "boss");
    runtime.spawnEnemy("boss");
    runtime.updateBossRuntime(0.1);
    return this.snapshot();
  },
  debugSpawnMaterialDrops(rewards = { mysticIron: 1, spiritEssence: 2 }) {
    if (game.state === "home") runtime.startRunFromHome();
    spawnRewardPickups(game.player.x + 16, game.player.y - 12, rewards);
    return this.snapshot();
  },
  debugSpawnRunEvent(eventId = "") {
    if (game.state === "home") runtime.startRunFromHome();
    spawnRunEvent(eventId);
    return this.snapshot();
  },
  debugCollectNearbyPickups() {
    if (game.state !== "playing") return this.snapshot();
    for (const pickup of game.pickups) {
      pickup.x = game.player.x;
      pickup.y = game.player.y;
    }
    runtime.updatePickups(1 / 30);
    return this.snapshot();
  },
  debugChooseEventChoice(index = 0) {
    if (!game.activeEventChoice) return this.snapshot();
    const choice = game.activeEventChoice.options[index] || game.activeEventChoice.options[0];
    if (choice) selectRunEventChoice(choice.id);
    return this.snapshot();
  },
  resetMetaState() {
    if (!metaConfig) return null;
    setMetaState(createDefaultMetaState());
    saveMetaState();
    homeController.renderHomePanel();
    return getMetaState();
  },
  finishRun() {
    runtime.finishRun();
    return this.snapshot();
  },
  setMetaDebugState(options = {}) {
    if (!metaConfig) return null;
    setMetaState(sanitizeMetaState({
      ...metaState,
      currencies: { ...metaState.currencies, ...(options.currencies || {}) },
      selected: { ...metaState.selected, ...(options.selected || {}) },
      unlocks: { ...metaState.unlocks, ...(options.unlocks || {}) },
      progression: {
        ...metaState.progression,
        talentTree: { ...metaState.progression.talentTree, ...(options.talentTree || {}) },
        facilities: { ...metaState.progression.facilities, ...(options.facilities || {}) },
        artifacts: { ...metaState.progression.artifacts, ...(options.artifacts || {}) },
        cultivations: { ...metaState.progression.cultivations, ...(options.cultivations || {}) },
      },
    }));
    saveMetaState();
    homeController.renderHomePanel();
    return this.snapshot().meta;
  },
  sampleUpgradeBias(iterations = 120) {
    const total = Math.max(1, Math.min(500, Math.floor(iterations)));
    const counts = {};
    for (let index = 0; index < total; index += 1) {
      for (const upgrade of chooseUpgrades()) {
        if (upgrade.kind !== "spell") continue;
        const key = upgradeSpellKey(upgrade);
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return {
      cultivation: selectedCultivation()?.name || "",
      bias: selectedCultivationSpell(),
      counts,
      total,
    };
  },
};

const { render } = createRenderer({
  canvas,
  ctx,
  game,
  theme,
  pointer,
  clamp,
  rand,
  positiveModulo,
  realmIndex,
  currencyConfig,
  effectiveBossSkill: runtime.effectiveBossSkill,
  getBossEnemy: runtime.getBossEnemy,
  getAsset,
  loadImageAsset,
  drawImageCentered,
  drawSpriteFitted,
  canUseGeometryFallback,
});

function resize() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function scheduleDeferredLoads() {
  if (!theme.assetBase) return;
  scheduleIdle(() => preloadBattleDeferredAssets());
  scheduleIdle(() => preloadHomeAssetsForTab(homeState.activeTab));
}

async function initializeApp() {
  decorateHomeTabs();
  decorateSemanticHomeButtons();
  decorateMobileHomeNav();
  updateUiMode();
  resize();

  const shouldBoot = Boolean(theme.assetBase);
  if (shouldBoot) {
    showBootOverlay(true);
    setBootPhase("凝聚灵息...", 18);
    const keys = [
      ...preloadCriticalAssets(),
      ...(metaConfig && !debugBossOnLoad && !debugResolveEventId && !debugFinishOnStart
        ? preloadHomeAssetsForTab(homeState.activeTab)
        : []),
    ];
    await waitForAssetKeys(keys, 1800);
    setBootPhase("安置法器...", 72);
  } else {
    preloadThemeAssets();
  }

  runtime.resetGame();
  if (debugBossOnLoad) {
    runtime.spawnEnemy("boss");
    runtime.updateBossRuntime(0.1);
  } else if (debugResolveEventId && metaConfig) {
    runtime.runDebugResolvedEventScenario();
  } else if (debugFinishOnStart && metaConfig) startRunFromHome();
  else if (metaConfig) {
    homeController.open(defaultHomeTab());
  } else {
    ui.homeBtn?.classList.add("hidden");
    ui.mobileHomeBtn?.classList.add("hidden");
    ui.runGoals?.classList.add("hidden");
  }

  if (shouldBoot) {
    setBootPhase(game.state === "home" ? "洞府布阵..." : "结阵入世...", 100);
    window.setTimeout(() => showBootOverlay(false), 120);
    scheduleDeferredLoads();
  }
}

function loop(now) {
  const dt = Math.min(0.033, (now - game.lastFrame) / 1000);
  game.lastFrame = now;
  runtime.update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  resize();
  updateUiMode();
  decorateSemanticHomeButtons();
  decorateMobileHomeNav();
  syncMobileBattleDrawer();
  homeController?.syncSaveToolsState?.();
  if (!ui.homePanel?.classList.contains("hidden")) homeController?.renderHomePanel?.();
  if (game.player?.maxHp) runtime.updateUi();
});
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p" || event.key === "Escape") {
    if (game.state === "playing") runtime.pauseGame();
    else if (game.state === "paused") runtime.resumeGame();
    return;
  }
  if (event.code === "Space" || event.key === "Shift") {
    event.preventDefault();
    runtime.startDash();
    return;
  }
  keys.add(event.key.toLowerCase());
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  if (event.clientX > rect.width * 0.48 || event.clientY < rect.height * 0.58) return;
  pointer.active = true;
  pointer.id = event.pointerId;
  pointer.origin = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  pointer.current = { ...pointer.origin };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active || event.pointerId !== pointer.id) return;
  const rect = canvas.getBoundingClientRect();
  const raw = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const dir = normalize(raw.x - pointer.origin.x, raw.y - pointer.origin.y);
  const dist = Math.min(58, Math.hypot(raw.x - pointer.origin.x, raw.y - pointer.origin.y));
  pointer.current = {
    x: pointer.origin.x + dir.x * dist,
    y: pointer.origin.y + dir.y * dist,
  };
});

canvas.addEventListener("pointerup", (event) => {
  if (event.pointerId === pointer.id) pointer.active = false;
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

ui.restartBtn.addEventListener("click", () => {
  toggleGrowthPanel(false);
  if (metaConfig) homeController.open(defaultHomeTab());
  else runtime.resetGame();
});
ui.resultQuestBtn?.addEventListener("click", () => {
  toggleGrowthPanel(false);
  homeController.open("quests");
});
ui.resultNextSteps?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='result-open-tab']");
  if (!button || button.disabled) return;
  if (button.dataset.postAction === "applyWeaknessPatch") applyWeaknessPatchPlan();
  homeState.focusedMaterials = button.dataset.focusMaterials
    ? button.dataset.focusMaterials.split(",").filter(Boolean)
    : [];
  homeState.materialPreviewDifficultyId = button.dataset.previewDifficulty || "";
  toggleGrowthPanel(false);
  homeController.open(button.dataset.tab || "journey");
});
ui.pauseBtn.addEventListener("click", runtime.pauseGame);
ui.mobilePauseBtn?.addEventListener("click", runtime.pauseGame);
ui.dashBtn?.addEventListener("click", runtime.startDash);
ui.mobileDashBtn?.addEventListener("click", runtime.startDash);
ui.growthBtn?.addEventListener("click", () => {
  toggleGrowthPanel();
});
ui.mobileGrowthBtn?.addEventListener("click", () => toggleGrowthPanel());
ui.resumeBtn.addEventListener("click", runtime.resumeGame);
ui.quickRestartBtn.addEventListener("click", runtime.resetGame);
ui.homeBtn?.addEventListener("click", () => {
  toggleGrowthPanel(false);
  homeController.open(defaultHomeTab());
});
ui.mobileHomeBtn?.addEventListener("click", () => {
  toggleGrowthPanel(false);
  homeController.open(defaultHomeTab());
});
ui.startRunBtn?.addEventListener("click", startRunFromHome);
ui.closeHomeBtn?.addEventListener("click", () => {
  toggleGrowthPanel(false);
  homeController.close();
});
ui.exportSaveBtn?.addEventListener("click", exportMetaSave);
ui.importSaveBtn?.addEventListener("click", importMetaSave);
ui.saveToolsToggleBtn?.addEventListener("click", () => {
  homeState.saveToolsOpen = !homeState.saveToolsOpen;
  decorateSemanticHomeButtons();
  homeController?.syncSaveToolsState?.();
});
ui.mobileHomeNav?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-section]");
  if (!button) return;
  if (button.dataset.section === "more") {
    homeState.mobileHomeSection = "more";
    homeState.mobileHomeMoreTab = "more";
  } else {
    homeState.mobileHomeSection = button.dataset.section;
  }
  syncMobileHomeShellState();
  homeController.renderHomePanel();
});
ui.homeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  homeState.focusedMaterials = [];
  homeState.targetMaterial = "";
  homeState.targetMaterialMode = "";
  homeState.targetMaterialDifficulty = "";
  homeState.activeTab = button.dataset.tab;
  syncMobileHomeShellState();
  homeController.renderHomePanel();
});
ui.homeContent?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  handleHomeAction(button);
  syncMobileHomeShellState();
});
ui.mobileHomeLanding?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  handleHomeAction(button);
  syncMobileHomeShellState();
});
ui.chapterQuickModal?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  handleHomeAction(target);
  syncMobileHomeShellState();
});
ui.mobileDrawerCloseBtn?.addEventListener("click", () => toggleGrowthPanel(false));
ui.eventChoiceOptions?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-choice-id]");
  if (!button || button.disabled) return;
  selectRunEventChoice(button.dataset.choiceId || "");
});

initializeApp().finally(() => requestAnimationFrame(loop));
