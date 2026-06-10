import { themes } from "./theme.js";

const params = new URLSearchParams(window.location.search);
const requestedTheme = params.get("theme") || "xianxia";
const debugBossOnLoad = params.get("debugBoss") === "1";
const debugMetaMode = params.get("debugMeta") || "";
const debugFinishOnStart = params.get("debugFinish") === "1";
const debugSecretRoutes = params.get("debugSecret") === "1";
const debugResolveEventId = params.get("debugResolveEvent") || "";
const debugResolveEventChoice = params.get("debugResolveEventChoice") || "";
const debugResolveEventChain = Math.max(0, Math.floor(Number(params.get("debugResolveEventChain") || 0)));
const debugOpenTab = params.get("debugOpenTab") || "";
const debugResultMode = params.get("debugResult") || "";
const debugTargetMaterial = params.get("debugMaterial") || "";
const debugTargetMaterialMode = params.get("debugMaterialMode") || "";
const debugTargetMaterialDifficulty = params.get("debugMaterialDifficulty") || "";
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
  growthBtn: document.querySelector("#growthBtn"),
  dashBtn: document.querySelector("#dashBtn"),
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
  runGoals: document.querySelector("#runGoals"),
  goalToast: document.querySelector("#goalToast"),
  pausePanel: document.querySelector("#pausePanel"),
  pauseBuildSummary: document.querySelector("#pauseBuildSummary"),
  resumeBtn: document.querySelector("#resumeBtn"),
  quickRestartBtn: document.querySelector("#quickRestartBtn"),
  upgradePanel: document.querySelector("#upgradePanel"),
  upgradeChoices: document.querySelector("#upgradeChoices"),
  eventChoicePanel: document.querySelector("#eventChoicePanel"),
  eventChoiceTitle: document.querySelector("#eventChoiceTitle"),
  eventChoiceSubtitle: document.querySelector("#eventChoiceSubtitle"),
  eventChoiceOptions: document.querySelector("#eventChoiceOptions"),
  resultPanel: document.querySelector("#resultPanel"),
  resultText: document.querySelector("#resultText"),
  rewardText: document.querySelector("#rewardText"),
  resultNextSteps: document.querySelector("#resultNextSteps"),
  resultQuestBtn: document.querySelector("#resultQuestBtn"),
  restartBtn: document.querySelector("#restartBtn"),
  homePanel: document.querySelector("#homePanel"),
  metaCurrencies: document.querySelector("#metaCurrencies"),
  homeTabs: document.querySelector("#homeTabs"),
  homeContent: document.querySelector("#homeContent"),
  startRunBtn: document.querySelector("#startRunBtn"),
  closeHomeBtn: document.querySelector("#closeHomeBtn"),
  exportSaveBtn: document.querySelector("#exportSaveBtn"),
  importSaveBtn: document.querySelector("#importSaveBtn"),
  saveDataBox: document.querySelector("#saveDataBox"),
  saveStatus: document.querySelector("#saveStatus"),
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
let focusedMaterials = [];
let targetMaterial = debugTargetMaterial;
let targetMaterialMode = debugTargetMaterial ? (debugTargetMaterialMode === "unlock" ? "unlock" : "farm") : "";
let targetMaterialDifficulty = debugTargetMaterial ? debugTargetMaterialDifficulty : "";
let materialPreviewDifficultyId = "";

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

function mapById(items = []) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function assetUrl(file) {
  return file ? `${theme.assetBase || ""}${file}` : "";
}

function optimizedAssetUrl(file) {
  return file ? assetUrl(optimizedAssetFile(file)) : "";
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

function setQuestBadge(element, count, label = "可领取悬赏") {
  if (!element) return;
  element.querySelector(".quest-badge")?.remove();
  element.classList.toggle("has-quest-badge", count > 0);
  if (count <= 0) {
    element.removeAttribute("data-quest-count");
    return;
  }
  element.dataset.questCount = String(count);
  const badge = document.createElement("span");
  badge.className = "quest-badge";
  badge.textContent = count > 9 ? "9+" : String(count);
  badge.setAttribute("aria-label", `${label} ${count}`);
  element.appendChild(badge);
}

function isCompactHud() {
  return window.matchMedia?.("(max-width: 720px)")?.matches;
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
      claimedQuests: [],
      combos: {},
      events: {},
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
      claimedQuests: unique((state.records || {}).claimedQuests),
      combos: { ...defaults.records.combos, ...((state.records || {}).combos || {}) },
      events: { ...defaults.records.events, ...((state.records || {}).events || {}) },
      chapters: { ...defaults.records.chapters, ...((state.records || {}).chapters || {}) },
    },
  };
}

function loadMetaState() {
  if (!metaConfig) return null;
  try {
    const loaded = sanitizeMetaState(JSON.parse(localStorage.getItem(metaConfig.saveKey) || "null"));
    return applyDebugMetaState(loaded);
  } catch {
    return applyDebugMetaState(createDefaultMetaState());
  }
}

function applyDebugMetaState(state) {
  if (debugMetaMode === "quests") {
    return sanitizeMetaState({
      ...state,
      records: {
        ...state.records,
        runs: Math.max(state.records?.runs || 0, 1),
        totalKills: Math.max(state.records?.totalKills || 0, 120),
        highestRealmLevel: Math.max(state.records?.highestRealmLevel || 1, 4),
        claimedQuests: [],
      },
    });
  }
  if (debugMetaMode === "combos") {
    return sanitizeMetaState({
      ...state,
      currencies: {
        ...state.currencies,
        spiritStone: Math.max(state.currencies?.spiritStone || 0, 9999),
        dao: Math.max(state.currencies?.dao || 0, 9999),
        mysticIron: Math.max(state.currencies?.mysticIron || 0, 9999),
        spiritEssence: Math.max(state.currencies?.spiritEssence || 0, 9999),
        thunderShard: Math.max(state.currencies?.thunderShard || 0, 9999),
      },
      unlocks: {
        ...state.unlocks,
        artifacts: unique([...(state.unlocks?.artifacts || []), "red-lotus-lamp"]),
        cultivations: unique([...(state.unlocks?.cultivations || []), "fire-lotus-scripture"]),
        startingTalents: unique([...(state.unlocks?.startingTalents || []), "talisman-fate", "sword-heart", "full-meridian"]),
      },
      selected: {
        ...state.selected,
        artifactId: "red-lotus-lamp",
        cultivationId: "fire-lotus-scripture",
        startingTalentIds: ["talisman-fate", "sword-heart", "full-meridian"],
      },
      progression: {
        ...state.progression,
        facilities: { ...state.progression?.facilities, cushion: 7 },
        artifacts: { ...state.progression?.artifacts, "red-lotus-lamp": 6 },
        cultivations: { ...state.progression?.cultivations, "fire-lotus-scripture": 3 },
      },
    });
  }
  if (debugMetaMode === "shortage") {
    return sanitizeMetaState({
      ...state,
      currencies: {
        ...state.currencies,
        spiritStone: 0,
        dao: 0,
        mysticIron: 0,
        spiritEssence: 0,
        thunderShard: 0,
      },
      unlocks: {
        ...state.unlocks,
        artifacts: unique([...(state.unlocks?.artifacts || []), "qingming-sword-case"]),
        cultivations: unique([...(state.unlocks?.cultivations || []), "sword-scripture"]),
        startingTalents: unique([...(state.unlocks?.startingTalents || []), "sword-heart"]),
      },
      selected: {
        ...state.selected,
        artifactId: "qingming-sword-case",
        cultivationId: "sword-scripture",
        startingTalentIds: ["sword-heart"],
      },
      progression: {
        ...state.progression,
        talentTree: { ...state.progression?.talentTree, sword: 12, spirit: 12, body: 12, movement: 12 },
        artifacts: { ...state.progression?.artifacts, "qingming-sword-case": 9 },
        cultivations: { ...state.progression?.cultivations, "sword-scripture": 3 },
        facilities: { ...state.progression?.facilities, field: 10, alchemy: 10, forge: 10, library: 10, cushion: 10, "thunder-pool": 10 },
      },
    });
  }
  if (debugMetaMode === "cleared") {
    return sanitizeMetaState({
      ...state,
      unlocks: {
        ...state.unlocks,
        chapters: unique([...(state.unlocks?.chapters || []), "cloud-bamboo-valley"]),
        difficulties: {
          ...state.unlocks?.difficulties,
          "cloud-bamboo-valley": unique([...(state.unlocks?.difficulties?.["cloud-bamboo-valley"] || []), "mortal", "mystic"]),
        },
      },
      records: {
        ...state.records,
        chapters: {
          ...state.records?.chapters,
          "cloud-bamboo-valley": {
            ...(state.records?.chapters?.["cloud-bamboo-valley"] || {}),
            bestDifficulty: "mortal",
            clearedDifficulties: unique([...(state.records?.chapters?.["cloud-bamboo-valley"]?.clearedDifficulties || []), "mortal"]),
            bestTime: Math.max(state.records?.chapters?.["cloud-bamboo-valley"]?.bestTime || 0, 120),
            bestKills: Math.max(state.records?.chapters?.["cloud-bamboo-valley"]?.bestKills || 0, 160),
          },
        },
      },
      selected: {
        ...state.selected,
        chapterId: "cloud-bamboo-valley",
        difficultyId: "mortal",
      },
    });
  }
  if (debugMetaMode !== "milestones") return state;
  const next = sanitizeMetaState({
    ...state,
    currencies: {
      ...state.currencies,
      spiritStone: Math.max(state.currencies?.spiritStone || 0, 9999),
      dao: Math.max(state.currencies?.dao || 0, 9999),
      mysticIron: Math.max(state.currencies?.mysticIron || 0, 9999),
      spiritEssence: Math.max(state.currencies?.spiritEssence || 0, 9999),
      thunderShard: Math.max(state.currencies?.thunderShard || 0, 9999),
    },
    unlocks: {
      ...state.unlocks,
      artifacts: unique([...(state.unlocks?.artifacts || []), "qingming-sword-case"]),
      cultivations: unique([...(state.unlocks?.cultivations || []), "sword-scripture"]),
      startingTalents: unique([...(state.unlocks?.startingTalents || []), "sword-heart"]),
    },
    selected: {
      ...state.selected,
      artifactId: "qingming-sword-case",
      cultivationId: "sword-scripture",
      startingTalentIds: ["sword-heart"],
    },
    progression: {
      ...state.progression,
      talentTree: { ...state.progression?.talentTree, sword: 8, spirit: 5 },
      artifacts: { ...state.progression?.artifacts, "qingming-sword-case": 6 },
    },
  });
  return next;
}

function saveMetaState() {
  if (!metaConfig || !metaState) return;
  localStorage.setItem(metaConfig.saveKey, JSON.stringify(metaState));
}

function setSaveStatus(message, error = false) {
  if (!ui.saveStatus) return;
  ui.saveStatus.textContent = message;
  ui.saveStatus.classList.toggle("error", error);
}

function exportMetaSave() {
  if (!metaConfig || !metaState || !ui.saveDataBox) return;
  ui.saveDataBox.value = JSON.stringify(metaState, null, 2);
  setSaveStatus("已导出当前存档。");
}

function importMetaSave() {
  if (!metaConfig || !ui.saveDataBox) return;
  const raw = ui.saveDataBox.value.trim();
  if (!raw) {
    setSaveStatus("请先粘贴存档 JSON。", true);
    return;
  }
  try {
    metaState = sanitizeMetaState(JSON.parse(raw));
    focusedMaterials = [];
    targetMaterial = "";
    targetMaterialMode = "";
    targetMaterialDifficulty = "";
    materialPreviewDifficultyId = "";
    saveMetaState();
    updateQuestBadges();
    renderHomePanel();
    setSaveStatus("已导入并应用存档。");
  } catch {
    setSaveStatus("存档 JSON 解析失败。", true);
  }
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

function currencyConfig(key) {
  return metaConfig?.currencies?.[key] || { name: key, color: "#f7f3e8", iconText: key.slice(0, 1) };
}

function currencyToken(key, value = null, className = "material-token") {
  const config = currencyConfig(key);
  const amount = value === null || value === undefined ? "" : ` ${Math.floor(value)}`;
  return `<span class="${className}" style="--material-color:${config.color || "#f7f3e8"}"><b>${config.iconText || config.name.slice(0, 1)}</b>${config.name}${amount}</span>`;
}

function rewardChip({ title, detail = "", asset = "", color = "#f7f3e8", tone = "default", iconText = "" }) {
  const icon = asset ? homeImage(asset, title, "reward-chip-icon", asset) : `<span class="reward-chip-glyph">${iconText || title.slice(0, 1)}</span>`;
  return `
    <span class="reward-chip ${tone}" style="--reward-chip-color:${color}">
      ${icon}
      <span class="reward-chip-text">
        <b>${title}</b>
        ${detail ? `<small>${detail}</small>` : ""}
      </span>
    </span>
  `;
}

function difficultyRewardChip(chapter, difficultyId) {
  const difficulty = mapById(metaConfig.difficulties || [])[difficultyId];
  if (!chapter || !difficulty) return "";
  return rewardChip({
    title: difficulty.name,
    detail: `${chapter.name}新难度`,
    asset: thumbnailAsset(chapter.background || chapter.fallbackBackground),
    tone: "unlock",
  });
}

function rewardCurrencyChips(chapter, difficulty) {
  const estimate = chapterDropEstimate(chapter, difficulty);
  return Object.entries(estimate)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => {
      const config = currencyConfig(key);
      return rewardChip({
        title: config.name,
        detail: `预计 ${Math.floor(amount)}`,
        color: config.color || "#f7f3e8",
        tone: "currency",
        iconText: config.iconText || config.name.slice(0, 1),
      });
    })
    .join("");
}

function firstClearRewardChips(chapter) {
  const unlocks = chapter.firstClearUnlocks || {};
  const chapterMap = mapById(metaConfig.chapters || []);
  const artifactMap = mapById(metaConfig.artifacts || []);
  const talentMap = mapById(metaConfig.startingTalents || []);
  const cultivationMap = mapById(metaConfig.cultivations || []);
  const rows = [
    ...(unlocks.chapters || []).map((id) => {
      const item = chapterMap[id];
      return item ? rewardChip({ title: item.name, detail: "新章节", asset: thumbnailAsset(item.background || item.fallbackBackground), tone: "unlock" }) : "";
    }),
    ...(unlocks.artifacts || []).map((id) => {
      const item = artifactMap[id];
      return item ? rewardChip({ title: item.shortName || item.name, detail: "法宝解锁", asset: item.icon, tone: "unlock" }) : "";
    }),
    ...(unlocks.startingTalents || []).map((id) => {
      const item = talentMap[id];
      return item ? rewardChip({ title: item.name, detail: "天赋解锁", asset: item.icon, tone: "unlock" }) : "";
    }),
    ...(unlocks.cultivations || []).map((id) => {
      const item = cultivationMap[id];
      return item ? rewardChip({ title: item.name, detail: "功法解锁", asset: item.icon, tone: "unlock" }) : "";
    }),
  ].filter(Boolean);
  return rows.join("") || `<span class="home-muted">高难与材料收益</span>`;
}

function chapterRewardChipRows(chapter, difficulty) {
  return `
    <div class="reward-chip-groups">
      <div class="reward-chip-group">
        <span class="reward-chip-label">掉落</span>
        ${rewardCurrencyChips(chapter, difficulty)}
      </div>
      <div class="reward-chip-group">
        <span class="reward-chip-label">首通</span>
        ${firstClearRewardChips(chapter)}
      </div>
    </div>
  `;
}

function renderFirstClearRewardSummary() {
  const snapshot = game.runStats.firstClearRewards;
  if (!snapshot || !metaConfig) return "";
  const chapterMap = mapById(metaConfig.chapters || []);
  const artifactMap = mapById(metaConfig.artifacts || []);
  const talentMap = mapById(metaConfig.startingTalents || []);
  const cultivationMap = mapById(metaConfig.cultivations || []);
  const difficultyMap = mapById(metaConfig.difficulties || []);
  const chapter = chapterMap[snapshot.chapterId];
  const difficulty = difficultyMap[snapshot.difficultyId];
  const chips = [
    ...(snapshot.chapters || []).map((id) => {
      const item = chapterMap[id];
      return item ? rewardChip({ title: item.name, detail: "新章节", asset: thumbnailAsset(item.background || item.fallbackBackground), tone: "unlock" }) : "";
    }),
    ...(snapshot.artifacts || []).map((id) => {
      const item = artifactMap[id];
      return item ? rewardChip({ title: item.shortName || item.name, detail: "法宝解锁", asset: item.icon, tone: "unlock" }) : "";
    }),
    ...(snapshot.startingTalents || []).map((id) => {
      const item = talentMap[id];
      return item ? rewardChip({ title: item.name, detail: "天赋解锁", asset: item.icon, tone: "unlock" }) : "";
    }),
    ...(snapshot.cultivations || []).map((id) => {
      const item = cultivationMap[id];
      return item ? rewardChip({ title: item.name, detail: "功法解锁", asset: item.icon, tone: "unlock" }) : "";
    }),
    snapshot.difficultyUnlockId ? difficultyRewardChip(chapter, snapshot.difficultyUnlockId) : "",
  ].filter(Boolean);
  if (!chips.length) return "";
  return `
    <div class="first-clear-reward-summary">
      <strong>首通奖励</strong>
      <small>${chapter?.name || "当前章节"} · ${difficulty?.name || "当前难度"}</small>
      <div class="reward-chip-group">${chips.join("")}</div>
    </div>
  `;
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

function formatCostTokens(cost, className = "material-token") {
  return Object.entries(cost || {})
    .filter(([, value]) => value > 0)
    .map(([key, value]) => currencyToken(key, value, className))
    .join("");
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

const damageSourceFallbacks = {
  keyboard: "御剑成阵",
  coffee: "业火莲华",
  invoice: "雷符万钧",
  fireThunder: "火莲引雷",
  swordTalisman: "飞剑附符",
  ultimate: "天劫雷瀑",
  unknown: "散修余威",
};

const enemyAffixes = {
  swift: { id: "swift", name: "迅捷", color: "#b9f3ff", desc: "移速提高，逼迫玩家走位。" },
  armored: { id: "armored", name: "厚甲", color: "#f4d778", desc: "气血提高，优先用高伤害法术处理。" },
  leech: { id: "leech", name: "噬灵", color: "#d68cff", desc: "碰撞命中会额外损耗灵力。" },
};

function damageSourceName(source) {
  if (source === "ultimate") return theme.spells?.ultimate?.name || damageSourceFallbacks.ultimate;
  return theme.weapons?.[source]?.name || damageSourceFallbacks[source] || damageSourceFallbacks.unknown;
}

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

function comboRecord(id) {
  return metaState?.records?.combos?.[id] || null;
}

function updateComboRecordsAfterRun() {
  if (!metaState?.records || !game.runStats?.combos) return;
  if (!metaState.records.combos) metaState.records.combos = {};
  for (const combo of spellCombos) {
    const count = game.runStats.combos[combo.id] || 0;
    if (count <= 0) continue;
    const existing = metaState.records.combos[combo.id] || {};
    metaState.records.combos[combo.id] = {
      bestCount: Math.max(existing.bestCount || 0, count),
      lastCount: count,
      runs: (existing.runs || 0) + 1,
      bestChapter: count > (existing.bestCount || 0) ? game.chapter?.id || existing.bestChapter || "" : existing.bestChapter || "",
      bestDifficulty: count > (existing.bestCount || 0) ? game.difficulty?.id || existing.bestDifficulty || "" : existing.bestDifficulty || "",
    };
  }
}

window.demoGame = {
  snapshot() {
    return {
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
      balance: getBalanceSnapshot(),
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
    updateUi();
  },
  debugSpawnBoss() {
    if (game.state === "home") startRunFromHome();
    game.enemies = game.enemies.filter((enemy) => enemy.type !== "boss");
    spawnEnemy("boss");
    updateBossRuntime(0.1);
    return this.snapshot();
  },
  debugSpawnMaterialDrops(rewards = { mysticIron: 1, spiritEssence: 2 }) {
    if (game.state === "home") startRunFromHome();
    spawnRewardPickups(game.player.x + 16, game.player.y - 12, rewards);
    return this.snapshot();
  },
  debugSpawnRunEvent(eventId = "") {
    if (game.state === "home") startRunFromHome();
    spawnRunEvent(eventId);
    return this.snapshot();
  },
  debugCollectNearbyPickups() {
    if (game.state !== "playing") return this.snapshot();
    for (const pickup of game.pickups) {
      pickup.x = game.player.x;
      pickup.y = game.player.y;
    }
    updatePickups(1 / 30);
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
    metaState = createDefaultMetaState();
    saveMetaState();
    renderHomePanel();
    return metaState;
  },
  finishRun() {
    finishRun();
    return this.snapshot();
  },
  setMetaDebugState(options = {}) {
    if (!metaConfig) return null;
    metaState = sanitizeMetaState({
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
    });
    saveMetaState();
    renderHomePanel();
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

function cloneWeapons() {
  return Object.fromEntries(Object.entries(theme.weapons).map(([key, weapon]) => [key, { ...weapon, timer: 0 }]));
}

function createEquipmentState() {
  return Object.fromEntries(Object.keys(theme.equipmentSlots || {}).map((slot) => [slot, { tier: 0 }]));
}

function getBalanceConfig() {
  return theme.balance || null;
}

function xpRequiredForLevel(level) {
  const curve = game.balance?.xpCurve;
  if (!curve) return game.player.nextXp ? Math.floor(game.player.nextXp * 1.32 + 16) : 36;
  const zeroBasedLevel = Math.max(0, level - 1);
  return Math.round((curve.base || 90) * Math.pow(curve.growth || 1.38, zeroBasedLevel) + (curve.flatAdd || 0) * zeroBasedLevel);
}

function xpForEnemy(type, fallback) {
  const curve = game.balance?.xpCurve;
  if (!curve) return fallback;
  if (type === "manager") return curve.minEnemyXp ?? fallback;
  if (type === "director") return curve.eliteXp ?? fallback;
  if (type === "boss") return curve.bossXp ?? fallback;
  return fallback;
}

function bossAtForChapter(chapter = game.chapter) {
  const target = game.balance?.bossTargets?.chapterBossAt?.[chapter?.id] ?? chapter?.bossAt;
  const multiplier = game.balance?.difficultyPacing?.[game.difficulty?.id]?.bossAtMultiplier || 1;
  return typeof target === "number" ? Math.round(target * multiplier) : target;
}

function bossHpForChapter(chapter = game.chapter, fallback) {
  const target = game.balance?.bossTargets?.chapterBossHp?.[chapter?.id] ?? fallback;
  const multiplier = game.balance?.difficultyPacing?.[game.difficulty?.id]?.bossHpMultiplier || 1;
  return typeof target === "number" ? Math.round(target * multiplier) : target;
}

function recordBalanceMetric(key, value) {
  if (!game.runStats.balance) game.runStats.balance = {};
  if (typeof game.runStats.balance[key] === "undefined") game.runStats.balance[key] = value;
}

function getBalanceSnapshot() {
  return {
    enabled: Boolean(game.balance),
    targets: structuredClone(game.balance?.runTargets || {}),
    xpCurve: structuredClone(game.balance?.xpCurve || {}),
    bossTargets: structuredClone(game.balance?.bossTargets || {}),
    difficultyPacing: structuredClone(game.balance?.difficultyPacing || {}),
    firstUpgradeTime: game.runStats?.balance?.firstUpgradeTime ?? null,
    bossSpawnTime: game.runStats?.balance?.bossSpawnTime ?? null,
    bossKillTime: game.runStats?.balance?.bossKillTime ?? null,
    bossTtk: game.runStats?.balance?.bossTtk ?? null,
    upgradeChoices: game.runStats?.breakthroughs || 0,
    nextXp: game.player?.nextXp || 0,
  };
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

function applyMilestoneEffects(item, level = 0) {
  for (const [milestone, effects] of Object.entries(item?.milestoneEffects || {})) {
    if (level >= Number(milestone)) applyEffects(effects, level);
  }
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
    applyMilestoneEffects(tree, level);
  }

  for (const facility of metaConfig.facilities || []) {
    const level = Math.min(facility.maxLevel || 10, metaState.progression.facilities[facility.id] || 0);
    if (level > 0) applyEffects(facility.effects, level);
  }

  const artifact = artifactMap[metaState.selected.artifactId];
  const artifactLevel = metaState.progression.artifacts[artifact?.id] || 1;
  if (artifact) {
    applyEffects(artifact.effects, artifactLevel);
    applyMilestoneEffects(artifact, artifactLevel);
  }

  const cultivation = cultivationMap[metaState.selected.cultivationId];
  const cultivationLevel = metaState.progression.cultivations[cultivation?.id] || 1;
  if (cultivation) applyEffects(cultivation.effects, cultivationLevel);

  for (const talentId of metaState.selected.startingTalentIds || []) {
    const talent = talentMap[talentId];
    if (talent) applyEffects(talent.effects, 1);
  }

  for (const synergy of activeBuildSynergies()) applyEffects(synergy.effects, 1);

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
    damageBySource: {},
    dashes: 0,
    affixes: {},
    balance: {},
    goalNotices: [],
    combos: {},
    events: { spring: 0, chest: 0, rewards: {}, details: {} },
    blessings: {},
    pickupRewards: {},
    rewards: null,
    unlocks: [],
    firstClearRewards: null,
  };
}

function resetGame() {
  game.state = "playing";
  game.time = 0;
  game.killCount = 0;
  game.nextEntityId = 1;
  game.chapter = getSelectedChapter();
  game.difficulty = getSelectedDifficulty();
  game.balance = getBalanceConfig();
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
    dashCooldown: 0,
    dashDuration: 0,
    dashCooldownMax: 2.4,
    dashDurationMax: 0.18,
    dashSpeed: 760,
    dashDir: { x: 1, y: 0 },
    lastMoveDir: { x: 1, y: 0 },
  };
  game.weapons = cloneWeapons();
  game.equipment = createEquipmentState();
  game.energy = { value: 0, max: 100, gainMultiplier: 1 };
  game.ultimate = { damage: theme.spells?.ultimate?.damage || 95 };
  game.combos = { fireThunderTimer: 0, swordTalismanTimer: 0 };
  game.runMods = {
    xpMultiplier: 0,
    energyRegen: 0,
    killHeal: 0,
    eliteDamageBonus: 0,
    healMultiplier: 0,
    reward: { spiritStoneMultiplier: 0 },
  };
  game.runStats = createRunStats();
  game.player.nextXp = xpRequiredForLevel(game.player.level);
  game.bossRuntime = null;
  game.bossTelegraphs = [];
  game.bossHazards = [];
  game.bossIntro = null;
  game.events = { nextAt: debugMetaMode === "events" ? 3 : 28, spawned: 0 };
  clearGoalToastTimer();
  game.goalToast = null;
  game.goalToastQueue = [];
  game.goalTrackingActive = false;
  game.activeEventChallenge = null;
  game.activeEventChoice = null;
  game.spellPowerBonus = 0;
  game.breakthroughFx = null;
  applyMetaProgressionToRun();
  ui.upgradePanel.classList.add("hidden");
  ui.eventChoicePanel?.classList.add("hidden");
  ui.resultPanel.classList.add("hidden");
  ui.resultQuestBtn?.classList.add("hidden");
  ui.runGoals?.classList.toggle("hidden", !metaConfig);
  ui.goalToast?.classList.add("hidden");
  ui.pausePanel.classList.add("hidden");
  ui.homePanel?.classList.add("hidden");
  document.querySelector(".brand strong").textContent = theme.name;
  setHudMetric(ui.hpLabel, "hp", "", theme.copy?.hp || "生命");
  setHudMetric(ui.energyLabel, "energy", "", theme.copy?.energy || "能量");
  setHudMetric(ui.xpLabel, "xp", "", theme.copy?.xp || "经验");
  setHudMetric(ui.growthBtn, "realm", "成长", "局内成长");
  setHudMetric(ui.dashBtn, "movement", "闪避", "闪避");
  setHudMetric(ui.homeBtn, "home", "洞府", "洞府");
  setHudMetric(ui.pauseBtn, "pause", "暂停", "暂停");
  ui.resumeBtn.textContent = theme.copy?.resume || "继续割草";
  ui.quickRestartBtn.textContent = theme.copy?.restart || "重新开始";
  document.querySelector("#pausePanel h1").textContent = theme.copy?.pause || "暂停中";
  document.querySelector("#upgradePanel h1").textContent = theme.copy?.upgradeTitle || "升职加薪！";
  document.querySelector("#upgradePanel p").textContent = theme.copy?.upgradeSubtitle || "选一个能力继续割草";
  document.querySelector("#resultPanel h1").textContent = theme.copy?.resultTitle || "今日绩效结算";
  ui.restartBtn.textContent = theme.copy?.restart || "再卷一局";
  updateUi();
  updateQuestBadges();
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
  if (debugMetaMode === "combos" && type !== "boss") {
    const angle = rand(0, Math.PI * 2);
    const range = Math.max(48, (game.weapons.coffee?.radius || 90) - 12);
    spawnEnemyAt(type, game.player.x + Math.cos(angle) * range, game.player.y + Math.sin(angle) * range, {
      hp: Math.max(140, theme.enemies[type]?.hp || 36),
      speed: Math.max(16, theme.enemies[type]?.speed || 48),
    });
    return;
  }
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

function affixChanceForDifficulty() {
  if (debugMetaMode === "affixes") return 0.9;
  if (game.difficulty?.id === "heaven") return 0.36;
  if (game.difficulty?.id === "mystic") return 0.22;
  return 0;
}

function chooseEnemyAffix(type) {
  if (type === "boss" || Math.random() > affixChanceForDifficulty()) return null;
  const pool = game.difficulty?.id === "heaven"
    ? ["swift", "armored", "leech"]
    : ["swift", "armored"];
  return enemyAffixes[pool[Math.floor(Math.random() * pool.length)]] || null;
}

function applyEnemyAffixStats(enemy, affix) {
  if (!affix) return enemy;
  enemy.affix = affix;
  if (affix.id === "swift") enemy.speed *= 1.34;
  if (affix.id === "armored") {
    enemy.hp = Math.round(enemy.hp * 1.45);
    enemy.maxHp = Math.round(enemy.maxHp * 1.45);
    enemy.radius += 2;
  }
  if (affix.id === "leech") enemy.damage = Math.round(enemy.damage * 0.9);
  game.runStats.affixes[affix.id] = (game.runStats.affixes[affix.id] || 0) + 1;
  return enemy;
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
    ? { ...config, hp: bossHpForChapter(game.chapter, config.hp), name: game.chapter.bossName || config.name, asset: game.chapter.bossAsset || config.asset }
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
    xp: xpForEnemy(type, enemyConfig.xp),
    color: overrides.color || enemyConfig.color,
    name: overrides.name || enemyConfig.name,
    asset: overrides.asset || enemyConfig.asset,
    assetKey,
    hitFlash: 0,
    bossSummon: overrides.bossSummon || false,
    eventChallengeId: overrides.eventChallengeId || "",
  };
  applyEnemyAffixStats(enemy, overrides.affix || chooseEnemyAffix(type));
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

function defaultRunEvents() {
  return [
    {
      id: "spring",
      kind: "spring",
      label: "灵泉",
      summary: "回血与灵力",
      color: "#8dffba",
      radius: 18,
      healRatio: 0.22,
      energy: 30,
    },
    {
      id: "chest",
      kind: "chest",
      label: "秘匣",
      summary: "额外结算资源",
      color: "#f4d778",
      radius: 17,
      rewardsByDifficulty: {
        mortal: { spiritStone: 20, dao: 2 },
        mystic: { spiritStone: 28, dao: 3, mysticIron: 1 },
        heaven: { spiritStone: 36, dao: 4, thunderShard: 1 },
      },
    },
  ];
}

function currentRunEvents() {
  return game.chapter?.runEvents?.length ? game.chapter.runEvents : defaultRunEvents();
}

function getRunEventConfig(eventId) {
  const current = currentRunEvents().find((item) => item.id === eventId);
  if (current) return current;
  for (const chapter of metaConfig?.chapters || []) {
    const match = (chapter.runEvents || []).find((item) => item.id === eventId);
    if (match) return match;
  }
  return defaultRunEvents().find((item) => item.id === eventId) || null;
}

function resolveEventCurrencies(config, field, difficulty = game.difficulty || getSelectedDifficulty()) {
  if (!config) return {};
  const difficultyId = difficulty?.id || "mortal";
  const byDifficulty = config[`${field}ByDifficulty`];
  if (byDifficulty?.[difficultyId]) return { ...byDifficulty[difficultyId] };
  return { ...(config[field] || {}) };
}

function resolveEventValue(config, field, difficulty = game.difficulty || getSelectedDifficulty()) {
  if (!config) return 0;
  const difficultyId = difficulty?.id || "mortal";
  const byDifficulty = config[`${field}ByDifficulty`];
  if (Number.isFinite(byDifficulty?.[difficultyId])) return byDifficulty[difficultyId];
  return Number.isFinite(config[field]) ? config[field] : 0;
}

function resolveEventAmbush(config, difficulty = game.difficulty || getSelectedDifficulty()) {
  if (!config) return {};
  const difficultyId = difficulty?.id || "mortal";
  const byDifficulty = config.ambushByDifficulty;
  if (byDifficulty?.[difficultyId]) return { ...byDifficulty[difficultyId] };
  return { ...(config.ambush || {}) };
}

function resolveEventChallenge(config, difficulty = game.difficulty || getSelectedDifficulty()) {
  if (!config) return null;
  const difficultyId = difficulty?.id || "mortal";
  const byDifficulty = config.challengeByDifficulty;
  const challenge = byDifficulty?.[difficultyId] || config.challenge;
  return challenge ? structuredClone(challenge) : null;
}

function ambushSummaryText(ambush = {}) {
  const enemyNames = {
    manager: theme.enemies?.manager?.name || "小妖",
    director: theme.enemies?.director?.name || "精英",
    boss: theme.enemies?.boss?.name || "Boss",
  };
  return Object.entries(ambush)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([key, value]) => `${enemyNames[key] || key} ${value}`)
    .join(" / ");
}

function challengeRewardSummary(challenge = {}) {
  const successText = [formatCost(challenge.successRewards || {}), formatCost(challenge.successPickupRewards || {})].filter(Boolean).join(" / ");
  const failText = [formatCost(challenge.failRewards || {}), formatCost(challenge.failPickupRewards || {})].filter(Boolean).join(" / ");
  const rows = [];
  if (successText) rows.push(`成功 ${successText}`);
  if (failText) rows.push(`失败 ${failText}`);
  return rows.join(" / ");
}

function challengeStateText(challenge = {}, includeRewards = false) {
  if (!challenge) return "";
  const parts = [];
  if (challenge.result === "success") {
    parts.push(`试炼成功 ${challenge.defeated || challenge.targetCount || 0}/${challenge.targetCount || challenge.defeated || 0}`);
  } else if (challenge.result === "fail") {
    parts.push(`试炼失守 ${challenge.defeated || 0}/${challenge.targetCount || 0}`);
  } else if (challenge.active && Number.isFinite(challenge.targetCount)) {
    parts.push(`试炼进行中 ${challenge.defeated || 0}/${challenge.targetCount}`);
  } else if (Number.isFinite(challenge.targetCount)) {
    parts.push(`试炼 ${challenge.targetCount}`);
  }
  if (includeRewards && challenge.rewardText) parts.push(challenge.rewardText);
  return parts.join(" / ");
}

function resolveEventChoices(config, difficulty = game.difficulty || getSelectedDifficulty()) {
  if (!config) return [];
  const difficultyId = difficulty?.id || "mortal";
  const byDifficulty = config.choicesByDifficulty;
  const choices = byDifficulty?.[difficultyId] || config.choices || [];
  return choices.length ? structuredClone(choices) : [];
}

function resolveEventChance(config, difficulty = game.difficulty || getSelectedDifficulty()) {
  if (!config) return 0;
  const difficultyId = difficulty?.id || "mortal";
  const byDifficulty = config.chanceByDifficulty;
  if (Number.isFinite(byDifficulty?.[difficultyId])) return clamp(byDifficulty[difficultyId], 0, 1);
  return Number.isFinite(config.chance) ? clamp(config.chance, 0, 1) : 0;
}

function isHiddenRunEvent(config) {
  return Boolean(config?.hidden);
}

function hasSeenRunEvent(eventId) {
  return Boolean(metaState?.records?.events?.[eventId]?.count);
}

function shouldRevealRunEvent(config) {
  return !isHiddenRunEvent(config) || hasSeenRunEvent(config.id);
}

function resolveEventSecretFollowup(config, difficulty = game.difficulty || getSelectedDifficulty()) {
  if (!config?.secretFollowup?.eventId) return null;
  const secret = structuredClone(config.secretFollowup);
  secret.chance = debugSecretRoutes ? 1 : resolveEventChance(config.secretFollowup, difficulty);
  return secret;
}

function blessingSummaryText(blessing = {}) {
  return blessing.summary || effectSummary(blessing.effects || [], 1) || "";
}

function followupEventSummary(eventId, options = {}) {
  const config = getRunEventConfig(eventId);
  if (!config) return eventId || "";
  if (isHiddenRunEvent(config) && !options.revealHidden && !shouldRevealRunEvent(config)) {
    return options.hiddenLabel || "隐秘机缘";
  }
  return `${config.label}${config.summary ? ` · ${config.summary}` : ""}`;
}

function formatChancePercent(chance = 0) {
  return `${Math.round(clamp(chance, 0, 1) * 100)}%`;
}

function eventFollowupTargets(config, difficulty = game.difficulty || getSelectedDifficulty()) {
  const targets = resolveEventChoices(config, difficulty)
    .filter((choice) => choice.followupEventId)
    .map((choice) => ({
      routeLabel: choice.label,
      eventId: choice.followupEventId,
      hidden: Boolean(getRunEventConfig(choice.followupEventId)?.hidden),
      chance: 1,
      kind: "chain",
    }));
  const secret = resolveEventSecretFollowup(config, difficulty);
  if (secret?.eventId) {
    targets.push({
      routeLabel: secret.routeLabel || "秘径",
      eventId: secret.eventId,
      hidden: Boolean(getRunEventConfig(secret.eventId)?.hidden),
      chance: secret.chance,
      announceText: secret.announceText || "",
      kind: "secret",
    });
  }
  return targets;
}

function eventFollowupHintText(target) {
  const chanceText = target.kind === "secret" && target.chance > 0 && target.chance < 1 ? ` ${formatChancePercent(target.chance)}` : "";
  return `${target.routeLabel}${chanceText} -> ${followupEventSummary(target.eventId)}`;
}

function runEventChoiceSummary(row) {
  const choices = Object.values(row?.choices || {});
  if (!choices.length) return "";
  return `抉择 ${choices.map((choice) => `${choice.label}${choice.count > 1 ? ` ${choice.count}次` : ""}`).join(" / ")}`;
}

function runEventBlessingSummary(row) {
  const blessings = Object.values(row?.blessings || {});
  if (!blessings.length) return "";
  return `加持 ${blessings.map((blessing) => `${blessing.label}${blessing.summary ? ` · ${blessing.summary}` : ""}`).join(" / ")}`;
}

function runEventFollowupSummary(row) {
  const followups = Object.values(row?.followups || {});
  if (!followups.length) return "";
  return `连锁 ${followups.map((item) => `${item.label}${item.count > 1 ? ` ${item.count}次` : ""}`).join(" / ")}`;
}

function activeRunBlessingRows() {
  return Object.values(game.runStats?.blessings || {})
    .filter((row) => row.count > 0)
    .map((row) => ({
      ...row,
      text: `${row.label}${row.count > 1 ? ` ×${row.count}` : ""}${row.summary ? ` · ${row.summary}` : ""}`,
    }));
}

function updateMetaEventRecord(config, payload = {}) {
  if (!metaState?.records || !config?.id) return;
  if (!metaState.records.events) metaState.records.events = {};
  const existing = metaState.records.events[config.id] || {
    id: config.id,
    label: config.label,
    summary: config.summary || "",
    count: 0,
    chapters: [],
    difficulties: [],
    choices: {},
    blessings: {},
    followups: {},
  };
  existing.label = config.label || existing.label;
  existing.summary = config.summary || existing.summary;
  existing.count += 1;
  if (game.chapter?.id) existing.chapters = unique([...(existing.chapters || []), game.chapter.id]);
  if (game.difficulty?.id) existing.difficulties = unique([...(existing.difficulties || []), game.difficulty.id]);
  if (payload.choice?.id) {
    const row = existing.choices[payload.choice.id] || { label: payload.choice.label, count: 0, summary: payload.choice.summary || "" };
    row.label = payload.choice.label || row.label;
    row.count += 1;
    if (payload.choice.summary) row.summary = payload.choice.summary;
    existing.choices[payload.choice.id] = row;
  }
  if (payload.blessing?.id) {
    const row = existing.blessings[payload.blessing.id] || { label: payload.blessing.label, count: 0, summary: payload.blessing.summary || "" };
    row.label = payload.blessing.label || row.label;
    row.count += 1;
    if (payload.blessing.summary) row.summary = payload.blessing.summary;
    existing.blessings[payload.blessing.id] = row;
  }
  const followups = payload.followups || (payload.followup ? [payload.followup] : []);
  for (const followup of followups) {
    if (!followup?.id) continue;
    const row = existing.followups[followup.id] || { label: followup.label, count: 0 };
    row.label = followup.label || row.label;
    row.count += 1;
    existing.followups[followup.id] = row;
  }
  metaState.records.events[config.id] = existing;
}

function recordRunEvent(config, payload = {}) {
  if (!config) return;
  const events = game.runStats.events;
  if (!events.details) events.details = {};
  const entry = events.details[config.id] || {
    label: config.label,
    summary: config.summary || "",
    count: 0,
    rewards: {},
    pickupRewards: {},
    totalHeal: 0,
    totalEnergy: 0,
    totalDamage: 0,
    ambush: {},
    challenge: null,
    choices: {},
    blessings: {},
    followups: {},
  };
  entry.count += 1;
  entry.summary = config.summary || entry.summary;
  entry.totalHeal += payload.heal || 0;
  entry.totalEnergy += payload.energy || 0;
  entry.totalDamage += payload.damage || 0;
  for (const [key, value] of Object.entries(payload.rewards || {})) {
    entry.rewards[key] = (entry.rewards[key] || 0) + value;
  }
  for (const [key, value] of Object.entries(payload.pickupRewards || {})) {
    entry.pickupRewards[key] = (entry.pickupRewards[key] || 0) + value;
  }
  for (const [key, value] of Object.entries(payload.ambush || {})) {
    entry.ambush[key] = (entry.ambush[key] || 0) + value;
  }
  if (payload.challenge) entry.challenge = { ...(entry.challenge || {}), ...payload.challenge };
  if (payload.choice?.id) {
    const current = entry.choices[payload.choice.id] || { label: payload.choice.label, count: 0 };
    current.label = payload.choice.label || current.label;
    current.count += 1;
    if (payload.choice.summary) current.summary = payload.choice.summary;
    entry.choices[payload.choice.id] = current;
  }
  if (payload.blessing?.id) {
    const current = entry.blessings[payload.blessing.id] || { label: payload.blessing.label, count: 0, summary: payload.blessing.summary || "" };
    current.label = payload.blessing.label || current.label;
    current.count += 1;
    if (payload.blessing.summary) current.summary = payload.blessing.summary;
    entry.blessings[payload.blessing.id] = current;
  }
  const followups = payload.followups || (payload.followup ? [payload.followup] : []);
  for (const followup of followups) {
    if (!followup?.id) continue;
    const current = entry.followups[followup.id] || { label: followup.label, count: 0 };
    current.label = followup.label || current.label;
    current.count += 1;
    entry.followups[followup.id] = current;
  }
  events.details[config.id] = entry;
  updateMetaEventRecord(config, payload);
  if (config.kind === "spring") events.spring += 1;
  if (config.kind === "chest") events.chest += 1;
}

function patchRunEventDetail(eventId, patch = {}) {
  if (!eventId) return;
  const events = game.runStats.events;
  if (!events.details) events.details = {};
  const entry = events.details[eventId];
  if (!entry) return;
  for (const [key, value] of Object.entries(patch.rewards || {})) {
    entry.rewards[key] = (entry.rewards[key] || 0) + value;
  }
  for (const [key, value] of Object.entries(patch.pickupRewards || {})) {
    entry.pickupRewards[key] = (entry.pickupRewards[key] || 0) + value;
  }
  if (patch.challenge) entry.challenge = { ...(entry.challenge || {}), ...patch.challenge };
}

function recordRunBlessing(blessing, sourceLabel = "") {
  if (!blessing?.id) return null;
  if (!game.runStats.blessings) game.runStats.blessings = {};
  const existing = game.runStats.blessings[blessing.id] || {
    id: blessing.id,
    label: blessing.label || "临时加持",
    count: 0,
    summary: blessingSummaryText(blessing),
    sources: [],
  };
  existing.label = blessing.label || existing.label;
  existing.summary = blessingSummaryText(blessing) || existing.summary;
  existing.count += 1;
  if (sourceLabel) existing.sources = unique([...(existing.sources || []), sourceLabel]);
  game.runStats.blessings[blessing.id] = existing;
  return existing;
}

function spawnConfiguredRunEvent(config, options = {}) {
  if (!config) return null;
  const angle = options.angle ?? Math.random() * Math.PI * 2;
  const distanceFromPlayer = options.distance ?? rand(180, 310);
  const origin = options.origin || game.player;
  game.pickups.push({
    id: game.nextEntityId++,
    type: "event",
    eventType: config.id,
    eventKind: config.kind || config.id,
    label: config.label,
    color: config.color,
    x: origin.x + Math.cos(angle) * distanceFromPlayer,
    y: origin.y + Math.sin(angle) * distanceFromPlayer,
    radius: config.radius,
    age: 0,
    life: 24,
    magnet: false,
  });
  game.events.spawned += 1;
  game.events.lastEventId = config.id;
  addText(options.announceText || `${config.label}现世`, game.player.x, game.player.y - 88, config.color);
  return config;
}

function spawnRunEvent(eventId = "", options = {}) {
  const events = currentRunEvents();
  if (!events.length) return null;
  const explicit = eventId ? events.find((item) => item.id === eventId) : null;
  if (explicit) return spawnConfiguredRunEvent(explicit, options);
  const previousEventId = game.events.lastEventId || "";
  const pool = events.length > 1 ? events.filter((item) => item.id !== previousEventId) : events;
  const config = pool[Math.floor(Math.random() * pool.length)] || events[0];
  return spawnConfiguredRunEvent(config, options);
}

function spawnEventAmbush(ambush = {}, source = {}) {
  const entries = Object.entries(ambush).filter(([, value]) => Number.isFinite(value) && value > 0);
  for (const [type, count] of entries) {
    for (let index = 0; index < count; index += 1) {
      const angle = rand(0, Math.PI * 2);
      const radius = rand(120, 185);
      spawnEnemyAt(type, game.player.x + Math.cos(angle) * radius, game.player.y + Math.sin(angle) * radius, {
        color: source.color,
        affix: null,
        eventChallengeId: source.challengeId || "",
      });
    }
  }
  if (entries.length) {
    game.camera.shake = Math.max(game.camera.shake, 10);
    addText("伏击骤起！", game.player.x, game.player.y - 62, source.color || "#ff8a8a");
  }
}

function startEventChallenge(config, challenge, ambush = {}) {
  if (!config || !challenge) return null;
  if (game.activeEventChallenge && !game.activeEventChallenge.resolved) resolveActiveEventChallenge(false);
  const targetCount = Math.max(1, challenge.targetCount || Object.values(ambush).reduce((sum, value) => sum + value, 0));
  const active = {
    id: `${config.id}:${game.time}:${Math.random()}`,
    eventId: config.id,
    label: config.label,
    summary: config.summary || "",
    startedAt: game.time,
    endsAt: game.time + Math.max(4, challenge.duration || 12),
    targetCount,
    defeated: 0,
    successRewards: { ...(challenge.successRewards || {}) },
    successPickupRewards: { ...(challenge.successPickupRewards || {}) },
    failRewards: { ...(challenge.failRewards || {}) },
    failPickupRewards: { ...(challenge.failPickupRewards || {}) },
    ambush: { ...ambush },
    resolved: false,
    result: "",
  };
  game.activeEventChallenge = active;
  patchRunEventDetail(config.id, {
    challenge: {
      active: true,
      result: "",
      targetCount: active.targetCount,
      defeated: 0,
      rewardText: challengeRewardSummary(challenge),
    },
  });
  return active;
}

function resolveActiveEventChallenge(success) {
  const challenge = game.activeEventChallenge;
  if (!challenge || challenge.resolved) return;
  challenge.resolved = true;
  challenge.result = success ? "success" : "fail";
  const rewardDelta = success ? challenge.successRewards : challenge.failRewards;
  const pickupDelta = success ? challenge.successPickupRewards : challenge.failPickupRewards;
  if (Object.keys(rewardDelta || {}).length) addEventReward(rewardDelta);
  if (Object.keys(pickupDelta || {}).length) {
    spawnRewardPickups(game.player.x + 12, game.player.y - 8, pickupDelta, { radius: 10, spread: 16 });
  }
  patchRunEventDetail(challenge.eventId, {
    rewards: rewardDelta,
    pickupRewards: pickupDelta,
    challenge: {
      active: false,
      result: challenge.result,
      targetCount: challenge.targetCount,
      defeated: Math.min(challenge.targetCount, challenge.defeated),
      rewardText: challengeRewardSummary({
        successRewards: challenge.successRewards,
        successPickupRewards: challenge.successPickupRewards,
        failRewards: challenge.failRewards,
        failPickupRewards: challenge.failPickupRewards,
      }),
    },
  });
  const title = success ? `${challenge.label} 试炼完成` : `${challenge.label} 试炼失守`;
  const detail = [ambushSummaryText(challenge.ambush), formatCost(rewardDelta), formatCost(pickupDelta)].filter(Boolean).join(" / ") || "只保住了基础收益";
  pushGoalNotice(`event:${challenge.id}:${challenge.result}`, title, detail);
  addText(title, game.player.x, game.player.y - 86, success ? "#9dffca" : "#ff9a9a");
  game.activeEventChallenge = null;
}

function updateEventChallenge() {
  const challenge = game.activeEventChallenge;
  if (!challenge || challenge.resolved || game.state !== "playing") return;
  if (challenge.defeated >= challenge.targetCount) {
    resolveActiveEventChallenge(true);
    return;
  }
  if (game.time >= challenge.endsAt) resolveActiveEventChallenge(false);
}

function updateRunEvents(_dt) {
  if (!game.events) return;
  if (game.time < (game.events.nextAt || 0)) return;
  spawnRunEvent();
  game.events.nextAt = game.time + rand(32, 46);
}

function addEventReward(delta) {
  const rewards = game.runStats.events.rewards;
  for (const [key, value] of Object.entries(delta || {})) {
    rewards[key] = (rewards[key] || 0) + value;
  }
}

function addPickupReward(delta) {
  const rewards = game.runStats.pickupRewards;
  for (const [key, value] of Object.entries(delta || {})) {
    rewards[key] = (rewards[key] || 0) + value;
  }
}

function spawnMaterialPickup(x, y, currencyKey, value, options = {}) {
  if (!currencyKey || !Number.isFinite(value) || value <= 0) return;
  const config = currencyConfig(currencyKey);
  game.pickups.push({
    id: game.nextEntityId++,
    type: "material",
    currencyKey,
    label: config.name,
    iconText: config.iconText || config.name.slice(0, 1),
    color: config.color || "#f7f3e8",
    x,
    y,
    value: Math.floor(value),
    radius: options.radius || 11,
    age: 0,
    magnet: false,
  });
}

function spawnRewardPickups(x, y, rewards = {}, options = {}) {
  const entries = Object.entries(rewards).filter(([, value]) => Number.isFinite(value) && value > 0);
  if (!entries.length) return;
  const spread = options.spread || 20;
  entries.forEach(([currencyKey, value], index) => {
    const angle = entries.length === 1 ? rand(0, Math.PI * 2) : (Math.PI * 2 * index) / entries.length;
    const distanceFromSource = entries.length === 1 ? 0 : spread + index * 4;
    spawnMaterialPickup(
      x + Math.cos(angle) * distanceFromSource,
      y + Math.sin(angle) * distanceFromSource,
      currencyKey,
      value,
      options,
    );
  });
}

function resolveRunEventOutcome(config, choice = null) {
  const source = choice ? { ...config, label: choice.label || config.label, summary: choice.summary || config.summary, color: choice.color || config.color } : config;
  const mergeRewardMaps = (base = {}, extra = {}) => {
    const merged = { ...base };
    for (const [key, value] of Object.entries(extra || {})) merged[key] = (merged[key] || 0) + value;
    return merged;
  };
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const choiceOverridesDamage = choice && (hasOwn(choice, "damage") || hasOwn(choice, "damageByDifficulty"));
  const choiceOverridesAmbush = choice && (hasOwn(choice, "ambush") || hasOwn(choice, "ambushByDifficulty"));
  const choiceOverridesChallenge = choice && (hasOwn(choice, "challenge") || hasOwn(choice, "challengeByDifficulty"));
  const healRatio = typeof (choice && hasOwn(choice, "healRatio") ? choice.healRatio : config.healRatio) === "number"
    ? (choice && hasOwn(choice, "healRatio") ? choice.healRatio : config.healRatio)
    : 0;
  const heal = healRatio ? Math.round(game.player.maxHp * healRatio) : 0;
  return {
    source,
    displayLabel: choice ? `${config.label}·${choice.label || "抉择"}` : config.label,
    heal,
    energy: Math.round(choice && hasOwn(choice, "energy") ? choice.energy || 0 : config.energy || 0),
    rewards: mergeRewardMaps(resolveEventCurrencies(config, "rewards"), choice ? resolveEventCurrencies(choice, "rewards") : {}),
    pickupRewards: mergeRewardMaps(resolveEventCurrencies(config, "pickupRewards"), choice ? resolveEventCurrencies(choice, "pickupRewards") : {}),
    damage: choiceOverridesDamage ? resolveEventValue(choice, "damage") : resolveEventValue(config, "damage"),
    ambush: choiceOverridesAmbush ? resolveEventAmbush(choice) : resolveEventAmbush(config),
    challenge: choiceOverridesChallenge ? resolveEventChallenge(choice) : resolveEventChallenge(config),
    followupEventId: choice?.followupEventId || config.followupEventId || "",
    secretFollowup: choice?.secretFollowup ? resolveEventSecretFollowup(choice) : resolveEventSecretFollowup(config),
    choice: choice
      ? {
          id: choice.id,
          label: choice.label || "抉择",
          summary: choice.summary || "",
        }
      : null,
    blessing: choice?.blessing ? structuredClone(choice.blessing) : source.blessing ? structuredClone(source.blessing) : null,
  };
}

function runEventOutcomeParts(outcome) {
  return [
    outcome.heal > 0 ? `气血 +${outcome.heal}` : "",
    outcome.energy > 0 ? `灵力 +${outcome.energy}` : "",
    outcome.damage > 0 ? `代价 -${outcome.damage}` : "",
    Object.keys(outcome.ambush || {}).length ? `伏击 ${ambushSummaryText(outcome.ambush)}` : "",
    outcome.challenge ? `试炼 ${Math.round((outcome.challenge.duration || 12) * 10) / 10}s` : "",
    formatCost(outcome.rewards),
    Object.keys(outcome.pickupRewards || {}).length ? `掉落 ${formatCost(outcome.pickupRewards)}` : "",
    outcome.blessing ? `加持 ${outcome.blessing.label}${blessingSummaryText(outcome.blessing) ? ` · ${blessingSummaryText(outcome.blessing)}` : ""}` : "",
  ].filter(Boolean);
}

function applyRunEventBlessing(blessing, sourceLabel = "") {
  if (!blessing?.effects?.length) return null;
  const previousMaxHp = game.player.maxHp;
  applyEffects(blessing.effects, 1);
  const maxHpGain = Math.max(0, game.player.maxHp - previousMaxHp);
  if (maxHpGain > 0) game.player.hp = Math.min(game.player.maxHp, game.player.hp + maxHpGain);
  game.player.hp = clamp(game.player.hp, 0, game.player.maxHp);
  game.energy.value = clamp(game.energy.value || 0, 0, game.energy.max || 100);
  return recordRunBlessing(blessing, sourceLabel);
}

function triggerRunEventFollowup(config, followupEventId, options = {}) {
  if (!followupEventId || game.state !== "playing") return null;
  if (!game.runStats.eventChains) game.runStats.eventChains = {};
  const chainKey = `${options.chainType || "chain"}:${config.id}->${followupEventId}`;
  if (game.runStats.eventChains[chainKey]) return null;
  const followup = getRunEventConfig(followupEventId);
  if (!followup) return null;
  game.runStats.eventChains[chainKey] = (game.runStats.eventChains[chainKey] || 0) + 1;
  spawnConfiguredRunEvent(followup, {
    distance: options.distance ?? 118,
    origin: game.player,
    announceText: options.announceText || `${followup.label}被引动`,
  });
  return {
    id: followup.id,
    label: followup.label,
    kind: options.chainType || "chain",
  };
}

function maybeTriggerRunEventFollowups(config, outcome) {
  if (game.state !== "playing") return [];
  const triggered = [];
  if (outcome?.followupEventId) {
    const normal = triggerRunEventFollowup(config, outcome.followupEventId, { chainType: "chain" });
    if (normal) triggered.push(normal);
  }
  const secret = outcome?.secretFollowup;
  if (secret?.eventId && secret.chance > 0 && Math.random() <= secret.chance) {
    const rare = triggerRunEventFollowup(config, secret.eventId, {
      chainType: "secret",
      distance: 132,
      announceText: secret.announceText || "隐秘机缘显现",
    });
    if (rare) triggered.push(rare);
  }
  return triggered;
}

function applyRunEventOutcome(config, pickup, choice = null) {
  const outcome = resolveRunEventOutcome(config, choice);
  if (outcome.heal > 0) game.player.hp = Math.min(game.player.maxHp, game.player.hp + outcome.heal);
  if (outcome.energy > 0) gainEnergy(outcome.energy);
  if (Object.keys(outcome.rewards).length) addEventReward(outcome.rewards);
  if (Object.keys(outcome.pickupRewards).length) {
    spawnRewardPickups(pickup.x, pickup.y, outcome.pickupRewards, { radius: 10, spread: 14 });
  }
  const actualDamage = outcome.damage > 0 ? damagePlayerFromBoss(outcome.damage, { color: outcome.source.color || "#ff7676" }) : 0;
  const recordedBlessing = outcome.blessing ? applyRunEventBlessing(outcome.blessing, config.label) : null;
  const canContinue = game.state === "playing";
  const activeChallenge = canContinue && outcome.challenge ? startEventChallenge(config, outcome.challenge, outcome.ambush) : null;
  if (Object.keys(outcome.ambush).length && canContinue) {
    spawnEventAmbush(outcome.ambush, { ...outcome.source, challengeId: activeChallenge?.id || "" });
  }
  const triggeredFollowups = canContinue ? maybeTriggerRunEventFollowups(config, outcome) : [];
  recordRunEvent(config, {
    heal: outcome.heal,
    energy: outcome.energy,
    damage: actualDamage,
    rewards: outcome.rewards,
    pickupRewards: outcome.pickupRewards,
    ambush: outcome.ambush,
    choice: outcome.choice,
    blessing: recordedBlessing
      ? {
          id: recordedBlessing.id,
          label: recordedBlessing.label,
          summary: recordedBlessing.summary,
        }
      : null,
    followups: triggeredFollowups,
    challenge: activeChallenge
      ? {
          active: true,
          result: "",
          targetCount: activeChallenge.targetCount,
          defeated: 0,
          rewardText: challengeRewardSummary(outcome.challenge),
        }
      : null,
  });
  if (game.state !== "ended") {
    const followupText = triggeredFollowups.length ? ` / 连锁 ${triggeredFollowups.map((item) => item.label).join(" / ")}` : "";
    addText(
      `${outcome.displayLabel} ${runEventOutcomeParts({ ...outcome, damage: actualDamage }).join(" / ")}${followupText}`.trim(),
      game.player.x,
      game.player.y - 42,
      pickup.color || outcome.source.color || "#f4d778",
    );
    addBurst(pickup.x, pickup.y, pickup.color || outcome.source.color || "#f4d778", config.kind === "spring" ? 18 : 20);
  }
}

function renderRunEventChoicePanel() {
  const pending = game.activeEventChoice;
  if (!pending || !ui.eventChoicePanel || !ui.eventChoiceOptions) return;
  if (ui.eventChoiceTitle) ui.eventChoiceTitle.textContent = `${pending.config.label} · 抉择`;
  if (ui.eventChoiceSubtitle) {
    ui.eventChoiceSubtitle.textContent = pending.config.choicePrompt || pending.config.summary || "此番机缘，可择一路。";
  }
  ui.eventChoiceOptions.innerHTML = pending.options
    .map((choice) => {
      const outcome = resolveRunEventOutcome(pending.config, choice);
      const choiceSummary = [choice.desc || choice.summary || "", ...runEventOutcomeParts(outcome)].filter(Boolean).join(" / ");
      return `
        <button class="choice run-event-choice" data-kind="${choice.kind || "fate"}" data-choice-id="${choice.id}" type="button">
          <span class="choice-meta">
            <b class="choice-tag">奇遇</b>
            <b class="choice-rarity">${choice.rarity || "机缘"}</b>
          </span>
          <strong class="run-event-choice-title">${choice.label}</strong>
          <span class="choice-desc">${choiceSummary}</span>
        </button>
      `;
    })
    .join("");
  ui.eventChoicePanel.classList.remove("hidden");
}

function openRunEventChoice(config, pickup) {
  const options = resolveEventChoices(config);
  if (!options.length || !ui.eventChoicePanel || !ui.eventChoiceOptions) return false;
  game.activeEventChoice = {
    config,
    pickup: { x: pickup.x, y: pickup.y, color: pickup.color || config.color || "#f4d778" },
    options,
  };
  game.state = "event-choice";
  renderRunEventChoicePanel();
  updateUi();
  return true;
}

function selectRunEventChoice(choiceId) {
  const pending = game.activeEventChoice;
  if (!pending) return false;
  const choice = pending.options.find((item) => item.id === choiceId) || pending.options[0];
  ui.eventChoicePanel?.classList.add("hidden");
  game.activeEventChoice = null;
  if (game.state === "event-choice") game.state = "playing";
  applyRunEventOutcome(pending.config, pending.pickup, choice);
  updateUi();
  return true;
}

function pickupBonusForBoss(drops = {}) {
  const scale = game.difficulty?.id === "heaven" ? 0.22 : game.difficulty?.id === "mystic" ? 0.18 : 0.15;
  const bonus = {};
  for (const [key, amount] of Object.entries(drops)) {
    if (!Number.isFinite(amount) || amount <= 0) continue;
    bonus[key] = key === "thunderShard" ? 1 : Math.max(1, Math.floor(amount * scale));
  }
  return bonus;
}

function rewardPickupsForEnemy(enemy) {
  if (enemy.type === "director") {
    const chance = game.difficulty?.id === "heaven" ? 0.8 : game.difficulty?.id === "mystic" ? 0.55 : 0.35;
    return Math.random() < chance ? { mysticIron: 1 } : null;
  }
  if (enemy.type === "boss") {
    return pickupBonusForBoss(game.chapter?.drops || {});
  }
  return null;
}

function collectRunEvent(pickup) {
  const config = getRunEventConfig(pickup.eventType) || {
    id: pickup.eventType,
    kind: pickup.eventKind || pickup.eventType,
    label: pickup.label || "奇遇",
    summary: "",
  };
  if (resolveEventChoices(config).length && openRunEventChoice(config, pickup)) return;
  applyRunEventOutcome(config, pickup);
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

function startDash() {
  if (game.state !== "playing" || game.player.dashCooldown > 0 || game.player.dashDuration > 0) return false;
  const input = currentInputVector();
  const dir = input.x || input.y ? input : game.player.lastMoveDir || { x: 1, y: 0 };
  game.player.dashDir = normalize(dir.x, dir.y);
  game.player.lastMoveDir = { ...game.player.dashDir };
  game.player.dashDuration = game.player.dashDurationMax;
  game.player.dashCooldown = game.player.dashCooldownMax;
  game.player.invincible = Math.max(game.player.invincible, game.player.dashDurationMax + 0.08);
  game.runStats.dashes += 1;
  game.camera.shake = Math.max(game.camera.shake, 5);
  addText("踏风", game.player.x, game.player.y - 44, "#b9f3ff");
  addBurst(game.player.x, game.player.y, "#b9f3ff", 10);
  updateUi();
  return true;
}

function updatePlayer(dt) {
  const input = currentInputVector();
  if (input.x || input.y) game.player.lastMoveDir = { ...input };
  game.player.dashCooldown = Math.max(0, game.player.dashCooldown - dt);
  if (game.player.dashDuration > 0) {
    const step = Math.min(dt, game.player.dashDuration);
    game.player.x += game.player.dashDir.x * game.player.dashSpeed * step;
    game.player.y += game.player.dashDir.y * game.player.dashSpeed * step;
    game.player.dashDuration = Math.max(0, game.player.dashDuration - dt);
    game.player.invincible = Math.max(game.player.invincible, 0.06);
  } else if (input.x || input.y) {
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
    const waveAt = wave.type === "boss" && bossAtForChapter() ? bossAtForChapter() : wave.at;
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
        if (wave.type === "boss") recordBalanceMetric("bossSpawnTime", game.time);
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
    const effectiveSkill = effectiveBossSkillConfig(skill);
    runtime.cooldowns[skill.id] = (runtime.cooldowns[skill.id] || effectiveSkill.cooldown || 6) - dt;
    if (runtime.cooldowns[skill.id] <= 0) {
      scheduleBossSkill(boss, skill, runtime);
      runtime.cooldowns[skill.id] = Math.max(1.4, (effectiveSkill.cooldown || 6) * (runtime.phase >= 2 ? 0.78 : runtime.phase >= 1 ? 0.88 : 1));
      break;
    }
  }
}

function bossSkillModsForDifficulty(difficulty = game.difficulty) {
  return difficulty?.bossSkillMods || {};
}

function effectiveBossSkillConfig(skill, difficulty = game.difficulty) {
  const mods = bossSkillModsForDifficulty(difficulty);
  return {
    ...skill,
    cooldown: (skill.cooldown || 6) * (mods.cooldown || 1),
    telegraph: Math.max(0.45, (skill.telegraph || 0.75) * (mods.telegraph || 1)),
    damage: Math.round((skill.damage || 0) * (mods.damage || 1)),
    duration: skill.duration ? skill.duration * (mods.duration || 1) : skill.duration,
    count: skill.count ? skill.count + (mods.countBonus || 0) : skill.count,
    eliteCount: skill.eliteCount ? skill.eliteCount + Math.max(0, Math.floor((mods.countBonus || 0) / 2)) : skill.eliteCount,
  };
}

function scheduleBossSkill(boss, skill, runtime, options = {}) {
  const effectiveSkill = effectiveBossSkillConfig(skill);
  const angleToPlayer = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
  const items = expandBossSkillTargets(boss, effectiveSkill, angleToPlayer, runtime);
  for (const target of items) {
    game.bossTelegraphs.push({
      id: `${effectiveSkill.id}-${game.time}-${Math.random()}`,
      skill: effectiveSkill,
      bossId: boss.id,
      x: target.x,
      y: target.y,
      angle: target.angle ?? angleToPlayer,
      age: target.delay ? -target.delay : 0,
      telegraph: target.telegraph || effectiveSkill.telegraph || 0.75,
      color: target.color || effectiveSkill.color || runtime.mechanics.auraColor || "#f4d778",
      effect: target.effect || null,
    });
  }
  addText(options.phaseBurst ? `阶段技：${effectiveSkill.name}` : effectiveSkill.name, boss.x, boss.y - boss.radius - 38, effectiveSkill.color || runtime.mechanics.auraColor || "#f4d778");
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
    const offsets = (skill.count || 3) >= 5 ? [-0.96, -0.48, 0, 0.48, 0.96] : [-0.72, 0, 0.72];
    return offsets.map((offset, index) => ({ x: boss.x, y: boss.y, angle: angleToPlayer + offset, delay: index * 0.08, color }));
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
    const offsets = (skill.count || 4) >= 6 ? [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI / 8, -Math.PI / 8] : [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
    return offsets.map((offset, index) => ({
      x: game.player.x,
      y: game.player.y,
      angle: offset,
      delay: index * 0.06,
      color,
    }));
  }
  if (skill.pattern === "parallelLines") {
    const normal = angleToPlayer + Math.PI / 2;
    const offsets = (skill.count || 3) >= 5 ? [-128, -64, 0, 64, 128] : [-74, 0, 74];
    return offsets.map((offset, index) => ({
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
    const offsets = (skill.count || 3) >= 5 ? [-92, -46, 0, 46, 92] : [-46, 0, 46];
    return offsets.map((offset, index) => ({
      x: baseTarget.x + Math.cos(normal) * offset,
      y: baseTarget.y + Math.sin(normal) * offset,
      angle: angleToPlayer + (index - (offsets.length - 1) / 2) * 0.08,
      delay: index * 0.05,
      color,
    }));
  }
  if (skill.pattern === "prisonPlusStrikes") {
    const extraStrikes = Math.max(0, (skill.count || 3) - 3);
    return [
      { x: game.player.x, y: game.player.y, angle: angleToPlayer, color },
      { x: game.player.x + rand(-140, 140), y: game.player.y + rand(-110, 110), angle: angleToPlayer, delay: 0.18, effect: { shape: "circle", radius: 72 }, color: "#f4dd72" },
      { x: game.player.x + rand(-170, 170), y: game.player.y + rand(-130, 130), angle: angleToPlayer, delay: 0.3, effect: { shape: "circle", radius: 72 }, color: "#f4dd72" },
      ...Array.from({ length: extraStrikes }, (_, index) => ({
        x: game.player.x + rand(-190, 190),
        y: game.player.y + rand(-145, 145),
        angle: angleToPlayer,
        delay: 0.42 + index * 0.1,
        effect: { shape: "circle", radius: 72 },
        color: "#f4dd72",
      })),
    ];
  }
  return [baseTarget];
}

function damagePlayerFromBoss(amount, source) {
  if (game.player.invincible > 0 || game.state !== "playing") return 0;
  const damage = Math.max(1, Math.round(amount * (1 - (game.player.damageReduction || 0))));
  game.player.hp -= damage;
  game.runStats.damageTaken += damage;
  game.player.invincible = 0.35;
  game.camera.shake = Math.max(game.camera.shake, 8);
  addText(`-${damage}`, game.player.x, game.player.y - 24, source?.color || "#ff7676");
  addBurst(game.player.x, game.player.y, source?.color || "#ff7676", 8);
  if (game.player.hp <= 0) finishRun();
  return damage;
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
      if (damagePlayerFromBoss(enemy.damage, { color: enemy.affix?.color || enemy.color }) && enemy.affix?.id === "leech") {
        const drain = Math.min(game.energy.value || 0, 16);
        game.energy.value = Math.max(0, (game.energy.value || 0) - drain);
        addText(`灵力 -${Math.round(drain)}`, game.player.x, game.player.y - 46, enemy.affix.color);
      }
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
      source: "keyboard",
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
      source: "invoice",
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

function triggerFireThunderCombo(enemy) {
  const fire = game.weapons.coffee;
  const thunder = game.weapons.invoice;
  if (!fire?.unlocked || !thunder?.unlocked || !enemy || game.combos.fireThunderTimer > 0) return false;
  if (!game.enemies.some((item) => item.id === enemy.id)) return false;
  const damage = Math.max(1, Math.round((fire.damage * 0.55 + thunder.damage * 0.75) * (1 + game.spellPowerBonus)));
  game.combos.fireThunderTimer = 0.72;
  game.runStats.combos.fireThunder = (game.runStats.combos.fireThunder || 0) + 1;
  addText("火莲引雷", enemy.x, enemy.y - enemy.radius - 24, "#f3df78");
  addBurst(enemy.x, enemy.y, "#f3df78", 14);
  damageEnemy(enemy, damage, "fireThunder");
  game.camera.shake = Math.max(game.camera.shake, 7);
  return true;
}

function triggerSwordTalismanCombo(enemy) {
  const sword = game.weapons.keyboard;
  const thunder = game.weapons.invoice;
  if (!sword || (!sword.unlocked && sword.level <= 0)) return false;
  if (!thunder?.unlocked || !enemy || game.combos.swordTalismanTimer > 0) return false;
  if (!game.enemies.some((item) => item.id === enemy.id)) return false;
  const damage = Math.max(1, Math.round((sword.damage * 0.28 + thunder.damage * 0.48) * (1 + game.spellPowerBonus)));
  game.combos.swordTalismanTimer = 0.58;
  game.runStats.combos.swordTalisman = (game.runStats.combos.swordTalisman || 0) + 1;
  addText("飞剑附符", enemy.x, enemy.y - enemy.radius - 42, "#d6c2ff");
  addBurst(enemy.x, enemy.y, "#d6c2ff", 10);
  damageEnemy(enemy, damage, "swordTalisman");
  game.camera.shake = Math.max(game.camera.shake, 5);
  return true;
}

function pulseCoffee() {
  const weapon = game.weapons.coffee;
  if (!weapon.unlocked) return;
  let hit = 0;
  for (const enemy of [...game.enemies]) {
    if (distance(enemy, game.player) < weapon.radius + enemy.radius) {
      damageEnemy(enemy, scaledDamage(weapon.damage), "coffee");
      triggerFireThunderCombo(enemy);
      hit += 1;
    }
  }
  if (hit > 0) {
    addText(theme.weapons.coffee.name, game.player.x, game.player.y - 54, weapon.color);
    game.camera.shake = Math.max(game.camera.shake, 5);
  }
}

function updateWeapon(dt) {
  if (game.combos?.fireThunderTimer > 0) game.combos.fireThunderTimer = Math.max(0, game.combos.fireThunderTimer - dt);
  if (game.combos?.swordTalismanTimer > 0) game.combos.swordTalismanTimer = Math.max(0, game.combos.swordTalismanTimer - dt);
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

function damageEnemy(enemy, amount, source = "unknown") {
  const damage = Math.max(0, Math.round(amount));
  if (damage <= 0) return;
  game.runStats.damageDealt += damage;
  game.runStats.damageBySource[source] = (game.runStats.damageBySource[source] || 0) + damage;
  enemy.hp -= damage;
  enemy.hitFlash = 0.1;
  addText(damage.toString(), enemy.x, enemy.y - enemy.radius, "#fff2a8");
  addBurst(enemy.x, enemy.y, "#ffd35a", 4);
  if (enemy.hp <= 0) {
    const defeatedBossText = enemy.type === "boss" ? game.chapter?.bossMechanics?.victoryText : "";
    game.killCount += 1;
    if (enemy.type === "director") game.runStats.eliteKills += 1;
    if (enemy.type === "boss") {
      game.runStats.bossKilled = true;
      recordBalanceMetric("bossKillTime", game.time);
      if (typeof game.runStats.balance.bossSpawnTime === "number") {
        recordBalanceMetric("bossTtk", game.time - game.runStats.balance.bossSpawnTime);
      }
    }
    if (enemy.eventChallengeId && game.activeEventChallenge?.id === enemy.eventChallengeId) {
      game.activeEventChallenge.defeated = Math.min(
        game.activeEventChallenge.targetCount,
        game.activeEventChallenge.defeated + 1,
      );
      patchRunEventDetail(game.activeEventChallenge.eventId, {
        challenge: {
          active: true,
          result: "",
          targetCount: game.activeEventChallenge.targetCount,
          defeated: game.activeEventChallenge.defeated,
        },
      });
    }
    gainEnergy(enemy.type === "boss" ? 42 : enemy.type === "director" ? 12 : 6);
    spawnExperience(enemy.x, enemy.y, enemy.xp);
    const rewardPickups = rewardPickupsForEnemy(enemy);
    if (rewardPickups) {
      spawnRewardPickups(enemy.x, enemy.y, rewardPickups, {
        radius: enemy.type === "boss" ? 12 : 10,
        spread: enemy.type === "boss" ? 26 : 16,
      });
    }
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
        damageEnemy(enemy, scaledDamage(projectile.damage), projectile.source || projectile.type);
        if (projectile.source === "keyboard" || projectile.type === "keyboard") triggerSwordTalismanCombo(enemy);
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
    if (game.runStats.breakthroughs === 1) recordBalanceMetric("firstUpgradeTime", game.time);
    game.player.nextXp = xpRequiredForLevel(game.player.level);
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
    damageEnemy(enemy, scaledDamage(game.ultimate.damage), "ultimate");
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
    if (pickup.life && pickup.age > pickup.life) {
      pickup.collected = true;
      continue;
    }
    const d = distance(pickup, game.player);
    if (d < game.player.pickupRadius || (pickup.type !== "event" && pickup.age > 0.8)) pickup.magnet = true;
    if (pickup.magnet) {
      const dir = normalize(game.player.x - pickup.x, game.player.y - pickup.y);
      const speed = pickup.type === "event"
        ? clamp(420 - d * 0.8, 160, 420)
        : pickup.age > 0.8
          ? clamp(680 - d * 1.2, 220, 680)
          : clamp(520 - d * 2.2, 160, 520);
      pickup.x += dir.x * speed * dt;
      pickup.y += dir.y * speed * dt;
    }
    if (d < game.player.radius + pickup.radius) {
      if (pickup.type === "event") {
        collectRunEvent(pickup);
      } else if (pickup.type === "material") {
        addPickupReward({ [pickup.currencyKey]: pickup.value });
        addText(`${pickup.label || currencyName(pickup.currencyKey)} +${pickup.value}`, game.player.x, game.player.y - 40, pickup.color || "#f7f3e8");
        addBurst(pickup.x, pickup.y, pickup.color || "#f7f3e8", 12);
      } else if (pickup.type === "health") {
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

function selectedCultivationSpell() {
  return selectedCultivation()?.spell || "keyboard";
}

function upgradeSpellKey(upgrade) {
  if (!upgrade || upgrade.kind !== "spell") return "";
  if (upgrade.id?.includes("coffee")) return "coffee";
  if (upgrade.id?.includes("invoice")) return "invoice";
  if (upgrade.id?.includes("ultimate")) return "ultimate";
  return "keyboard";
}

function weightedShuffle(items, weightFor) {
  return [...items]
    .map((item) => {
      const weight = Math.max(0.01, weightFor(item));
      return { item, rank: Math.random() ** (1 / weight) };
    })
    .sort((a, b) => b.rank - a.rank)
    .map(({ item }) => item);
}

function cultivationUpgradeBiasSummary() {
  const spell = selectedCultivationSpell();
  const spellName = spell === "ultimate" ? theme.spells?.ultimate?.label : theme.weapons?.[spell]?.name || theme.spells?.[spell]?.label || "御剑成阵";
  return `${selectedCultivation()?.name || "无功法"}偏向 ${spellName}`;
}

function chooseUpgrades() {
  if (!theme.spellUpgrades || !theme.equipmentUpgrades) {
    const pool = [...theme.upgrades].sort(() => Math.random() - 0.5);
    return pool.slice(0, 3);
  }

  const biasedSpell = selectedCultivationSpell();
  const spellPool = weightedShuffle(theme.spellUpgrades, (upgrade) => {
    const key = upgradeSpellKey(upgrade);
    if (key === biasedSpell) return 3.2;
    if (biasedSpell === "ultimate" && key === "invoice") return 1.45;
    if (biasedSpell === "coffee" && key === "invoice") return 1.35;
    if (biasedSpell === "invoice" && key === "coffee") return 1.2;
    return 1;
  });
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
  const formula = game.balance?.rewardFormula || {};
  const chapterMultiplier = game.chapter?.rewardMultiplier || 1;
  const difficultyMultiplier = game.difficulty?.rewardMultiplier || 1;
  const rewardMultiplier = chapterMultiplier * difficultyMultiplier;
  const bossBonus = game.runStats.bossKilled ? formula.spiritStoneBossBonus ?? 120 : 0;
  const daoBossBonus = game.runStats.bossKilled ? formula.daoBossBonus ?? 30 : 0;
  const fieldBonus = 1 + (game.runMods.reward?.spiritStoneMultiplier || 0);
  const drops = game.chapter?.drops || {};
  const eventRewards = game.runStats.events?.rewards || {};
  const pickupRewards = game.runStats.pickupRewards || {};
  return {
    spiritStone: Math.floor((game.killCount * (formula.spiritStonePerKill ?? 2) + game.time * (formula.spiritStonePerSecond ?? 0.6) + bossBonus) * rewardMultiplier * fieldBonus) + (eventRewards.spiritStone || 0) + (pickupRewards.spiritStone || 0),
    dao: Math.floor((game.player.level * (formula.daoPerLevel ?? 4) + game.time * (formula.daoPerSecond ?? 0.05) + daoBossBonus) * rewardMultiplier) + (eventRewards.dao || 0) + (pickupRewards.dao || 0),
    mysticIron: Math.floor((game.runStats.eliteKills + (game.runStats.bossKilled ? drops.mysticIron || formula.fallbackMysticIronBossDrop || 2 : 0)) * difficultyMultiplier) + (eventRewards.mysticIron || 0) + (pickupRewards.mysticIron || 0),
    spiritEssence: Math.floor((game.runStats.breakthroughs * (formula.spiritEssencePerBreakthrough ?? 3) + game.runStats.xpCollected / (formula.spiritEssenceXpDivisor ?? 80) + (game.runStats.bossKilled ? drops.spiritEssence || 0 : 0)) * Math.min(formula.spiritEssenceRewardCap ?? 2.2, rewardMultiplier)) + (eventRewards.spiritEssence || 0) + (pickupRewards.spiritEssence || 0),
    thunderShard: (game.runStats.bossKilled ? drops.thunderShard || 0 : 0) + (eventRewards.thunderShard || 0) + (pickupRewards.thunderShard || 0),
  };
}

function calculateRewardBreakdown(rewards = {}) {
  if (!metaConfig) return [];
  const formula = game.balance?.rewardFormula || {};
  const chapterMultiplier = game.chapter?.rewardMultiplier || 1;
  const difficultyMultiplier = game.difficulty?.rewardMultiplier || 1;
  const rewardMultiplier = chapterMultiplier * difficultyMultiplier;
  const fieldBonus = 1 + (game.runMods.reward?.spiritStoneMultiplier || 0);
  const drops = game.chapter?.drops || {};
  const eventRewards = game.runStats.events?.rewards || {};
  const pickupRewards = game.runStats.pickupRewards || {};
  return [
    {
      key: "spiritStone",
      amount: rewards.spiritStone || 0,
      parts: [
        `${game.killCount} 斩妖`,
        `闭关 ${formatTime(game.time)}`,
        game.runStats.bossKilled ? "Boss 击败" : "",
        fieldBonus > 1 ? "灵田加成" : "",
        eventRewards.spiritStone ? `奇遇 +${eventRewards.spiritStone}` : "",
        pickupRewards.spiritStone ? `战场拾取 +${pickupRewards.spiritStone}` : "",
      ],
      multiplier: rewardMultiplier * fieldBonus,
    },
    {
      key: "dao",
      amount: rewards.dao || 0,
      parts: [
        `${realmLabel(game.player.level)}`,
        `闭关 ${formatTime(game.time)}`,
        game.runStats.bossKilled ? "Boss 击败" : "",
        eventRewards.dao ? `奇遇 +${eventRewards.dao}` : "",
        pickupRewards.dao ? `战场拾取 +${pickupRewards.dao}` : "",
      ],
      multiplier: rewardMultiplier,
    },
    {
      key: "mysticIron",
      amount: rewards.mysticIron || 0,
      parts: [
        `${game.runStats.eliteKills || 0} 精英`,
        game.runStats.bossKilled ? `Boss 掉落 ${drops.mysticIron || formula.fallbackMysticIronBossDrop || 2}` : "",
        eventRewards.mysticIron ? `奇遇 +${eventRewards.mysticIron}` : "",
        pickupRewards.mysticIron ? `战场拾取 +${pickupRewards.mysticIron}` : "",
      ],
      multiplier: difficultyMultiplier,
    },
    {
      key: "spiritEssence",
      amount: rewards.spiritEssence || 0,
      parts: [
        `${game.runStats.breakthroughs || 0} 次突破`,
        `修为收集 ${Math.floor(game.runStats.xpCollected || 0)}`,
        game.runStats.bossKilled && drops.spiritEssence ? `Boss 掉落 ${drops.spiritEssence}` : "",
        eventRewards.spiritEssence ? `奇遇 +${eventRewards.spiritEssence}` : "",
        pickupRewards.spiritEssence ? `战场拾取 +${pickupRewards.spiritEssence}` : "",
      ],
      multiplier: Math.min(formula.spiritEssenceRewardCap ?? 2.2, rewardMultiplier),
    },
    {
      key: "thunderShard",
      amount: rewards.thunderShard || 0,
      parts: [
        game.runStats.bossKilled && drops.thunderShard ? `${game.chapter?.name || "章节"} Boss` : "",
        eventRewards.thunderShard ? `奇遇 +${eventRewards.thunderShard}` : "",
        pickupRewards.thunderShard ? `战场拾取 +${pickupRewards.thunderShard}` : "",
      ],
      multiplier: 1,
    },
  ].filter((item) => item.amount > 0);
}

function calculateRewardSourceBreakdown(rewards = {}) {
  if (!metaConfig) return [];
  const formula = game.balance?.rewardFormula || {};
  const chapterMultiplier = game.chapter?.rewardMultiplier || 1;
  const difficultyMultiplier = game.difficulty?.rewardMultiplier || 1;
  const rewardMultiplier = chapterMultiplier * difficultyMultiplier;
  const fieldBonus = 1 + (game.runMods.reward?.spiritStoneMultiplier || 0);
  const drops = game.chapter?.drops || {};
  const eventRewards = game.runStats.events?.rewards || {};
  const pickupRewards = game.runStats.pickupRewards || {};
  const spiritStoneBase = [
    { label: "斩妖", amount: Math.floor(game.killCount * (formula.spiritStonePerKill ?? 2)) },
    { label: "闭关", amount: Math.floor(game.time * (formula.spiritStonePerSecond ?? 0.6)) },
    { label: "Boss", amount: game.runStats.bossKilled ? formula.spiritStoneBossBonus ?? 120 : 0 },
  ].filter((part) => part.amount > 0);
  const daoBase = [
    { label: "境界", amount: Math.floor(game.player.level * (formula.daoPerLevel ?? 4)) },
    { label: "闭关", amount: Math.floor(game.time * (formula.daoPerSecond ?? 0.05)) },
    { label: "Boss", amount: game.runStats.bossKilled ? formula.daoBossBonus ?? 30 : 0 },
  ].filter((part) => part.amount > 0);
  const mysticIronBase = [
    { label: "精英", amount: Math.floor(game.runStats.eliteKills || 0) },
    { label: "Boss", amount: game.runStats.bossKilled ? drops.mysticIron || formula.fallbackMysticIronBossDrop || 2 : 0 },
  ].filter((part) => part.amount > 0);
  const spiritEssenceBase = [
    { label: "突破", amount: Math.floor((game.runStats.breakthroughs || 0) * (formula.spiritEssencePerBreakthrough ?? 3)) },
    { label: "修为", amount: Math.floor((game.runStats.xpCollected || 0) / (formula.spiritEssenceXpDivisor ?? 80)) },
    { label: "Boss", amount: game.runStats.bossKilled ? drops.spiritEssence || 0 : 0 },
  ].filter((part) => part.amount > 0);
  const thunderShardBase = [
    { label: "Boss", amount: game.runStats.bossKilled ? drops.thunderShard || 0 : 0 },
  ].filter((part) => part.amount > 0);
  const spiritEssenceMultiplier = Math.min(formula.spiritEssenceRewardCap ?? 2.2, rewardMultiplier);
  const rows = [
    {
      key: "spiritStone",
      total: rewards.spiritStone || 0,
      baseParts: spiritStoneBase,
      baseTotal: spiritStoneBase.reduce((sum, part) => sum + part.amount, 0),
      scaledTotal: Math.floor(spiritStoneBase.reduce((sum, part) => sum + part.amount, 0) * rewardMultiplier * fieldBonus),
      multipliers: [
        `章节 x${chapterMultiplier.toFixed(2)}`,
        `难度 x${difficultyMultiplier.toFixed(2)}`,
        fieldBonus > 1 ? `灵田 x${fieldBonus.toFixed(2)}` : "",
      ].filter(Boolean),
      extraParts: [
        { label: "奇遇", amount: eventRewards.spiritStone || 0 },
        { label: "战场拾取", amount: pickupRewards.spiritStone || 0 },
      ].filter((part) => part.amount > 0),
    },
    {
      key: "dao",
      total: rewards.dao || 0,
      baseParts: daoBase,
      baseTotal: daoBase.reduce((sum, part) => sum + part.amount, 0),
      scaledTotal: Math.floor(daoBase.reduce((sum, part) => sum + part.amount, 0) * rewardMultiplier),
      multipliers: [`章节 x${chapterMultiplier.toFixed(2)}`, `难度 x${difficultyMultiplier.toFixed(2)}`],
      extraParts: [
        { label: "奇遇", amount: eventRewards.dao || 0 },
        { label: "战场拾取", amount: pickupRewards.dao || 0 },
      ].filter((part) => part.amount > 0),
    },
    {
      key: "mysticIron",
      total: rewards.mysticIron || 0,
      baseParts: mysticIronBase,
      baseTotal: mysticIronBase.reduce((sum, part) => sum + part.amount, 0),
      scaledTotal: Math.floor(mysticIronBase.reduce((sum, part) => sum + part.amount, 0) * difficultyMultiplier),
      multipliers: difficultyMultiplier !== 1 ? [`难度 x${difficultyMultiplier.toFixed(2)}`] : [],
      extraParts: [
        { label: "奇遇", amount: eventRewards.mysticIron || 0 },
        { label: "战场拾取", amount: pickupRewards.mysticIron || 0 },
      ].filter((part) => part.amount > 0),
    },
    {
      key: "spiritEssence",
      total: rewards.spiritEssence || 0,
      baseParts: spiritEssenceBase,
      baseTotal: spiritEssenceBase.reduce((sum, part) => sum + part.amount, 0),
      scaledTotal: Math.floor(spiritEssenceBase.reduce((sum, part) => sum + part.amount, 0) * spiritEssenceMultiplier),
      multipliers: [`奖励倍率 x${spiritEssenceMultiplier.toFixed(2)}`],
      extraParts: [
        { label: "奇遇", amount: eventRewards.spiritEssence || 0 },
        { label: "战场拾取", amount: pickupRewards.spiritEssence || 0 },
      ].filter((part) => part.amount > 0),
    },
    {
      key: "thunderShard",
      total: rewards.thunderShard || 0,
      baseParts: thunderShardBase,
      baseTotal: thunderShardBase.reduce((sum, part) => sum + part.amount, 0),
      scaledTotal: thunderShardBase.reduce((sum, part) => sum + part.amount, 0),
      multipliers: [],
      extraParts: [
        { label: "奇遇", amount: eventRewards.thunderShard || 0 },
        { label: "战场拾取", amount: pickupRewards.thunderShard || 0 },
      ].filter((part) => part.amount > 0),
    },
  ];
  return rows.filter((row) => row.total > 0);
}

function renderRewardBreakdown(rewards = {}) {
  const rows = calculateRewardBreakdown(rewards);
  if (!rows.length) return `<span>获得：暂无</span>`;
  return `
    <div class="reward-total">${formatCostTokens(rewards, "material-token reward-token")}</div>
    <div class="reward-breakdown">
      ${rows
        .map((row) => {
          const multiplier = row.multiplier && row.multiplier !== 1 ? ` · 倍率 x${row.multiplier.toFixed(2)}` : "";
          return `<span>${currencyToken(row.key, row.amount, "material-token reward-token")}<small>${row.parts.filter(Boolean).join(" / ")}${multiplier}</small></span>`;
        })
        .join("")}
    </div>
  `;
}

function renderRewardSourceBreakdown() {
  if (!metaConfig || !game.runStats?.rewards) return "";
  const sourceRows = calculateRewardSourceBreakdown(game.runStats.rewards);
  return `
    <div class="reward-source-breakdown">
      <strong>奖励来源</strong>
      <div class="reward-source-cards">
        ${sourceRows
          .map((row) => {
            const extraTotal = row.extraParts.reduce((sum, part) => sum + part.amount, 0);
            const pipeline = [
              `基础 ${row.baseTotal}`,
              row.multipliers.length ? `结算 ${row.scaledTotal}` : "",
              extraTotal > 0 ? `额外 +${extraTotal}` : "",
            ].filter(Boolean).join(" -> ");
            return `
              <article class="reward-source-card">
                <div class="reward-source-card-head">
                  ${currencyToken(row.key, row.total, "material-token reward-token")}
                  <small>${pipeline}</small>
                </div>
                <span><b>基础</b><small>${row.baseParts.map((part) => `${part.label} +${part.amount}`).join(" / ") || "无"}</small></span>
                ${row.multipliers.length ? `<span><b>倍率</b><small>${row.multipliers.join(" / ")}</small></span>` : ""}
                ${row.extraParts.length ? `<span><b>额外</b><small>${row.extraParts.map((part) => `${part.label} +${part.amount}`).join(" / ")}</small></span>` : ""}
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function damageBreakdownRows(limit = 3) {
  return Object.entries(game.runStats.damageBySource || {})
    .map(([source, amount]) => ({
      source,
      name: damageSourceName(source),
      amount: Math.round(amount || 0),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function renderDamageBreakdown() {
  const rows = damageBreakdownRows();
  if (!rows.length) return "";
  const total = Math.max(1, Math.round(game.runStats.damageDealt || 0));
  const top = rows[0];
  return `
    <div class="run-breakdown">
      <strong>本局输出</strong>
      <span>最强法术：${top.name} ${top.amount}</span>
      <div class="damage-breakdown">
        ${rows
          .map((row) => `<span><b>${row.name}</b><small>${row.amount} · ${Math.round((row.amount / total) * 100)}%</small></span>`)
          .join("")}
      </div>
    </div>
  `;
}

function runEventSummaryRows() {
  const events = game.runStats.events || {};
  const pickupText = formatCost(game.runStats.pickupRewards || {});
  const detailRows = Object.values(events.details || {})
    .filter((row) => row.count > 0)
    .map((row) => {
      const notes = [
        row.summary ? `${row.count} 次 · ${row.summary}` : `${row.count} 次`,
        formatCost(row.rewards || {}),
        formatCost(row.pickupRewards || {}),
        row.totalHeal ? `回血 ${row.totalHeal}` : "",
        row.totalEnergy ? `灵力 ${row.totalEnergy}` : "",
        row.totalDamage ? `代价 ${row.totalDamage}` : "",
        Object.keys(row.ambush || {}).length ? `伏击 ${ambushSummaryText(row.ambush)}` : "",
        runEventChoiceSummary(row),
        runEventBlessingSummary(row),
        runEventFollowupSummary(row),
        challengeStateText(row.challenge, true),
      ].filter(Boolean);
      return `<span><b>${row.label}</b><small>${notes.join(" / ")}</small></span>`;
    });
  return [
    ...detailRows,
    pickupText ? `<span><b>战场拾取</b><small>${pickupText}</small></span>` : "",
  ].filter(Boolean);
}

function affixSummaryRows() {
  return Object.entries(game.runStats.affixes || {})
    .map(([id, count]) => {
      const affix = enemyAffixes[id];
      if (!affix || count <= 0) return "";
      return `<span><b>${affix.name}</b><small>${count} 只 · ${affix.desc}</small></span>`;
    })
    .filter(Boolean);
}

function activeWeaponRows() {
  return Object.values(game.weapons || {})
    .filter((weapon) => weapon.level > 0 || weapon.unlocked)
    .map((weapon) => {
      const details = [
        weapon.burst ? `${weapon.burst}重` : "",
        weapon.damage ? `伤害 ${Math.round(weapon.damage)}` : "",
        weapon.radius ? `范围 ${Math.round(weapon.radius)}` : "",
      ].filter(Boolean);
      return `<span><b>${weapon.name}</b><small>${details.join(" / ")}</small></span>`;
    });
}

function spellCodexRows() {
  const spellNotes = {
    keyboard: "主轴远程飞剑，负责清线与触发飞剑附符。",
    coffee: "近身持续灼烧，命中后可引动火莲引雷。",
    invoice: "自动散射雷符，是两条合术路线的关键组件。",
    ultimate: "消耗满灵力释放大范围雷瀑，适合清场和压 Boss 血线。",
  };
  const spellIds = ["keyboard", "coffee", "invoice", "ultimate"];
  return spellIds.map((id) => {
    const spell = theme.spells?.[id] || {};
    const weapon = game.weapons?.[id];
    const unlocked = id === "ultimate" ? Boolean(theme.spells?.ultimate) : Boolean(weapon?.unlocked || weapon?.level > 0);
    const metrics = id === "ultimate"
      ? [
          `伤害 ${Math.round(scaledDamage(game.ultimate?.damage || spell.damage || 0))}`,
          `灵力 ${Math.floor(game.energy.value || 0)}/${game.energy.max || 100}`,
        ]
      : [
          weapon?.level ? `${weapon.level}重` : "0重",
          weapon?.damage ? `伤害 ${Math.round(scaledDamage(weapon.damage))}` : "",
          weapon?.burst ? `${weapon.burst}发` : "",
          weapon?.radius ? `范围 ${Math.round(weapon.radius)}` : "",
          weapon?.cooldown ? `${weapon.cooldown.toFixed(2)}s` : "",
        ];
    const combos = spellCombos
      .filter((combo) => combo.recipe.includes(spell.label || weapon?.name))
      .map((combo) => {
        const count = game.runStats?.combos?.[combo.id] || 0;
        return `${combo.name}${count ? ` ${count}次` : ""}`;
      });
    return {
      id,
      name: spell.label || weapon?.name || damageSourceName(id),
      type: spell.type || "法术",
      icon: spell.icon || weapon?.asset || "",
      unlocked,
      status: unlocked ? (id === "ultimate" ? "可施放" : "已悟得") : "待悟",
      metrics: metrics.filter(Boolean).join(" / "),
      note: spellNotes[id] || "",
      combos,
    };
  });
}

function renderSpellCodex() {
  return `
    <div class="pause-spell-codex">
      ${spellCodexRows()
        .map((spell) => `
          <article class="${spell.unlocked ? "unlocked" : "locked"}">
            ${spell.icon ? homeImage(spell.icon, spell.name, "pause-spell-icon") : ""}
            <div>
              <div class="pause-spell-head">
                <b>${spell.name}</b>
                <span>${spell.status}</span>
              </div>
              <small>${spell.metrics || spell.type}</small>
              <p>${spell.note}</p>
              ${spell.combos.length ? `<em>关联：${spell.combos.join(" / ")}</em>` : ""}
            </div>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function activeComboRows() {
  const rows = [];
  if (game.weapons.coffee?.unlocked && game.weapons.invoice?.unlocked) {
    const count = game.runStats?.combos?.fireThunder || 0;
    rows.push(`<span><b>火莲引雷</b><small>${count ? `已触发 ${count} 次` : "业火命中后引动雷符"}</small></span>`);
  }
  if ((game.weapons.keyboard?.level > 0 || game.weapons.keyboard?.unlocked) && game.weapons.invoice?.unlocked) {
    const count = game.runStats?.combos?.swordTalisman || 0;
    rows.push(`<span><b>飞剑附符</b><small>${count ? `已触发 ${count} 次` : "飞剑命中后附着雷符"}</small></span>`);
  }
  return rows;
}

function selectedBuildNameSummary() {
  if (!metaConfig || !metaState) return "";
  const parts = [
    selectedArtifact()?.name,
    selectedCultivation()?.name,
    ...selectedTalents().map((talent) => talent.name),
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "";
}

function renderRunBlessingsSummary() {
  const rows = activeRunBlessingRows();
  if (!rows.length) return "";
  return `
    <div class="run-blessing-summary">
      <strong>本局加持</strong>
      <div class="run-blessing-grid">
        ${rows.map((row) => `<span><b>${row.label}</b><small>${row.text}</small></span>`).join("")}
      </div>
    </div>
  `;
}

function renderPauseBuildSummary() {
  const comboRows = activeComboRows();
  const damageRows = damageBreakdownRows();
  const eventRows = runEventSummaryRows();
  const affixRows = affixSummaryRows();
  const blessingSummary = renderRunBlessingsSummary();
  const buildSummary = selectedBuildNameSummary();
  const synergySummary = activeBuildSynergies().map((synergy) => synergy.name).join(" / ");
  const buildItems = [
    `${game.chapter?.name || theme.name}${game.difficulty?.name ? ` · ${game.difficulty.name}` : ""}`,
    `${realmLabel(game.player.level)} · ${theme.copy?.kills || "击退"} ${game.killCount}`,
    `气血 ${Math.max(0, Math.ceil(game.player.hp))}/${Math.ceil(game.player.maxHp)} · 灵力 ${Math.floor(game.energy.value || 0)}/${game.energy.max || 100}`,
    buildSummary,
    synergySummary ? `流派共鸣：${synergySummary}` : "",
  ].filter(Boolean);
  return `
    <div class="pause-meta">
      ${buildItems.map((item) => `<span>${item}</span>`).join("")}
      <span>升级偏向：${cultivationUpgradeBiasSummary()}</span>
    </div>
    <div class="pause-section">
      <strong>局内法术图鉴</strong>
      ${renderSpellCodex()}
    </div>
    <div class="pause-section">
      <strong>身法</strong>
      <div class="pause-spells">
        <span><b>踏风闪避</b><small>Space / Shift / 闪避按钮 · 已用 ${game.runStats.dashes || 0} 次</small></span>
      </div>
    </div>
    ${
      comboRows.length
        ? `<div class="pause-section"><strong>法术组合</strong><div class="pause-spells">${comboRows.join("")}</div></div>`
        : ""
    }
    ${
      eventRows.length
        ? `<div class="pause-section"><strong>本局奇遇</strong><div class="pause-spells">${eventRows.join("")}</div></div>`
        : ""
    }
    ${blessingSummary ? `<div class="pause-section">${blessingSummary}</div>` : ""}
    ${
      affixRows.length
        ? `<div class="pause-section"><strong>妖魔词缀</strong><div class="pause-spells">${affixRows.join("")}</div></div>`
        : ""
    }
    ${
      damageRows.length
        ? `<div class="pause-section"><strong>输出排行</strong><div class="pause-spells">${damageRows
            .map((row) => `<span><b>${row.name}</b><small>${row.amount}</small></span>`)
            .join("")}</div></div>`
        : ""
    }
  `;
}

function chapterDropEstimate(chapter, difficulty = getSelectedDifficulty()) {
  if (!chapter) return {};
  const formula = theme.balance?.rewardFormula || {};
  const difficultyMultiplier = difficulty?.rewardMultiplier || 1;
  const chapterMultiplier = chapter.rewardMultiplier || 1;
  const drops = chapter.drops || {};
  return {
    spiritStone: Math.floor((formula.spiritStoneBossBonus ?? 120) * chapterMultiplier * difficultyMultiplier),
    dao: Math.floor((formula.daoBossBonus ?? 30) * chapterMultiplier * difficultyMultiplier),
    mysticIron: Math.floor((drops.mysticIron || formula.fallbackMysticIronBossDrop || 2) * difficultyMultiplier),
    spiritEssence: Math.floor((drops.spiritEssence || 0) * Math.min(formula.spiritEssenceRewardCap ?? 2.2, chapterMultiplier * difficultyMultiplier)),
    thunderShard: drops.thunderShard || 0,
  };
}

function chapterDropSummary(chapter, difficulty = getSelectedDifficulty()) {
  const estimate = chapterDropEstimate(chapter, difficulty);
  const entries = Object.entries(estimate).filter(([, value]) => value > 0);
  return entries.length ? entries.map(([key, value]) => currencyToken(key, value)).join("") : `<span class="home-muted">通关后获得基础资源</span>`;
}

function materialChapters(key) {
  return (metaConfig?.chapters || [])
    .filter((chapter) => {
      if (key === "spiritStone" || key === "dao") return true;
      if (key === "mysticIron") return (chapter.drops?.mysticIron || 0) > 0;
      if (key === "spiritEssence") return (chapter.drops?.spiritEssence || 0) > 0;
      if (key === "thunderShard") return (chapter.drops?.thunderShard || 0) > 0;
      return false;
    })
    .sort((a, b) => {
      const aUnlocked = isUnlocked("chapters", a.id) ? 0 : 1;
      const bUnlocked = isUnlocked("chapters", b.id) ? 0 : 1;
      const aValue = chapterDropEstimate(a)[key] || 0;
      const bValue = chapterDropEstimate(b)[key] || 0;
      return aUnlocked - bUnlocked || bValue - aValue;
    });
}

function recommendChapterForMaterial(key) {
  const chapter = materialChapters(key)[0];
  if (!chapter) return "";
  const locked = !isUnlocked("chapters", chapter.id);
  return `${locked ? "后续解锁" : "建议刷"}：${chapter.name}`;
}

function materialRouteLockReason(chapter, difficulty) {
  if (!isUnlocked("chapters", chapter.id)) return "章节未解锁";
  if (!difficultyAllowed(chapter.id, difficulty?.id || "mortal")) return `${difficulty?.name || "难度"}未解锁`;
  return "";
}

function materialRouteLockRank(chapter, difficulty) {
  if (!isUnlocked("chapters", chapter.id)) return 2;
  if (!difficultyAllowed(chapter.id, difficulty?.id || "mortal")) return 1;
  return 0;
}

function nearestUnlockedChapterFor(chapter) {
  const chapterMap = mapById(metaConfig.chapters || []);
  let current = chapter;
  let fallback = chapter;
  for (let guard = 0; current && guard < 12; guard += 1) {
    if (isUnlocked("chapters", current.id)) return current;
    const prerequisite = current.unlock?.type === "chapterClear" ? chapterMap[current.unlock.chapterId] : null;
    if (!prerequisite) return fallback;
    fallback = prerequisite;
    current = prerequisite;
  }
  return fallback || chapter;
}

function materialRouteUnlockHint(chapter, difficulty) {
  if (!isUnlocked("chapters", chapter.id)) {
    const target = nearestUnlockedChapterFor(chapter);
    return target?.id && target.id !== chapter.id
      ? `先通关${target.name}推进章节链`
      : `先${unlockConditionText(chapter.unlock).replace(/\s+/g, "")}`;
  }
  if (difficultyAllowed(chapter.id, difficulty?.id || "mortal")) return "";
  const difficulties = metaConfig.difficulties || [];
  const index = difficulties.findIndex((item) => item.id === difficulty?.id);
  const previous = difficulties[index - 1];
  if (previous) return `先通关${chapter.name}${previous.name}`;
  return `先通关${chapter.name}`;
}

function materialRouteUnlockTarget(chapter, difficulty) {
  if (!chapter) return null;
  if (!isUnlocked("chapters", chapter.id)) {
    const prerequisite = nearestUnlockedChapterFor(chapter);
    return prerequisite ? { chapterId: prerequisite.id, difficultyId: "mortal" } : null;
  }
  if (difficultyAllowed(chapter.id, difficulty?.id || "mortal")) return null;
  const difficulties = metaConfig.difficulties || [];
  const index = difficulties.findIndex((item) => item.id === difficulty?.id);
  const previous = difficulties[index - 1] || difficulties[0];
  return previous ? { chapterId: chapter.id, difficultyId: previous.id } : { chapterId: chapter.id, difficultyId: "mortal" };
}

function materialRouteRunsText(key, amount, locked = false) {
  const needAmount = materialNeedAmount(key);
  const owned = Math.floor(metaState.currencies[key] || 0);
  const missing = Math.max(0, needAmount - owned);
  if (missing <= 0 || amount <= 0) return "";
  const runs = Math.max(1, Math.ceil(missing / amount));
  const summary = locked
    ? runs === 1
      ? "解锁后 1 局可补齐缺口"
      : `解锁后约 ${runs} 局补齐缺口`
    : runs === 1
      ? "当前路线可补齐缺口"
      : `约 ${runs} 局补齐缺口`;
  return `
    <span class="material-route-runs">
      <b>${summary}</b>
      <small>缺 ${currencyToken(key, missing, "material-token route-token")} / 局 ${currencyToken(key, amount, "material-token route-token")}</small>
    </span>
  `;
}

function materialRouteRewardNote(key, chapter, difficulty, amount) {
  const difficultyId = difficulty?.id || "mortal";
  const difficultyName = difficulty?.name || "当前难度";
  const record = metaState.records.chapters?.[chapter.id];
  const cleared = (record?.clearedDifficulties || []).includes(difficultyId);
  if (cleared) {
    return `<span class="material-route-reward-note repeat"><b>复刷收益</b>${difficultyName}已首通，适合稳定补${currencyName(key)}。</span>`;
  }
  return `<span class="material-route-reward-note first"><b>首通待拿</b>${difficultyName}首通可解锁${firstClearSummary(chapter)}，同时预计${currencyToken(key, amount, "material-token route-token")}。</span>`;
}

function materialFarmRoute(key, difficulty = getSelectedDifficulty()) {
  const routes = materialChapters(key)
    .map((chapter) => {
      const lockReason = materialRouteLockReason(chapter, difficulty);
      const unlockTarget = materialRouteUnlockTarget(chapter, difficulty);
      return {
        chapter,
        amount: chapterDropEstimate(chapter, difficulty)[key] || 0,
        locked: Boolean(lockReason),
        lockRank: materialRouteLockRank(chapter, difficulty),
        lockReason,
        unlockHint: materialRouteUnlockHint(chapter, difficulty),
        unlockTarget,
      };
    })
    .filter((route) => route.amount > 0)
    .sort((a, b) => a.lockRank - b.lockRank || b.amount - a.amount)
    .slice(0, 2);
  if (!routes.length) return `<span class="home-muted">暂无推荐</span>`;
  return routes
    .map(({ chapter, amount, locked, lockReason, unlockHint, unlockTarget }) => `
      <span class="material-farm-route ${locked ? "locked" : ""}">
        <b>${chapter.name}</b>
        <small>${difficulty?.name || "当前难度"}预计 ${currencyToken(key, amount, "material-token route-token")}${lockReason ? `<em>${lockReason}</em>` : ""}</small>
        ${materialRouteRewardNote(key, chapter, difficulty, amount)}
        ${materialRouteRunsText(key, amount, locked)}
        ${unlockHint ? `<span class="material-route-hint">${unlockHint}</span>` : ""}
        <button
          data-action="${locked ? "unlock-material-route" : "farm-material-route"}"
          data-id="${chapter.id}"
          data-difficulty="${difficulty?.id || ""}"
          data-material="${key}"
          ${unlockTarget ? `data-target-chapter="${unlockTarget.chapterId}" data-target-difficulty="${unlockTarget.difficultyId}"` : ""}
          type="button"
        >${locked ? "去解锁" : "去刷"}</button>
      </span>
    `)
    .join("");
}

function materialPreviewDifficulty() {
  const difficultyMap = mapById(metaConfig.difficulties || []);
  const selected = difficultyMap[materialPreviewDifficultyId || metaState.selected.difficultyId];
  return selected || getSelectedDifficulty() || metaConfig.difficulties?.[0];
}

function renderMaterialDifficultyPreview() {
  const current = materialPreviewDifficulty();
  return `
    <div class="material-difficulty-preview">
      <span>收益难度预览</span>
      <div>
        ${(metaConfig.difficulties || [])
          .map((difficulty) => `<button data-action="preview-material-difficulty" data-difficulty="${difficulty.id}" class="${current?.id === difficulty.id ? "active" : ""}" type="button">${difficulty.name}</button>`)
          .join("")}
      </div>
    </div>
  `;
}

function missingCost(cost = {}) {
  return Object.fromEntries(
    Object.entries(cost)
      .map(([key, value]) => [key, Math.max(0, Math.floor(value - (metaState?.currencies?.[key] || 0)))])
      .filter(([, value]) => value > 0),
  );
}

function primaryMissingMaterial(cost = {}) {
  return Object.entries(missingCost(cost))
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)[0] || "";
}

function renderCostHint(cost = {}) {
  const missing = missingCost(cost);
  const entries = Object.entries(missing);
  if (!entries.length) return "";
  const missingKeys = entries.map(([key]) => key);
  const recommendations = unique(entries.map(([key]) => recommendChapterForMaterial(key)).filter(Boolean));
  const material = primaryMissingMaterial(cost);
  const difficulty = getSelectedDifficulty() || metaConfig?.difficulties?.[0];
  const route = material ? materialChapters(material)[0] : null;
  const routeLocked = route ? materialRouteLockReason(route, difficulty) : "";
  const unlockTarget = route && routeLocked ? materialRouteUnlockTarget(route, difficulty) : null;
  const routeButton = route
    ? `<button
        data-action="${routeLocked ? "unlock-material-route" : "farm-material-route"}"
        data-id="${route.id}"
        data-material="${material}"
        data-difficulty="${difficulty?.id || ""}"
        ${unlockTarget ? `data-target-chapter="${unlockTarget.chapterId}" data-target-difficulty="${unlockTarget.difficultyId}"` : ""}
        type="button"
      >${routeLocked ? "去解锁" : `去刷${route.name}`}</button>`
    : "";
  return `
    <div class="cost-hint">
      <span>缺 ${formatCost(missing)}${recommendations.length ? ` · ${recommendations.join(" / ")}` : ""}</span>
      <div class="cost-hint-actions">
        ${routeButton}
        <button data-action="open-tab" data-tab="materials" data-focus-materials="${missingKeys.join(",")}" type="button">看材料</button>
      </div>
    </div>
  `;
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

function unlockManyDetailed(kind, ids = [], messages = [], collected = {}) {
  for (const id of ids || []) {
    if (!id) continue;
    const list = metaState.unlocks[kind];
    if (Array.isArray(list) && !list.includes(id)) {
      list.push(id);
      messages.push(`解锁 ${unlockDisplayName(kind, id)}`);
      if (!collected[kind]) collected[kind] = [];
      collected[kind].push(id);
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
  game.runStats.firstClearRewards = null;
  if (cleared && !record.clearedDifficulties.includes(difficultyId)) {
    record.clearedDifficulties.push(difficultyId);
    messages.push(`${game.chapter.name}${game.difficulty?.name || ""}首通`);
    const unlocks = game.chapter.firstClearUnlocks || {};
    const firstClearRewards = { chapterId, difficultyId, chapters: [], artifacts: [], startingTalents: [], cultivations: [], difficultyUnlockId: "" };
    unlockManyDetailed("chapters", unlocks.chapters, messages, firstClearRewards);
    unlockManyDetailed("artifacts", unlocks.artifacts, messages, firstClearRewards);
    unlockManyDetailed("startingTalents", unlocks.startingTalents, messages, firstClearRewards);
    unlockManyDetailed("cultivations", unlocks.cultivations, messages, firstClearRewards);
    for (const chapter of metaConfig.chapters) {
      if (!metaState.unlocks.difficulties[chapter.id]) metaState.unlocks.difficulties[chapter.id] = ["mortal"];
    }
    if (difficultyId === "mortal" && !metaState.unlocks.difficulties[chapterId].includes("mystic")) {
      metaState.unlocks.difficulties[chapterId].push("mystic");
      messages.push(`解锁 ${game.chapter.name}玄境`);
      firstClearRewards.difficultyUnlockId = "mystic";
    }
    if (difficultyId === "mystic" && !metaState.unlocks.difficulties[chapterId].includes("heaven")) {
      metaState.unlocks.difficulties[chapterId].push("heaven");
      messages.push(`解锁 ${game.chapter.name}天境`);
      firstClearRewards.difficultyUnlockId = "heaven";
    }
    if ([...(firstClearRewards.chapters || []), ...(firstClearRewards.artifacts || []), ...(firstClearRewards.startingTalents || []), ...(firstClearRewards.cultivations || []), firstClearRewards.difficultyUnlockId].filter(Boolean).length) {
      game.runStats.firstClearRewards = firstClearRewards;
    }
  }
  metaState.records.runs += 1;
  metaState.records.totalKills += game.killCount;
  metaState.records.bestSurvivalSeconds = Math.max(metaState.records.bestSurvivalSeconds || 0, Math.floor(game.time));
  metaState.records.highestRealmLevel = Math.max(metaState.records.highestRealmLevel || 1, game.player.level);
  updateComboRecordsAfterRun();
  return messages;
}

function finishRun() {
  if (game.state === "ended") return;
  if (game.activeEventChallenge && !game.activeEventChallenge.resolved) resolveActiveEventChallenge(false);
  ui.eventChoicePanel?.classList.add("hidden");
  game.activeEventChoice = null;
  game.state = "ended";
  clearGoalToastTimer();
  ui.runGoals?.classList.add("hidden");
  ui.goalToast?.classList.add("hidden");
  const killLabel = theme.copy?.kills || "击退";
  if (metaConfig && metaState) {
    const rewards = calculateRunRewards();
    addCurrencies(rewards);
    const unlocks = unlockProgressAfterRun();
    game.runStats.rewards = rewards;
    game.runStats.unlocks = unlocks;
    saveMetaState();
    updateQuestBadges();
    ui.rewardText.innerHTML = `
      ${renderRewardBreakdown(rewards)}
      ${renderRewardSourceBreakdown()}
      ${renderRunBlessingsSummary()}
      ${renderDamageBreakdown()}
      ${renderFirstClearRewardSummary()}
      ${renderQuestCompletionSummary()}
      ${!game.runStats.firstClearRewards && unlocks.length ? `<span>${unlocks.join(" / ")}</span>` : ""}
    `;
    renderResultNextSteps();
    ui.resultQuestBtn?.classList.toggle("hidden", claimableQuestCount() <= 0);
  } else if (ui.rewardText) {
    ui.rewardText.innerHTML = renderDamageBreakdown();
    ui.resultNextSteps?.classList.add("hidden");
    ui.resultQuestBtn?.classList.add("hidden");
  }
  ui.resultText.textContent = `闭关 ${formatTime(game.time)}，${killLabel} ${game.killCount}，最高境界 ${realmLabel(game.player.level)}。`;
  ui.resultPanel.classList.remove("hidden");
}

function pauseGame() {
  if (game.state !== "playing") return;
  game.state = "paused";
  if (ui.pauseBuildSummary) ui.pauseBuildSummary.innerHTML = renderPauseBuildSummary();
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
  const costs = theme.balance?.upgradeCosts || {};
  if (kind === "talent") {
    const config = costs.talent || {};
    return { [config.currency || "spiritStone"]: Math.floor((config.base ?? 80) * Math.pow(config.growth ?? 1.32, level)) };
  }
  if (kind === "artifact") {
    const config = costs.artifact || {};
    return {
      spiritStone: Math.floor((config.spiritStoneBase ?? 120) * Math.pow(config.spiritStoneGrowth ?? 1.4, level)),
      mysticIron: Math.max(1, Math.floor(level / (config.mysticIronEvery ?? 2))),
    };
  }
  if (kind === "cultivation") {
    const config = costs.cultivation || {};
    return {
      dao: (config.daoBase ?? 20) + level * (config.daoPerLevel ?? 18),
      spiritEssence: (config.spiritEssenceBase ?? 8) + level * (config.spiritEssencePerLevel ?? 6),
    };
  }
  if (kind === "facility") {
    const config = costs.facility || {};
    const cost = { spiritStone: Math.floor((config.spiritStoneBase ?? 160) * Math.pow(config.spiritStoneGrowth ?? 1.45, level)) };
    if (id === "cushion" || id === "library") cost.dao = (config.daoBase ?? 8) + level * (config.daoPerLevel ?? 5);
    if (id === "forge") cost.mysticIron = Math.max(1, Math.floor(level / (config.mysticIronEvery ?? 2)));
    if (id === "thunderPool") cost.thunderShard = Math.max(1, Math.floor(level / (config.thunderShardEvery ?? 3)));
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

function nextMilestoneBenefit(item, milestone) {
  const level = Number(milestone?.level || 0);
  const effects = item?.milestoneEffects?.[level] || item?.milestoneEffects?.[String(level)] || [];
  const summary = effectSummary(effects, level);
  if (summary) return `收益 ${summary}`;
  return milestone?.text ? `突破 ${milestone.text}` : "";
}

function addCostTotals(total, cost) {
  for (const [key, value] of Object.entries(cost || {})) {
    total[key] = (total[key] || 0) + value;
  }
  return total;
}

function nextMilestoneCostPlan(kind, id, currentLevel = 0, milestone) {
  if (!kind || !id || !milestone?.level) return null;
  const targetLevel = Number(milestone.level);
  if (!Number.isFinite(targetLevel) || targetLevel <= currentLevel) return null;
  const totalCost = {};
  for (let step = currentLevel; step < targetLevel; step += 1) {
    addCostTotals(totalCost, upgradeCost(kind, id, step));
  }
  const missing = missingCost(totalCost);
  const affordable = !Object.keys(missing).length;
  return {
    affordable,
    cost: totalCost,
    id,
    kind,
    label: affordable ? `冲刺成本 ${formatCost(totalCost)}` : `还缺 ${formatCost(missing)}`,
    missingKeys: Object.keys(missing),
    targetLevel,
  };
}

function milestoneProgressLevel(kind, id) {
  if (kind === "talent") return metaState.progression.talentTree[id] || 0;
  if (kind === "artifact") return metaState.progression.artifacts[id] || 1;
  if (kind === "cultivation") return metaState.progression.cultivations[id] || 1;
  if (kind === "facility") return metaState.progression.facilities[id] || 0;
  return 0;
}

function setMilestoneProgressLevel(kind, id, level) {
  if (kind === "talent") metaState.progression.talentTree[id] = level;
  if (kind === "artifact") metaState.progression.artifacts[id] = level;
  if (kind === "cultivation") metaState.progression.cultivations[id] = level;
  if (kind === "facility") metaState.progression.facilities[id] = level;
}

function rushMilestone(kind, id, targetLevel) {
  const currentLevel = milestoneProgressLevel(kind, id);
  const plan = nextMilestoneCostPlan(kind, id, currentLevel, { level: Number(targetLevel) });
  if (!plan?.affordable || !spendCurrency(plan.cost)) return false;
  setMilestoneProgressLevel(kind, id, plan.targetLevel);
  if (kind === "facility") metaState.selected.startingTalentIds = metaState.selected.startingTalentIds.slice(0, getStartingTalentSlots());
  return true;
}

function milestoneSummary(item, level = 0, upgrade = {}) {
  const milestones = Object.entries(item?.milestones || {});
  if (!milestones.length) return "";
  const next = milestones
    .map(([milestone, text]) => ({ level: Number(milestone), text }))
    .filter((milestone) => milestone.level > level)
    .sort((a, b) => a.level - b.level)[0];
  const nextBenefit = nextMilestoneBenefit(item, next);
  const nextCostPlan = nextMilestoneCostPlan(upgrade.kind, upgrade.id || item?.id, level, next);
  return `
    <div class="milestone-list">
      ${milestones
        .map(([milestone, text]) => {
          const active = level >= Number(milestone);
          return `<span class="${active ? "active" : ""}"><b>${milestone}级</b>${text}</span>`;
        })
        .join("")}
    </div>
    ${next ? `
      <div class="next-milestone">
        <b>下一档 ${next.level}级</b>
        <span>${next.text}</span>
        ${nextBenefit ? `<em>${nextBenefit}</em>` : ""}
        ${nextCostPlan ? `<small class="next-milestone-cost">${nextCostPlan.label}</small>` : ""}
        ${nextCostPlan ? `<button class="milestone-rush" data-action="rush-milestone" data-kind="${nextCostPlan.kind}" data-id="${nextCostPlan.id}" data-level="${nextCostPlan.targetLevel}" ${nextCostPlan.affordable ? "" : "disabled"} type="button">冲到 ${nextCostPlan.targetLevel}级</button>` : ""}
        ${nextCostPlan && !nextCostPlan.affordable ? `<button class="milestone-materials" data-action="open-tab" data-tab="materials" data-focus-materials="${nextCostPlan.missingKeys.join(",")}" type="button">看材料</button>` : ""}
        <small>还差 ${next.level - level} 级</small>
      </div>
    ` : `
      <div class="next-milestone complete">
        <b>里程碑圆满</b>
        <span>已激活全部关键突破。</span>
      </div>
    `}
  `;
}

function selectedArtifact() {
  return mapById(metaConfig.artifacts)[metaState.selected.artifactId] || null;
}

function selectedCultivation() {
  return mapById(metaConfig.cultivations)[metaState.selected.cultivationId] || null;
}

function selectedTalents() {
  const talentMap = mapById(metaConfig.startingTalents);
  return (metaState.selected.startingTalentIds || []).map((id) => talentMap[id]).filter(Boolean);
}

function collectBuildTags(items = []) {
  const names = new Set();
  for (const item of items) {
    for (const tag of item?.tags || []) {
      const normalized = normalizeStyleTag(tag);
      if (normalized) names.add(normalized);
    }
    const text = `${item?.name || ""}${item?.desc || ""}${item?.id || ""}`;
    if (/剑|sword|keyboard/.test(text)) names.add("sword");
    if (/火|莲|coffee|fire/.test(text)) names.add("fire");
    if (/雷|符|thunder|invoice|ultimate/.test(text)) names.add("thunder");
    if (/气血|减伤|护|龟|回血|survival/.test(text)) names.add("survival");
    if (/修为|灵力|拾取|成长|growth/.test(text)) names.add("growth");
    if (/控|铃|震|control/.test(text)) names.add("control");
  }
  return [...names];
}

function normalizeStyleTag(tag) {
  if (!tag) return "";
  const aliases = {
    飞剑: "sword",
    攻击: "sword",
    灵火: "fire",
    范围: "fire",
    雷符: "thunder",
    爆发: "thunder",
    生存: "survival",
    护体: "survival",
    成长: "growth",
    拾取: "growth",
    控场: "control",
    法器: "control",
  };
  return metaConfig.styleTags?.[tag] ? tag : aliases[tag] || "";
}

function styleTagToken(tagId) {
  const tag = metaConfig.styleTags?.[tagId] || { name: tagId, color: "#f7f3e8" };
  return `<span class="style-tag" style="--tag-color:${tag.color || "#f7f3e8"}">${tag.name}</span>`;
}

function selectedBuildItems() {
  return [selectedArtifact(), selectedCultivation(), ...selectedTalents()].filter(Boolean);
}

function selectedBuildTagCounts() {
  const counts = {};
  for (const item of selectedBuildItems()) {
    const tags = collectBuildTags([item]);
    for (const tag of tags) counts[tag] = (counts[tag] || 0) + 1;
  }
  return counts;
}

function activeBuildSynergies() {
  const counts = selectedBuildTagCounts();
  return (metaConfig.buildSynergies || [])
    .map((synergy) => {
      const tagCount = (synergy.tags || []).reduce((sum, tag) => sum + (counts[tag] || 0), 0);
      const complete = (synergy.tags || []).every((tag) => counts[tag] > 0);
      return { ...synergy, tagCount, complete };
    })
    .filter((synergy) => synergy.complete);
}

function chapterPressureTags(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
  const scores = {};
  const add = (tag, value = 1) => {
    if (!tag) return;
    scores[tag] = (scores[tag] || 0) + value;
  };
  for (const tag of chapter?.recommendedTags || []) add(tag, 2.4);
  const difficultyId = difficulty?.id || metaState?.selected?.difficultyId || "mortal";
  if (difficultyId === "mystic") {
    add("survival", 0.8);
    add("growth", 0.3);
  }
  if (difficultyId === "heaven") {
    add("survival", 1.4);
    add("thunder", 0.5);
  }
  for (const skill of chapter?.bossMechanics?.skills || []) {
    if (skill.shape === "summon") {
      add("fire", 0.8);
      add("sword", 0.4);
    }
    if (["line", "ring", "pool", "pull"].includes(skill.shape)) add("survival", 0.5);
    if (skill.followup || skill.pattern) add("control", 0.35);
    if ((skill.damage || 0) >= 23) add("survival", 0.4);
    if ((skill.count || 0) >= 4) add("fire", 0.35);
  }
  return scores;
}

function scoreBuildItemForChapter(item, chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
  if (!item) return 0;
  const pressure = chapterPressureTags(chapter, difficulty);
  const tags = collectBuildTags([item]);
  let score = tags.reduce((sum, tag) => sum + (pressure[tag] || 0), 0);
  const text = `${item.name || ""}${item.desc || ""}`;
  const bossShapes = (chapter?.bossMechanics?.skills || []).map((skill) => skill.shape);
  if (bossShapes.includes("summon") && /范围|火|莲|飞剑|剑/.test(text)) score += 0.7;
  if (bossShapes.some((shape) => ["pool", "line", "ring", "pull"].includes(shape)) && /气血|减伤|移速|护|龟|回血/.test(text)) score += 0.8;
  if (bossShapes.includes("ring") && /雷|灵力|雷瀑|护/.test(text)) score += 0.45;
  return score;
}

function bestUnlockedBuildItem(kind, chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
  const collection = metaConfig?.[kind] || [];
  return collection
    .filter((item) => isUnlocked(kind, item.id))
    .map((item) => ({ item, score: scoreBuildItemForChapter(item, chapter, difficulty) }))
    .sort((a, b) => b.score - a.score || (a.item.name || "").localeCompare(b.item.name || ""))
    [0]?.item || null;
}

function chapterBuildRecommendation() {
  const chapter = getSelectedChapter();
  const difficulty = getSelectedDifficulty();
  const slots = getStartingTalentSlots();
  const pressure = chapterPressureTags(chapter, difficulty);
  const tags = Object.entries(pressure)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 3);
  const directPreset = (metaConfig.loadoutPresets || []).find((preset) => {
    const availability = presetAvailability(preset);
    return availability.usable && (preset.recommendedChapters || []).includes(chapter?.id);
  });
  const artifact = directPreset?.artifactId && isUnlocked("artifacts", directPreset.artifactId)
    ? mapById(metaConfig.artifacts)[directPreset.artifactId]
    : bestUnlockedBuildItem("artifacts", chapter, difficulty);
  const cultivation = directPreset?.cultivationId && isUnlocked("cultivations", directPreset.cultivationId)
    ? mapById(metaConfig.cultivations)[directPreset.cultivationId]
    : bestUnlockedBuildItem("cultivations", chapter, difficulty);
  const presetTalents = (directPreset?.talentIds || []).filter((id) => isUnlocked("startingTalents", id));
  const scoredTalents = (metaConfig.startingTalents || [])
    .filter((talent) => isUnlocked("startingTalents", talent.id) && !presetTalents.includes(talent.id))
    .map((talent) => ({ talent, score: scoreBuildItemForChapter(talent, chapter, difficulty) }))
    .sort((a, b) => b.score - a.score || (a.talent.name || "").localeCompare(b.talent.name || ""))
    .map(({ talent }) => talent.id);
  const talentIds = unique([...presetTalents, ...scoredTalents]).slice(0, slots);
  const selected = metaState.selected || {};
  const applied =
    (!artifact?.id || selected.artifactId === artifact.id)
    && (!cultivation?.id || selected.cultivationId === cultivation.id)
    && talentIds.every((id) => selected.startingTalentIds?.includes(id));
  const missing = [];
  if (directPreset) {
    const availability = presetAvailability(directPreset);
    missing.push(...availability.missing);
  }
  const reasons = [
    `${chapter?.bossName || "本章 Boss"}：${(chapter?.bossMechanics?.skills || []).slice(0, 2).map((skill) => skill.name).join(" / ") || "常规妖潮"}`,
    tags.length ? `推荐流派：${tags.map((tag) => metaConfig.styleTags?.[tag]?.name || tag).join(" / ")}` : "推荐流派：通用",
    directPreset ? `匹配预设：${directPreset.name}` : "按已解锁组件动态配装",
  ];
  return { chapter, difficulty, tags, artifact, cultivation, talentIds, directPreset, missing: unique(missing), reasons, applied };
}

function applyChapterBuildRecommendation() {
  const recommendation = chapterBuildRecommendation();
  if (!recommendation.artifact && !recommendation.cultivation && !recommendation.talentIds.length) return false;
  if (recommendation.artifact?.id) metaState.selected.artifactId = recommendation.artifact.id;
  if (recommendation.cultivation?.id) metaState.selected.cultivationId = recommendation.cultivation.id;
  metaState.selected.startingTalentIds = recommendation.talentIds.slice(0, getStartingTalentSlots());
  return true;
}

function weaknessPatchTags(row, chapter = getSelectedChapter()) {
  if (!row) return chapter?.recommendedTags || ["growth"];
  if (row.key === "生存") return ["survival", "control"];
  if (row.key === "成长") return ["growth", "thunder", "sword"];
  return [...(chapter?.recommendedTags || []), "sword", "fire", "thunder"];
}

function scoreBuildItemForTags(item, targetTags = []) {
  if (!item) return 0;
  const tags = collectBuildTags([item]);
  const text = `${item.name || ""}${item.desc || ""}${item.id || ""}`;
  let score = tags.reduce((sum, tag) => sum + (targetTags.includes(tag) ? 3 : 0), 0);
  if (targetTags.includes("survival") && /气血|减伤|护|龟|回血|丹田/.test(text)) score += 2;
  if (targetTags.includes("growth") && /修为|灵力|拾取|成长|周天|葫芦/.test(text)) score += 2;
  if (targetTags.some((tag) => ["sword", "fire", "thunder"].includes(tag)) && /剑|火|莲|雷|符|伤害|爆发/.test(text)) score += 1.5;
  return score;
}

function bestUnlockedBuildItemForTags(kind, tags = []) {
  const best = (metaConfig?.[kind] || [])
    .filter((item) => isUnlocked(kind, item.id))
    .map((item) => ({ item, score: scoreBuildItemForTags(item, tags) }))
    .sort((a, b) => b.score - a.score || (a.item.name || "").localeCompare(b.item.name || ""))
    [0];
  return best?.score > 0 ? best.item : null;
}

function weaknessPatchPlan(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
  const readiness = chapterReadinessReport(buildPreviewState(), chapter, difficulty);
  const weakest = [...readiness.rows].sort((a, b) => a.ratio - b.ratio)[0];
  if (!weakest || weakest.state !== "偏弱") return { readiness, weakest, available: false, applied: true, reason: "暂无明显短板" };
  const tags = weaknessPatchTags(weakest);
  const slots = getStartingTalentSlots();
  const artifact = bestUnlockedBuildItemForTags("artifacts", tags);
  const cultivation = bestUnlockedBuildItemForTags("cultivations", tags);
  const patchTalentIds = (metaConfig.startingTalents || [])
    .filter((talent) => isUnlocked("startingTalents", talent.id))
    .map((talent) => ({ talent, score: scoreBuildItemForTags(talent, tags) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.talent.name || "").localeCompare(b.talent.name || ""))
    .map(({ talent }) => talent.id)
    .slice(0, slots);
  const currentTalentIds = metaState.selected?.startingTalentIds || [];
  const talentIds = unique([...patchTalentIds, ...currentTalentIds]).slice(0, slots);
  const selected = metaState.selected || {};
  const applied =
    (!artifact?.id || selected.artifactId === artifact.id)
    && (!cultivation?.id || selected.cultivationId === cultivation.id)
    && talentIds.every((id) => selected.startingTalentIds?.includes(id));
  const names = [
    artifact?.shortName || artifact?.name,
    cultivation?.name,
    ...patchTalentIds.map((id) => mapById(metaConfig.startingTalents)[id]?.name),
  ].filter(Boolean);
  return { readiness, weakest, tags, artifact, cultivation, talentIds, names, available: Boolean(artifact || cultivation || talentIds.length), applied, reason: `补${weakest.key}` };
}

function applyWeaknessPatchPlan(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
  const plan = weaknessPatchPlan(chapter, difficulty);
  if (!plan.available) return false;
  if (plan.artifact?.id) metaState.selected.artifactId = plan.artifact.id;
  if (plan.cultivation?.id) metaState.selected.cultivationId = plan.cultivation.id;
  metaState.selected.startingTalentIds = plan.talentIds.slice(0, getStartingTalentSlots());
  return true;
}

function chapterReadinessReport(preview = buildPreviewState(), chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
  const difficultyId = difficulty?.id || "mortal";
  const pressure = chapterPressureTags(chapter, difficulty);
  const pressureTotal = Math.max(1, Object.values(pressure).reduce((sum, value) => sum + value, 0));
  const power = buildPowerSummary(preview);
  const difficultyFactor = difficultyId === "heaven" ? 1.28 : difficultyId === "mystic" ? 1.14 : 1;
  const bossPressure = (chapter?.enemyMods?.hp || 1) * 18 + (chapter?.enemyMods?.damage || 1) * 16 + (chapter?.spawnMods?.cap || 1) * 10;
  const expected = Math.round((92 + bossPressure + pressureTotal * 8) * difficultyFactor);
  const totalRatio = power.total / Math.max(1, expected);
  const rows = [
    {
      key: "输出",
      value: power.weaponScore,
      need: Math.round(expected * (0.42 + (pressure.sword || pressure.fire || pressure.thunder ? 0.04 : 0))),
      hint: "补飞剑/灵火/雷符伤害",
    },
    {
      key: "生存",
      value: power.sustainScore,
      need: Math.round(expected * (0.28 + (pressure.survival || 0) * 0.025)),
      hint: "补气血、减伤或回血",
    },
    {
      key: "成长",
      value: power.growthScore,
      need: Math.round(expected * (0.24 + (pressure.growth || 0) * 0.025)),
      hint: "补修为、灵力或拾取",
    },
  ].map((row) => {
    const ratio = row.value / Math.max(1, row.need);
    const state = ratio >= 1.08 ? "充足" : ratio >= 0.82 ? "可战" : "偏弱";
    return { ...row, ratio, state };
  });
  const weak = rows.filter((row) => row.state === "偏弱");
  const tier = totalRatio >= 1.12 && !weak.length ? "稳压" : totalRatio >= 0.88 ? "可战" : "偏险";
  const summary = weak.length ? `建议先${weak.map((row) => row.hint).join("，")}` : `${chapter?.bossName || "Boss"}当前压力可控`;
  return { tier, expected, totalRatio, rows, summary, power };
}

function buildPowerSummary(preview = buildPreviewState()) {
  const weaponScore = Math.round(
    (preview.weapons.keyboard?.damage || 0) * (preview.weapons.keyboard?.burst || 1) * 0.45
      + (preview.weapons.coffee?.unlocked ? (preview.weapons.coffee.damage || 0) * Math.max(1, (preview.weapons.coffee.radius || 0) / 70) * 0.9 : 0)
      + (preview.weapons.invoice?.unlocked ? (preview.weapons.invoice.damage || 0) * 1.2 : 0)
      + (preview.ultimate?.damage || 0) * 0.28
  );
  const sustainScore = Math.round(
    (preview.player.maxHp || 0) * 0.26
      + (preview.player.damageReduction || 0) * 420
      + (preview.runMods.killHeal || 0) * 3
      + (preview.runMods.energyRegen || 0) * 24
  );
  const growthScore = Math.round(
    (preview.runMods.xpMultiplier || 0) * 360
      + (preview.energy.gainMultiplier || 0) * 210
      + (preview.player.pickupRadius || 0) * 0.18
      + (preview.energy.value || 0) * 0.25
  );
  const total = Math.max(0, weaponScore + sustainScore + growthScore);
  const tier = total >= 210 ? "成型" : total >= 160 ? "可战" : "起步";
  return { weaponScore, sustainScore, growthScore, total, tier };
}

function createPreviewState() {
  return {
    player: {
      maxHp: theme.player.maxHp,
      speed: theme.player.speed,
      pickupRadius: theme.player.pickupRadius,
      damageReduction: 0,
      speedMultiplier: 0,
    },
    weapons: cloneWeapons(),
    energy: { value: 0, gainMultiplier: 0 },
    ultimate: { damage: theme.ultimate?.damage || 0, damageMultiplier: 0 },
    runMods: { xpMultiplier: 0, healMultiplier: 0, killHeal: 0, energyRegen: 0, eliteDamageBonus: 0, reward: { spiritStoneMultiplier: 0 } },
    spellPowerBonus: 0,
  };
}

function resolvePreviewEffectTarget(preview, target) {
  const mapped = target
    .replace(/^weapon\./, "weapons.")
    .replace(/^player\./, "player.")
    .replace(/^energy\./, "energy.")
    .replace(/^ultimate\./, "ultimate.")
    .replace(/^run\./, "runMods.")
    .replace(/^reward\./, "runMods.reward.");
  return ensurePath(preview, mapped.split("."));
}

function applyPreviewEffect(preview, effect, level = 1) {
  const { holder, key } = resolvePreviewEffectTarget(preview, effect.target);
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

function applyPreviewEffects(preview, effects = [], level = 1) {
  for (const effect of effects) applyPreviewEffect(preview, effect, level);
}

function applyPreviewMilestoneEffects(preview, item, level = 0) {
  for (const [milestone, effects] of Object.entries(item?.milestoneEffects || {})) {
    if (level >= Number(milestone)) applyPreviewEffects(preview, effects, level);
  }
}

function buildPreviewState() {
  const preview = createPreviewState();
  const artifact = selectedArtifact();
  const cultivation = selectedCultivation();
  const artifactLevel = metaState.progression.artifacts[artifact?.id] || 1;
  const cultivationLevel = metaState.progression.cultivations[cultivation?.id] || 1;
  for (const tree of metaConfig.talentTrees || []) {
    const level = Math.min(tree.maxLevel || 12, metaState.progression.talentTree[tree.id] || 0);
    if (level > 0) {
      applyPreviewEffects(preview, tree.effects, level);
      applyPreviewMilestoneEffects(preview, tree, level);
    }
  }
  if (artifact) {
    applyPreviewEffects(preview, artifact.effects, artifactLevel);
    applyPreviewMilestoneEffects(preview, artifact, artifactLevel);
  }
  if (cultivation) applyPreviewEffects(preview, cultivation.effects, cultivationLevel);
  for (const talent of selectedTalents()) applyPreviewEffects(preview, talent.effects, 1);
  for (const synergy of activeBuildSynergies()) applyPreviewEffects(preview, synergy.effects, 1);
  if (preview.player.speedMultiplier) preview.player.speed *= 1 + preview.player.speedMultiplier;
  for (const weapon of Object.values(preview.weapons)) {
    if (weapon.damageMultiplier) weapon.damage = Math.round(weapon.damage * (1 + weapon.damageMultiplier));
  }
  if (preview.ultimate.damageMultiplier) preview.ultimate.damage = Math.round(preview.ultimate.damage * (1 + preview.ultimate.damageMultiplier));
  preview.player.maxHp = Math.round(preview.player.maxHp);
  preview.player.speed = Math.round(preview.player.speed);
  preview.player.pickupRadius = Math.round(preview.player.pickupRadius);
  preview.energy.value = Math.round(clamp(preview.energy.value || 0, 0, preview.energy.max || 100));
  return preview;
}

function buildPreviewRows() {
  const preview = buildPreviewState();
  const rows = [
    ["气血", preview.player.maxHp],
    ["移速", preview.player.speed],
    ["拾取", preview.player.pickupRadius],
    ["飞剑", `${preview.weapons.keyboard?.burst || 1}剑 / 伤害 ${preview.weapons.keyboard?.damage || 0}`],
    ["业火", preview.weapons.coffee?.unlocked ? `${preview.weapons.coffee.level || 1}重 / 范围 ${Math.round(preview.weapons.coffee.radius || 0)}` : "未起手"],
    ["雷符", preview.weapons.invoice?.unlocked ? `${preview.weapons.invoice.level || 1}重 / 伤害 ${preview.weapons.invoice.damage || 0}` : "未起手"],
    ["初始灵力", preview.energy.value || 0],
    ["修为获取", `+${Math.round((preview.runMods.xpMultiplier || 0) * 100)}%`],
    ["升级偏向", cultivationUpgradeBiasSummary()],
  ];
  return rows;
}

function comboPreviewRows(preview = buildPreviewState()) {
  const availableBySpell = {
    "御剑成阵": (preview.weapons.keyboard?.level || 0) > 0 || preview.weapons.keyboard?.unlocked,
    "业火莲华": Boolean(preview.weapons.coffee?.unlocked),
    "雷符万钧": Boolean(preview.weapons.invoice?.unlocked),
  };
  return spellCombos.map((combo) => {
    const missing = combo.recipe.filter((name) => !availableBySpell[name]);
    const record = comboRecord(combo.id) || {};
    const plan = comboPlanAvailability(combo);
    return {
      ...combo,
      ready: missing.length === 0,
      missing,
      record,
      plan,
    };
  });
}

function comboPlanAvailability(combo) {
  const plan = combo.plan || {};
  const missing = [];
  let usable = false;
  if (plan.artifactId && !isUnlocked("artifacts", plan.artifactId)) missing.push(unlockDisplayName("artifacts", plan.artifactId));
  else if (plan.artifactId) usable = true;
  if (plan.cultivationId && !isUnlocked("cultivations", plan.cultivationId)) missing.push(unlockDisplayName("cultivations", plan.cultivationId));
  else if (plan.cultivationId) usable = true;
  for (const talentId of plan.talentIds || []) {
    if (!isUnlocked("startingTalents", talentId)) missing.push(unlockDisplayName("startingTalents", talentId));
    else usable = true;
  }
  return { usable, missing };
}

function applyComboPlan(comboId) {
  const combo = spellCombos.find((item) => item.id === comboId);
  if (!combo || !comboPlanAvailability(combo).usable) return false;
  const plan = combo.plan || {};
  if (plan.artifactId && isUnlocked("artifacts", plan.artifactId)) metaState.selected.artifactId = plan.artifactId;
  if (plan.cultivationId && isUnlocked("cultivations", plan.cultivationId)) metaState.selected.cultivationId = plan.cultivationId;
  const slots = getStartingTalentSlots();
  const nextTalents = [...(metaState.selected.startingTalentIds || [])];
  for (const talentId of plan.talentIds || []) {
    if (!isUnlocked("startingTalents", talentId) || nextTalents.includes(talentId)) continue;
    if (nextTalents.length < slots) nextTalents.push(talentId);
  }
  metaState.selected.startingTalentIds = nextTalents.slice(0, slots);
  return true;
}

function renderComboPreview() {
  const rows = comboPreviewRows();
  return `
    <div class="combo-preview">
      <strong>法术组合</strong>
      <div>
        ${rows
          .map((combo) => `
            <article class="${combo.ready ? "ready" : ""}">
              <span>${combo.ready ? "可触发" : "缺组件"}</span>
              <b>${combo.name}</b>
              <small>${combo.ready ? combo.desc : `还缺：${combo.missing.join(" / ")}`}</small>
              <em>${combo.record.bestCount ? `最佳 ${combo.record.bestCount} 次` : combo.recipe.join(" + ")}</em>
              <button data-action="apply-combo" data-id="${combo.id}" ${combo.plan.usable ? "" : "disabled"}>${combo.ready ? "重套组合" : combo.plan.missing.length ? "套用已解锁" : "套用组合"}</button>
            </article>
          `)
          .join("")}
      </div>
    </div>
  `;
}

function renderBuildSynergyPanel() {
  const preview = buildPreviewState();
  const power = buildPowerSummary(preview);
  const active = activeBuildSynergies();
  const counts = selectedBuildTagCounts();
  const candidates = (metaConfig.buildSynergies || [])
    .filter((synergy) => !active.some((item) => item.id === synergy.id))
    .map((synergy) => {
      const missing = (synergy.tags || []).filter((tag) => !counts[tag]);
      return { ...synergy, missing };
    })
    .sort((a, b) => a.missing.length - b.missing.length)
    .slice(0, 2);
  return `
    <section class="home-card build-synergy-panel">
      <div class="build-preview-head">
        <h2>流派共鸣</h2>
        <small>${power.tier} · 战力 ${power.total}</small>
      </div>
      <div class="power-score">
        <span><b>${power.weaponScore}</b>输出</span>
        <span><b>${power.sustainScore}</b>生存</span>
        <span><b>${power.growthScore}</b>成长</span>
      </div>
      <div class="synergy-list">
        ${active.length
          ? active
              .map((synergy) => `
                <article class="active">
                  <div><strong>${synergy.name}</strong>${(synergy.tags || []).map(styleTagToken).join("")}</div>
                  <p>${synergy.desc}</p>
                  <small>${effectSummary(synergy.effects, 1)}</small>
                </article>
              `)
              .join("")
          : `<article><div><strong>尚未共鸣</strong></div><p>让法宝、功法和初始天赋至少凑齐同一条推荐组合，会获得额外入局效果。</p></article>`}
        ${candidates
          .map((synergy) => `
            <article>
              <div><strong>${synergy.name}</strong>${(synergy.tags || []).map(styleTagToken).join("")}</div>
              <p>还缺：${synergy.missing.map((tag) => metaConfig.styleTags?.[tag]?.name || tag).join(" / ")}</p>
            </article>
          `)
          .join("")}
      </div>
    </section>
  `;
}

function presetAvailability(preset) {
  const missing = [];
  let usable = false;
  if (preset.artifactId && !isUnlocked("artifacts", preset.artifactId)) missing.push(unlockDisplayName("artifacts", preset.artifactId));
  else if (preset.artifactId) usable = true;
  if (preset.cultivationId && !isUnlocked("cultivations", preset.cultivationId)) missing.push(unlockDisplayName("cultivations", preset.cultivationId));
  else if (preset.cultivationId) usable = true;
  for (const talentId of preset.talentIds || []) {
    if (!isUnlocked("startingTalents", talentId)) missing.push(unlockDisplayName("startingTalents", talentId));
    else usable = true;
  }
  return { available: missing.length === 0, usable, missing };
}

function renderCurrencies() {
  if (!ui.metaCurrencies || !metaConfig) return;
  ui.metaCurrencies.innerHTML = Object.entries(metaConfig.currencies)
    .map(([key, config]) => `<span class="meta-currency" style="color:${config.color}">${config.name} ${metaState.currencies[key] || 0}</span>`)
    .join("");
}

function updateQuestBadges() {
  const count = metaConfig && metaState ? claimableQuestCount() : 0;
  setQuestBadge(ui.homeBtn, count, "可领取悬赏");
  const questTab = ui.homeTabs?.querySelector('button[data-tab="quests"]');
  setQuestBadge(questTab, count, "可领取悬赏");
}

function renderHomePanel() {
  if (!metaConfig || !ui.homePanel) return;
  metaState = sanitizeMetaState(metaState);
  if (metaConfig.homeAssets?.background) ui.homePanel.style.setProperty("--home-bg", `url("${optimizedAssetUrl(metaConfig.homeAssets.background)}")`);
  renderCurrencies();
  for (const button of ui.homeTabs.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.tab === activeHomeTab);
  }
  updateQuestBadges();
  const renderers = {
    chapters: renderChapterTab,
    start: renderStartBuildTab,
    journey: renderJourneyTab,
    materials: renderMaterialsTab,
    quests: renderQuestsTab,
    bestiary: renderBestiaryTab,
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
  game.goalTrackingActive = false;
  clearGoalToastTimer();
  ui.pausePanel.classList.add("hidden");
  ui.upgradePanel.classList.add("hidden");
  ui.resultPanel.classList.add("hidden");
  ui.runGoals?.classList.add("hidden");
  ui.goalToast?.classList.add("hidden");
  renderHomePanel();
  ui.homePanel.classList.remove("hidden");
}

function closeHomePanel() {
  if (!metaConfig || !ui.homePanel) return;
  ui.homePanel.classList.add("hidden");
  game.state = previousStateBeforeHome === "paused" ? "paused" : "playing";
  if (game.state === "paused") ui.pausePanel.classList.remove("hidden");
  if (game.state === "playing") {
    game.goalTrackingActive = true;
    updateUi();
  }
  game.lastFrame = performance.now();
}

function runDebugComboTicks() {
  if (debugMetaMode !== "combos") return;
  for (let ticks = 0; ticks < 90 && game.state === "playing"; ticks += 1) {
    update(1 / 30);
  }
  render();
}

function runDebugEventTicks() {
  if (debugMetaMode !== "events") return;
  for (let ticks = 0; ticks < 150 && game.state === "playing"; ticks += 1) {
    update(1 / 30);
  }
  const eventPickup = game.pickups.find((pickup) => pickup.type === "event");
  if (eventPickup) {
    game.player.x = eventPickup.x;
    game.player.y = eventPickup.y;
    for (let ticks = 0; ticks < 8 && game.state === "playing"; ticks += 1) {
      update(1 / 30);
    }
  }
  render();
}

function runDebugAffixTicks() {
  if (debugMetaMode !== "affixes") return;
  for (let ticks = 0; ticks < 90 && game.state === "playing"; ticks += 1) {
    update(1 / 30);
  }
  render();
}

function startRunFromHome() {
  resetGame();
  game.state = "playing";
  game.goalTrackingActive = true;
  updateUi();
  game.lastFrame = performance.now();
  runDebugComboTicks();
  runDebugEventTicks();
  runDebugAffixTicks();
  if (debugResultMode === "first-clear" && metaConfig && metaState && game.chapter) {
    const record = ensureChapterRecord(game.chapter.id);
    const difficultyId = game.difficulty?.id || "mortal";
    const unlocks = game.chapter.firstClearUnlocks || {};
    record.clearedDifficulties = (record.clearedDifficulties || []).filter((id) => id !== difficultyId);
    metaState.unlocks.chapters = (metaState.unlocks.chapters || []).filter((id) => !(unlocks.chapters || []).includes(id));
    metaState.unlocks.artifacts = (metaState.unlocks.artifacts || []).filter((id) => !(unlocks.artifacts || []).includes(id));
    metaState.unlocks.startingTalents = (metaState.unlocks.startingTalents || []).filter((id) => !(unlocks.startingTalents || []).includes(id));
    metaState.unlocks.cultivations = (metaState.unlocks.cultivations || []).filter((id) => !(unlocks.cultivations || []).includes(id));
    for (const id of unlocks.artifacts || []) delete metaState.progression.artifacts[id];
    for (const id of unlocks.cultivations || []) delete metaState.progression.cultivations[id];
    if (!metaState.unlocks.difficulties[game.chapter.id]) metaState.unlocks.difficulties[game.chapter.id] = ["mortal"];
    if (difficultyId === "mortal") metaState.unlocks.difficulties[game.chapter.id] = ["mortal"];
    if (difficultyId === "mystic") metaState.unlocks.difficulties[game.chapter.id] = ["mortal", "mystic"];
    game.runStats.bossKilled = true;
    game.runStats.eliteKills = Math.max(game.runStats.eliteKills || 0, 3);
    game.runStats.breakthroughs = Math.max(game.runStats.breakthroughs || 0, 2);
    game.runStats.xpCollected = Math.max(game.runStats.xpCollected || 0, 180);
    game.killCount = Math.max(game.killCount, 64);
    game.time = Math.max(game.time, 118);
    game.player.level = Math.max(game.player.level, 7);
  }
  if (debugFinishOnStart) finishRun();
}

function resolveDebugEventChoiceId() {
  const pending = game.activeEventChoice;
  if (!pending?.options?.length) return "";
  const requested = pending.options.find((option) => option.id === debugResolveEventChoice || option.label === debugResolveEventChoice);
  return requested?.id || pending.options[0]?.id || "";
}

function runDebugResolvedEventScenario() {
  if (!metaConfig || !debugResolveEventId) return false;
  startRunFromHome();
  spawnRunEvent(debugResolveEventId);
  for (let step = 0; step <= debugResolveEventChain; step += 1) {
    for (const pickup of game.pickups) {
      pickup.x = game.player.x;
      pickup.y = game.player.y;
    }
    updatePickups(1 / 30);
    if (game.activeEventChoice) {
      const choiceId = resolveDebugEventChoiceId();
      if (choiceId) selectRunEventChoice(choiceId);
    }
  }
  if (debugOpenTab && metaConfig) openHomePanel(debugOpenTab);
  else updateUi();
  return true;
}

function difficultyAllowed(chapterId, difficultyId) {
  return (metaState.unlocks.difficulties[chapterId] || ["mortal"]).includes(difficultyId);
}

function unlockConditionText(unlock = {}) {
  if (!unlock || unlock.type === "default") return "默认解锁";
  if (unlock.type === "chapterClear") {
    const chapter = mapById(metaConfig.chapters)[unlock.chapterId];
    return `通关 ${chapter?.name || unlock.chapterId}`;
  }
  return "待解锁";
}

function firstClearSummary(chapter) {
  const unlocks = chapter.firstClearUnlocks || {};
  const names = [
    ...(unlocks.chapters || []).map((id) => mapById(metaConfig.chapters)[id]?.name || id),
    ...(unlocks.artifacts || []).map((id) => mapById(metaConfig.artifacts)[id]?.name || id),
    ...(unlocks.startingTalents || []).map((id) => mapById(metaConfig.startingTalents)[id]?.name || id),
    ...(unlocks.cultivations || []).map((id) => mapById(metaConfig.cultivations)[id]?.name || id),
  ].filter(Boolean);
  return names.length ? names.join(" / ") : "高难度与材料收益";
}

function chapterRewardMultiplierText(difficulty) {
  const multiplier = difficulty?.rewardMultiplier || 1;
  if (multiplier <= 1) return "当前难度按基础收益结算";
  return `当前难度奖励 x${multiplier.toFixed(1)} · 额外 ${Math.round((multiplier - 1) * 100)}%`;
}

function chapterRewardHighlights(chapter, difficulty, locked = false) {
  if (locked) return "";
  const difficultyId = difficulty?.id || "mortal";
  const difficultyName = difficulty?.name || "当前难度";
  const record = metaState.records.chapters?.[chapter.id];
  const cleared = (record?.clearedDifficulties || []).includes(difficultyId);
  const clearDetail = cleared
    ? `${difficultyName}已首通，适合复刷 ${chapterDropSummary(chapter, difficulty)}`
    : `${difficultyName}首通可解锁 ${firstClearSummary(chapter)}`;
  return `
    <div class="chapter-reward-highlights">
      <span class="chapter-reward-pill bonus">
        <b>${difficultyName}收益</b>
        <small>${chapterRewardMultiplierText(difficulty)}</small>
      </span>
      <span class="chapter-reward-pill ${cleared ? "repeat" : "first"}">
        <b>${cleared ? "已首通" : "首通待拿"}</b>
        <small>${clearDetail}</small>
      </span>
    </div>
  `;
}

function chapterEventTagIds(chapter) {
  return unique((chapter?.runEvents || []).filter((event) => !event.hidden || shouldRevealRunEvent(event)).flatMap((event) => event.tags || []));
}

function chapterBuildContextTags(chapter) {
  return unique([...(chapter?.recommendedTags || []), ...chapterEventTagIds(chapter)]);
}

function runEventDetailText(event, difficulty = getSelectedDifficulty()) {
  const damage = resolveEventValue(event, "damage", difficulty);
  const ambush = resolveEventAmbush(event, difficulty);
  const challenge = resolveEventChallenge(event, difficulty);
  const choices = resolveEventChoices(event, difficulty);
  const followupText = eventFollowupTargets(event, difficulty).map((target) => eventFollowupHintText(target)).join(" / ");
  const parts = [
    event.summary || "",
    choices.length ? `可择 ${choices.map((choice) => choice.label).join(" / ")}` : "",
    followupText ? `连锁 ${followupText}` : event.followupEventId ? `连锁 ${followupEventSummary(event.followupEventId)}` : "",
    event.healRatio ? `回血 ${Math.round(event.healRatio * 100)}%` : "",
    event.energy ? `灵力 +${Math.round(event.energy)}` : "",
    damage > 0 ? `代价 ${Math.round(damage)}` : "",
    Object.keys(ambush).length ? `伏击 ${ambushSummaryText(ambush)}` : "",
    challenge ? `试炼 ${Math.round(challenge.duration || 12)}s` : "",
    challenge ? challengeRewardSummary(challenge) : "",
    formatCost(resolveEventCurrencies(event, "rewards", difficulty)),
    formatCost(resolveEventCurrencies(event, "pickupRewards", difficulty)),
  ].filter(Boolean);
  return parts.join(" / ");
}

function renderRunEventPreview(chapter, difficulty, locked = false) {
  const events = (chapter?.runEvents || []).filter((event) => !event.hidden || shouldRevealRunEvent(event));
  if (locked || !events.length) return "";
  return `
    <div class="chapter-event-preview">
      <strong>章节奇遇</strong>
      <div class="chapter-event-list">
        ${events
          .map((event) => `
            <span class="chapter-event-pill ${event.kind || "event"}">
              <b>${event.label}</b>
              <small>${runEventDetailText(event, difficulty)}</small>
              ${(event.tags || []).length ? `<em>${(event.tags || []).map(styleTagToken).join("")}</em>` : ""}
            </span>
          `)
          .join("")}
      </div>
    </div>
  `;
}

function renderBestiaryRewardHighlights(chapter, difficulty, locked = false) {
  if (locked) return "";
  return `
    <div class="bestiary-rewards">
      ${chapterRewardHighlights(chapter, difficulty, locked)}
    </div>
  `;
}

function chapterClearCount() {
  return (metaConfig?.chapters || []).filter((chapter) => {
    const record = metaState.records.chapters?.[chapter.id];
    return record?.clearedDifficulties?.length > 0;
  }).length;
}

function difficultyProgressCount() {
  return (metaConfig?.chapters || []).reduce((total, chapter) => {
    const record = metaState.records.chapters?.[chapter.id];
    return total + (record?.clearedDifficulties?.length || 0);
  }, 0);
}

function totalDifficultyCount() {
  return (metaConfig?.chapters?.length || 0) * (metaConfig?.difficulties?.length || 0);
}

function nextChapterGoal() {
  const chapters = metaConfig?.chapters || [];
  return chapters.find((chapter) => {
    if (!isUnlocked("chapters", chapter.id)) return false;
    const record = metaState.records.chapters?.[chapter.id];
    return !(record?.clearedDifficulties || []).includes("mortal");
  }) || chapters.find((chapter) => !isUnlocked("chapters", chapter.id)) || null;
}

function nextQuestGoal() {
  return (metaConfig.quests || [])
    .map((quest) => ({ quest, state: questState(quest) }))
    .find(({ state }) => !state.claimed) || null;
}

function upgradeCandidates() {
  const rows = [];
  for (const tree of metaConfig.talentTrees || []) {
    const level = metaState.progression.talentTree[tree.id] || 0;
    if (level < tree.maxLevel) rows.push({ kind: "天赋", name: tree.name, level, maxLevel: tree.maxLevel, cost: upgradeCost("talent", tree.id, level) });
  }
  for (const artifact of metaConfig.artifacts || []) {
    const level = metaState.progression.artifacts[artifact.id] || 0;
    if (isUnlocked("artifacts", artifact.id) && level < artifact.maxLevel) rows.push({ kind: "法宝", name: artifact.shortName || artifact.name, level, maxLevel: artifact.maxLevel, cost: upgradeCost("artifact", artifact.id, level) });
  }
  for (const cultivation of metaConfig.cultivations || []) {
    const level = metaState.progression.cultivations[cultivation.id] || 0;
    if (isUnlocked("cultivations", cultivation.id) && level < cultivation.maxLevel) rows.push({ kind: "功法", name: cultivation.name, level, maxLevel: cultivation.maxLevel, cost: upgradeCost("cultivation", cultivation.id, level) });
  }
  for (const facility of metaConfig.facilities || []) {
    const level = metaState.progression.facilities[facility.id] || 0;
    if (level < facility.maxLevel) rows.push({ kind: "洞府", name: facility.name, level, maxLevel: facility.maxLevel, cost: upgradeCost("facility", facility.id, level) });
  }
  return rows;
}

function nextUpgradeGoal() {
  return upgradeCandidates()
    .map((item) => {
      const missing = missingCost(item.cost);
      const missingTotal = Object.values(missing).reduce((sum, value) => sum + value, 0);
      return { ...item, missing, missingTotal };
    })
    .sort((a, b) => a.missingTotal - b.missingTotal || a.level - b.level)[0] || null;
}

function currentDifficultyEventProgress(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
  if (!chapter || !difficulty) return [];
  return (chapter.runEvents || []).map((event) => {
    const record = metaState.records?.events?.[event.id] || {};
    const choices = resolveEventChoices(event, difficulty);
    const seenChoices = choices.filter((choice) => record.choices?.[choice.id]);
    const unseenChoices = choices.filter((choice) => !record.choices?.[choice.id]);
    const routeTargets = eventFollowupTargets(event, difficulty);
    const seenRoutes = routeTargets.filter((target) => record.followups?.[target.eventId]);
    const unseenRoutes = routeTargets.filter((target) => !record.followups?.[target.eventId]);
    const unseenSecretRoutes = unseenRoutes.filter((target) => target.kind === "secret");
    const unseenChainRoutes = unseenRoutes.filter((target) => target.kind !== "secret");
    return {
      event,
      record,
      choices,
      seenChoices,
      unseenChoices,
      routeTargets,
      seenRoutes,
      unseenRoutes,
      unseenSecretRoutes,
      unseenChainRoutes,
    };
  });
}

function nextEventProgressGoal(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
  const progress = currentDifficultyEventProgress(chapter, difficulty);
  const missingBranch = progress.find((row) => row.choices.length && row.unseenChoices.length);
  if (missingBranch) {
    return {
      kind: "branch",
      chapter,
      difficulty,
      event: missingBranch.event,
      unseenChoices: missingBranch.unseenChoices,
      seenCount: missingBranch.seenChoices.length,
      totalCount: missingBranch.choices.length,
    };
  }
  const missingEncounter = progress.find((row) => !row.record.count && !row.event.hidden);
  if (missingEncounter) {
    return {
      kind: "event",
      chapter,
      difficulty,
      event: missingEncounter.event,
    };
  }
  const missingSecret = progress.find((row) => row.unseenSecretRoutes.length);
  if (missingSecret) {
    return {
      kind: "secret",
      chapter,
      difficulty,
      event: missingSecret.event,
      unseenRoutes: missingSecret.unseenSecretRoutes,
      seenCount: missingSecret.seenRoutes.length,
      totalCount: missingSecret.routeTargets.length,
    };
  }
  const missingFollowup = progress.find((row) => row.unseenChainRoutes.length);
  if (missingFollowup) {
    return {
      kind: "followup",
      chapter,
      difficulty,
      event: missingFollowup.event,
      unseenRoutes: missingFollowup.unseenChainRoutes,
      seenCount: missingFollowup.seenRoutes.length,
      totalCount: missingFollowup.routeTargets.length,
    };
  }
  return null;
}

function journeyRecommendationRows() {
  const rows = [];
  const claimable = claimableQuestRows(1)[0];
  if (claimable) {
    rows.push({
      label: "先领奖励",
      title: claimable.quest.name,
      body: `悬赏已完成，领取后获得 ${formatCost(claimable.quest.rewards)}。`,
      action: "打开悬赏",
      tab: "quests",
    });
  }

  const chapter = nextChapterGoal();
  if (chapter) {
    const locked = !isUnlocked("chapters", chapter.id);
    rows.push({
      label: locked ? "解锁路线" : "下一章",
      title: chapter.name,
      body: locked ? `需要先完成：${unlockConditionText(chapter.unlock)}。` : `目标：${chapter.bossName} 首通，奖励 ${firstClearSummary(chapter)}。`,
      action: "查看章节",
      tab: "chapters",
    });
  }

  const upgrade = nextUpgradeGoal();
  if (upgrade) {
    const missingEntries = Object.entries(upgrade.missing);
    rows.push({
      label: missingEntries.length ? "补材料" : "可升级",
      title: `${upgrade.kind} · ${upgrade.name}`,
      body: missingEntries.length
        ? `缺 ${formatCost(upgrade.missing)}，${unique(missingEntries.map(([key]) => recommendChapterForMaterial(key)).filter(Boolean)).join(" / ") || "继续刷当前章节"}。`
        : `材料已够，建议升到 Lv.${upgrade.level + 1}。`,
      action: missingEntries.length ? "看材料" : `看${upgrade.kind}`,
      tab: missingEntries.length ? "materials" : upgrade.kind === "天赋" ? "talents" : upgrade.kind === "法宝" ? "artifacts" : upgrade.kind === "功法" ? "cultivation" : "facilities",
      focusMaterials: missingEntries.map(([key]) => key),
    });
  }

  const eventGoal = nextEventProgressGoal();
  if (eventGoal) {
    if (eventGoal.kind === "branch") {
      rows.push({
        label: "补奇遇分支",
        title: `${eventGoal.event.label} ${eventGoal.seenCount}/${eventGoal.totalCount}`,
        body: `${eventGoal.chapter.name} · ${eventGoal.difficulty.name} 还有未见走法：${eventGoal.unseenChoices.map((choice) => choice.label).join(" / ")}。`,
        action: "看路线",
        tab: "journey",
      });
    } else if (eventGoal.kind === "event") {
      rows.push({
        label: "补奇遇图鉴",
        title: eventGoal.event.label,
        body: `${eventGoal.chapter.name} · ${eventGoal.difficulty.name} 仍未遭遇，下一局可优先补齐本章奇遇记录。`,
        action: "看图鉴",
        tab: "journey",
      });
    } else if (eventGoal.kind === "followup") {
      rows.push({
        label: "补连锁奇遇",
        title: `${eventGoal.event.label} ${eventGoal.seenCount}/${eventGoal.totalCount}`,
        body: `${eventGoal.chapter.name} 还有未触发连锁：${eventGoal.unseenRoutes.map((target) => target.routeLabel).join(" / ")}。`,
        action: "看路线",
        tab: "journey",
      });
    } else if (eventGoal.kind === "secret") {
      rows.push({
        label: "补隐秘奇遇",
        title: `${eventGoal.event.label} ${eventGoal.seenCount}/${eventGoal.totalCount}`,
        body: `${eventGoal.chapter.name} 还有未触发秘径：${eventGoal.unseenRoutes.map((target) => `${target.routeLabel}${target.chance ? ` ${formatChancePercent(target.chance)}` : ""}`).join(" / ")}。`,
        action: "看路线",
        tab: "journey",
      });
    }
  }

  const questGoal = nextQuestGoal();
  if (questGoal && !claimable) {
    rows.push({
      label: "悬赏目标",
      title: questGoal.quest.name,
      body: questProgressText(questGoal.quest, questGoal.state.progress),
      action: "打开悬赏",
      tab: "quests",
    });
  }

  return rows.slice(0, 4);
}

function resultRecommendationRows() {
  const rows = [];
  const materialRoute = materialResultRecommendation();
  if (materialRoute) rows.push(materialRoute);
  const unlocks = game.runStats?.unlocks || [];
  if (unlocks.length) {
    rows.push({
      label: game.runStats?.bossKilled ? "首通收获" : "新进展",
      title: unlocks[0],
      body: unlocks.slice(1, 4).join(" / ") || "新内容已加入洞府，可调整章节、构筑或继续修炼。",
      action: "查看章节",
      tab: "chapters",
    });
  }
  if (claimableQuestCount() > 0) {
    const claimable = claimableQuestRows(1)[0];
    rows.push({
      label: "可领奖励",
      title: `${claimableQuestCount()} 个悬赏可领取`,
      body: claimable ? `${claimable.quest.name}：${formatCost(claimable.quest.rewards)}` : "领取后可继续升级战力。",
      action: "打开悬赏",
      tab: "quests",
    });
  }
  if (!game.runStats?.bossKilled && game.chapter) {
    const readiness = chapterReadinessReport();
    const weak = readiness.rows.filter((row) => row.state === "偏弱");
    const patch = weaknessPatchPlan();
    rows.push({
      label: "战备复盘",
      title: `${game.chapter.bossName} 尚未镇压`,
      body: weak.length ? `短板：${weak.map((row) => `${row.key}${row.value}/${row.need}`).join(" / ")}，${readiness.summary}。` : `当前 ${readiness.tier}，建议按本章策令重整构筑。`,
      action: patch.available && !patch.applied ? "补短板并调构筑" : "调构筑",
      tab: "start",
      postAction: patch.available && !patch.applied ? "applyWeaknessPatch" : "",
    });
  }
  const existingTabs = new Set(rows.map((row) => `${row.label}:${row.tab}`));
  for (const row of journeyRecommendationRows()) {
    const key = `${row.label}:${row.tab}`;
    if (existingTabs.has(key)) continue;
    rows.push(row);
    existingTabs.add(key);
    if (rows.length >= 4) break;
  }
  return rows.slice(0, 4);
}

function materialResultRecommendation() {
  if (!targetMaterial || !game.runStats?.rewards) return null;
  const materialName = currencyName(targetMaterial);
  const gained = game.runStats.rewards[targetMaterial] || 0;
  const unlocking = targetMaterialMode === "unlock";
  return {
    label: unlocking ? "路线解锁" : "材料路线",
    title: unlocking ? `${game.chapter?.name || "当前章节"}已推进` : `${materialName}路线`,
    body: gained > 0
      ? `本局获得 ${materialName} ${gained}，可回材料页继续比较收益路线。`
      : unlocking
        ? `回材料页继续查看${materialName}路线，确认下一步可刷章节。`
        : `本局未获得${materialName}，回材料页切换路线或难度。`,
    action: "回材料页",
    tab: "materials",
    focusMaterials: [targetMaterial],
    previewDifficulty: targetMaterialDifficulty || game.difficulty?.id || "",
  };
}

function comboNextMilestone(bestCount = 0) {
  return [1, 3, 5, 8, 12].find((target) => bestCount < target) || bestCount + 5;
}

function comboJourneyRows() {
  const preview = buildPreviewState();
  return comboPreviewRows(preview).map((combo) => {
    const record = combo.record || {};
    const nextTarget = comboNextMilestone(record.bestCount || 0);
    const remaining = Math.max(0, nextTarget - (record.bestCount || 0));
    const missingText = combo.ready
      ? "本局构筑已成型"
      : combo.missing.length
        ? `缺 ${combo.missing.join(" / ")}`
        : combo.plan.missing.length
          ? `待解锁 ${combo.plan.missing.join(" / ")}`
          : "可套用组合";
    return {
      ...combo,
      nextTarget,
      remaining,
      missingText,
      routeLabel: record.bestCount ? "冲刺新档" : "首次见招",
      context: record.bestCount ? comboRecordContext(record) : combo.unlockText,
    };
  });
}

function renderComboJourneyPanel() {
  const rows = comboJourneyRows();
  return `
    <section class="home-card combo-route">
      <div class="build-preview-head">
        <h2>合术路线</h2>
        <small>${rows.filter((row) => row.record.bestCount).length}/${rows.length} 已见招</small>
      </div>
      <div class="combo-route-grid">
        ${rows
          .map((combo) => `
            <article class="${combo.ready ? "ready" : ""}">
              <div class="combo-route-head">
                <span>${combo.routeLabel}</span>
                <strong>${combo.name}</strong>
              </div>
              <p>${combo.desc}</p>
              <div class="combo-route-record">
                <span><b>${combo.record.bestCount || 0}</b>最佳</span>
                <span><b>${combo.record.lastCount || 0}</b>上局</span>
                <span><b>${combo.record.runs || 0}</b>成型</span>
                <span><b>${combo.nextTarget}</b>目标</span>
              </div>
              <small>${combo.missingText} · ${combo.context}</small>
              <div class="combo-route-actions">
                <button data-action="apply-combo" data-id="${combo.id}" ${combo.plan.usable ? "" : "disabled"}>${combo.ready ? "重套组合" : "套用组合"}</button>
                <button data-action="open-tab" data-tab="bestiary" type="button">看图鉴</button>
                <button data-action="open-tab" data-tab="quests" type="button">做悬赏</button>
              </div>
            </article>
          `)
          .join("")}
      </div>
    </section>
  `;
}

function eventCodexRows() {
  const eventRows = [];
  const difficulty = getSelectedDifficulty();
  for (const chapter of metaConfig.chapters || []) {
    for (const event of chapter.runEvents || []) {
      if (eventRows.some((row) => row.id === event.id)) continue;
      const record = metaState.records?.events?.[event.id] || {};
      if (event.hidden && !record.count) continue;
      const choices = resolveEventChoices(event, difficulty);
      const choiceLabels = choices.map((choice) => choice.label);
      const routeTargets = eventFollowupTargets(event, difficulty);
      const followups = routeTargets.map((target) => eventFollowupHintText(target)).filter(Boolean);
      const seenChoices = choices.filter((choice) => record.choices?.[choice.id]);
      const unseenChoices = choices.filter((choice) => !record.choices?.[choice.id]);
      const seenFollowups = routeTargets.filter((target) => record.followups?.[target.eventId]);
      eventRows.push({
        id: event.id,
        label: event.label,
        chapterId: chapter.id,
        chapterName: chapter.name,
        summary: event.summary || "",
        count: record.count || 0,
        choices: Object.values(record.choices || {}),
        blessings: Object.values(record.blessings || {}),
        followups: Object.values(record.followups || {}),
        choiceLabels,
        followupHints: followups,
        seenChoiceCount: seenChoices.length,
        choiceTotal: choices.length,
        unseenChoiceLabels: unseenChoices.map((choice) => choice.label),
        seenFollowupCount: seenFollowups.length,
        followupTotal: routeTargets.length,
        tags: event.tags || [],
      });
    }
  }
  return eventRows.sort((a, b) => b.count - a.count || a.chapterName.localeCompare(b.chapterName, "zh-CN"));
}

function chapterEventRouteRows() {
  return (metaConfig.chapters || []).map((chapter) => {
    const routes = [];
    let seen = 0;
    let total = 0;
    for (const event of chapter.runEvents || []) {
      if (event.hidden && !hasSeenRunEvent(event.id)) continue;
      const record = metaState.records?.events?.[event.id] || {};
      for (const target of eventFollowupTargets(event, getSelectedDifficulty())) {
        total += 1;
        if (record.followups?.[target.eventId]) seen += 1;
        routes.push(`${event.label} · ${eventFollowupHintText(target)}`);
      }
    }
    return {
      chapter,
      routes,
      seen,
      total,
      unlocked: isUnlocked("chapters", chapter.id),
    };
  });
}

function renderEventJourneyPanel() {
  const eventRows = eventCodexRows();
  const routeRows = chapterEventRouteRows();
  return `
    <section class="journey-grid event-journey-grid">
      <article class="home-card journey-card event-route-card">
        <div class="journey-card-head">
          <span>章节奇遇路线</span>
          <b>${routeRows.filter((row) => row.routes.length).length} 条连锁</b>
        </div>
        <div class="event-route-list">
          ${routeRows
            .map((row) => `
              <span class="${row.unlocked ? "" : "locked"}">
                <b>${row.chapter.name}</b>
                <small>${row.routes.length ? `已探 ${row.seen}/${row.total} · ${row.routes.join(" / ")}` : "当前章节暂无连锁奇遇"}</small>
              </span>
            `)
            .join("")}
        </div>
      </article>
      <article class="home-card journey-card event-codex-card">
        <div class="journey-card-head">
          <span>奇遇图鉴</span>
          <b>${eventRows.filter((row) => row.count > 0).length}/${eventRows.length} 已见</b>
        </div>
        <div class="event-codex-list">
          ${eventRows
            .map((row) => `
              <span class="${row.count > 0 ? "seen" : ""}">
                <b>${row.label}${row.choiceTotal ? ` · 分支 ${row.seenChoiceCount}/${row.choiceTotal}` : ""}${row.followupTotal ? ` · 连锁 ${row.seenFollowupCount}/${row.followupTotal}` : ""}</b>
                <small>${row.chapterName} · ${row.count ? `遭遇 ${row.count} 次` : "未遭遇"}${row.summary ? ` · ${row.summary}` : ""}</small>
                <em>${row.choiceLabels.length ? `分支：${row.choiceLabels.join(" / ")}` : "固定收益"}${row.unseenChoiceLabels.length ? ` · 未见：${row.unseenChoiceLabels.join(" / ")}` : ""}${row.followupHints.length ? ` · 连锁：${row.followupHints.join(" / ")}` : ""}${row.blessings.length ? ` · 加持：${row.blessings.map((item) => item.label).join(" / ")}` : ""}</em>
              </span>
            `)
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function bossSkillShapeLabel(skill) {
  const map = {
    circle: "范围预警",
    line: "直线预警",
    cone: "扇形预警",
    pool: "持续地面",
    pull: "牵引控场",
    ring: "环形封锁",
    summon: "召唤压制",
  };
  return map[skill.shape] || "机制";
}

function bossSkillPhaseLabel(skill) {
  if (!skill.phase) return "开场";
  if (skill.phase === 1) return "70% 后";
  if (skill.phase === 2) return "35% 后";
  return `${skill.phase} 阶`;
}

function bossSkillSummary(skill, difficulty = getSelectedDifficulty()) {
  const effective = effectiveBossSkillConfig(skill, difficulty);
  const parts = [
    bossSkillShapeLabel(effective),
    bossSkillPhaseLabel(effective),
    effective.telegraph ? `预警 ${effective.telegraph.toFixed(2)}s` : "",
    effective.count && effective.count !== skill.count ? `数量 ${effective.count}` : "",
    effective.duration ? `留场 ${effective.duration.toFixed(1)}s` : "",
    effective.damage && effective.damage !== skill.damage ? `伤害 ${effective.damage}` : "",
    skill.followup ? "组合技" : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

function matchingPresetNames(chapter) {
  const tags = chapterBuildContextTags(chapter);
  const directMatches = (metaConfig.loadoutPresets || [])
    .filter((preset) => (preset.recommendedChapters || []).includes(chapter.id))
    .map((preset) => preset.name);
  if (directMatches.length) return directMatches.slice(0, 3);
  return (metaConfig.loadoutPresets || [])
    .filter((preset) => tags.some((tag) => (preset.tags || []).includes(tag)))
    .map((preset) => preset.name)
    .slice(0, 3);
}

function difficultySummary(chapter, difficulty) {
  const pacing = theme.balance?.difficultyPacing?.[difficulty?.id] || {};
  const bossAt = bossAtForChapterConfig(chapter, difficulty);
  const hpMultiplier = pacing.bossHpMultiplier || 1;
  const mods = bossSkillModsForDifficulty(difficulty);
  const mechanics = [
    mods.cooldown && mods.cooldown !== 1 ? `技能冷却 x${mods.cooldown.toFixed(2)}` : "",
    mods.telegraph && mods.telegraph !== 1 ? `预警 x${mods.telegraph.toFixed(2)}` : "",
    mods.countBonus ? `技能数量 +${mods.countBonus}` : "",
  ].filter(Boolean);
  return `${difficulty.desc || ""} Boss ${bossAt}s 出场 / 血量 x${hpMultiplier.toFixed(2)} / 奖励 x${(difficulty.rewardMultiplier || 1).toFixed(1)}${mechanics.length ? ` / ${mechanics.join(" / ")}` : ""}`;
}

function bossAtForChapterConfig(chapter, difficulty) {
  const target = theme.balance?.bossTargets?.chapterBossAt?.[chapter?.id] ?? chapter?.bossAt;
  const multiplier = theme.balance?.difficultyPacing?.[difficulty?.id]?.bossAtMultiplier || 1;
  return typeof target === "number" ? Math.round(target * multiplier) : target || 0;
}

function renderBossGuide(chapter, difficulty) {
  const mechanics = chapter.bossMechanics || {};
  const presetNames = matchingPresetNames(chapter);
  return `
    <div class="boss-guide">
      <div class="boss-guide-head">
        <strong>${chapter.bossName}</strong>
        <span>${mechanics.subtitle || "章节 Boss"}</span>
      </div>
      <div class="boss-skill-list">
        ${(mechanics.skills || [])
          .map((skill) => `
            <span class="boss-skill">
              <b>${skill.name}</b>
              <small>${bossSkillSummary(skill, difficulty)}</small>
            </span>
          `)
          .join("")}
      </div>
      <div class="boss-guide-foot">
        <span>阶段：${(mechanics.phaseTexts || []).join(" / ") || "血量阶段变化"}</span>
        <span>推荐：${chapterBuildContextTags(chapter).map(styleTagToken).join("")}${presetNames.length ? ` ${presetNames.join(" / ")}` : ""}</span>
        <span>难度：${difficultySummary(chapter, difficulty)}</span>
      </div>
    </div>
  `;
}

function renderChapterReadiness(chapter, difficulty, locked = false) {
  if (locked) return "";
  const readiness = chapterReadinessReport(buildPreviewState(), chapter, difficulty);
  const weak = readiness.rows.filter((row) => row.state === "偏弱");
  const detail = weak.length
    ? `短板：${weak.map((row) => row.key).join(" / ")}`
    : readiness.summary;
  return `
    <div class="chapter-readiness ${readiness.tier === "稳压" ? "ready" : readiness.tier === "偏险" ? "risky" : ""}">
      <span><b>${readiness.tier}</b>当前构筑</span>
      <em>战备 ${readiness.power.total} / 需求 ${readiness.expected}</em>
      <small>${detail}</small>
    </div>
  `;
}

function renderBestiaryPatchAction(chapter, difficulty, locked = false) {
  if (locked) return "";
  const patchPlan = weaknessPatchPlan(chapter, difficulty);
  if (!patchPlan.available || patchPlan.applied) return "";
  return `
    <div class="readiness-action bestiary-patch-action">
      <span>${patchPlan.reason}：${patchPlan.names.slice(0, 3).join(" / ")}</span>
      <button data-action="patch-bestiary-build" data-id="${chapter.id}" data-difficulty="${difficulty.id}" type="button">补短板</button>
    </div>
  `;
}

function renderChapterMaterialTarget(chapter, difficulty, selected = false) {
  if (!selected || !targetMaterial) return "";
  const amount = chapterDropEstimate(chapter, difficulty)[targetMaterial] || 0;
  if (amount <= 0) return "";
  const unlocking = targetMaterialMode === "unlock";
  return `
    <div class="chapter-material-target ${unlocking ? "unlocking" : ""}">
      <span>${unlocking ? "解锁" : "刷"}${currencyName(targetMaterial)}路线</span>
      <b>${difficulty?.name || "当前难度"}预计 ${currencyToken(targetMaterial, amount, "material-token route-token")}</b>
      ${unlocking ? `<small>完成这里后再回材料页刷目标路线</small>` : ""}
    </div>
  `;
}

function setSelectedChapterForBuild(chapterId) {
  if (!chapterId || !metaState) return;
  metaState.selected.chapterId = chapterId;
  const allowed = metaState.unlocks.difficulties[chapterId] || ["mortal"];
  if (!allowed.includes(metaState.selected.difficultyId)) metaState.selected.difficultyId = allowed[0] || "mortal";
}

function renderChapterTab() {
  ui.homeContent.innerHTML = `${renderHomeBanner("chapters")}<div class="home-grid chapter-grid">${metaConfig.chapters
    .map((chapter) => {
      const locked = !isUnlocked("chapters", chapter.id);
      const selected = metaState.selected.chapterId === chapter.id;
      const record = metaState.records.chapters[chapter.id];
      const difficulty = selected ? getSelectedDifficulty() : metaConfig.difficulties[0];
      return `
        <article class="home-card chapter-card ${locked ? "locked" : ""} ${selected ? "selected" : ""}">
          ${homeImage(thumbnailAsset(chapter.background || chapter.fallbackBackground), chapter.name, "home-thumb", chapter.background || chapter.fallbackBackground)}
          <div class="home-card-body">
            <h2>${chapter.name}</h2>
            <p>${chapter.desc}</p>
            <small>Boss：${chapter.bossName} · 最佳 ${record?.bestKills || 0} 斩妖 / ${formatTime(record?.bestTime || 0)}</small>
          </div>
          <div class="chapter-rewards">
            <span>主要掉落</span>
            ${chapterRewardChipRows(chapter, difficulty)}
          </div>
          ${chapterRewardHighlights(chapter, difficulty, locked)}
          ${renderRunEventPreview(chapter, difficulty, locked)}
          ${renderChapterMaterialTarget(chapter, difficulty, selected)}
          ${renderBossGuide(chapter, difficulty)}
          ${renderChapterReadiness(chapter, difficulty, locked)}
          <small class="chapter-unlock">${locked ? `解锁：${unlockConditionText(chapter.unlock)}` : `首通：${firstClearSummary(chapter)}`}</small>
          <div class="difficulty-row">
            ${metaConfig.difficulties
              .map((difficulty) => `<button data-action="select-difficulty" data-chapter="${chapter.id}" data-difficulty="${difficulty.id}" class="${selected && metaState.selected.difficultyId === difficulty.id ? "active" : ""}" ${locked || !difficultyAllowed(chapter.id, difficulty.id) ? "disabled" : ""}>${difficulty.name}</button>`)
              .join("")}
          </div>
          <button data-action="select-chapter" data-id="${chapter.id}" ${locked ? "disabled" : ""}>${selected ? "已选择" : "选择章节"}</button>
          <button data-action="tune-chapter-build" data-id="${chapter.id}" ${locked ? "disabled" : ""}>调构筑</button>
        </article>
      `;
    })
    .join("")}</div>`;
}

function selectedBuildSummary() {
  const artifact = selectedArtifact();
  const cultivation = selectedCultivation();
  const talents = selectedTalents();
  const tagIds = collectBuildTags([artifact, cultivation, ...talents]);
  return `
    <div class="build-summary">
      <span>${artifact ? homeImage(artifact.icon, artifact.name, "summary-icon") : ""}<b>本命法宝</b>${artifact?.name || "未选择"} Lv.${metaState.progression.artifacts[artifact?.id] || 1}</span>
      <span><b>初始天赋</b>${talents.length ? talents.map((item) => item.name).join(" / ") : "未选择"}</span>
      <span>${cultivation ? homeImage(cultivation.icon, cultivation.name, "summary-icon") : ""}<b>起手功法</b>${cultivation?.name || "未选择"} Lv.${metaState.progression.cultivations[cultivation?.id] || 1}</span>
      <span class="build-tags"><b>流派</b>${tagIds.length ? tagIds.map(styleTagToken).join("") : "未成型"}</span>
    </div>
  `;
}

function materialNeedSummary(key) {
  const needs = [];
  for (const tree of metaConfig.talentTrees || []) {
    const level = metaState.progression.talentTree[tree.id] || 0;
    if (level < tree.maxLevel && upgradeCost("talent", tree.id, level)[key]) needs.push(tree.name);
  }
  for (const artifact of metaConfig.artifacts || []) {
    const level = metaState.progression.artifacts[artifact.id] || 0;
    if (isUnlocked("artifacts", artifact.id) && level < artifact.maxLevel && upgradeCost("artifact", artifact.id, level)[key]) needs.push(artifact.shortName || artifact.name);
  }
  for (const cultivation of metaConfig.cultivations || []) {
    const level = metaState.progression.cultivations[cultivation.id] || 0;
    if (isUnlocked("cultivations", cultivation.id) && level < cultivation.maxLevel && upgradeCost("cultivation", cultivation.id, level)[key]) needs.push(cultivation.name);
  }
  for (const facility of metaConfig.facilities || []) {
    const level = metaState.progression.facilities[facility.id] || 0;
    if (level < facility.maxLevel && upgradeCost("facility", facility.id, level)[key]) needs.push(facility.name);
  }
  return unique(needs).slice(0, 4);
}

function materialNeedAmount(key) {
  let amount = 0;
  for (const tree of metaConfig.talentTrees || []) {
    const level = metaState.progression.talentTree[tree.id] || 0;
    if (level < tree.maxLevel) amount += upgradeCost("talent", tree.id, level)[key] || 0;
  }
  for (const artifact of metaConfig.artifacts || []) {
    const level = metaState.progression.artifacts[artifact.id] || 0;
    if (isUnlocked("artifacts", artifact.id) && level < artifact.maxLevel) amount += upgradeCost("artifact", artifact.id, level)[key] || 0;
  }
  for (const cultivation of metaConfig.cultivations || []) {
    const level = metaState.progression.cultivations[cultivation.id] || 0;
    if (isUnlocked("cultivations", cultivation.id) && level < cultivation.maxLevel) amount += upgradeCost("cultivation", cultivation.id, level)[key] || 0;
  }
  for (const facility of metaConfig.facilities || []) {
    const level = metaState.progression.facilities[facility.id] || 0;
    if (level < facility.maxLevel) amount += upgradeCost("facility", facility.id, level)[key] || 0;
  }
  return amount;
}

function materialNeedAmountText(key, amount) {
  if (amount <= 0) return `<span class="home-muted">暂无升级需求</span>`;
  const owned = Math.floor(metaState.currencies[key] || 0);
  const missing = Math.max(0, amount - owned);
  return `
    <span class="material-need-amount">
      <b>总需 ${currencyToken(key, amount, "material-token route-token")}</b>
      <small>${missing > 0 ? `缺口 ${currencyToken(key, missing, "material-token route-token")}` : "当前已覆盖近期升级"}</small>
    </span>
  `;
}

function renderMaterialsTab() {
  const selectedDifficulty = materialPreviewDifficulty();
  ui.homeContent.innerHTML = `
    ${renderHomeBanner("materials")}
    ${renderMaterialDifficultyPreview()}
    <div class="materials-dashboard">
      ${Object.entries(metaConfig.currencies)
        .map(([key, config]) => {
          const needs = materialNeedSummary(key);
          const needAmount = materialNeedAmount(key);
          const focused = focusedMaterials.includes(key);
          return `
            <article class="home-card material-card ${focused ? "focused" : ""}" data-material="${key}">
              <div class="material-card-head" style="--material-color:${config.color || "#f7f3e8"}">
                <span class="material-card-icon" aria-hidden="true">${config.iconText || config.name.slice(0, 1)}</span>
                <div class="material-card-title">
                  <h2>${config.name}</h2>
                  <span>${config.desc || ""}</span>
                </div>
                <strong class="material-card-balance">${Math.floor(metaState.currencies[key] || 0)}</strong>
                ${focused ? `<em class="material-card-focus">当前缺口</em>` : ""}
              </div>
              <dl>
                <div><dt>来源</dt><dd>${config.source || "战斗结算"}</dd></div>
                <div><dt>用途</dt><dd>${needs.length ? needs.join(" / ") : config.usage || "后续成长"}</dd></div>
                <div><dt>近期需求</dt><dd>${materialNeedAmountText(key, needAmount)}</dd></div>
                <div><dt>刷图</dt><dd class="material-farm-routes">${materialFarmRoute(key, selectedDifficulty)}</dd></div>
              </dl>
            </article>
          `;
        })
        .join("")}
    </div>
    <div class="home-card drop-matrix">
      <h2>章节收益预览</h2>
      <div class="drop-grid">
        ${metaConfig.chapters
          .map((chapter) => `
            <article class="${isUnlocked("chapters", chapter.id) ? "" : "locked"}">
              <strong>${chapter.name}</strong>
              <span>${chapter.bossName}</span>
              <div>${chapterDropSummary(chapter, selectedDifficulty)}</div>
            </article>
          `)
          .join("")}
      </div>
    </div>
  `;
}

function renderJourneyTab() {
  const chapterCount = metaConfig.chapters?.length || 0;
  const difficultyTotal = totalDifficultyCount();
  const claimedQuestCount = (metaState.records.claimedQuests || []).length;
  const questTotal = metaConfig.quests?.length || 0;
  const chapterGoal = nextChapterGoal();
  const questGoal = nextQuestGoal();
  const upgradeGoal = nextUpgradeGoal();
  const recommendations = journeyRecommendationRows();
  ui.homeContent.innerHTML = `
    ${renderHomeBanner("journey")}
    <section class="journey-dashboard">
      <article class="home-card journey-hero">
        <div>
          <h2>历练总览</h2>
          <p>把章节首通、悬赏、境界和下一次升级串成一条路线，回洞府后先看这里决定下一局刷什么。</p>
        </div>
        <div class="journey-score">
          <strong>${chapterClearCount()}/${chapterCount}</strong>
          <span>章节已首通</span>
        </div>
      </article>
      <article class="home-card journey-stats">
        <span><b>${formatTime(metaState.records.bestSurvivalSeconds || 0)}</b>最长存活</span>
        <span><b>${metaState.records.totalKills || 0}</b>累计斩妖</span>
        <span><b>${realmLabel(metaState.records.highestRealmLevel || 1)}</b>最高境界</span>
        <span><b>${difficultyProgressCount()}/${difficultyTotal}</b>难度首通</span>
      </article>
    </section>
    <section class="journey-grid">
      <article class="home-card journey-card">
        <div class="journey-card-head">
          <span>章节路线</span>
          <b>${chapterGoal ? chapterGoal.name : "全章已开"}</b>
        </div>
        <p>${chapterGoal ? (isUnlocked("chapters", chapterGoal.id) ? `${chapterGoal.bossName} 尚未凡境首通。` : unlockConditionText(chapterGoal.unlock)) : "当前章节线已完成基础首通，可以转向高难和材料刷取。"}</p>
        <div class="quest-progress">
          <div><span style="width:${chapterCount ? (chapterClearCount() / chapterCount) * 100 : 0}%"></span></div>
          <small>${chapterClearCount()} / ${chapterCount} 章节</small>
        </div>
      </article>
      <article class="home-card journey-card">
        <div class="journey-card-head">
          <span>悬赏进度</span>
          <b>${claimableQuestCount()} 可领取</b>
        </div>
        <p>${questGoal ? `${questGoal.quest.name}：${questProgressText(questGoal.quest, questGoal.state.progress)}` : "悬赏已全部领取，后续可以继续扩展周常和高难目标。"}</p>
        <div class="quest-progress">
          <div><span style="width:${questTotal ? (claimedQuestCount / questTotal) * 100 : 0}%"></span></div>
          <small>${claimedQuestCount} / ${questTotal} 已领取</small>
        </div>
      </article>
      <article class="home-card journey-card">
        <div class="journey-card-head">
          <span>下一次成长</span>
          <b>${upgradeGoal ? `${upgradeGoal.kind} · ${upgradeGoal.name}` : "全部满级"}</b>
        </div>
        <p>${upgradeGoal ? (Object.keys(upgradeGoal.missing).length ? `还缺 ${formatCost(upgradeGoal.missing)}。` : `材料已够，可升到 Lv.${upgradeGoal.level + 1}。`) : "当前成长线已经拉满。"}</p>
        <div class="journey-materials">${upgradeGoal ? formatCostTokens(upgradeGoal.cost, "material-token reward-token") : ""}</div>
      </article>
    </section>
    ${renderEventJourneyPanel()}
    ${renderComboJourneyPanel()}
    <section class="home-card journey-next">
      <div class="build-preview-head">
        <h2>下一步建议</h2>
        <small>${getSelectedChapter()?.name || "当前章节"} · ${getSelectedDifficulty()?.name || "当前难度"}</small>
      </div>
      <div class="journey-recommendations">
        ${recommendations
          .map((row) => `
            <article>
              <span>${row.label}</span>
              <strong>${row.title}</strong>
              <p>${row.body}</p>
              <button data-action="open-tab" data-tab="${row.tab}" data-focus-materials="${(row.focusMaterials || []).join(",")}" type="button">${row.action}</button>
            </article>
          `)
          .join("")}
      </div>
    </section>
  `;
}

function questChapterName(quest) {
  return mapById(metaConfig.chapters)[quest.chapterId]?.name || quest.chapterId || "";
}

function questDifficultyName(quest) {
  return mapById(metaConfig.difficulties)[quest.difficultyId]?.name || quest.difficultyId || "";
}

function comboQuestProgressValue(quest, records = metaState.records) {
  const combos = records?.combos || {};
  const rows = quest.comboId ? [combos[quest.comboId]] : Object.values(combos);
  if (quest.type === "comboSeen") return rows.some((record) => (record?.bestCount || 0) > 0) ? 1 : 0;
  if (quest.type === "comboBest") return Math.max(0, ...rows.map((record) => record?.bestCount || 0));
  return 0;
}

function currentRunComboQuestValue(quest) {
  const rows = quest.comboId ? [game.runStats?.combos?.[quest.comboId] || 0] : Object.values(game.runStats?.combos || {});
  if (quest.type === "comboSeen") return rows.some((count) => count > 0) ? 1 : 0;
  if (quest.type === "comboBest") return Math.max(0, ...rows);
  return 0;
}

function questProgress(quest) {
  const records = metaState.records || {};
  if (quest.type === "runs") return { value: records.runs || 0, target: quest.target || 1 };
  if (quest.type === "totalKills") return { value: records.totalKills || 0, target: quest.target || 1 };
  if (quest.type === "highestRealmLevel") return { value: records.highestRealmLevel || 1, target: quest.target || 1 };
  if (quest.type === "comboSeen" || quest.type === "comboBest") return { value: comboQuestProgressValue(quest, records), target: quest.target || 1 };
  if (quest.type === "chapterClear") {
    const chapterRecord = records.chapters?.[quest.chapterId];
    const cleared = chapterRecord?.clearedDifficulties?.includes(quest.difficultyId || "mortal");
    return { value: cleared ? 1 : 0, target: 1 };
  }
  return { value: 0, target: quest.target || 1 };
}

function runQuestProgress(quest) {
  const base = questProgress(quest);
  if (quest.type === "runs") return { ...base, value: Math.max(base.value, (metaState.records?.runs || 0) + 1) };
  if (quest.type === "totalKills") return { ...base, value: Math.max(base.value, (metaState.records?.totalKills || 0) + game.killCount) };
  if (quest.type === "highestRealmLevel") return { ...base, value: Math.max(base.value, game.player?.level || 1) };
  if (quest.type === "comboSeen" || quest.type === "comboBest") return { ...base, value: Math.max(base.value, currentRunComboQuestValue(quest)) };
  if (quest.type === "chapterClear" && quest.chapterId === game.chapter?.id && quest.difficultyId === game.difficulty?.id) {
    return { ...base, value: game.runStats?.bossKilled ? 1 : base.value };
  }
  return base;
}

function questProgressText(quest, progress) {
  if (quest.type === "highestRealmLevel") return `${realmLabel(progress.value)} / ${realmLabel(progress.target)}`;
  if (quest.type === "comboSeen") return progress.value >= progress.target ? "已悟得合术" : "尚未触发组合";
  if (quest.type === "comboBest") return `最佳 ${Math.min(progress.value, progress.target)} / ${progress.target} 次`;
  if (quest.type === "chapterClear") {
    return progress.value >= progress.target
      ? "已镇压"
      : `${questChapterName(quest)} ${questDifficultyName(quest)} 未首通`;
  }
  return `${Math.min(progress.value, progress.target)} / ${progress.target}`;
}

function questState(quest) {
  const progress = questProgress(quest);
  const claimed = (metaState.records.claimedQuests || []).includes(quest.id);
  const complete = progress.value >= progress.target;
  return { progress, claimed, complete, claimable: complete && !claimed };
}

function runQuestState(quest) {
  const progress = runQuestProgress(quest);
  const claimed = (metaState.records.claimedQuests || []).includes(quest.id);
  const complete = progress.value >= progress.target;
  return { progress, claimed, complete, claimable: complete && !claimed };
}

function questProgressPercent(progress) {
  return clamp((progress.value / Math.max(1, progress.target)) * 100, 0, 100);
}

function runChapterGoal() {
  if (!game.chapter || !game.difficulty) return null;
  const record = metaState?.records?.chapters?.[game.chapter.id];
  const cleared = record?.clearedDifficulties?.includes(game.difficulty.id);
  if (cleared) return null;
  return {
    title: `${game.chapter.name} ${game.difficulty.name}`,
    text: game.runStats?.bossKilled ? `${game.chapter.bossName} 已镇压` : `镇压 ${game.chapter.bossName}`,
    complete: Boolean(game.runStats?.bossKilled),
  };
}

function activeRunQuestRows(limit = 2) {
  return (metaConfig.quests || [])
    .map((quest) => ({ quest, state: runQuestState(quest) }))
    .filter(({ state }) => !state.claimed)
    .sort((a, b) => {
      const aDone = a.state.complete ? 0 : 1;
      const bDone = b.state.complete ? 0 : 1;
      return aDone - bDone || questProgressPercent(b.state.progress) - questProgressPercent(a.state.progress);
    })
    .slice(0, limit);
}

function runComboGoal() {
  const readyCombos = comboPreviewRows().filter((combo) => combo.ready);
  if (!readyCombos.length) return null;
  const triggered = readyCombos
    .map((combo) => ({ ...combo, count: game.runStats?.combos?.[combo.id] || 0 }))
    .sort((a, b) => b.count - a.count);
  const best = triggered[0];
  const target = 1;
  const complete = best.count >= target;
  return {
    id: best.id,
    title: best.name,
    complete,
    progress: complete ? 100 : 0,
    text: complete ? `${best.name} 已触发 ${best.count} 次` : `${readyCombos.map((combo) => combo.name).join(" / ")} 待触发`,
  };
}

function runMaterialGoal() {
  if (!targetMaterial || !game.chapter || !game.difficulty) return null;
  const amount = chapterDropEstimate(game.chapter, game.difficulty)[targetMaterial] || 0;
  const materialName = currencyName(targetMaterial);
  const unlocking = targetMaterialMode === "unlock";
  const complete = unlocking ? Boolean(game.runStats?.bossKilled) : amount > 0 && Boolean(game.runStats?.bossKilled);
  return {
    label: unlocking ? "解锁路线" : "材料路线",
    complete,
    progress: complete ? 100 : game.runStats?.bossKilled ? 100 : 0,
    text: unlocking
      ? `${game.chapter.name}${game.difficulty.name}首通后回材料页刷${materialName}`
      : `镇压 ${game.chapter.bossName} 后预计 ${currencyName(targetMaterial)} ${amount}`,
  };
}

function runEventChallengeGoal() {
  const challenge = game.activeEventChallenge;
  if (!challenge || challenge.resolved) return null;
  const remaining = Math.max(0, challenge.endsAt - game.time);
  return {
    label: "限时试炼",
    complete: challenge.defeated >= challenge.targetCount,
    progress: clamp((challenge.defeated / Math.max(1, challenge.targetCount)) * 100, 0, 100),
    text: `${challenge.label} ${challenge.defeated}/${challenge.targetCount} · 余 ${remaining.toFixed(1)}s${challengeRewardSummary(challenge) ? ` · ${challengeRewardSummary(challenge)}` : ""}`,
  };
}

function renderRunGoals() {
  if (!ui.runGoals || !metaConfig || !metaState) return;
  if (!game.goalTrackingActive || game.state !== "playing") {
    ui.runGoals.classList.add("hidden");
    ui.runGoals.innerHTML = "";
    return;
  }
  const chapterGoal = runChapterGoal();
  const comboGoal = runComboGoal();
  const materialGoal = runMaterialGoal();
  const eventChallengeGoal = runEventChallengeGoal();
  const questRows = activeRunQuestRows(chapterGoal || comboGoal || materialGoal || eventChallengeGoal ? 1 : 2);
  if (!chapterGoal && !comboGoal && !materialGoal && !eventChallengeGoal && !questRows.length) {
    ui.runGoals.classList.add("hidden");
    ui.runGoals.innerHTML = "";
    return;
  }
  const rows = [];
  if (eventChallengeGoal) {
    rows.push(`
      <span class="${eventChallengeGoal.complete ? "complete" : ""}">
        <b>${eventChallengeGoal.label}</b>
        <em>${eventChallengeGoal.text}</em>
        <i style="--goal-progress:${eventChallengeGoal.progress}%"></i>
      </span>
    `);
  }
  if (materialGoal) {
    rows.push(`
      <span class="${materialGoal.complete ? "complete" : ""}">
        <b>${materialGoal.label}</b>
        <em>${materialGoal.text}</em>
        <i style="--goal-progress:${materialGoal.progress}%"></i>
      </span>
    `);
  }
  if (chapterGoal) {
    rows.push(`
      <span class="${chapterGoal.complete ? "complete" : ""}">
        <b>首通</b>
        <em>${chapterGoal.text}</em>
        <i style="--goal-progress:${chapterGoal.complete ? 100 : 0}%"></i>
      </span>
    `);
  }
  if (comboGoal) {
    rows.push(`
      <span class="${comboGoal.complete ? "complete" : ""}">
        <b>合术</b>
        <em>${comboGoal.text}</em>
        <i style="--goal-progress:${comboGoal.progress}%"></i>
      </span>
    `);
  }
  for (const { quest, state } of questRows) {
    rows.push(`
      <span class="${state.complete ? "complete" : ""}">
        <b>悬赏</b>
        <em>${quest.name} · ${questProgressText(quest, state.progress)}</em>
        <i style="--goal-progress:${questProgressPercent(state.progress)}%"></i>
      </span>
    `);
  }
  ui.runGoals.classList.remove("hidden");
  ui.runGoals.innerHTML = `<strong>本局目标</strong>${rows.join("")}`;
}

function clearGoalToastTimer() {
  if (!game.goalToastTimer) return;
  clearTimeout(game.goalToastTimer);
  game.goalToastTimer = null;
}

function scheduleNextGoalToast() {
  clearGoalToastTimer();
  game.goalToastTimer = setTimeout(() => {
    game.goalToastTimer = null;
    game.goalToast = null;
    if (game.state !== "playing" || !game.goalTrackingActive) {
      renderGoalToast();
      return;
    }
    playNextGoalToast();
  }, game.goalToast?.life || 2200);
}

function playNextGoalToast() {
  if (game.goalToast || !game.goalToastQueue.length) {
    renderGoalToast();
    return;
  }
  game.goalToast = game.goalToastQueue.shift();
  game.goalToast.startedAt = Date.now();
  renderGoalToast();
  scheduleNextGoalToast();
}

function pushGoalNotice(key, title, detail) {
  if (!game.runStats.goalNotices) game.runStats.goalNotices = [];
  if (game.runStats.goalNotices.includes(key)) return;
  game.runStats.goalNotices.push(key);
  game.goalToastQueue.push({ title, detail, startedAt: 0, life: 2200 });
  playNextGoalToast();
  addText(title, game.player.x, game.player.y - 118, "#9dffca");
  if (detail) addText(detail, game.player.x, game.player.y - 94, "#f4d778");
}

function updateRunGoalNotices() {
  if (!metaConfig || !metaState || game.state !== "playing" || !game.goalTrackingActive) return;
  const chapterGoal = runChapterGoal();
  if (chapterGoal?.complete) pushGoalNotice(`chapter:${game.chapter.id}:${game.difficulty.id}`, "首通目标完成", chapterGoal.title);
  const comboGoal = runComboGoal();
  if (comboGoal?.complete) pushGoalNotice(`combo:${comboGoal.id}`, "合术目标完成", comboGoal.title);
  for (const { quest, state } of activeRunQuestRows(3)) {
    if (state.complete) pushGoalNotice(`quest:${quest.id}`, "悬赏目标完成", quest.name);
  }
}

function renderGoalToast() {
  if (!ui.goalToast) return;
  if (!game.goalToast || game.state !== "playing") {
    ui.goalToast.classList.add("hidden");
    ui.goalToast.innerHTML = "";
    return;
  }
  ui.goalToast.classList.remove("hidden");
  ui.goalToast.innerHTML = `<strong>${game.goalToast.title}</strong>${game.goalToast.detail ? `<span>${game.goalToast.detail}</span>` : ""}`;
}

function claimableQuestCount() {
  return (metaConfig.quests || []).filter((quest) => questState(quest).claimable).length;
}

function claimableQuestRows(limit = 3) {
  return (metaConfig.quests || [])
    .map((quest) => ({ quest, state: questState(quest) }))
    .filter(({ state }) => state.claimable)
    .slice(0, limit);
}

function renderQuestCompletionSummary() {
  const rows = claimableQuestRows();
  if (!rows.length) return "";
  return `
    <div class="quest-complete-summary">
      <strong>悬赏可领取</strong>
      ${rows
        .map(({ quest }) => `<span><b>${quest.name}</b><small>${formatCostTokens(quest.rewards, "material-token reward-token")}</small></span>`)
        .join("")}
    </div>
  `;
}

function renderResultNextSteps() {
  if (!ui.resultNextSteps || !metaConfig || !metaState) return;
  const rows = resultRecommendationRows().slice(0, 3);
  if (!rows.length) {
    ui.resultNextSteps.classList.add("hidden");
    ui.resultNextSteps.innerHTML = "";
    return;
  }
  ui.resultNextSteps.classList.remove("hidden");
  ui.resultNextSteps.innerHTML = `
    <strong>下一步</strong>
    <div>
      ${rows
        .map((row) => `
          <article data-tab="${row.tab}">
            <span>${row.label}</span>
            <b>${row.title}</b>
            <p>${row.body}</p>
            <button data-action="result-open-tab" data-tab="${row.tab}" data-post-action="${row.postAction || ""}" data-focus-materials="${(row.focusMaterials || []).join(",")}" data-preview-difficulty="${row.previewDifficulty || ""}" type="button">${row.action}</button>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function renderQuestsTab() {
  const quests = metaConfig.quests || [];
  const sorted = [...quests].sort((a, b) => {
    const stateA = questState(a);
    const stateB = questState(b);
    const rank = (state) => (state.claimable ? 0 : state.claimed ? 2 : 1);
    return rank(stateA) - rank(stateB);
  });
  ui.homeContent.innerHTML = `
    ${renderHomeBanner("quests")}
    <div class="quest-summary">
      <article class="home-card quest-overview">
        <h2>悬赏榜</h2>
        <p>把长期成长拆成可领取目标：先拿首局、斩妖和筑基奖励，再追章节首通与高难挑战。</p>
        <div class="quest-counters">
          <span><b>${claimableQuestCount()}</b>可领取</span>
          <span><b>${(metaState.records.claimedQuests || []).length}</b>已完成</span>
          <span><b>${quests.length}</b>总悬赏</span>
        </div>
      </article>
    </div>
    <div class="quest-list">
      ${sorted
        .map((quest) => {
          const state = questState(quest);
          const percent = clamp((state.progress.value / Math.max(1, state.progress.target)) * 100, 0, 100);
          return `
            <article class="home-card quest-card ${state.claimed ? "claimed" : ""} ${state.claimable ? "claimable" : ""}">
              <div class="quest-card-head">
                <div>
                  <h2>${quest.name}</h2>
                  <p>${quest.desc}</p>
                </div>
                <span>${state.claimed ? "已领取" : state.claimable ? "可领取" : "进行中"}</span>
              </div>
              <div class="quest-progress">
                <div><span style="width:${percent}%"></span></div>
                <small>${questProgressText(quest, state.progress)}</small>
              </div>
              <div class="quest-rewards">
                ${formatCostTokens(quest.rewards, "material-token reward-token")}
              </div>
              <button data-action="claim-quest" data-id="${quest.id}" ${state.claimable ? "" : "disabled"}>${state.claimed ? "已领取" : "领取悬赏"}</button>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function bossRecordSummary(chapter) {
  const record = metaState.records.chapters?.[chapter.id];
  const cleared = record?.clearedDifficulties || [];
  const clearedNames = cleared
    .map((id) => mapById(metaConfig.difficulties)[id]?.name || id)
    .join(" / ");
  return {
    cleared,
    clearedText: clearedNames || "尚未首通",
    bestTime: record?.bestTime || 0,
    bestKills: record?.bestKills || 0,
  };
}

function bossPhaseTimeline(chapter) {
  const phases = chapter.bossMechanics?.phaseTexts || [];
  if (!phases.length) return "血量阶段变化";
  return phases.map((text, index) => `${index === 0 ? "70%" : "35%"} ${text}`).join(" / ");
}

function comboRecordContext(record) {
  const chapter = mapById(metaConfig.chapters)[record?.bestChapter];
  const difficulty = mapById(metaConfig.difficulties)[record?.bestDifficulty];
  return [chapter?.name, difficulty?.name].filter(Boolean).join(" · ") || "尚无记录";
}

function renderComboCodex() {
  return `
    <section class="combo-codex">
      ${spellCombos
        .map((combo) => {
          const record = comboRecord(combo.id) || {};
          return `
            <article class="home-card combo-card">
              <div class="combo-card-head">
                <div>
                  <h2>${combo.name}</h2>
                  <p>${combo.desc}</p>
                </div>
                <span>${record.bestCount ? "已见招" : "待验证"}</span>
              </div>
              <div class="combo-recipe">
                ${combo.recipe.map((name) => `<b>${name}</b>`).join("<i>+</i>")}
              </div>
              <div class="combo-record">
                <span><b>${record.bestCount || 0}</b>最佳触发</span>
                <span><b>${record.lastCount || 0}</b>上次触发</span>
                <span><b>${record.runs || 0}</b>成型局数</span>
              </div>
              <small>${record.bestCount ? comboRecordContext(record) : combo.unlockText}</small>
            </article>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderBestiaryTab() {
  const selectedDifficulty = getSelectedDifficulty();
  ui.homeContent.innerHTML = `
    ${renderHomeBanner("chapters")}
    <section class="bestiary-overview">
      <article class="home-card bestiary-hero">
        <div>
          <h2>Boss 图鉴</h2>
          <p>按章节查看 Boss 技能、阶段、推荐构筑和首通记录。选定挑战后可直接回到开局页调整构筑，再入世开战。</p>
        </div>
        <div class="bestiary-score">
          <strong>${difficultyProgressCount()}/${totalDifficultyCount()}</strong>
          <span>难度首通</span>
        </div>
      </article>
    </section>
    ${renderComboCodex()}
    <div class="bestiary-grid">
      ${metaConfig.chapters
        .map((chapter) => {
          const locked = !isUnlocked("chapters", chapter.id);
          const selected = metaState.selected.chapterId === chapter.id;
          const record = bossRecordSummary(chapter);
          const difficulty = selected ? selectedDifficulty : metaConfig.difficulties[0];
          const mechanics = chapter.bossMechanics || {};
          const presetNames = matchingPresetNames(chapter);
          return `
            <article class="home-card bestiary-card ${locked ? "locked" : ""} ${selected ? "selected" : ""}">
              <div class="bestiary-portrait">
                ${homeImage(chapter.bossAsset || chapter.background || chapter.fallbackBackground, chapter.bossName, "bestiary-boss", chapter.background || chapter.fallbackBackground)}
                <span>${locked ? "未遭遇" : record.cleared.length ? "已镇压" : "待挑战"}</span>
              </div>
              <div class="bestiary-body">
                <div class="bestiary-head">
                  <div>
                    <h2>${chapter.bossName}</h2>
                    <p>${mechanics.subtitle || chapter.name}</p>
                  </div>
                  <small>${chapter.name}</small>
                </div>
                <div class="bestiary-record">
                  <span><b>${record.clearedText}</b>首通记录</span>
                  <span><b>${formatTime(record.bestTime)}</b>最佳存活</span>
                  <span><b>${record.bestKills}</b>最高斩妖</span>
                </div>
                <div class="boss-skill-list bestiary-skills">
                  ${(mechanics.skills || [])
                    .map((skill) => `
                      <span class="boss-skill">
                        <b>${skill.name}</b>
                        <small>${bossSkillSummary(skill, difficulty)}</small>
                      </span>
                    `)
                    .join("")}
                </div>
                <div class="bestiary-notes">
                  <span>阶段：${bossPhaseTimeline(chapter)}</span>
                  <span>推荐：${chapterBuildContextTags(chapter).map(styleTagToken).join("")}${presetNames.length ? ` ${presetNames.join(" / ")}` : ""}</span>
                  <span>掉落与首通</span>
                  ${chapterRewardChipRows(chapter, difficulty)}
                </div>
                ${renderBestiaryRewardHighlights(chapter, difficulty, locked)}
                ${renderRunEventPreview(chapter, difficulty, locked)}
                ${renderChapterReadiness(chapter, difficulty, locked)}
                ${renderBestiaryPatchAction(chapter, difficulty, locked)}
                <div class="difficulty-row bestiary-actions">
                  ${metaConfig.difficulties
                    .map((item) => `<button data-action="select-bestiary-difficulty" data-chapter="${chapter.id}" data-difficulty="${item.id}" class="${selected && metaState.selected.difficultyId === item.id ? "active" : ""}" ${locked || !difficultyAllowed(chapter.id, item.id) ? "disabled" : ""}>${item.name}</button>`)
                    .join("")}
                  <button data-action="challenge-boss" data-id="${chapter.id}" ${locked ? "disabled" : ""}>${selected ? "当前挑战" : "选择挑战"}</button>
                  <button data-action="tune-chapter-build" data-id="${chapter.id}" ${locked ? "disabled" : ""}>调构筑</button>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderBuildPlanner() {
  const rows = buildPreviewRows();
  const selectedChapter = getSelectedChapter();
  const recommendation = chapterBuildRecommendation();
  const readiness = chapterReadinessReport();
  const patchPlan = weaknessPatchPlan();
  const talentMap = mapById(metaConfig.startingTalents);
  const presetCards = (metaConfig.loadoutPresets || [])
    .map((preset) => {
      const availability = presetAvailability(preset);
      const recommended = (preset.recommendedChapters || []).includes(selectedChapter?.id);
      return `
        <article class="preset-card ${availability.available ? "" : "partial"} ${recommended ? "recommended" : ""}">
          <div>
            <h3>${preset.name}</h3>
            <p>${preset.desc}</p>
            <div class="build-tags">${(preset.tags || []).map(styleTagToken).join("")}</div>
            <small>${availability.available ? `适合：${(preset.recommendedChapters || []).map((id) => mapById(metaConfig.chapters)[id]?.name || id).join(" / ") || "通用"}` : `可先套用已解锁项，缺少：${availability.missing.join(" / ")}`}</small>
          </div>
          <button data-action="apply-preset" data-id="${preset.id}" ${availability.usable ? "" : "disabled"}>${availability.available ? (recommended ? "本章推荐" : "套用") : "套用已解锁"}</button>
        </article>
      `;
    })
    .join("");
  return `
    <div class="build-planner">
      <section class="home-card chapter-build-card ${recommendation.applied ? "applied" : ""}">
        <div class="build-preview-head">
          <h2>本章策令</h2>
          <small>${recommendation.applied ? "已按本章配置" : "按章节和 Boss 机制推荐"}</small>
        </div>
        <div class="chapter-build-target">
          <span>${recommendation.artifact ? homeImage(recommendation.artifact.icon, recommendation.artifact.name, "summary-icon") : ""}<b>法宝</b>${recommendation.artifact?.name || "暂无"}</span>
          <span>${recommendation.cultivation ? homeImage(recommendation.cultivation.icon, recommendation.cultivation.name, "summary-icon") : ""}<b>功法</b>${recommendation.cultivation?.name || "暂无"}</span>
          <span><b>天赋</b>${recommendation.talentIds.map((id) => talentMap[id]?.name || id).join(" / ") || "暂无"}</span>
        </div>
        <div class="build-tags">${recommendation.tags.map(styleTagToken).join("")}</div>
        <div class="readiness-panel ${readiness.tier === "稳压" ? "ready" : readiness.tier === "偏险" ? "risky" : ""}">
          <div class="readiness-head">
            <strong>${readiness.tier}</strong>
            <span>战备 ${readiness.power.total} / 需求 ${readiness.expected}</span>
          </div>
          <div class="readiness-bars">
            ${readiness.rows
              .map((row) => `
                <span class="${row.state === "充足" ? "ready" : row.state === "偏弱" ? "weak" : ""}" style="--readiness:${Math.round(clamp(row.ratio, 0, 1.3) * 100)}%">
                  <b>${row.key}</b>
                  <em>${row.value}/${row.need}</em>
                  <i>${row.state}</i>
                </span>
              `)
              .join("")}
          </div>
          <small>${readiness.summary}</small>
          ${patchPlan.available && !patchPlan.applied ? `
            <div class="readiness-action">
              <span>${patchPlan.reason}：${patchPlan.names.slice(0, 3).join(" / ")}</span>
              <button data-action="apply-weakness-patch" type="button">补短板</button>
            </div>
          ` : ""}
        </div>
        <ul class="chapter-build-reasons">
          ${recommendation.reasons.map((reason) => `<li>${reason}</li>`).join("")}
        </ul>
        ${recommendation.missing.length ? `<small class="cost-hint">预设未全解锁：${recommendation.missing.join(" / ")}，已用可用组件替代。</small>` : ""}
        <button data-action="apply-chapter-recommendation" ${recommendation.applied ? "disabled" : ""}>${recommendation.applied ? "已套用" : "套用本章推荐"}</button>
      </section>
      <section class="home-card build-preview-card">
        <div class="build-preview-head">
          <h2>入局预览</h2>
          <small>${getSelectedChapter()?.name || "当前章节"} · ${getSelectedDifficulty()?.name || "当前难度"}</small>
        </div>
        <div class="preview-stats">
          ${rows.map(([label, value]) => `<span><b>${label}</b>${value}</span>`).join("")}
        </div>
        ${renderComboPreview()}
      </section>
      <section class="home-card preset-panel">
        <div class="build-preview-head">
          <h2>构筑预设</h2>
          <small>只会套用已解锁的法宝、功法和天赋槽。</small>
        </div>
        <div class="preset-grid">${presetCards}</div>
      </section>
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
    ${renderBuildPlanner()}
    ${renderBuildSynergyPanel()}
    <div class="home-list build-loadout">
      <article class="home-card home-loadout-card">
        <h2>本命法宝</h2>
        <div class="slot-row">${metaConfig.artifacts
          .map((artifact) => `<button data-action="select-artifact" data-id="${artifact.id}" class="choice-chip ${metaState.selected.artifactId === artifact.id ? "active" : ""}" ${!isUnlocked("artifacts", artifact.id) ? "disabled" : ""}>${homeImage(artifact.icon, artifact.name, "chip-icon")}<span>${artifact.shortName || artifact.name}</span>${collectBuildTags([artifact]).slice(0, 2).map(styleTagToken).join("")}</button>`)
          .join("")}</div>
      </article>
      <article class="home-card home-loadout-card">
        <h2>初始天赋 ${metaState.selected.startingTalentIds.length}/${slots}</h2>
        <div class="slot-row">${metaConfig.startingTalents
          .map((talent) => `<button data-action="toggle-talent" data-id="${talent.id}" class="${metaState.selected.startingTalentIds.includes(talent.id) ? "active" : ""}" ${!isUnlocked("startingTalents", talent.id) ? "disabled" : ""}>${talent.name}${collectBuildTags([talent]).slice(0, 1).map(styleTagToken).join("")}</button>`)
          .join("")}</div>
        <small>悟道蒲团 3/7 级会增加天赋槽。</small>
      </article>
      <article class="home-card home-loadout-card">
        <h2>起手功法</h2>
        <div class="slot-row">${metaConfig.cultivations
          .map((cultivation) => `<button data-action="select-cultivation" data-id="${cultivation.id}" class="choice-chip ${metaState.selected.cultivationId === cultivation.id ? "active" : ""}" ${!isUnlocked("cultivations", cultivation.id) ? "disabled" : ""}>${homeImage(cultivation.icon || artifactMap[cultivation.spell]?.icon || cultivationMap[cultivation.id]?.icon, cultivation.name, "chip-icon")}<span>${cultivation.name}</span>${collectBuildTags([cultivation]).slice(0, 2).map(styleTagToken).join("")}</button>`)
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
            <small>当前：${level ? effectSummary(tree.effects, level) : "未修炼"}</small>
            ${milestoneSummary(tree, level, { kind: "talent", id: tree.id })}
          </div>
          <button data-action="upgrade-talent" data-id="${tree.id}" ${maxed || !hasCurrency(cost) ? "disabled" : ""}>${maxed ? "已圆满" : `升级 ${formatCost(cost)}`}</button>
          ${renderCostHint(cost)}
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
            ${unlocked ? milestoneSummary(artifact, level, { kind: "artifact", id: artifact.id }) : ""}
          </div>
          <button data-action="select-artifact" data-id="${artifact.id}" ${!unlocked ? "disabled" : ""}>设为本命</button>
          <button data-action="upgrade-artifact" data-id="${artifact.id}" ${!unlocked || maxed || !hasCurrency(cost) ? "disabled" : ""}>${maxed ? "已满级" : `升级 ${formatCost(cost)}`}</button>
          ${unlocked ? renderCostHint(cost) : `<small class="cost-hint">解锁：${unlockConditionText(artifact.unlock)}</small>`}
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
            ${unlocked ? milestoneSummary(cultivation, level, { kind: "cultivation", id: cultivation.id }) : ""}
          </div>
          <button data-action="select-cultivation" data-id="${cultivation.id}" ${!unlocked ? "disabled" : ""}>设为起手</button>
          <button data-action="upgrade-cultivation" data-id="${cultivation.id}" ${!unlocked || maxed || !hasCurrency(cost) ? "disabled" : ""}>${maxed ? "已满级" : `升级 ${formatCost(cost)}`}</button>
          ${unlocked ? renderCostHint(cost) : `<small class="cost-hint">解锁：${unlockConditionText(cultivation.unlock)}</small>`}
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
            <small>当前：${level ? effectSummary(facility.effects, level) : "未建设"}</small>
            ${milestoneSummary(facility, level, { kind: "facility", id: facility.id })}
          </div>
          <button data-action="upgrade-facility" data-id="${facility.id}" ${maxed || !hasCurrency(cost) ? "disabled" : ""}>${maxed ? "已满级" : `升级 ${formatCost(cost)}`}</button>
          ${renderCostHint(cost)}
        </article>
      `;
    })
    .join("")}</div>`;
}

function handleHomeAction(target) {
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !metaState) return;
  if (action === "open-tab" && target.dataset.tab) {
    focusedMaterials = target.dataset.focusMaterials
      ? target.dataset.focusMaterials.split(",").filter(Boolean)
      : [];
    targetMaterial = "";
    targetMaterialMode = "";
    targetMaterialDifficulty = "";
    activeHomeTab = target.dataset.tab;
    renderHomePanel();
    return;
  }
  if (action === "select-chapter") {
    setSelectedChapterForBuild(id);
  }
  if (action === "farm-material-route") {
    setSelectedChapterForBuild(id);
    if (target.dataset.difficulty && difficultyAllowed(id, target.dataset.difficulty)) {
      metaState.selected.difficultyId = target.dataset.difficulty;
    }
    focusedMaterials = [];
    targetMaterial = target.dataset.material || "";
    targetMaterialMode = "farm";
    targetMaterialDifficulty = target.dataset.difficulty || "";
    activeHomeTab = "chapters";
  }
  if (action === "unlock-material-route") {
    const chapterId = target.dataset.targetChapter || id;
    setSelectedChapterForBuild(chapterId);
    if (target.dataset.targetDifficulty && difficultyAllowed(chapterId, target.dataset.targetDifficulty)) {
      metaState.selected.difficultyId = target.dataset.targetDifficulty;
    }
    focusedMaterials = [];
    targetMaterial = target.dataset.material || "";
    targetMaterialMode = "unlock";
    targetMaterialDifficulty = target.dataset.difficulty || "";
    activeHomeTab = "chapters";
  }
  if (action === "preview-material-difficulty") {
    materialPreviewDifficultyId = target.dataset.difficulty || "";
  }
  if (action === "select-difficulty") {
    metaState.selected.chapterId = target.dataset.chapter;
    metaState.selected.difficultyId = target.dataset.difficulty;
  }
  if (action === "select-bestiary-difficulty") {
    metaState.selected.chapterId = target.dataset.chapter;
    metaState.selected.difficultyId = target.dataset.difficulty;
  }
  if (action === "challenge-boss") {
    setSelectedChapterForBuild(id);
  }
  if (action === "tune-chapter-build") {
    setSelectedChapterForBuild(id);
    activeHomeTab = "start";
  }
  if (action === "patch-bestiary-build") {
    setSelectedChapterForBuild(id);
    if (target.dataset.difficulty) metaState.selected.difficultyId = target.dataset.difficulty;
    applyWeaknessPatchPlan(getSelectedChapter(), getSelectedDifficulty());
  }
  if (action === "select-artifact") metaState.selected.artifactId = id;
  if (action === "select-cultivation") metaState.selected.cultivationId = id;
  if (action === "apply-preset") {
    const preset = mapById(metaConfig.loadoutPresets)[id];
    if (preset && presetAvailability(preset).usable) {
      if (preset.artifactId && isUnlocked("artifacts", preset.artifactId)) metaState.selected.artifactId = preset.artifactId;
      if (preset.cultivationId && isUnlocked("cultivations", preset.cultivationId)) metaState.selected.cultivationId = preset.cultivationId;
      const slots = getStartingTalentSlots();
      metaState.selected.startingTalentIds = (preset.talentIds || [])
        .filter((talentId) => isUnlocked("startingTalents", talentId))
        .slice(0, slots);
    }
  }
  if (action === "apply-chapter-recommendation") applyChapterBuildRecommendation();
  if (action === "apply-weakness-patch") applyWeaknessPatchPlan();
  if (action === "apply-combo") applyComboPlan(id);
  if (action === "rush-milestone") rushMilestone(target.dataset.kind, id, target.dataset.level);
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
  if (action === "claim-quest") {
    const quest = mapById(metaConfig.quests || [])[id];
    const state = quest ? questState(quest) : null;
    if (quest && state?.claimable) {
      addCurrencies(quest.rewards || {});
      metaState.records.claimedQuests = unique([...(metaState.records.claimedQuests || []), quest.id]);
    }
  }
  saveMetaState();
  updateQuestBadges();
  renderHomePanel();
}

function equipmentSummaryText() {
  const equipped = Object.entries(game.equipment || {})
    .filter(([, state]) => state.tier > 0)
    .map(([slot, state]) => `${theme.equipmentSlots?.[slot]?.name || slot}${state.tier}`);
  const blessingCount = activeRunBlessingRows().length;
  const base = equipped.length ? equipped.join(" / ") : "未着法器";
  return blessingCount ? `${base} · 奇遇加持 ${blessingCount}` : base;
}

function updateUi() {
  setHudMetric(ui.timer, "timer", formatTime(game.time), `时间 ${formatTime(game.time)}`);
  const compactHud = isCompactHud();
  setHudMetric(ui.level, "realm", compactHud ? compactRealmLabel(game.player.level) : realmLabel(game.player.level), `境界 ${realmLabel(game.player.level)}`);
  setHudMetric(ui.kills, "kills", compactHud ? `斩${game.killCount}` : `${theme.copy?.kills || "击退"} ${game.killCount}`, `${theme.copy?.kills || "击退"} ${game.killCount}`);
  const activeWeapons = Object.values(game.weapons).filter((weapon) => weapon.level > 0 || weapon.unlocked);
  const weaponText = activeWeapons
    .map((weapon) => (theme.realms ? `${weapon.name} ${weapon.level}重` : `${weapon.name} Lv.${weapon.level}`))
    .join(" / ");
  const compactWeaponText = activeWeapons.length
    ? `${activeWeapons[0].name.slice(0, 2)}${activeWeapons[0].level}${activeWeapons.length > 1 ? `+${activeWeapons.length - 1}` : ""}`
    : weaponText;
  setHudMetric(ui.weapon, "weapon", compactHud ? compactWeaponText : weaponText, `功法 ${weaponText}`);
  const dashReady = game.player.dashCooldown <= 0;
  const dashText = dashReady ? "闪避" : `${game.player.dashCooldown.toFixed(1)}s`;
  setHudMetric(ui.dashBtn, "movement", dashText, dashReady ? "闪避可用" : `闪避冷却 ${dashText}`);
  ui.dashBtn?.classList.toggle("cooling", !dashReady);
  if (ui.dashBtn) ui.dashBtn.disabled = game.state !== "playing";
  ui.hpBar.style.width = `${clamp((game.player.hp / game.player.maxHp) * 100, 0, 100)}%`;
  if (ui.energyBar) ui.energyBar.style.width = `${clamp(((game.energy.value || 0) / (game.energy.max || 100)) * 100, 0, 100)}%`;
  ui.xpBar.style.width = `${clamp((game.player.xp / game.player.nextXp) * 100, 0, 100)}%`;
  if (ui.equipmentSummary) {
    setHudMetric(ui.equipmentSummary, "artifact", equipmentSummaryText(), `法器 ${equipmentSummaryText()}`);
  }
  updateQuestBadges();
  renderRunGoals();
  updateRunGoalNotices();
  renderGoalToast();

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
  updateRunEvents(dt);
  updateWaves(dt);
  updateBossRuntime(dt);
  updateBossTelegraphs(dt);
  updateBossHazards(dt);
  updateWeapon(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updatePickups(dt);
  updateEventChallenge();
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
    drawTiledBackground(background, rect, bg ? 0.7 : 0.38);
  }
  drawGroundMotifs(rect);
}

function drawTiledBackground(background, rect, alpha) {
  const configuredScale = theme.background?.tileScale;
  const scale = configuredScale ?? clamp(rect.height / background.height, 0.58, 0.78);
  const width = Math.max(1, background.width * scale);
  const height = Math.max(1, background.height * scale);
  const offsetX = rect.width / 2 - width / 2 - positiveModulo(game.camera.x, width);
  const offsetY = rect.height / 2 - height / 2 - positiveModulo(game.camera.y, height);

  ctx.save();
  ctx.globalAlpha = alpha;
  for (let x = offsetX; x < rect.width; x += width) {
    for (let y = offsetY; y < rect.height; y += height) {
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
  if (game.player.dashDuration > 0) {
    const progress = clamp(game.player.dashDuration / game.player.dashDurationMax, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = rgba("#b9f3ff", 0.22 + progress * 0.36);
    ctx.fillStyle = rgba("#b9f3ff", 0.08 + progress * 0.12);
    ctx.lineWidth = 2;
    ctx.shadowColor = "#b9f3ff";
    ctx.shadowBlur = 18;
    for (let i = 1; i <= 3; i += 1) {
      const x = p.x - game.player.dashDir.x * i * 20;
      const y = p.y - game.player.dashDir.y * i * 20;
      ctx.beginPath();
      ctx.ellipse(x, y, game.player.radius * (1.25 - i * 0.16), game.player.radius * (0.62 - i * 0.08), Math.atan2(game.player.dashDir.y, game.player.dashDir.x), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
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

  if (game.player.dashCooldown <= 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(185, 243, 255, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, game.player.radius + 10 + Math.sin(performance.now() / 220) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

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
  if (enemy.affix) {
    const pulse = Math.sin(performance.now() / 180 + enemy.id) * 0.5 + 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = rgba(enemy.affix.color, 0.36 + pulse * 0.24);
    ctx.lineWidth = 2;
    ctx.shadowColor = enemy.affix.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, enemy.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
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
  if (enemy.affix) {
    ctx.save();
    ctx.font = "800 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelWidth = Math.max(32, enemy.affix.name.length * 13);
    const labelY = p.y - enemy.radius - 24;
    ctx.fillStyle = "rgba(8, 13, 16, 0.72)";
    ctx.strokeStyle = rgba(enemy.affix.color, 0.72);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(p.x - labelWidth / 2, labelY - 9, labelWidth, 18, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = enemy.affix.color;
    ctx.fillText(enemy.affix.name, p.x, labelY);
    ctx.restore();
  }
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
  if (pickup.type === "event") {
    const color = pickup.color || (pickup.eventType === "spring" ? "#8dffba" : "#f4d778");
    const pulse = 0.78 + Math.sin(performance.now() / 180 + pickup.id) * 0.14;
    const ttl = pickup.life ? clamp(1 - pickup.age / pickup.life, 0, 1) : 1;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = rgba(color, 0.28 + ttl * 0.28);
    ctx.fillStyle = rgba(color, 0.12 + ttl * 0.12);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pickup.radius * (1.7 + pulse * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color;
    if (pickup.eventType === "spring") {
      ctx.beginPath();
      ctx.arc(p.x, p.y + 2, pickup.radius * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(247,243,232,0.86)";
      ctx.fillRect(p.x - 8, p.y - 2, 16, 3);
      ctx.fillRect(p.x - 2, p.y - 8, 4, 15);
    } else {
      ctx.beginPath();
      ctx.roundRect(p.x - pickup.radius * 0.72, p.y - pickup.radius * 0.52, pickup.radius * 1.44, pickup.radius * 1.08, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(80,52,10,0.72)";
      ctx.stroke();
      ctx.fillStyle = "rgba(80,52,10,0.72)";
      ctx.fillRect(p.x - 8, p.y - 2, 16, 4);
    }
    ctx.font = "800 12px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.lineWidth = 3;
    ctx.fillStyle = color;
    ctx.strokeText(pickup.label || "奇遇", p.x, p.y - pickup.radius * 2.2);
    ctx.fillText(pickup.label || "奇遇", p.x, p.y - pickup.radius * 2.2);
    ctx.restore();
    return;
  }
  if (pickup.type === "material") {
    const color = pickup.color || currencyConfig(pickup.currencyKey).color || "#f7f3e8";
    const pulse = 0.82 + Math.sin(performance.now() / 180 + pickup.id) * 0.12;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = rgba(color, 0.18);
    ctx.strokeStyle = rgba(color, 0.72);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pickup.radius * (1.45 + pulse * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgba("#10131c", 0.92);
    ctx.beginPath();
    ctx.arc(p.x, p.y, pickup.radius * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "800 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pickup.iconText || pickup.label?.slice(0, 1) || "材", p.x, p.y + 0.5);
    if (pickup.value > 1) {
      ctx.fillStyle = "#f7f3e8";
      ctx.font = "700 10px Arial, sans-serif";
      ctx.fillText(`+${pickup.value}`, p.x, p.y - pickup.radius * 1.9);
    }
    ctx.restore();
    return;
  }
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
  if (event.code === "Space" || event.key === "Shift") {
    event.preventDefault();
    startDash();
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
ui.resultQuestBtn?.addEventListener("click", () => openHomePanel("quests"));
ui.resultNextSteps?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='result-open-tab']");
  if (!button || button.disabled) return;
  if (button.dataset.postAction === "applyWeaknessPatch") applyWeaknessPatchPlan();
  focusedMaterials = button.dataset.focusMaterials
    ? button.dataset.focusMaterials.split(",").filter(Boolean)
    : [];
  materialPreviewDifficultyId = button.dataset.previewDifficulty || "";
  openHomePanel(button.dataset.tab || "journey");
});
ui.pauseBtn.addEventListener("click", pauseGame);
ui.dashBtn?.addEventListener("click", startDash);
ui.growthBtn?.addEventListener("click", () => {
  const stats = ui.growthBtn.closest(".stats");
  const expanded = !stats?.classList.contains("show-growth");
  stats?.classList.toggle("show-growth", expanded);
  ui.growthBtn.setAttribute("aria-expanded", String(expanded));
});
ui.resumeBtn.addEventListener("click", resumeGame);
ui.quickRestartBtn.addEventListener("click", resetGame);
ui.homeBtn?.addEventListener("click", () => openHomePanel("chapters"));
ui.startRunBtn?.addEventListener("click", startRunFromHome);
ui.closeHomeBtn?.addEventListener("click", closeHomePanel);
ui.exportSaveBtn?.addEventListener("click", exportMetaSave);
ui.importSaveBtn?.addEventListener("click", importMetaSave);
ui.homeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  focusedMaterials = [];
  targetMaterial = "";
  targetMaterialMode = "";
  targetMaterialDifficulty = "";
  activeHomeTab = button.dataset.tab;
  renderHomePanel();
});
ui.homeContent?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  handleHomeAction(button);
});
ui.eventChoiceOptions?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-choice-id]");
  if (!button || button.disabled) return;
  selectRunEventChoice(button.dataset.choiceId || "");
});

resize();
preloadThemeAssets();
resetGame();
if (debugBossOnLoad) {
  spawnEnemy("boss");
  updateBossRuntime(0.1);
} else if (debugResolveEventId && metaConfig) {
  runDebugResolvedEventScenario();
} else if (debugFinishOnStart && metaConfig) startRunFromHome();
else if (metaConfig) openHomePanel("chapters");
else {
  ui.homeBtn?.classList.add("hidden");
  ui.runGoals?.classList.add("hidden");
}
requestAnimationFrame(loop);
