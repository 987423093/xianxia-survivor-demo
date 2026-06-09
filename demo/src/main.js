import { themes } from "./theme.js";

const params = new URLSearchParams(window.location.search);
const requestedTheme = params.get("theme") || "xianxia";
const debugBossOnLoad = params.get("debugBoss") === "1";
const requestedChapter = params.get("chapter") || "";
const requestedDifficulty = params.get("difficulty") || "";
const theme = themes[requestedTheme] || themes.xianxia;

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const ui = {
  timer: document.querySelector("#timer"),
  level: document.querySelector("#level"),
  kills: document.querySelector("#kills"),
  weapon: document.querySelector("#weapon"),
  homeBtn: document.querySelector("#homeBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  hpLabel: document.querySelector("#hpLabel"),
  energyLabel: document.querySelector("#energyLabel"),
  xpLabel: document.querySelector("#xpLabel"),
  hpBar: document.querySelector("#hpBar"),
  energyBar: document.querySelector("#energyBar"),
  xpBar: document.querySelector("#xpBar"),
  equipmentSummary: document.querySelector("#equipmentSummary"),
  bossHud: document.querySelector("#bossHud"),
  bossName: document.querySelector("#bossName"),
  bossBar: document.querySelector("#bossBar"),
  pausePanel: document.querySelector("#pausePanel"),
  resumeBtn: document.querySelector("#resumeBtn"),
  quickRestartBtn: document.querySelector("#quickRestartBtn"),
  upgradePanel: document.querySelector("#upgradePanel"),
  upgradeChoices: document.querySelector("#upgradeChoices"),
  resultPanel: document.querySelector("#resultPanel"),
  resultText: document.querySelector("#resultText"),
  rewardText: document.querySelector("#rewardText"),
  restartBtn: document.querySelector("#restartBtn"),
  homePanel: document.querySelector("#homePanel"),
  metaCurrencies: document.querySelector("#metaCurrencies"),
  homeTabs: document.querySelector("#homeTabs"),
  homeContent: document.querySelector("#homeContent"),
  startRunBtn: document.querySelector("#startRunBtn"),
  closeHomeBtn: document.querySelector("#closeHomeBtn"),
};

const keys = new Set();
const pointer = {
  active: false,
  id: null,
  origin: { x: 0, y: 0 },
  current: { x: 0, y: 0 },
};

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const positiveModulo = (value, size) => ((value % size) + size) % size;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const normalize = (x, y) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

const imageAssets = new Map();
const assetMeta = new Map();
const PLAYER_SPRITE_SCALE = 3.85;
const ENEMY_SPRITE_SCALE = 3.2;
const supportsWebp = (() => {
  const probe = document.createElement("canvas");
  return probe.toDataURL("image/webp").startsWith("data:image/webp");
})();
const metaConfig = theme.meta || null;
const isXianxiaMeta = Boolean(metaConfig);
let activeHomeTab = "chapters";
let metaState = isXianxiaMeta ? loadMetaState() : null;
let previousStateBeforeHome = "playing";

function computeImageBounds(image) {
  const probe = document.createElement("canvas");
  probe.width = image.naturalWidth || image.width;
  probe.height = image.naturalHeight || image.height;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  probeCtx.drawImage(image, 0, 0);
  const { data, width, height } = probeCtx.getImageData(0, 0, probe.width, probe.height);
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 12) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (left > right || top > bottom) return { sx: 0, sy: 0, sw: width, sh: height };
  const pad = Math.ceil(Math.max(width, height) * 0.018);
  return {
    sx: clamp(left - pad, 0, width),
    sy: clamp(top - pad, 0, height),
    sw: clamp(right - left + 1 + pad * 2, 1, width),
    sh: clamp(bottom - top + 1 + pad * 2, 1, height),
  };
}

function optimizedAssetFile(file) {
  return supportsWebp && file?.endsWith(".png") ? file.replace(/\.png$/i, ".webp") : file;
}

function assetFileCandidates(file) {
  const optimized = optimizedAssetFile(file);
  return optimized && optimized !== file ? [optimized, file] : [file].filter(Boolean);
}

function loadImageAsset(key, file, candidateIndex = 0) {
  if (!file) return;
  const candidates = assetFileCandidates(file);
  const assetFile = candidates[candidateIndex];
  if (!assetFile) return;
  const current = imageAssets.get(key);
  if (current?.sourceFile === file && current?.assetFile === assetFile) return;
  assetMeta.delete(key);
  const image = new Image();
  image.decoding = "async";
  image.sourceFile = file;
  image.assetFile = assetFile;
  image.src = `${theme.assetBase || ""}${assetFile}`;
  image.addEventListener("load", () => {
    image.loaded = true;
  });
  image.addEventListener("error", () => {
    image.failed = true;
    if (candidates[candidateIndex + 1]) loadImageAsset(key, file, candidateIndex + 1);
  });
  imageAssets.set(key, image);
}

function getAsset(key) {
  const image = imageAssets.get(key);
  return image?.loaded ? image : null;
}

function getAssetMeta(key, image) {
  if (!theme.assetBase) return { sx: 0, sy: 0, sw: image.width, sh: image.height };
  if (!assetMeta.has(key)) assetMeta.set(key, computeImageBounds(image));
  return assetMeta.get(key);
}

function canUseGeometryFallback(assetName) {
  return !theme.assetBase || !assetName;
}

function preloadThemeAssets() {
  if (!theme.assetBase) return;
  loadImageAsset("player", theme.player.asset);
  loadImageAsset("background", theme.background?.asset);
  loadImageAsset("background:fallback", theme.background?.fallbackAsset);
  loadImageAsset("hero:0", theme.heroRealms?.[0]?.asset);
  for (const [type, enemy] of Object.entries(theme.enemies)) {
    if (type !== "boss") loadImageAsset(`enemy:${type}`, enemy.asset);
  }
  for (const [type, weapon] of Object.entries(theme.weapons)) loadImageAsset(`weapon:${type}`, weapon.asset);
  loadImageAsset("pickup:xp", theme.pickups?.xp?.asset);
  loadImageAsset("pickup:health", theme.pickups?.health?.asset);
}

function drawImageCentered(image, x, y, width, height, rotation = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawSpriteFitted(key, x, y, size, options = {}) {
  const image = getAsset(key);
  if (!image) return false;
  const meta = getAssetMeta(key, image);
  const ratio = meta.sw / meta.sh;
  const width = ratio >= 1 ? size : size * ratio;
  const height = ratio >= 1 ? size / ratio : size;
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(options.rotation || 0);
  if (options.clip) {
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      width * (options.clipScaleX ?? 0.5),
      height * (options.clipScaleY ?? 0.5),
      0,
      0,
      Math.PI * 2,
    );
    ctx.clip();
  }
  if (options.shadowColor) {
    ctx.shadowColor = options.shadowColor;
    ctx.shadowBlur = options.shadowBlur ?? 14;
  }
  ctx.drawImage(image, meta.sx, meta.sy, meta.sw, meta.sh, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
}

function realmLabel(level) {
  if (!theme.realms) return `Lv.${level}`;
  const index = realmIndex(level);
  if (index === theme.realms.length - 1) return theme.realms[index];
  const layer = ((level - 1) % 3) + 1;
  return `${theme.realms[index]} ${layer}层`;
}

function realmIndex(level) {
  if (!theme.realms) return 0;
  return Math.min(theme.realms.length - 1, Math.floor((level - 1) / 3));
}

function mapById(items = []) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function assetUrl(file) {
  return file ? `${theme.assetBase || ""}${file}` : "";
}

function optimizedAssetUrl(file) {
  return file ? assetUrl(optimizedAssetFile(file)) : "";
}

function thumbnailAsset(file) {
  return file?.endsWith(".png") ? `thumbs/${file.replace(/\.png$/i, ".webp")}` : file;
}

function homeImage(file, alt, className = "home-icon", fallbackFile = file) {
  if (!file) return "";
  const optimized = optimizedAssetUrl(file);
  const fallback = assetUrl(fallbackFile);
  return `<picture><source srcset="${optimized}" type="image/webp"><img class="${className}" src="${fallback}" alt="${alt}" loading="lazy" decoding="async" onerror="this.remove()"></picture>`;
}

function renderHomeBanner(tab) {
  const asset = metaConfig?.homeAssets?.tabs?.[tab];
  if (!asset) return "";
  return `<div class="home-banner">${homeImage(asset, "", "home-banner-img")}</div>`;
}

function createDefaultMetaState() {
  const firstChapter = metaConfig?.chapters?.[0]?.id || "cloud-bamboo-valley";
  const firstDifficulty = metaConfig?.difficulties?.[0]?.id || "mortal";
  const defaultArtifacts = (metaConfig?.artifacts || []).filter((item) => item.unlock?.type === "default").map((item) => item.id);
  const defaultTalents = (metaConfig?.startingTalents || []).filter((item) => item.unlock?.type === "default").map((item) => item.id);
  const defaultCultivations = (metaConfig?.cultivations || []).filter((item) => item.unlock?.type === "default").map((item) => item.id);
  const selectedArtifact = defaultArtifacts[0] || metaConfig?.artifacts?.[0]?.id || "";
  const selectedCultivation = defaultCultivations[0] || metaConfig?.cultivations?.[0]?.id || "";
  return {
    version: 1,
    currencies: {
      spiritStone: 0,
      dao: 0,
      mysticIron: 0,
      spiritEssence: 0,
      thunderShard: 0,
    },
    selected: {
      chapterId: firstChapter,
      difficultyId: firstDifficulty,
      artifactId: selectedArtifact,
      cultivationId: selectedCultivation,
      startingTalentIds: defaultTalents.slice(0, 1),
    },
    unlocks: {
      chapters: [firstChapter],
      difficulties: { [firstChapter]: [firstDifficulty] },
      artifacts: defaultArtifacts,
      startingTalents: defaultTalents,
      cultivations: defaultCultivations,
    },
    progression: {
      talentTree: Object.fromEntries((metaConfig?.talentTrees || []).map((tree) => [tree.id, 0])),
      facilities: Object.fromEntries((metaConfig?.facilities || []).map((facility) => [facility.id, 0])),
      artifacts: Object.fromEntries(defaultArtifacts.map((id) => [id, 1])),
      cultivations: Object.fromEntries(defaultCultivations.map((id) => [id, 1])),
    },
    records: {
      runs: 0,
      totalKills: 0,
      bestSurvivalSeconds: 0,
      highestRealmLevel: 1,
      chapters: {
        [firstChapter]: {
          bestDifficulty: firstDifficulty,
          clearedDifficulties: [],
          bestTime: 0,
          bestKills: 0,
        },
      },
    },
  };
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function sanitizeMetaState(raw) {
  if (!metaConfig) return null;
  const defaults = createDefaultMetaState();
  const state = raw && typeof raw === "object" ? raw : {};
  const selected = { ...defaults.selected, ...(state.selected || {}) };
  const unlocks = {
    chapters: unique([...(defaults.unlocks.chapters || []), ...((state.unlocks || {}).chapters || [])]),
    difficulties: { ...defaults.unlocks.difficulties, ...((state.unlocks || {}).difficulties || {}) },
    artifacts: unique([...(defaults.unlocks.artifacts || []), ...((state.unlocks || {}).artifacts || [])]),
    startingTalents: unique([...(defaults.unlocks.startingTalents || []), ...((state.unlocks || {}).startingTalents || [])]),
    cultivations: unique([...(defaults.unlocks.cultivations || []), ...((state.unlocks || {}).cultivations || [])]),
  };
  if (!unlocks.chapters.includes(selected.chapterId)) selected.chapterId = unlocks.chapters[0] || defaults.selected.chapterId;
  if (!unlocks.artifacts.includes(selected.artifactId)) selected.artifactId = unlocks.artifacts[0] || defaults.selected.artifactId;
  if (!unlocks.cultivations.includes(selected.cultivationId)) selected.cultivationId = unlocks.cultivations[0] || defaults.selected.cultivationId;
  selected.startingTalentIds = unique(selected.startingTalentIds).filter((id) => unlocks.startingTalents.includes(id));
  const maxSlots = getStartingTalentSlots(state);
  selected.startingTalentIds = selected.startingTalentIds.slice(0, maxSlots);
  const progression = {
    talentTree: { ...defaults.progression.talentTree, ...((state.progression || {}).talentTree || {}) },
    facilities: { ...defaults.progression.facilities, ...((state.progression || {}).facilities || {}) },
    artifacts: { ...defaults.progression.artifacts, ...((state.progression || {}).artifacts || {}) },
    cultivations: { ...defaults.progression.cultivations, ...((state.progression || {}).cultivations || {}) },
  };
  for (const artifactId of unlocks.artifacts) progression.artifacts[artifactId] = Math.max(1, progression.artifacts[artifactId] || 1);
  for (const cultivationId of unlocks.cultivations) progression.cultivations[cultivationId] = Math.max(1, progression.cultivations[cultivationId] || 1);
  return {
    ...defaults,
    version: 1,
    currencies: { ...defaults.currencies, ...(state.currencies || {}) },
    selected,
    unlocks,
    progression,
    records: {
      ...defaults.records,
      ...(state.records || {}),
      chapters: { ...defaults.records.chapters, ...((state.records || {}).chapters || {}) },
    },
  };
}

function loadMetaState() {
  if (!metaConfig) return null;
  try {
    return sanitizeMetaState(JSON.parse(localStorage.getItem(metaConfig.saveKey) || "null"));
  } catch {
    return createDefaultMetaState();
  }
}

function saveMetaState() {
  if (!metaConfig || !metaState) return;
  localStorage.setItem(metaConfig.saveKey, JSON.stringify(metaState));
}

function getSelectedChapter() {
  if (!metaConfig) return null;
  const chapters = mapById(metaConfig.chapters);
  if (requestedChapter && chapters[requestedChapter]) return chapters[requestedChapter];
  return chapters[metaState?.selected?.chapterId] || metaConfig.chapters[0];
}

function getSelectedDifficulty() {
  if (!metaConfig) return null;
  const difficulties = mapById(metaConfig.difficulties);
  if (requestedDifficulty && difficulties[requestedDifficulty]) return difficulties[requestedDifficulty];
  return difficulties[metaState?.selected?.difficultyId] || metaConfig.difficulties[0];
}

function getStartingTalentSlots(state = metaState) {
  const cushion = state?.progression?.facilities?.cushion || 0;
  return 1 + (cushion >= 3 ? 1 : 0) + (cushion >= 7 ? 1 : 0);
}

function currencyName(key) {
  return metaConfig?.currencies?.[key]?.name || key;
}

function isUnlocked(kind, id) {
  if (!metaState) return true;
  if (kind === "chapters") return metaState.unlocks.chapters.includes(id);
  if (kind === "artifacts") return metaState.unlocks.artifacts.includes(id);
  if (kind === "startingTalents") return metaState.unlocks.startingTalents.includes(id);
  if (kind === "cultivations") return metaState.unlocks.cultivations.includes(id);
  return true;
}

function formatCost(cost) {
  return Object.entries(cost || {})
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${currencyName(key)} ${value}`)
    .join(" / ");
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

window.demoGame = {
  snapshot() {
    return {
      state: game.state,
      time: game.time,
      killCount: game.killCount,
      level: game.player.level,
      hp: game.player.hp,
      xp: game.player.xp,
      energy: game.energy.value,
      energyMax: game.energy.max,
      realmIndex: realmIndex(game.player.level),
      realmLabel: realmLabel(game.player.level),
      equipmentSummary: equipmentSummaryText(),
      chapter: game.chapter ? { id: game.chapter.id, name: game.chapter.name } : null,
      difficulty: game.difficulty ? { id: game.difficulty.id, name: game.difficulty.name } : null,
      runStats: structuredClone(game.runStats || {}),
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
    updateUi();
  },
  debugSpawnBoss() {
    if (game.state === "home") startRunFromHome();
    game.enemies = game.enemies.filter((enemy) => enemy.type !== "boss");
    spawnEnemy("boss");
    updateBossRuntime(0.1);
    return this.snapshot();
  },
  resetMetaState() {
    if (!metaConfig) return null;
    metaState = createDefaultMetaState();
    saveMetaState();
    renderHomePanel();
    return metaState;
  },
};

function cloneWeapons() {
  return Object.fromEntries(Object.entries(theme.weapons).map(([key, weapon]) => [key, { ...weapon, timer: 0 }]));
}

function createEquipmentState() {
  return Object.fromEntries(Object.keys(theme.equipmentSlots || {}).map((slot) => [slot, { tier: 0 }]));
}

function ensurePath(root, parts) {
  let current = root;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part];
  }
  return { holder: current, key: parts[parts.length - 1] };
}

function resolveEffectTarget(target) {
  const mapped = target
    .replace(/^weapon\./, "weapons.")
    .replace(/^player\./, "player.")
    .replace(/^energy\./, "energy.")
    .replace(/^ultimate\./, "ultimate.")
    .replace(/^run\./, "runMods.")
    .replace(/^reward\./, "runMods.reward.");
  return ensurePath(game, mapped.split("."));
}

function effectValue(effect, level = 1) {
  if (typeof effect.value !== "undefined") return effect.value;
  return (effect.base || 0) + (effect.perLevel || 0) * Math.max(0, level - 1);
}

function applyEffect(effect, level = 1) {
  const { holder, key } = resolveEffectTarget(effect.target);
  const value = effectValue(effect, level);
  if (effect.op === "set") {
    holder[key] = value;
    return;
  }
  if (effect.op === "multiply") {
    holder[key] = (holder[key] ?? 1) * value;
    return;
  }
  holder[key] = (holder[key] || 0) + value;
  if (typeof effect.max === "number") holder[key] = Math.min(effect.max, holder[key]);
}

function applyEffects(effects = [], level = 1) {
  for (const effect of effects) applyEffect(effect, level);
}

function applyMetaProgressionToRun() {
  if (!metaConfig || !metaState) return;
  const artifactMap = mapById(metaConfig.artifacts);
  const talentMap = mapById(metaConfig.startingTalents);
  const cultivationMap = mapById(metaConfig.cultivations);

  for (const tree of metaConfig.talentTrees || []) {
    const level = Math.min(tree.maxLevel || 12, metaState.progression.talentTree[tree.id] || 0);
    if (level <= 0) continue;
    applyEffects(tree.effects, level);
    if (tree.id === "sword" && level >= 5) game.weapons.keyboard.level += 1;
  }

  for (const facility of metaConfig.facilities || []) {
    const level = Math.min(facility.maxLevel || 10, metaState.progression.facilities[facility.id] || 0);
    if (level > 0) applyEffects(facility.effects, level);
  }

  const artifact = artifactMap[metaState.selected.artifactId];
  const artifactLevel = metaState.progression.artifacts[artifact?.id] || 1;
  if (artifact) applyEffects(artifact.effects, artifactLevel);

  const cultivation = cultivationMap[metaState.selected.cultivationId];
  const cultivationLevel = metaState.progression.cultivations[cultivation?.id] || 1;
  if (cultivation) applyEffects(cultivation.effects, cultivationLevel);

  for (const talentId of metaState.selected.startingTalentIds || []) {
    const talent = talentMap[talentId];
    if (talent) applyEffects(talent.effects, 1);
  }

  if (game.player.speedMultiplier) game.player.speed *= 1 + game.player.speedMultiplier;
  for (const weapon of Object.values(game.weapons)) {
    if (weapon.damageMultiplier) weapon.damage = Math.round(weapon.damage * (1 + weapon.damageMultiplier));
  }
  if (game.ultimate.damageMultiplier) game.ultimate.damage = Math.round(game.ultimate.damage * (1 + game.ultimate.damageMultiplier));
  game.player.hp = Math.min(game.player.maxHp, Math.max(game.player.hp, game.player.maxHp));
  game.energy.value = clamp(game.energy.value || 0, 0, game.energy.max || 100);
}

function createRunStats() {
  return {
    eliteKills: 0,
    bossKilled: false,
    xpCollected: 0,
    breakthroughs: 0,
    damageDealt: 0,
    damageTaken: 0,
    rewards: null,
    unlocks: [],
  };
}

function resetGame() {
  game.state = "playing";
  game.time = 0;
  game.killCount = 0;
  game.nextEntityId = 1;
  game.chapter = getSelectedChapter();
  game.difficulty = getSelectedDifficulty();
  if (game.chapter?.background) {
    theme.background.asset = game.chapter.background;
    theme.background.fallbackAsset = game.chapter.fallbackBackground || theme.background.fallbackAsset;
    loadImageAsset("background", theme.background.asset);
    loadImageAsset("background:fallback", theme.background.fallbackAsset);
  }
  game.camera = { x: 0, y: 0, shake: 0 };
  game.enemies = [];
  game.projectiles = [];
  game.pickups = [];
  game.texts = [];
  game.particles = [];
  game.spawnedOnce = new Set();
  game.waveTimers = new Map();
  game.player = {
    x: 0,
    y: 0,
    hp: theme.player.maxHp,
    maxHp: theme.player.maxHp,
    speed: theme.player.speed,
    radius: theme.player.radius,
    pickupRadius: theme.player.pickupRadius,
    xp: 0,
    nextXp: 36,
    level: 1,
    invincible: 0,
    damageReduction: 0,
  };
  game.weapons = cloneWeapons();
  game.equipment = createEquipmentState();
  game.energy = { value: 0, max: 100, gainMultiplier: 1 };
  game.ultimate = { damage: theme.spells?.ultimate?.damage || 95 };
  game.runMods = {
    xpMultiplier: 0,
    energyRegen: 0,
    killHeal: 0,
    eliteDamageBonus: 0,
    healMultiplier: 0,
    reward: { spiritStoneMultiplier: 0 },
  };
  game.runStats = createRunStats();
  game.bossRuntime = null;
  game.bossTelegraphs = [];
  game.bossHazards = [];
  game.bossIntro = null;
  game.spellPowerBonus = 0;
  game.breakthroughFx = null;
  applyMetaProgressionToRun();
  ui.upgradePanel.classList.add("hidden");
  ui.resultPanel.classList.add("hidden");
  ui.pausePanel.classList.add("hidden");
  ui.homePanel?.classList.add("hidden");
  document.querySelector(".brand strong").textContent = theme.name;
  if (ui.hpLabel) ui.hpLabel.textContent = theme.copy?.hp || "生命";
  if (ui.energyLabel) ui.energyLabel.textContent = theme.copy?.energy || "能量";
  if (ui.xpLabel) ui.xpLabel.textContent = theme.copy?.xp || "经验";
  ui.pauseBtn.textContent = "暂停";
  ui.resumeBtn.textContent = theme.copy?.resume || "继续割草";
  ui.quickRestartBtn.textContent = theme.copy?.restart || "重新开始";
  document.querySelector("#pausePanel h1").textContent = theme.copy?.pause || "暂停中";
  document.querySelector("#upgradePanel h1").textContent = theme.copy?.upgradeTitle || "升职加薪！";
  document.querySelector("#upgradePanel p").textContent = theme.copy?.upgradeSubtitle || "选一个能力继续割草";
  document.querySelector("#resultPanel h1").textContent = theme.copy?.resultTitle || "今日绩效结算";
  ui.restartBtn.textContent = theme.copy?.restart || "再卷一局";
  updateUi();
}

function resize() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function screenToWorld(x, y) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: x - rect.left + game.camera.x - rect.width / 2,
    y: y - rect.top + game.camera.y - rect.height / 2,
  };
}

function spawnEnemy(type) {
  const rect = canvas.getBoundingClientRect();
  const side = Math.floor(rand(0, 4));
  const margin = 80;
  const positions = [
    { x: rand(-rect.width / 2, rect.width / 2), y: -rect.height / 2 - margin },
    { x: rect.width / 2 + margin, y: rand(-rect.height / 2, rect.height / 2) },
    { x: rand(-rect.width / 2, rect.width / 2), y: rect.height / 2 + margin },
    { x: -rect.width / 2 - margin, y: rand(-rect.height / 2, rect.height / 2) },
  ];
  const pos = positions[side];
  spawnEnemyAt(type, game.player.x + pos.x, game.player.y + pos.y);
}

function spawnEnemyAt(type, x, y, overrides = {}) {
  const config = theme.enemies[type];
  if (!config) return null;
  const chapterMods = game.chapter?.enemyMods || {};
  const difficultyMods = game.difficulty?.enemyMods || {};
  const hpMod = (chapterMods.hp || 1) * (difficultyMods.hp || 1);
  const speedMod = (chapterMods.speed || 1) * (difficultyMods.speed || 1);
  const damageMod = (chapterMods.damage || 1) * (difficultyMods.damage || 1);
  const enemyConfig = type === "boss" && game.chapter
    ? { ...config, name: game.chapter.bossName || config.name, asset: game.chapter.bossAsset || config.asset }
    : config;
  const assetKey = enemyConfig.asset ? `enemy:${type}:${enemyConfig.asset}` : `enemy:${type}`;
  if (enemyConfig.asset && !imageAssets.has(assetKey)) loadImageAsset(assetKey, enemyConfig.asset);
  const enemy = {
    id: game.nextEntityId++,
    type,
    x,
    y,
    hp: Math.round((overrides.hp ?? enemyConfig.hp) * hpMod),
    maxHp: Math.round((overrides.hp ?? enemyConfig.hp) * hpMod),
    speed: (overrides.speed ?? enemyConfig.speed) * speedMod,
    damage: Math.round((overrides.damage ?? enemyConfig.damage) * damageMod),
    radius: overrides.radius ?? enemyConfig.radius,
    xp: enemyConfig.xp,
    color: overrides.color || enemyConfig.color,
    name: overrides.name || enemyConfig.name,
    asset: overrides.asset || enemyConfig.asset,
    assetKey,
    hitFlash: 0,
    bossSummon: overrides.bossSummon || false,
  };
  game.enemies.push(enemy);
  return enemy;
}

function spawnExperience(x, y, value) {
  game.pickups.push({
    id: game.nextEntityId++,
    type: "xp",
    x,
    y,
    value,
    radius: 7,
    age: 0,
    magnet: false,
  });
}

function spawnHealth(x, y) {
  game.pickups.push({
    id: game.nextEntityId++,
    type: "health",
    x,
    y,
    value: Math.round(22 * (1 + (game.runMods.healMultiplier || 0))),
    radius: 9,
    age: 0,
    magnet: false,
  });
}

function gainEnergy(amount) {
  if (!game.energy.max) return;
  game.energy.value = Math.min(game.energy.max, game.energy.value + amount * game.energy.gainMultiplier);
  if (game.energy.value >= game.energy.max && !game.ultimate.casting) castUltimate();
}

function addText(text, x, y, color = "#fff7c2") {
  game.texts.push({ text, x, y, color, life: 0.75, age: 0 });
}

function addBurst(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(60, 190);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: rand(2, 5),
      color,
      life: rand(0.28, 0.62),
      age: 0,
    });
  }
}

function currentInputVector() {
  let x = 0;
  let y = 0;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) y -= 1;
  if (keys.has("s") || keys.has("arrowdown")) y += 1;
  if (pointer.active) {
    x += clamp((pointer.current.x - pointer.origin.x) / 62, -1, 1);
    y += clamp((pointer.current.y - pointer.origin.y) / 62, -1, 1);
  }
  return normalize(x, y);
}

function updatePlayer(dt) {
  const input = currentInputVector();
  const moving = keys.size > 0 || pointer.active;
  if (moving) {
    game.player.x += input.x * game.player.speed * dt;
    game.player.y += input.y * game.player.speed * dt;
  }
  game.player.invincible = Math.max(0, game.player.invincible - dt);
}

function updateCamera(dt) {
  const smooth = 1 - Math.pow(0.001, dt);
  game.camera.x += (game.player.x - game.camera.x) * smooth;
  game.camera.y += (game.player.y - game.camera.y) * smooth;
  game.camera.shake = Math.max(0, game.camera.shake - dt * 22);
}

function updateWaves(dt) {
  for (const wave of theme.waves) {
    const waveAt = wave.type === "boss" && game.chapter?.bossAt ? game.chapter.bossAt : wave.at;
    const spawnMods = game.chapter?.spawnMods || {};
    const difficultySpawnMods = game.difficulty?.spawnMods || {};
    const rateMod = (spawnMods.rate || 1) * (difficultySpawnMods.rate || 1);
    const capMod = (spawnMods.cap || 1) * (difficultySpawnMods.cap || 1);
    const cap = Math.max(1, Math.round(wave.cap * capMod));
    if (game.time < waveAt) continue;
    const activeCount = game.enemies.filter((enemy) => enemy.type === wave.type).length;
    if (activeCount >= cap) continue;
    if (wave.once) {
      const key = `${waveAt}-${wave.type}`;
      if (!game.spawnedOnce.has(key)) {
        spawnEnemy(wave.type);
        game.spawnedOnce.add(key);
        addText(game.chapter?.bossWarning || theme.copy?.bossWarning || "老板来了！", game.player.x, game.player.y - 92, "#ffb347");
        game.camera.shake = 14;
      }
      continue;
    }
    const timer = (game.waveTimers.get(wave) || 0) - dt;
    if (timer <= 0) {
      spawnEnemy(wave.type);
      game.waveTimers.set(wave, Math.max(0.16, wave.rate * rateMod));
    } else {
      game.waveTimers.set(wave, timer);
    }
  }
}

function getBossEnemy() {
  return game.enemies.find((enemy) => enemy.type === "boss") || null;
}

function ensureBossRuntime(boss) {
  if (!boss || !game.chapter?.bossMechanics) return null;
  if (game.bossRuntime?.enemyId === boss.id) return game.bossRuntime;
  const mechanics = game.chapter.bossMechanics;
  game.bossRuntime = {
    id: game.chapter.id,
    enemyId: boss.id,
    phase: 0,
    mechanics,
    cooldowns: Object.fromEntries((mechanics.skills || []).map((skill, index) => [skill.id, 1.2 + index * 1.6])),
  };
  game.bossIntro = { age: 0, life: 2.2, title: boss.name, subtitle: mechanics.subtitle || mechanics.introText || "" };
  addText(mechanics.introText || game.chapter.bossWarning || boss.name, boss.x, boss.y - boss.radius - 62, mechanics.auraColor || "#f4d778");
  return game.bossRuntime;
}

function bossPhaseFor(boss) {
  const ratio = boss.hp / boss.maxHp;
  if (ratio <= 0.35) return 2;
  if (ratio <= 0.7) return 1;
  return 0;
}

function updateBossRuntime(dt) {
  const boss = getBossEnemy();
  if (!boss) {
    game.bossRuntime = null;
    game.bossTelegraphs = [];
    game.bossHazards = [];
    return;
  }
  const runtime = ensureBossRuntime(boss);
  if (!runtime) return;
  const nextPhase = bossPhaseFor(boss);
  if (nextPhase > runtime.phase) {
    runtime.phase = nextPhase;
    const text = runtime.mechanics.phaseTexts?.[nextPhase - 1] || `${boss.name} 进入 ${nextPhase + 1} 阶段`;
    addText(text, boss.x, boss.y - boss.radius - 50, runtime.mechanics.auraColor || "#f4d778");
    game.camera.shake = Math.max(game.camera.shake, 12 + nextPhase * 4);
    const phaseSkill = [...(runtime.mechanics.skills || [])].reverse().find((skill) => (skill.phase || 0) <= runtime.phase);
    if (phaseSkill) scheduleBossSkill(boss, phaseSkill, runtime, { phaseBurst: true });
  }
  for (const skill of runtime.mechanics.skills || []) {
    if ((skill.phase || 0) > runtime.phase) continue;
    runtime.cooldowns[skill.id] = (runtime.cooldowns[skill.id] || skill.cooldown || 6) - dt;
    if (runtime.cooldowns[skill.id] <= 0) {
      scheduleBossSkill(boss, skill, runtime);
      runtime.cooldowns[skill.id] = Math.max(1.8, (skill.cooldown || 6) * (runtime.phase >= 2 ? 0.78 : runtime.phase >= 1 ? 0.88 : 1));
      break;
    }
  }
}

function scheduleBossSkill(boss, skill, runtime, options = {}) {
  const angleToPlayer = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
  const items = expandBossSkillTargets(boss, skill, angleToPlayer, runtime);
  for (const target of items) {
    game.bossTelegraphs.push({
      id: `${skill.id}-${game.time}-${Math.random()}`,
      skill,
      bossId: boss.id,
      x: target.x,
      y: target.y,
      angle: target.angle ?? angleToPlayer,
      age: target.delay ? -target.delay : 0,
      telegraph: target.telegraph || skill.telegraph || 0.75,
      color: target.color || skill.color || runtime.mechanics.auraColor || "#f4d778",
      effect: target.effect || null,
    });
  }
  addText(options.phaseBurst ? `阶段技：${skill.name}` : skill.name, boss.x, boss.y - boss.radius - 38, skill.color || runtime.mechanics.auraColor || "#f4d778");
}

function expandBossSkillTargets(boss, skill, angleToPlayer, runtime) {
  const baseTarget = skill.shape === "line"
    ? {
        x: boss.x + Math.cos(angleToPlayer) * (skill.length || 300) * 0.42,
        y: boss.y + Math.sin(angleToPlayer) * (skill.length || 300) * 0.42,
        angle: angleToPlayer,
      }
    : { x: game.player.x, y: game.player.y, angle: angleToPlayer };
  const color = skill.color || runtime.mechanics.auraColor || "#f4d778";
  if (skill.pattern === "tripleCone") {
    return [-0.72, 0, 0.72].map((offset, index) => ({ x: boss.x, y: boss.y, angle: angleToPlayer + offset, delay: index * 0.08, color }));
  }
  if (skill.pattern === "scatterCircles") {
    const count = skill.count || 4;
    const spread = skill.id?.includes("thunder") ? 220 : 170;
    return Array.from({ length: count }, (_, index) => {
      const anchored = index === 0;
      return {
        x: anchored ? game.player.x : game.player.x + rand(-spread, spread),
        y: anchored ? game.player.y : game.player.y + rand(-spread * 0.75, spread * 0.75),
        angle: angleToPlayer,
        delay: index * 0.08,
        color,
      };
    });
  }
  if (skill.pattern === "crossLines") {
    return [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((offset, index) => ({
      x: game.player.x,
      y: game.player.y,
      angle: offset,
      delay: index * 0.06,
      color,
    }));
  }
  if (skill.pattern === "parallelLines") {
    const normal = angleToPlayer + Math.PI / 2;
    return [-74, 0, 74].map((offset, index) => ({
      x: baseTarget.x + Math.cos(normal) * offset,
      y: baseTarget.y + Math.sin(normal) * offset,
      angle: angleToPlayer,
      delay: index * 0.06,
      color,
    }));
  }
  if (skill.pattern === "chasePools") {
    const dir = normalize(game.player.x - boss.x, game.player.y - boss.y);
    return Array.from({ length: skill.count || 3 }, (_, index) => ({
      x: game.player.x + dir.x * index * 58 + rand(-34, 34),
      y: game.player.y + dir.y * index * 58 + rand(-34, 34),
      angle: angleToPlayer,
      delay: index * 0.14,
      color,
    }));
  }
  if (skill.pattern === "tripleClaw") {
    const normal = angleToPlayer + Math.PI / 2;
    return [-46, 0, 46].map((offset, index) => ({
      x: baseTarget.x + Math.cos(normal) * offset,
      y: baseTarget.y + Math.sin(normal) * offset,
      angle: angleToPlayer + (index - 1) * 0.08,
      delay: index * 0.05,
      color,
    }));
  }
  if (skill.pattern === "prisonPlusStrikes") {
    return [
      { x: game.player.x, y: game.player.y, angle: angleToPlayer, color },
      { x: game.player.x + rand(-140, 140), y: game.player.y + rand(-110, 110), angle: angleToPlayer, delay: 0.18, effect: { shape: "circle", radius: 72 }, color: "#f4dd72" },
      { x: game.player.x + rand(-170, 170), y: game.player.y + rand(-130, 130), angle: angleToPlayer, delay: 0.3, effect: { shape: "circle", radius: 72 }, color: "#f4dd72" },
    ];
  }
  return [baseTarget];
}

function damagePlayerFromBoss(amount, source) {
  if (game.player.invincible > 0 || game.state !== "playing") return false;
  const damage = Math.max(1, Math.round(amount * (1 - (game.player.damageReduction || 0))));
  game.player.hp -= damage;
  game.runStats.damageTaken += damage;
  game.player.invincible = 0.35;
  game.camera.shake = Math.max(game.camera.shake, 8);
  addText(`-${damage}`, game.player.x, game.player.y - 24, source?.color || "#ff7676");
  addBurst(game.player.x, game.player.y, source?.color || "#ff7676", 8);
  if (game.player.hp <= 0) finishRun();
  return true;
}

function effectiveBossSkill(item) {
  return item.effect ? { ...item.skill, ...item.effect } : item.skill;
}

function playerInTelegraph(item) {
  const skill = effectiveBossSkill(item);
  if (skill.shape === "circle" || skill.shape === "pool") return distance(game.player, item) <= (skill.radius || 80) + game.player.radius;
  if (skill.shape === "ring") {
    const d = distance(game.player, item);
    const radius = skill.radius || 130;
    const width = skill.width || 34;
    return d >= radius - width && d <= radius + width;
  }
  if (skill.shape === "line") {
    const dx = game.player.x - item.x;
    const dy = game.player.y - item.y;
    const cos = Math.cos(-item.angle);
    const sin = Math.sin(-item.angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= (skill.length || 320) / 2 && Math.abs(ly) <= (skill.width || 56) / 2 + game.player.radius;
  }
  if (skill.shape === "cone") {
    const boss = getBossEnemy();
    if (!boss) return false;
    const d = distance(game.player, boss);
    const angle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
    const diff = Math.abs(Math.atan2(Math.sin(angle - item.angle), Math.cos(angle - item.angle)));
    return d <= (skill.radius || 170) && diff <= (skill.arc || 0.8);
  }
  return false;
}

function resolveBossTelegraph(item) {
  const skill = item.skill;
  if (skill.shape === "summon") {
    const count = skill.count || 3;
    const boss = getBossEnemy();
    const origin = boss || game.player;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + rand(-0.18, 0.18);
      const radius = rand(95, 165);
      spawnEnemyAt(skill.type || "manager", origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius, {
        bossSummon: true,
      });
    }
    if (skill.eliteCount && game.bossRuntime?.phase >= 2) {
      for (let i = 0; i < skill.eliteCount; i += 1) {
        const angle = rand(0, Math.PI * 2);
        spawnEnemyAt(skill.eliteType || "director", origin.x + Math.cos(angle) * 145, origin.y + Math.sin(angle) * 145, {
          bossSummon: true,
        });
      }
    }
    if (skill.lifesteal && boss) {
      boss.hp = Math.min(boss.maxHp, boss.hp + skill.lifesteal);
      addText(`+${skill.lifesteal}`, boss.x, boss.y - boss.radius - 42, skill.color || "#ff7a86");
    }
    addBurst(origin.x, origin.y, skill.color || "#f4d778", 18);
    return;
  }
  if (skill.shape === "pull") {
    const dir = normalize(item.x - game.player.x, item.y - game.player.y);
    game.player.x += dir.x * (skill.pull || 80);
    game.player.y += dir.y * (skill.pull || 80);
    if (skill.followup && game.bossRuntime) {
      const followup = (game.bossRuntime.mechanics.skills || []).find((entry) => entry.id === skill.followup);
      if (followup) scheduleBossSkill(getBossEnemy(), followup, game.bossRuntime, { phaseBurst: true });
    }
  }
  if (skill.shape === "pool" || skill.duration) {
    game.bossHazards.push({ ...item, age: 0, duration: skill.duration || 4.5, tick: 0 });
  }
  if (playerInTelegraph(item)) damagePlayerFromBoss(skill.damage || 16, item);
  if (skill.leap) {
    const boss = getBossEnemy();
    if (boss) {
      boss.x = item.x;
      boss.y = item.y;
    }
  }
  game.camera.shake = Math.max(game.camera.shake, skill.cameraShake || 7);
  addBurst(item.x, item.y, item.color, 14);
}

function updateBossTelegraphs(dt) {
  for (const item of game.bossTelegraphs) {
    item.age += dt;
    if (item.age >= item.telegraph) {
      resolveBossTelegraph(item);
      item.done = true;
    }
  }
  game.bossTelegraphs = game.bossTelegraphs.filter((item) => !item.done);
}

function updateBossHazards(dt) {
  for (const hazard of game.bossHazards) {
    hazard.age += dt;
    hazard.tick -= dt;
    if (hazard.tick <= 0) {
      hazard.tick = 0.55;
      if (playerInTelegraph(hazard)) damagePlayerFromBoss(hazard.skill.damage || 8, hazard);
    }
  }
  game.bossHazards = game.bossHazards.filter((hazard) => hazard.age < hazard.duration);
}

function updateEnemies(dt) {
  for (const enemy of game.enemies) {
    const dir = normalize(game.player.x - enemy.x, game.player.y - enemy.y);
    enemy.x += dir.x * enemy.speed * dt;
    enemy.y += dir.y * enemy.speed * dt;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

    if (distance(enemy, game.player) < enemy.radius + game.player.radius && game.player.invincible <= 0) {
      damagePlayerFromBoss(enemy.damage, { color: enemy.color });
    }
  }
}

function nearestEnemyInRange() {
  return nearestEnemyInRangeFor(game.weapons.keyboard.range);
}

function fireWeapon() {
  const target = nearestEnemyInRange();
  if (!target) return;
  const base = Math.atan2(target.y - game.player.y, target.x - game.player.x);
  const spread = 0.18;
  const weapon = game.weapons.keyboard;
  for (let i = 0; i < weapon.burst; i += 1) {
    const offset = (i - (weapon.burst - 1) / 2) * spread;
    const angle = base + offset;
    game.projectiles.push({
      id: game.nextEntityId++,
      type: "keyboard",
      x: game.player.x,
      y: game.player.y,
      vx: Math.cos(angle) * weapon.projectileSpeed,
      vy: Math.sin(angle) * weapon.projectileSpeed,
      radius: weapon.projectileRadius,
      damage: weapon.damage,
      color: weapon.color,
      life: weapon.range / weapon.projectileSpeed,
      rotation: angle,
    });
  }
}

function fireInvoice() {
  const weapon = game.weapons.invoice;
  if (!weapon.unlocked) return;
  const target = nearestEnemyInRangeFor(weapon.range);
  if (!target) return;
  const base = Math.atan2(target.y - game.player.y, target.x - game.player.x);
  const spread = 0.34;
  for (let i = 0; i < weapon.burst; i += 1) {
    const offset = (i - (weapon.burst - 1) / 2) * spread;
    const angle = base + offset;
    game.projectiles.push({
      id: game.nextEntityId++,
      type: "invoice",
      x: game.player.x,
      y: game.player.y,
      vx: Math.cos(angle) * weapon.projectileSpeed,
      vy: Math.sin(angle) * weapon.projectileSpeed,
      radius: weapon.projectileRadius,
      damage: weapon.damage,
      color: weapon.color,
      life: weapon.range / weapon.projectileSpeed,
      rotation: angle,
    });
  }
}

function nearestEnemyInRangeFor(range) {
  let target = null;
  let best = Infinity;
  for (const enemy of game.enemies) {
    const d = distance(enemy, game.player);
    if (d < range && d < best) {
      target = enemy;
      best = d;
    }
  }
  return target;
}

function pulseCoffee() {
  const weapon = game.weapons.coffee;
  if (!weapon.unlocked) return;
  let hit = 0;
  for (const enemy of [...game.enemies]) {
    if (distance(enemy, game.player) < weapon.radius + enemy.radius) {
      damageEnemy(enemy, scaledDamage(weapon.damage));
      hit += 1;
    }
  }
  if (hit > 0) {
    addText(theme.weapons.coffee.name, game.player.x, game.player.y - 54, weapon.color);
    game.camera.shake = Math.max(game.camera.shake, 5);
  }
}

function updateWeapon(dt) {
  const keyboard = game.weapons.keyboard;
  keyboard.timer = (keyboard.timer || 0) - dt;
  if (keyboard.timer <= 0) {
    fireWeapon();
    keyboard.timer = keyboard.cooldown;
  }

  const coffee = game.weapons.coffee;
  if (coffee.unlocked) {
    coffee.timer = (coffee.timer || 0) - dt;
    if (coffee.timer <= 0) {
      pulseCoffee();
      coffee.timer = coffee.cooldown;
    }
  }

  const invoice = game.weapons.invoice;
  if (invoice.unlocked) {
    invoice.timer = (invoice.timer || 0) - dt;
    if (invoice.timer <= 0) {
      fireInvoice();
      invoice.timer = invoice.cooldown;
    }
  }
}

function damageEnemy(enemy, amount) {
  game.runStats.damageDealt += amount;
  enemy.hp -= amount;
  enemy.hitFlash = 0.1;
  addText(Math.round(amount).toString(), enemy.x, enemy.y - enemy.radius, "#fff2a8");
  addBurst(enemy.x, enemy.y, "#ffd35a", 4);
  if (enemy.hp <= 0) {
    const defeatedBossText = enemy.type === "boss" ? game.chapter?.bossMechanics?.victoryText : "";
    game.killCount += 1;
    if (enemy.type === "director") game.runStats.eliteKills += 1;
    if (enemy.type === "boss") game.runStats.bossKilled = true;
    gainEnergy(enemy.type === "boss" ? 42 : enemy.type === "director" ? 12 : 6);
    spawnExperience(enemy.x, enemy.y, enemy.xp);
    if (game.runMods.killHeal && game.killCount % 40 === 0) {
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.runMods.killHeal);
      addText(`+${game.runMods.killHeal}`, game.player.x, game.player.y - 36, "#8dffba");
    }
    if (Math.random() < (enemy.type === "boss" ? 1 : 0.06)) spawnHealth(enemy.x + rand(-18, 18), enemy.y + rand(-18, 18));
    addBurst(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 28 : 12);
    game.camera.shake = enemy.type === "boss" ? 16 : 4;
    game.enemies = game.enemies.filter((item) => item.id !== enemy.id);
    if (defeatedBossText) {
      addText(defeatedBossText, game.player.x, game.player.y - 104, game.chapter?.bossMechanics?.auraColor || "#f4d778");
      game.bossIntro = { age: 0, life: 1.8, title: "Boss 已镇压", subtitle: defeatedBossText };
    }
  }
}

function updateProjectiles(dt) {
  for (const projectile of game.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    for (const enemy of game.enemies) {
      if (distance(projectile, enemy) < projectile.radius + enemy.radius) {
        damageEnemy(enemy, scaledDamage(projectile.damage));
        projectile.life = 0;
        break;
      }
    }
  }
  game.projectiles = game.projectiles.filter((projectile) => projectile.life > 0);
}

function gainExperience(value) {
  const gained = Math.round(value * (1 + (game.runMods.xpMultiplier || 0)));
  game.runStats.xpCollected += gained;
  game.player.xp += gained;
  gainEnergy(gained * 0.22);
  while (game.player.xp >= game.player.nextXp) {
    game.player.xp -= game.player.nextXp;
    game.player.level += 1;
    game.runStats.breakthroughs += 1;
    game.player.nextXp = Math.floor(game.player.nextXp * 1.32 + 16);
    game.breakthroughFx = { age: 0, life: 1.15, type: "realm", label: realmLabel(game.player.level) };
    openUpgradePanel();
    break;
  }
}

function scaledDamage(amount) {
  return Math.round(amount * (1 + game.spellPowerBonus));
}

function castUltimate() {
  if (!theme.spells?.ultimate || game.state !== "playing") return;
  game.ultimate.casting = true;
  game.energy.value = 0;
  const targets = [...game.enemies].sort((a, b) => distance(a, game.player) - distance(b, game.player)).slice(0, 14);
  addText("天劫雷瀑！", game.player.x, game.player.y - 92, "#f3df78");
  game.camera.shake = 18;
  for (const enemy of targets) {
    damageEnemy(enemy, scaledDamage(game.ultimate.damage));
    addBurst(enemy.x, enemy.y, "#f3df78", 14);
  }
  for (let i = 0; i < 18; i += 1) {
    addBurst(game.player.x + rand(-260, 260), game.player.y + rand(-190, 190), "#9ed8ff", 3);
  }
  game.ultimate.casting = false;
}

function updatePickups(dt) {
  for (const pickup of game.pickups) {
    pickup.age += dt;
    const d = distance(pickup, game.player);
    if (d < game.player.pickupRadius || pickup.age > 0.8) pickup.magnet = true;
    if (pickup.magnet) {
      const dir = normalize(game.player.x - pickup.x, game.player.y - pickup.y);
      const speed = pickup.age > 0.8 ? clamp(680 - d * 1.2, 220, 680) : clamp(520 - d * 2.2, 160, 520);
      pickup.x += dir.x * speed * dt;
      pickup.y += dir.y * speed * dt;
    }
    if (d < game.player.radius + pickup.radius) {
      if (pickup.type === "health") {
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + pickup.value);
        addText(`+${pickup.value}`, game.player.x, game.player.y - 36, "#8dffba");
      } else {
        gainExperience(pickup.value);
      }
      pickup.collected = true;
    }
  }
  game.pickups = game.pickups.filter((pickup) => !pickup.collected);
}

function updateEffects(dt) {
  if (game.bossIntro) {
    game.bossIntro.age += dt;
    if (game.bossIntro.age >= game.bossIntro.life) game.bossIntro = null;
  }

  if (game.breakthroughFx) {
    game.breakthroughFx.age += dt;
    if (game.breakthroughFx.age >= game.breakthroughFx.life) game.breakthroughFx = null;
  }

  for (const item of game.texts) {
    item.age += dt;
    item.y -= 36 * dt;
  }
  game.texts = game.texts.filter((item) => item.age < item.life);

  for (const particle of game.particles) {
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - 4.2 * dt;
    particle.vy *= 1 - 4.2 * dt;
  }
  game.particles = game.particles.filter((particle) => particle.age < particle.life);
}

function chooseUpgrades() {
  if (!theme.spellUpgrades || !theme.equipmentUpgrades) {
    const pool = [...theme.upgrades].sort(() => Math.random() - 0.5);
    return pool.slice(0, 3);
  }

  const spellPool = [...theme.spellUpgrades].sort(() => Math.random() - 0.5);
  const equipmentPool = theme.equipmentUpgrades
    .filter((upgrade) => (game.equipment[upgrade.slot]?.tier || 0) < (theme.equipmentSlots[upgrade.slot]?.maxTier || 3))
    .sort(() => Math.random() - 0.5);
  const fatePool = [...(theme.fateUpgrades || [])].sort(() => Math.random() - 0.5);
  const choices = [];
  if (spellPool[0]) choices.push(spellPool[0]);
  if (equipmentPool[0]) choices.push(equipmentPool[0]);
  const randomPool = [...spellPool.slice(1), ...equipmentPool.slice(1), ...fatePool].sort(() => Math.random() - 0.5);
  if (randomPool[0]) choices.push(randomPool[0]);
  while (choices.length < 3 && fatePool[choices.length]) choices.push(fatePool[choices.length]);
  return choices.slice(0, 3);
}

function upgradeKindLabel(upgrade) {
  if (upgrade.kind === "equipment") return "装备";
  if (upgrade.kind === "spell") return "法术";
  return "机缘";
}

function upgradeIcon(upgrade) {
  if (upgrade.kind === "equipment") {
    const tier = Math.min((game.equipment[upgrade.slot]?.tier || 0) + 1, theme.equipmentSlots[upgrade.slot]?.maxTier || 3);
    return theme.equipmentSlots[upgrade.slot]?.assets?.[tier - 1] || "";
  }
  if (upgrade.id?.includes("coffee")) return theme.spells?.coffee?.icon || "";
  if (upgrade.id?.includes("invoice")) return theme.spells?.invoice?.icon || "";
  if (upgrade.id?.includes("ultimate")) return theme.spells?.ultimate?.icon || "";
  return theme.spells?.keyboard?.icon || "";
}

function upgradeSubtitle(upgrade) {
  if (upgrade.kind !== "equipment") return upgrade.title;
  const tier = Math.min((game.equipment[upgrade.slot]?.tier || 0) + 1, theme.equipmentSlots[upgrade.slot]?.maxTier || 3);
  return `${theme.equipmentSlots[upgrade.slot]?.name || "装备"} ${tier}阶`;
}

function applySelectedUpgrade(upgrade) {
  if (upgrade.kind === "equipment") {
    const slotState = game.equipment[upgrade.slot];
    const maxTier = theme.equipmentSlots[upgrade.slot]?.maxTier || 3;
    const nextTier = Math.min(maxTier, (slotState?.tier || 0) + 1);
    game.equipment[upgrade.slot] = { tier: nextTier };
    upgrade.apply?.(game, nextTier);
    game.breakthroughFx = {
      age: 0,
      life: 0.95,
      type: "equipment",
      label: `${theme.equipmentSlots[upgrade.slot]?.name || "装备"}${nextTier}`,
    };
    addText(`${theme.equipmentSlots[upgrade.slot]?.name || "装备"} ${nextTier}阶`, game.player.x, game.player.y - 70, "#b9f3ff");
    return;
  }
  upgrade.apply(game);
  if (upgrade.id === "damage" || upgrade.id === "cooldown" || upgrade.id === "burst") game.weapons.keyboard.level += 1;
}

function openUpgradePanel() {
  game.state = "upgrading";
  ui.upgradeChoices.innerHTML = "";
  for (const upgrade of chooseUpgrades()) {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.dataset.kind = upgrade.kind || "fate";
    const icon = upgradeIcon(upgrade);
    button.innerHTML = `
      ${icon ? homeImage(icon, "", "choice-icon") : ""}
      <span class="choice-meta"><b class="choice-tag">${upgradeKindLabel(upgrade)}</b><b class="choice-rarity">${upgrade.rarity || "黄"}</b></span>
      ${upgradeSubtitle(upgrade)}
      <span class="choice-desc">${upgrade.desc}</span>
    `;
    button.addEventListener("click", () => {
      applySelectedUpgrade(upgrade);
      ui.upgradePanel.classList.add("hidden");
      game.state = "playing";
      addText(upgrade.kind === "equipment" ? "法宝入体！" : "悟了！", game.player.x, game.player.y - 70, "#8dffba");
      game.camera.shake = 10;
    });
    ui.upgradeChoices.appendChild(button);
  }
  ui.upgradePanel.classList.remove("hidden");
}

function addCurrencies(delta) {
  for (const [key, value] of Object.entries(delta || {})) {
    metaState.currencies[key] = Math.max(0, Math.floor((metaState.currencies[key] || 0) + value));
  }
}

function hasCurrency(cost) {
  return Object.entries(cost || {}).every(([key, value]) => (metaState?.currencies?.[key] || 0) >= value);
}

function spendCurrency(cost) {
  if (!hasCurrency(cost)) return false;
  for (const [key, value] of Object.entries(cost || {})) metaState.currencies[key] -= value;
  saveMetaState();
  return true;
}

function calculateRunRewards() {
  if (!metaConfig) return null;
  const chapterMultiplier = game.chapter?.rewardMultiplier || 1;
  const difficultyMultiplier = game.difficulty?.rewardMultiplier || 1;
  const rewardMultiplier = chapterMultiplier * difficultyMultiplier;
  const bossBonus = game.runStats.bossKilled ? 120 : 0;
  const daoBossBonus = game.runStats.bossKilled ? 30 : 0;
  const fieldBonus = 1 + (game.runMods.reward?.spiritStoneMultiplier || 0);
  const drops = game.chapter?.drops || {};
  return {
    spiritStone: Math.floor((game.killCount * 2 + game.time * 0.6 + bossBonus) * rewardMultiplier * fieldBonus),
    dao: Math.floor((game.player.level * 4 + game.time / 20 + daoBossBonus) * rewardMultiplier),
    mysticIron: Math.floor((game.runStats.eliteKills + (game.runStats.bossKilled ? drops.mysticIron || 2 : 0)) * difficultyMultiplier),
    spiritEssence: Math.floor((game.runStats.breakthroughs * 3 + game.runStats.xpCollected / 80 + (game.runStats.bossKilled ? drops.spiritEssence || 0 : 0)) * Math.min(2.2, rewardMultiplier)),
    thunderShard: game.runStats.bossKilled ? drops.thunderShard || 0 : 0,
  };
}

function ensureChapterRecord(chapterId) {
  if (!metaState.records.chapters[chapterId]) {
    metaState.records.chapters[chapterId] = {
      bestDifficulty: "mortal",
      clearedDifficulties: [],
      bestTime: 0,
      bestKills: 0,
    };
  }
  return metaState.records.chapters[chapterId];
}

function unlockMany(kind, ids = [], messages = []) {
  for (const id of ids || []) {
    if (!id) continue;
    const list = metaState.unlocks[kind];
    if (Array.isArray(list) && !list.includes(id)) {
      list.push(id);
      messages.push(`解锁 ${unlockDisplayName(kind, id)}`);
    }
    if (kind === "artifacts" && !metaState.progression.artifacts[id]) metaState.progression.artifacts[id] = 1;
    if (kind === "cultivations" && !metaState.progression.cultivations[id]) metaState.progression.cultivations[id] = 1;
  }
}

function unlockDisplayName(kind, id) {
  const maps = {
    chapters: mapById(metaConfig.chapters),
    artifacts: mapById(metaConfig.artifacts),
    startingTalents: mapById(metaConfig.startingTalents),
    cultivations: mapById(metaConfig.cultivations),
  };
  return maps[kind]?.[id]?.name || id;
}

function unlockProgressAfterRun() {
  if (!metaConfig || !game.chapter) return [];
  const messages = [];
  const chapterId = game.chapter.id;
  const difficultyId = game.difficulty?.id || "mortal";
  const record = ensureChapterRecord(chapterId);
  record.bestTime = Math.max(record.bestTime || 0, Math.floor(game.time));
  record.bestKills = Math.max(record.bestKills || 0, game.killCount);
  const cleared = game.runStats.bossKilled;
  if (cleared && !record.clearedDifficulties.includes(difficultyId)) {
    record.clearedDifficulties.push(difficultyId);
    messages.push(`${game.chapter.name}${game.difficulty?.name || ""}首通`);
    const unlocks = game.chapter.firstClearUnlocks || {};
    unlockMany("chapters", unlocks.chapters, messages);
    unlockMany("artifacts", unlocks.artifacts, messages);
    unlockMany("startingTalents", unlocks.startingTalents, messages);
    unlockMany("cultivations", unlocks.cultivations, messages);
    for (const chapter of metaConfig.chapters) {
      if (!metaState.unlocks.difficulties[chapter.id]) metaState.unlocks.difficulties[chapter.id] = ["mortal"];
    }
    if (difficultyId === "mortal" && !metaState.unlocks.difficulties[chapterId].includes("mystic")) {
      metaState.unlocks.difficulties[chapterId].push("mystic");
      messages.push(`解锁 ${game.chapter.name}玄境`);
    }
    if (difficultyId === "mystic" && !metaState.unlocks.difficulties[chapterId].includes("heaven")) {
      metaState.unlocks.difficulties[chapterId].push("heaven");
      messages.push(`解锁 ${game.chapter.name}天境`);
    }
  }
  metaState.records.runs += 1;
  metaState.records.totalKills += game.killCount;
  metaState.records.bestSurvivalSeconds = Math.max(metaState.records.bestSurvivalSeconds || 0, Math.floor(game.time));
  metaState.records.highestRealmLevel = Math.max(metaState.records.highestRealmLevel || 1, game.player.level);
  return messages;
}

function finishRun() {
  if (game.state === "ended") return;
  game.state = "ended";
  const killLabel = theme.copy?.kills || "击退";
  if (metaConfig && metaState) {
    const rewards = calculateRunRewards();
    addCurrencies(rewards);
    const unlocks = unlockProgressAfterRun();
    game.runStats.rewards = rewards;
    game.runStats.unlocks = unlocks;
    saveMetaState();
    ui.rewardText.innerHTML = `
      <span>获得：${formatCost(rewards) || "暂无"}</span>
      ${unlocks.length ? `<span>${unlocks.join(" / ")}</span>` : ""}
    `;
  } else if (ui.rewardText) {
    ui.rewardText.textContent = "";
  }
  ui.resultText.textContent = `闭关 ${formatTime(game.time)}，${killLabel} ${game.killCount}，最高境界 ${realmLabel(game.player.level)}。`;
  ui.resultPanel.classList.remove("hidden");
}

function pauseGame() {
  if (game.state !== "playing") return;
  game.state = "paused";
  ui.pausePanel.classList.remove("hidden");
}

function resumeGame() {
  if (game.state !== "paused") return;
  game.state = "playing";
  game.lastFrame = performance.now();
  ui.pausePanel.classList.add("hidden");
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function upgradeCost(kind, id, level) {
  if (kind === "talent") return { spiritStone: Math.floor(80 * Math.pow(1.32, level)) };
  if (kind === "artifact") return { spiritStone: Math.floor(120 * Math.pow(1.4, level)), mysticIron: Math.max(1, Math.floor(level / 2)) };
  if (kind === "cultivation") return { dao: 20 + level * 18, spiritEssence: 8 + level * 6 };
  if (kind === "facility") {
    const cost = { spiritStone: Math.floor(160 * Math.pow(1.45, level)) };
    if (id === "cushion" || id === "library") cost.dao = 8 + level * 5;
    if (id === "forge") cost.mysticIron = Math.max(1, Math.floor(level / 2));
    if (id === "thunderPool") cost.thunderShard = Math.max(1, Math.floor(level / 3));
    return cost;
  }
  return {};
}

const effectLabelMap = {
  "weapon.keyboard.burst": "飞剑数量",
  "weapon.keyboard.damage": "飞剑伤害",
  "weapon.keyboard.damageMultiplier": "飞剑伤害",
  "weapon.keyboard.level": "御剑成阵等级",
  "weapon.coffee.unlocked": "解锁业火莲华",
  "weapon.coffee.level": "业火莲华等级",
  "weapon.coffee.radius": "业火莲华范围",
  "weapon.coffee.damage": "业火莲华伤害",
  "weapon.invoice.unlocked": "解锁雷符万钧",
  "weapon.invoice.level": "雷符万钧等级",
  "weapon.invoice.damage": "雷符万钧伤害",
  "energy.value": "初始灵力",
  "energy.gainMultiplier": "灵力获取",
  "ultimate.damageMultiplier": "天劫雷瀑伤害",
  "player.pickupRadius": "拾取范围",
  "player.maxHp": "气血上限",
  "player.hp": "气血",
  "player.damageReduction": "受到伤害降低",
  "player.speedMultiplier": "移动速度",
  spellPowerBonus: "法术伤害",
  "run.xpMultiplier": "修为获取",
  "run.healMultiplier": "回血丹效果",
  "run.killHeal": "斩妖回复",
  "run.energyRegen": "灵力恢复",
  "run.eliteDamageBonus": "对精英伤害",
  "reward.spiritStoneMultiplier": "结算灵石",
};

function effectLabel(target) {
  if (effectLabelMap[target]) return effectLabelMap[target];
  return String(target || "")
    .replace("weapon.keyboard", "飞剑")
    .replace("weapon.coffee", "业火莲华")
    .replace("weapon.invoice", "雷符万钧")
    .replace("player", "角色")
    .replace("energy", "灵力")
    .replace("ultimate", "天劫雷瀑")
    .replace("run", "局内")
    .replace("reward", "结算")
    .replace(/\./g, " ");
}

function formatEffectValue(effect, value) {
  if (effect.op === "set") return "解锁";
  const rounded = Number(value.toFixed?.(3) ?? value);
  const isPercent = /Multiplier|Reduction|Bonus|reward\.|healMultiplier|xpMultiplier|gainMultiplier|speedMultiplier/.test(effect.target);
  const display = isPercent ? Math.round(rounded * 100) : Number(rounded.toFixed?.(2) ?? rounded);
  return display > 0 ? `+${display}${isPercent ? "%" : ""}` : `${display}${isPercent ? "%" : ""}`;
}

function effectSummary(effects = [], level = 1) {
  if (!effects.length) return "";
  return effects
    .slice(0, 2)
    .map((effect) => {
      const value = effectValue(effect, level);
      return `${effectLabel(effect.target)} ${formatEffectValue(effect, value)}`;
    })
    .join(" / ");
}

function renderCurrencies() {
  if (!ui.metaCurrencies || !metaConfig) return;
  ui.metaCurrencies.innerHTML = Object.entries(metaConfig.currencies)
    .map(([key, config]) => `<span class="meta-currency" style="color:${config.color}">${config.name} ${metaState.currencies[key] || 0}</span>`)
    .join("");
}

function renderHomePanel() {
  if (!metaConfig || !ui.homePanel) return;
  metaState = sanitizeMetaState(metaState);
  if (metaConfig.homeAssets?.background) ui.homePanel.style.setProperty("--home-bg", `url("${optimizedAssetUrl(metaConfig.homeAssets.background)}")`);
  renderCurrencies();
  for (const button of ui.homeTabs.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.tab === activeHomeTab);
  }
  const renderers = {
    chapters: renderChapterTab,
    start: renderStartBuildTab,
    talents: renderTalentTreeTab,
    artifacts: renderArtifactsTab,
    cultivation: renderCultivationTab,
    facilities: renderFacilitiesTab,
  };
  (renderers[activeHomeTab] || renderChapterTab)();
}

function openHomePanel(defaultTab = activeHomeTab) {
  if (!metaConfig || !ui.homePanel) return;
  previousStateBeforeHome = game.state === "home" ? previousStateBeforeHome : game.state;
  activeHomeTab = defaultTab;
  game.state = "home";
  ui.pausePanel.classList.add("hidden");
  ui.upgradePanel.classList.add("hidden");
  ui.resultPanel.classList.add("hidden");
  renderHomePanel();
  ui.homePanel.classList.remove("hidden");
}

function closeHomePanel() {
  if (!metaConfig || !ui.homePanel) return;
  ui.homePanel.classList.add("hidden");
  game.state = previousStateBeforeHome === "paused" ? "paused" : "playing";
  if (game.state === "paused") ui.pausePanel.classList.remove("hidden");
  game.lastFrame = performance.now();
}

function startRunFromHome() {
  resetGame();
  game.state = "playing";
  game.lastFrame = performance.now();
}

function difficultyAllowed(chapterId, difficultyId) {
  return (metaState.unlocks.difficulties[chapterId] || ["mortal"]).includes(difficultyId);
}

function renderChapterTab() {
  ui.homeContent.innerHTML = `${renderHomeBanner("chapters")}<div class="home-grid chapter-grid">${metaConfig.chapters
    .map((chapter) => {
      const locked = !isUnlocked("chapters", chapter.id);
      const selected = metaState.selected.chapterId === chapter.id;
      const record = metaState.records.chapters[chapter.id];
      return `
        <article class="home-card chapter-card ${locked ? "locked" : ""} ${selected ? "selected" : ""}">
          ${homeImage(thumbnailAsset(chapter.background || chapter.fallbackBackground), chapter.name, "home-thumb", chapter.background || chapter.fallbackBackground)}
          <div class="home-card-body">
            <h2>${chapter.name}</h2>
            <p>${chapter.desc}</p>
            <small>Boss：${chapter.bossName} · 最佳 ${record?.bestKills || 0} 斩妖 / ${formatTime(record?.bestTime || 0)}</small>
          </div>
          <div class="difficulty-row">
            ${metaConfig.difficulties
              .map((difficulty) => `<button data-action="select-difficulty" data-chapter="${chapter.id}" data-difficulty="${difficulty.id}" class="${selected && metaState.selected.difficultyId === difficulty.id ? "active" : ""}" ${locked || !difficultyAllowed(chapter.id, difficulty.id) ? "disabled" : ""}>${difficulty.name}</button>`)
              .join("")}
          </div>
          <button data-action="select-chapter" data-id="${chapter.id}" ${locked ? "disabled" : ""}>${selected ? "已选择" : "选择章节"}</button>
        </article>
      `;
    })
    .join("")}</div>`;
}

function selectedBuildSummary() {
  const artifact = mapById(metaConfig.artifacts)[metaState.selected.artifactId];
  const cultivation = mapById(metaConfig.cultivations)[metaState.selected.cultivationId];
  const talents = metaState.selected.startingTalentIds.map((id) => mapById(metaConfig.startingTalents)[id]?.name).filter(Boolean);
  return `
    <div class="build-summary">
      <span>${artifact ? homeImage(artifact.icon, artifact.name, "summary-icon") : ""}<b>本命法宝</b>${artifact?.name || "未选择"} Lv.${metaState.progression.artifacts[artifact?.id] || 1}</span>
      <span><b>初始天赋</b>${talents.length ? talents.join(" / ") : "未选择"}</span>
      <span>${cultivation ? homeImage(cultivation.icon, cultivation.name, "summary-icon") : ""}<b>起手功法</b>${cultivation?.name || "未选择"} Lv.${metaState.progression.cultivations[cultivation?.id] || 1}</span>
    </div>
  `;
}

function renderStartBuildTab() {
  const slots = getStartingTalentSlots();
  const artifactMap = mapById(metaConfig.artifacts);
  const cultivationMap = mapById(metaConfig.cultivations);
  ui.homeContent.innerHTML = `
    ${renderHomeBanner("start")}
    ${selectedBuildSummary()}
    <div class="home-list build-loadout">
      <article class="home-card home-loadout-card">
        <h2>本命法宝</h2>
        <div class="slot-row">${metaConfig.artifacts
          .map((artifact) => `<button data-action="select-artifact" data-id="${artifact.id}" class="choice-chip ${metaState.selected.artifactId === artifact.id ? "active" : ""}" ${!isUnlocked("artifacts", artifact.id) ? "disabled" : ""}>${homeImage(artifact.icon, artifact.name, "chip-icon")}<span>${artifact.shortName || artifact.name}</span></button>`)
          .join("")}</div>
      </article>
      <article class="home-card home-loadout-card">
        <h2>初始天赋 ${metaState.selected.startingTalentIds.length}/${slots}</h2>
        <div class="slot-row">${metaConfig.startingTalents
          .map((talent) => `<button data-action="toggle-talent" data-id="${talent.id}" class="${metaState.selected.startingTalentIds.includes(talent.id) ? "active" : ""}" ${!isUnlocked("startingTalents", talent.id) ? "disabled" : ""}>${talent.name}</button>`)
          .join("")}</div>
        <small>悟道蒲团 3/7 级会增加天赋槽。</small>
      </article>
      <article class="home-card home-loadout-card">
        <h2>起手功法</h2>
        <div class="slot-row">${metaConfig.cultivations
          .map((cultivation) => `<button data-action="select-cultivation" data-id="${cultivation.id}" class="choice-chip ${metaState.selected.cultivationId === cultivation.id ? "active" : ""}" ${!isUnlocked("cultivations", cultivation.id) ? "disabled" : ""}>${homeImage(cultivation.icon || artifactMap[cultivation.spell]?.icon || cultivationMap[cultivation.id]?.icon, cultivation.name, "chip-icon")}<span>${cultivation.name}</span></button>`)
          .join("")}</div>
      </article>
    </div>
  `;
}

function renderTalentTreeTab() {
  ui.homeContent.innerHTML = `${renderHomeBanner("talents")}<div class="home-grid">${metaConfig.talentTrees
    .map((tree) => {
      const level = metaState.progression.talentTree[tree.id] || 0;
      const maxed = level >= tree.maxLevel;
      const cost = maxed ? {} : upgradeCost("talent", tree.id, level);
      return `
        <article class="home-card visual-card">
          ${homeImage(tree.icon, tree.name, "home-icon")}
          <div class="home-card-body">
            <h2>${tree.name} Lv.${level}/${tree.maxLevel}</h2>
            <p>${tree.desc}</p>
            <small>当前：${level ? effectSummary(tree.effects, level) : "未修炼"}<br>里程碑：${Object.entries(tree.milestones || {}).map(([k, v]) => `${k}级 ${v}`).join("；")}</small>
          </div>
          <button data-action="upgrade-talent" data-id="${tree.id}" ${maxed || !hasCurrency(cost) ? "disabled" : ""}>${maxed ? "已圆满" : `升级 ${formatCost(cost)}`}</button>
        </article>
      `;
    })
    .join("")}</div>`;
}

function renderArtifactsTab() {
  ui.homeContent.innerHTML = `${renderHomeBanner("artifacts")}<div class="home-grid">${metaConfig.artifacts
    .map((artifact) => {
      const unlocked = isUnlocked("artifacts", artifact.id);
      const level = metaState.progression.artifacts[artifact.id] || 0;
      const maxed = level >= artifact.maxLevel;
      const cost = unlocked && !maxed ? upgradeCost("artifact", artifact.id, level) : {};
      return `
        <article class="home-card visual-card ${!unlocked ? "locked" : ""} ${metaState.selected.artifactId === artifact.id ? "selected" : ""}">
          ${homeImage(artifact.icon, artifact.name, "home-icon artifact-icon")}
          <div class="home-card-body">
            <h2>${artifact.name} ${unlocked ? `Lv.${level}/${artifact.maxLevel}` : ""}</h2>
            <p>${artifact.desc}</p>
            <small>${artifact.tags?.join(" / ") || ""}${unlocked ? " · " : ""}${unlocked ? effectSummary(artifact.effects, level || 1) : "未解锁"}</small>
          </div>
          <button data-action="select-artifact" data-id="${artifact.id}" ${!unlocked ? "disabled" : ""}>设为本命</button>
          <button data-action="upgrade-artifact" data-id="${artifact.id}" ${!unlocked || maxed || !hasCurrency(cost) ? "disabled" : ""}>${maxed ? "已满级" : `升级 ${formatCost(cost)}`}</button>
        </article>
      `;
    })
    .join("")}</div>`;
}

function renderCultivationTab() {
  ui.homeContent.innerHTML = `${renderHomeBanner("cultivation")}<div class="home-grid">${metaConfig.cultivations
    .map((cultivation) => {
      const unlocked = isUnlocked("cultivations", cultivation.id);
      const level = metaState.progression.cultivations[cultivation.id] || 0;
      const maxed = level >= cultivation.maxLevel;
      const cost = unlocked && !maxed ? upgradeCost("cultivation", cultivation.id, level) : {};
      return `
        <article class="home-card visual-card ${!unlocked ? "locked" : ""} ${metaState.selected.cultivationId === cultivation.id ? "selected" : ""}">
          ${homeImage(cultivation.icon, cultivation.name, "home-icon")}
          <div class="home-card-body">
            <h2>${cultivation.name} ${unlocked ? `Lv.${level}/${cultivation.maxLevel}` : ""}</h2>
            <p>${cultivation.desc}</p>
            <small>${unlocked ? effectSummary(cultivation.effects, level || 1) : "未解锁"}</small>
          </div>
          <button data-action="select-cultivation" data-id="${cultivation.id}" ${!unlocked ? "disabled" : ""}>设为起手</button>
          <button data-action="upgrade-cultivation" data-id="${cultivation.id}" ${!unlocked || maxed || !hasCurrency(cost) ? "disabled" : ""}>${maxed ? "已满级" : `升级 ${formatCost(cost)}`}</button>
        </article>
      `;
    })
    .join("")}</div>`;
}

function renderFacilitiesTab() {
  ui.homeContent.innerHTML = `${renderHomeBanner("facilities")}<div class="home-grid">${metaConfig.facilities
    .map((facility) => {
      const level = metaState.progression.facilities[facility.id] || 0;
      const maxed = level >= facility.maxLevel;
      const cost = maxed ? {} : upgradeCost("facility", facility.id, level);
      return `
        <article class="home-card visual-card">
          ${homeImage(facility.icon, facility.name, "home-icon facility-icon")}
          <div class="home-card-body">
            <h2>${facility.name} Lv.${level}/${facility.maxLevel}</h2>
            <p>${facility.desc}</p>
            <small>当前：${level ? effectSummary(facility.effects, level) : "未建设"}${facility.milestones ? `<br>里程碑：${Object.entries(facility.milestones).map(([k, v]) => `${k}级 ${v}`).join("；")}` : ""}</small>
          </div>
          <button data-action="upgrade-facility" data-id="${facility.id}" ${maxed || !hasCurrency(cost) ? "disabled" : ""}>${maxed ? "已满级" : `升级 ${formatCost(cost)}`}</button>
        </article>
      `;
    })
    .join("")}</div>`;
}

function handleHomeAction(target) {
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !metaState) return;
  if (action === "select-chapter") {
    metaState.selected.chapterId = id;
    const allowed = metaState.unlocks.difficulties[id] || ["mortal"];
    if (!allowed.includes(metaState.selected.difficultyId)) metaState.selected.difficultyId = allowed[0] || "mortal";
  }
  if (action === "select-difficulty") {
    metaState.selected.chapterId = target.dataset.chapter;
    metaState.selected.difficultyId = target.dataset.difficulty;
  }
  if (action === "select-artifact") metaState.selected.artifactId = id;
  if (action === "select-cultivation") metaState.selected.cultivationId = id;
  if (action === "toggle-talent") {
    const list = metaState.selected.startingTalentIds;
    if (list.includes(id)) {
      metaState.selected.startingTalentIds = list.filter((item) => item !== id);
    } else if (list.length < getStartingTalentSlots() && isUnlocked("startingTalents", id)) {
      metaState.selected.startingTalentIds = [...list, id];
    }
  }
  if (action === "upgrade-talent") {
    const tree = mapById(metaConfig.talentTrees)[id];
    const level = metaState.progression.talentTree[id] || 0;
    const cost = upgradeCost("talent", id, level);
    if (tree && level < tree.maxLevel && spendCurrency(cost)) metaState.progression.talentTree[id] = level + 1;
  }
  if (action === "upgrade-artifact") {
    const artifact = mapById(metaConfig.artifacts)[id];
    const level = metaState.progression.artifacts[id] || 1;
    const cost = upgradeCost("artifact", id, level);
    if (artifact && level < artifact.maxLevel && spendCurrency(cost)) metaState.progression.artifacts[id] = level + 1;
  }
  if (action === "upgrade-cultivation") {
    const cultivation = mapById(metaConfig.cultivations)[id];
    const level = metaState.progression.cultivations[id] || 1;
    const cost = upgradeCost("cultivation", id, level);
    if (cultivation && level < cultivation.maxLevel && spendCurrency(cost)) metaState.progression.cultivations[id] = level + 1;
  }
  if (action === "upgrade-facility") {
    const facility = mapById(metaConfig.facilities)[id];
    const level = metaState.progression.facilities[id] || 0;
    const cost = upgradeCost("facility", id, level);
    if (facility && level < facility.maxLevel && spendCurrency(cost)) {
      metaState.progression.facilities[id] = level + 1;
      metaState.selected.startingTalentIds = metaState.selected.startingTalentIds.slice(0, getStartingTalentSlots());
    }
  }
  saveMetaState();
  renderHomePanel();
}

function equipmentSummaryText() {
  const equipped = Object.entries(game.equipment || {})
    .filter(([, state]) => state.tier > 0)
    .map(([slot, state]) => `${theme.equipmentSlots?.[slot]?.name || slot}${state.tier}`);
  return equipped.length ? equipped.join(" / ") : "未着法器";
}

function updateUi() {
  ui.timer.textContent = formatTime(game.time);
  ui.level.textContent = realmLabel(game.player.level);
  ui.kills.textContent = `${theme.copy?.kills || "击退"} ${game.killCount}`;
  const activeWeapons = Object.values(game.weapons).filter((weapon) => weapon.level > 0 || weapon.unlocked);
  ui.weapon.textContent = activeWeapons
    .map((weapon) => (theme.realms ? `${weapon.name} ${weapon.level}重` : `${weapon.name} Lv.${weapon.level}`))
    .join(" / ");
  ui.hpBar.style.width = `${clamp((game.player.hp / game.player.maxHp) * 100, 0, 100)}%`;
  if (ui.energyBar) ui.energyBar.style.width = `${clamp(((game.energy.value || 0) / (game.energy.max || 100)) * 100, 0, 100)}%`;
  ui.xpBar.style.width = `${clamp((game.player.xp / game.player.nextXp) * 100, 0, 100)}%`;
  if (ui.equipmentSummary) {
    ui.equipmentSummary.textContent = equipmentSummaryText();
  }

  const boss = game.enemies.find((enemy) => enemy.type === "boss");
  ui.bossHud.classList.toggle("hidden", !boss);
  if (boss) {
    ui.bossName.textContent = boss.name || game.chapter?.bossName || theme.enemies.boss.name;
    ui.bossBar.style.width = `${clamp((boss.hp / boss.maxHp) * 100, 0, 100)}%`;
  }
}

function update(dt) {
  if (game.state !== "playing") return;
  game.time += dt;
  if (game.runMods.energyRegen) gainEnergy(game.runMods.energyRegen * dt);
  updatePlayer(dt);
  updateCamera(dt);
  updateWaves(dt);
  updateBossRuntime(dt);
  updateBossTelegraphs(dt);
  updateBossHazards(dt);
  updateWeapon(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updatePickups(dt);
  updateEffects(dt);
  updateUi();
}

function drawGrid(rect) {
  const bg = getAsset("background");
  const fallbackBg = getAsset("background:fallback");
  const background = bg || fallbackBg;
  ctx.fillStyle = theme.background?.tint || "#202832";
  ctx.fillRect(0, 0, rect.width, rect.height);
  if (background) {
    drawTiledBackground(background, rect, bg ? 0.58 : 0.3);
  }
  drawWorldReferenceTexture(rect);
}

function drawTiledBackground(background, rect, alpha) {
  const configuredScale = theme.background?.tileScale;
  const scale = configuredScale ?? clamp(rect.height / background.height, 0.58, 0.78);
  const width = Math.max(1, background.width * scale);
  const height = Math.max(1, background.height * scale);
  const offsetX = positiveModulo(-game.camera.x + rect.width / 2, width);
  const offsetY = positiveModulo(-game.camera.y + rect.height / 2, height);

  ctx.save();
  ctx.globalAlpha = alpha;
  for (let x = offsetX - width; x < rect.width + width; x += width) {
    for (let y = offsetY - height; y < rect.height + height; y += height) {
      ctx.drawImage(background, x, y, width, height);
    }
  }
  ctx.restore();
}

function drawWorldReferenceTexture(rect) {
  const minor = 160;
  const major = 320;
  const offsetX = positiveModulo(-game.camera.x + rect.width / 2, minor);
  const offsetY = positiveModulo(-game.camera.y + rect.height / 2, minor);
  ctx.save();
  ctx.lineWidth = 1;
  for (let x = offsetX - minor; x < rect.width + minor; x += minor) {
    const worldX = Math.round(game.camera.x - rect.width / 2 + x);
    const isMajor = Math.abs(positiveModulo(worldX, major)) < 2;
    ctx.strokeStyle = isMajor ? "rgba(185, 231, 255, 0.12)" : "rgba(185, 231, 255, 0.055)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rect.height);
    ctx.stroke();
  }
  for (let y = offsetY - minor; y < rect.height + minor; y += minor) {
    const worldY = Math.round(game.camera.y - rect.height / 2 + y);
    const isMajor = Math.abs(positiveModulo(worldY, major)) < 2;
    ctx.strokeStyle = isMajor ? "rgba(244, 215, 120, 0.105)" : "rgba(244, 215, 120, 0.05)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rect.width, y);
    ctx.stroke();
  }
  drawGroundMotifs(rect);
  ctx.restore();
}

function motifHash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function drawGroundMotifs(rect) {
  const cell = 280;
  const left = game.camera.x - rect.width / 2;
  const top = game.camera.y - rect.height / 2;
  const startX = Math.floor(left / cell) - 1;
  const endX = Math.floor((game.camera.x + rect.width / 2) / cell) + 1;
  const startY = Math.floor(top / cell) - 1;
  const endY = Math.floor((game.camera.y + rect.height / 2) / cell) + 1;

  for (let gx = startX; gx <= endX; gx += 1) {
    for (let gy = startY; gy <= endY; gy += 1) {
      const h = motifHash(gx, gy);
      if (h < 0.34) continue;
      const worldX = gx * cell + cell * (0.18 + motifHash(gx + 13, gy) * 0.64);
      const worldY = gy * cell + cell * (0.2 + motifHash(gx, gy + 17) * 0.6);
      const screenX = worldX - game.camera.x + rect.width / 2;
      const screenY = worldY - game.camera.y + rect.height / 2;
      const radius = 5 + h * 9;
      ctx.strokeStyle = h > 0.72 ? "rgba(142, 247, 255, 0.16)" : "rgba(255, 238, 188, 0.12)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, radius * 1.6, radius * 0.58, h * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
      if (h > 0.82) {
        ctx.fillStyle = "rgba(255, 238, 188, 0.16)";
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function toScreen(entity, rect) {
  return {
    x: entity.x - game.camera.x + rect.width / 2,
    y: entity.y - game.camera.y + rect.height / 2,
  };
}

function colorToRgb(color) {
  const fallback = { r: 142, g: 247, b: 255 };
  if (!color || !color.startsWith("#")) return fallback;
  const hex = color.slice(1);
  if (hex.length !== 6) return fallback;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgba(color, alpha) {
  const { r, g, b } = colorToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRealmAura(p, realm, size) {
  if (!theme.heroRealms) return;
  const color = realm?.auraColor || "#8ef7ff";
  const pulse = Math.sin(performance.now() / 240) * 0.5 + 0.5;
  const fx = game.breakthroughFx;
  const fxProgress = fx ? clamp(fx.age / fx.life, 0, 1) : 1;
  const fxBoost = fx ? (1 - fxProgress) : 0;
  const base = size * (0.42 + fxBoost * 0.08);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = color;
  ctx.shadowBlur = 12 + fxBoost * 18;

  const gradient = ctx.createRadialGradient(0, size * 0.18, base * 0.2, 0, size * 0.2, base * 1.35);
  gradient.addColorStop(0, rgba(color, 0.24 + pulse * 0.08));
  gradient.addColorStop(0.58, rgba(color, 0.09));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.24, base * 1.35, base * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(color, 0.42 + pulse * 0.2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.24, base * 1.02, base * 0.27, 0, 0, Math.PI * 2);
  ctx.stroke();

  const style = realm?.auraStyle;
  if (style === "golden-core" || style === "double-ring" || style === "dharma") {
    ctx.rotate(performance.now() / 1400);
    ctx.strokeStyle = rgba(color, 0.34);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.46, size * 0.62, -0.58, 0, Math.PI * 2);
    ctx.stroke();
    if (style === "double-ring" || style === "dharma") {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.58, size * 0.42, 0.48, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (style === "thunder") {
    ctx.strokeStyle = rgba(color, 0.55);
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i += 1) {
      const angle = performance.now() / 380 + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.24, Math.sin(angle) * size * 0.24);
      ctx.lineTo(Math.cos(angle + 0.24) * size * 0.52, Math.sin(angle + 0.24) * size * 0.52);
      ctx.lineTo(Math.cos(angle - 0.18) * size * 0.68, Math.sin(angle - 0.18) * size * 0.68);
      ctx.stroke();
    }
  }
  if (style === "ascension") {
    ctx.strokeStyle = rgba(color, 0.42);
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * size * 0.18, size * 0.14);
      ctx.quadraticCurveTo(side * size * 0.55, -size * 0.22, side * size * 0.36, -size * 0.58);
      ctx.stroke();
    }
  }
  if (fx) {
    ctx.shadowBlur = 22;
    ctx.strokeStyle = rgba(color, 0.68 * (1 - fxProgress));
    ctx.lineWidth = 4 * (1 - fxProgress) + 1;
    ctx.beginPath();
    ctx.arc(0, 0, size * (0.42 + fxProgress * 0.92), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  if (fx) {
    ctx.save();
    ctx.globalAlpha = 1 - fxProgress;
    ctx.font = `700 ${Math.round(15 + 6 * (1 - fxProgress))}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.lineWidth = 4;
    ctx.fillStyle = color;
    ctx.strokeText(fx.label, p.x, p.y - size * (0.74 + fxProgress * 0.28));
    ctx.fillText(fx.label, p.x, p.y - size * (0.74 + fxProgress * 0.28));
    ctx.restore();
  }
}

function drawPlayer(rect) {
  const p = toScreen(game.player, rect);
  const pulse = game.player.invincible > 0 ? Math.sin(performance.now() / 40) * 0.28 + 0.72 : 1;
  const heroIndex = realmIndex(game.player.level);
  const realm = theme.heroRealms?.[heroIndex];
  if (realm?.asset) loadImageAsset(`hero:${heroIndex}`, realm.asset);
  const fxProgress = game.breakthroughFx ? clamp(game.breakthroughFx.age / game.breakthroughFx.life, 0, 1) : 1;
  const fxScale = game.breakthroughFx ? 1 + Math.sin((1 - fxProgress) * Math.PI) * 0.18 : 1;
  const heroSize = game.player.radius * PLAYER_SPRITE_SCALE * fxScale;
  drawRealmAura(p, realm, heroSize);
  drawPlayerEquipmentLayers(p, "under");
  const sprite = getAsset(`hero:${heroIndex}`) || getAsset("player");
  if (sprite) {
    drawSpriteFitted(getAsset(`hero:${heroIndex}`) ? `hero:${heroIndex}` : "player", p.x, p.y, heroSize, {
      alpha: pulse,
      shadowColor: realm?.auraColor || "#8ef7ff",
      shadowBlur: 12,
    });
  } else if (canUseGeometryFallback(theme.player.asset)) {
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = theme.player.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, game.player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1d1f26";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = theme.player.tieColor;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 2);
  ctx.lineTo(p.x - 5, p.y + 16);
  ctx.lineTo(p.x + 5, p.y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1d1f26";
  ctx.fillRect(p.x - 16, p.y - 26, 32, 8);
  ctx.restore();
  }
  drawPlayerEquipmentLayers(p, "over");

  ctx.strokeStyle = "rgba(85, 200, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, game.player.pickupRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlayerEquipmentLayers(p, layer) {
  if (!theme.equipmentSlots) return;
  const order = Object.keys(theme.equipmentSlots).filter((slot) => (theme.equipmentSlots[slot].layer || "over") === layer);
  const time = performance.now();
  for (const slot of order) {
    const slotConfig = theme.equipmentSlots[slot];
    const tier = game.equipment?.[slot]?.tier || 0;
    if (!tier) continue;
    const key = `equip:${slot}:${tier}`;
    const asset = slotConfig.assets?.[tier - 1];
    if (asset) loadImageAsset(key, asset);
    const image = getAsset(key);
    if (!image) continue;
    const strength = 0.72 + tier * 0.16;
    const anchor = slotConfig.anchor || { x: 0, y: 0 };
    const bob = slot === "artifact" || slot === "talisman" ? Math.sin(time / 360 + tier) * (2 + tier) : 0;
    const orbit = slot === "artifact" ? Math.sin(time / 520) * 6 : 0;
    const x = p.x + anchor.x + orbit;
    const y = p.y + anchor.y + bob;
    const size = game.player.radius * PLAYER_SPRITE_SCALE * (slotConfig.renderScale || 0.65) * strength;
    const color = tier >= 3 ? "#fff6bf" : tier === 2 ? "#b9f3ff" : "#8dffba";

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = rgba(color, 0.34 + tier * 0.08);
    ctx.lineWidth = 1.4 + tier * 0.45;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + tier * 4;
    if (slot === "boots") {
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.14, size * 0.62, size * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (slot === "crown") {
      ctx.beginPath();
      ctx.arc(x, y - size * 0.1, size * 0.46, 0, Math.PI * 2);
      ctx.stroke();
    } else if (slot === "artifact" || slot === "talisman") {
      ctx.beginPath();
      ctx.arc(x, y, size * (slot === "artifact" ? 0.5 : 0.42), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (tier >= 3) {
      ctx.globalAlpha = 0.34 + Math.sin(time / 180) * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.58, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    drawSpriteFitted(key, x, y, size, {
      rotation: slot === "artifact" ? Math.sin(time / 650) * 0.18 : 0,
      shadowColor: color,
      shadowBlur: 12 + tier * 3,
      alpha: slot === "robe" ? 0.54 + tier * 0.08 : 0.95,
      clip: true,
      clipScaleX: slot === "robe" ? 0.42 : slot === "boots" ? 0.48 : 0.5,
      clipScaleY: slot === "robe" ? 0.46 : slot === "boots" ? 0.34 : 0.5,
    });
  }
}

function drawBossAura(enemy, p) {
  const mechanics = enemy.type === "boss" ? game.chapter?.bossMechanics : null;
  if (!mechanics) return;
  const color = mechanics.auraColor || enemy.color || "#f4d778";
  const phase = game.bossRuntime?.enemyId === enemy.id ? game.bossRuntime.phase : 0;
  const time = performance.now();
  const pulse = Math.sin(time / 240) * 0.5 + 0.5;
  const base = enemy.radius * (2.0 + phase * 0.26);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 + phase * 7;

  const gradient = ctx.createRadialGradient(p.x, p.y + enemy.radius * 0.55, base * 0.18, p.x, p.y + enemy.radius * 0.55, base * 1.12);
  gradient.addColorStop(0, rgba(color, 0.25 + pulse * 0.08));
  gradient.addColorStop(0.58, rgba(color, 0.1));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + enemy.radius * 0.72, base * 1.08, base * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgba(color, 0.44 + pulse * 0.16);
  ctx.lineWidth = 2.4 + phase * 0.8;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + enemy.radius * 0.72, base * 0.82, base * 0.24, time / 900, 0, Math.PI * 2);
  ctx.stroke();

  ctx.translate(p.x, p.y + enemy.radius * 0.72);
  ctx.rotate(time / (mechanics.sigil === "thunder" ? 620 : 1200));
  ctx.strokeStyle = rgba(color, 0.4 + phase * 0.08);
  ctx.lineWidth = 1.6 + phase * 0.5;
  const spokes = mechanics.sigil === "claw" ? 5 : mechanics.sigil === "array" ? 8 : mechanics.sigil === "blood" ? 6 : 9;
  for (let i = 0; i < spokes; i += 1) {
    const angle = (Math.PI * 2 * i) / spokes;
    const inner = base * (mechanics.sigil === "blood" ? 0.16 : 0.24);
    const outer = base * (mechanics.sigil === "thunder" ? 0.74 : 0.62);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.42);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * 0.42);
    ctx.stroke();
  }
  if (mechanics.sigil === "thunder") {
    ctx.strokeStyle = rgba("#ffffff", 0.32 + pulse * 0.18);
    for (let i = 0; i < 4; i += 1) {
      const angle = time / 260 + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * base * 0.18, Math.sin(angle) * base * 0.08);
      ctx.lineTo(Math.cos(angle + 0.18) * base * 0.42, Math.sin(angle + 0.18) * base * 0.2);
      ctx.lineTo(Math.cos(angle - 0.16) * base * 0.7, Math.sin(angle - 0.16) * base * 0.33);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBossNameplate(enemy, p) {
  if (enemy.type !== "boss") return;
  const mechanics = game.chapter?.bossMechanics || {};
  const color = mechanics.auraColor || enemy.color || "#f4d778";
  const phase = game.bossRuntime?.enemyId === enemy.id ? game.bossRuntime.phase : 0;
  const y = p.y - enemy.radius * 2.24;
  const width = Math.max(116, enemy.name.length * 17 + 46);
  ctx.save();
  ctx.fillStyle = "rgba(12, 13, 18, 0.72)";
  ctx.strokeStyle = rgba(color, 0.62);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(p.x - width / 2, y - 15, width, 30, 7);
  ctx.fill();
  ctx.stroke();
  ctx.font = "800 15px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.lineWidth = 4;
  ctx.fillStyle = color;
  const label = phase ? `${enemy.name} · ${phase + 1}相` : enemy.name;
  ctx.strokeText(label, p.x, y);
  ctx.fillText(label, p.x, y);
  ctx.restore();
}

function drawEnemy(enemy, rect) {
  const p = toScreen(enemy, rect);
  drawBossAura(enemy, p);
  const sprite = getAsset(enemy.assetKey || `enemy:${enemy.type}`) || getAsset(`enemy:${enemy.type}`);
  const bossScale = enemy.type === "boss" ? game.chapter?.bossMechanics?.displayScale || 1.28 : 1;
  if (sprite) {
    const key = enemy.assetKey || `enemy:${enemy.type}`;
    drawSpriteFitted(key, p.x, p.y, enemy.radius * ENEMY_SPRITE_SCALE * bossScale, {
      alpha: enemy.hitFlash > 0 ? 0.72 : 1,
      shadowColor: enemy.type === "boss" ? game.chapter?.bossMechanics?.auraColor || enemy.color : undefined,
      shadowBlur: enemy.type === "boss" ? 18 : 0,
    });
  } else if (canUseGeometryFallback(theme.enemies[enemy.type]?.asset)) {
    ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, enemy.radius * bossScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1d1f26";
    ctx.lineWidth = enemy.type === "boss" ? 5 : 3;
    ctx.stroke();
    ctx.fillStyle = "#1d1f26";
    ctx.fillRect(p.x - enemy.radius * 0.45, p.y - enemy.radius * 0.22, enemy.radius * 0.3, 4);
    ctx.fillRect(p.x + enemy.radius * 0.15, p.y - enemy.radius * 0.22, enemy.radius * 0.3, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y + enemy.radius * 0.2, enemy.radius * 0.35, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  const hpWidth = enemy.type === "boss" ? enemy.radius * 3.25 : enemy.radius * 2;
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(p.x - hpWidth / 2, p.y - enemy.radius - 11, hpWidth, 4);
  ctx.fillStyle = "#f6e36b";
  ctx.fillRect(p.x - hpWidth / 2, p.y - enemy.radius - 11, hpWidth * clamp(enemy.hp / enemy.maxHp, 0, 1), 4);
  drawBossNameplate(enemy, p);
}

function drawProjectile(projectile, rect) {
  const p = toScreen(projectile, rect);
  const sprite = getAsset(`weapon:${projectile.type}`);
  if (sprite) {
    drawImageCentered(sprite, p.x, p.y, projectile.radius * 5.4, projectile.radius * 5.4, projectile.rotation);
    return;
  }
  if (!canUseGeometryFallback(theme.weapons[projectile.type]?.asset)) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(projectile.rotation);
  if (projectile.type === "invoice") {
    ctx.fillStyle = projectile.color || "#64d5ff";
    ctx.fillRect(-12, -8, 24, 16);
    ctx.fillStyle = "#f7f3e8";
    ctx.fillRect(-8, -4, 16, 3);
    ctx.fillRect(-8, 2, 12, 3);
  } else {
    ctx.fillStyle = "#f6f1d2";
    ctx.fillRect(-14, -5, 28, 10);
    ctx.fillStyle = "#8d9cff";
    ctx.fillRect(-10, -3, 18, 6);
  }
  ctx.restore();
}

function drawPickup(pickup, rect) {
  const p = toScreen(pickup, rect);
  const sprite = getAsset(`pickup:${pickup.type}`);
  if (sprite) {
    drawImageCentered(sprite, p.x, p.y, pickup.radius * 3.8, pickup.radius * 3.8);
    return;
  }
  const pickupAsset = pickup.type === "health" ? theme.pickups?.health?.asset : theme.pickups?.xp?.asset;
  if (!canUseGeometryFallback(pickupAsset)) return;
  ctx.fillStyle = pickup.type === "health" ? theme.pickups?.health?.color || "#71f2a5" : theme.pickups?.xp?.color || "#58d8ff";
  ctx.beginPath();
  ctx.arc(p.x, p.y, pickup.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (pickup.type === "health") {
    ctx.strokeStyle = "#15542c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y);
    ctx.lineTo(p.x + 5, p.y);
    ctx.moveTo(p.x, p.y - 5);
    ctx.lineTo(p.x, p.y + 5);
    ctx.stroke();
  }
}

function drawBossArea(item, rect, alphaMultiplier = 1) {
  const p = toScreen(item, rect);
  const skill = effectiveBossSkill(item);
  const color = item.color || skill.color || "#f4d778";
  const progress = item.telegraph ? clamp(Math.max(0, item.age) / item.telegraph, 0, 1) : 1;
  const alpha = (0.18 + progress * 0.3) * alphaMultiplier;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = rgba(color, Math.min(0.9, alpha + 0.25));
  ctx.fillStyle = rgba(color, alpha);
  ctx.lineWidth = 2 + progress * 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 + progress * 10;
  if (skill.shape === "circle" || skill.shape === "pool") {
    ctx.beginPath();
    ctx.arc(p.x, p.y, skill.radius || 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (skill.shape === "ring") {
    ctx.beginPath();
    ctx.arc(p.x, p.y, skill.radius || 130, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, (skill.radius || 130) - (skill.width || 34), 0, Math.PI * 2);
    ctx.stroke();
  } else if (skill.shape === "line") {
    ctx.translate(p.x, p.y);
    ctx.rotate(item.angle || 0);
    ctx.fillRect(-(skill.length || 320) / 2, -(skill.width || 56) / 2, skill.length || 320, skill.width || 56);
    ctx.strokeRect(-(skill.length || 320) / 2, -(skill.width || 56) / 2, skill.length || 320, skill.width || 56);
  } else if (skill.shape === "cone") {
    const boss = getBossEnemy();
    const origin = boss ? toScreen(boss, rect) : p;
    ctx.translate(origin.x, origin.y);
    ctx.rotate(item.angle || 0);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, skill.radius || 170, -(skill.arc || 0.8), skill.arc || 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (skill.shape === "summon" || skill.shape === "pull") {
    ctx.beginPath();
    ctx.arc(p.x, p.y, skill.radius || 110, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBossMechanics(rect) {
  for (const hazard of game.bossHazards) drawBossArea(hazard, rect, Math.max(0.28, 1 - hazard.age / hazard.duration));
  for (const telegraph of game.bossTelegraphs) drawBossArea(telegraph, rect, 1);
}

function drawBossIntro(rect) {
  if (!game.bossIntro) return;
  const progress = clamp(game.bossIntro.age / game.bossIntro.life, 0, 1);
  const alpha = Math.sin(progress * Math.PI);
  const mechanics = game.chapter?.bossMechanics || {};
  const color = mechanics.auraColor || "#f4d778";
  const y = Math.max(86, rect.height * 0.18);
  const width = Math.min(rect.width - 36, 430);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(9, 11, 15, 0.68)";
  ctx.strokeStyle = rgba(color, 0.62);
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.roundRect((rect.width - width) / 2, y - 40, width, 78, 8);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.lineWidth = 5;
  ctx.fillStyle = color;
  ctx.font = "900 24px Arial, sans-serif";
  ctx.strokeText(game.bossIntro.title || "Boss", rect.width / 2, y - 11);
  ctx.fillText(game.bossIntro.title || "Boss", rect.width / 2, y - 11);
  ctx.font = "700 13px Arial, sans-serif";
  ctx.fillStyle = "rgba(247, 243, 232, 0.92)";
  ctx.strokeText(game.bossIntro.subtitle || "", rect.width / 2, y + 18);
  ctx.fillText(game.bossIntro.subtitle || "", rect.width / 2, y + 18);
  ctx.restore();
}

function drawEffects(rect) {
  for (const particle of game.particles) {
    const p = toScreen(particle, rect);
    ctx.globalAlpha = 1 - particle.age / particle.life;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 16px Arial";
  for (const item of game.texts) {
    const p = toScreen(item, rect);
    ctx.globalAlpha = 1 - item.age / item.life;
    ctx.fillStyle = item.color;
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.lineWidth = 4;
    ctx.strokeText(item.text, p.x, p.y);
    ctx.fillText(item.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function drawJoystick() {
  if (!pointer.active) return;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(pointer.origin.x, pointer.origin.y, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,211,90,0.55)";
  ctx.beginPath();
  ctx.arc(pointer.current.x, pointer.current.y, 24, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  const rect = canvas.getBoundingClientRect();
  const shakeX = game.camera.shake ? rand(-game.camera.shake, game.camera.shake) : 0;
  const shakeY = game.camera.shake ? rand(-game.camera.shake, game.camera.shake) : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawGrid(rect);
  drawBossMechanics(rect);
  for (const pickup of game.pickups) drawPickup(pickup, rect);
  for (const projectile of game.projectiles) drawProjectile(projectile, rect);
  for (const enemy of game.enemies) drawEnemy(enemy, rect);
  drawPlayer(rect);
  drawEffects(rect);
  ctx.restore();
  drawCoffeeAura(rect);
  drawBossIntro(rect);
  drawJoystick();
}

function drawCoffeeAura(rect) {
  const weapon = game.weapons.coffee;
  if (!weapon?.unlocked) return;
  const p = toScreen(game.player, rect);
  const pulse = 0.5 + Math.sin(performance.now() / 130) * 0.08;
  ctx.save();
  ctx.strokeStyle = `rgba(158, 240, 194, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, weapon.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function loop(now) {
  const dt = Math.min(0.033, (now - game.lastFrame) / 1000);
  game.lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p" || event.key === "Escape") {
    if (game.state === "playing") pauseGame();
    else if (game.state === "paused") resumeGame();
    return;
  }
  keys.add(event.key.toLowerCase());
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  if (event.clientX > rect.width * 0.62 || event.clientY < rect.height * 0.36) return;
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
  if (metaConfig) openHomePanel("chapters");
  else resetGame();
});
ui.pauseBtn.addEventListener("click", pauseGame);
ui.resumeBtn.addEventListener("click", resumeGame);
ui.quickRestartBtn.addEventListener("click", resetGame);
ui.homeBtn?.addEventListener("click", () => openHomePanel("chapters"));
ui.startRunBtn?.addEventListener("click", startRunFromHome);
ui.closeHomeBtn?.addEventListener("click", closeHomePanel);
ui.homeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  activeHomeTab = button.dataset.tab;
  renderHomePanel();
});
ui.homeContent?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  handleHomeAction(button);
});

resize();
preloadThemeAssets();
resetGame();
if (debugBossOnLoad) {
  spawnEnemy("boss");
  updateBossRuntime(0.1);
} else if (metaConfig) openHomePanel("chapters");
else ui.homeBtn?.classList.add("hidden");
requestAnimationFrame(loop);
