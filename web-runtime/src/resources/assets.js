import { HOME_PRELOAD_TABS } from "./asset-pipeline-contract.js";

export const PLAYER_SPRITE_SCALE = 3.85;
export const ENEMY_SPRITE_SCALE = 3.2;

const supportsWebp = (() => {
  const probe = document.createElement("canvas");
  return probe.toDataURL("image/webp").startsWith("data:image/webp");
})();

export function createAssetManager({ theme, ctx, clamp }) {
  const imageAssets = new Map();
  const assetMeta = new Map();

  function queueAsset(keys, key, file) {
    if (!file) return;
    keys.push(key);
    loadImageAsset(key, file);
  }

  function preloadNamedAssets(rows = []) {
    if (!theme.assetBase) return [];
    const keys = [];
    for (const row of rows) queueAsset(keys, row.key, row.file);
    return keys;
  }

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
    if (current?.sourceFile === file && current?.assetFile === assetFile) return current.loadPromise;
    assetMeta.delete(key);
    const image = new Image();
    image.decoding = "async";
    image.sourceFile = file;
    image.assetFile = assetFile;
    image.loadPromise = new Promise((resolve) => {
      image.addEventListener("load", () => {
        image.loaded = true;
        resolve(image);
      }, { once: true });
      image.addEventListener("error", () => {
        image.failed = true;
        if (candidates[candidateIndex + 1]) resolve(loadImageAsset(key, file, candidateIndex + 1));
        else resolve(null);
      }, { once: true });
    });
    image.src = `${theme.assetBase || ""}${assetFile}`;
    imageAssets.set(key, image);
    return image.loadPromise;
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

  async function waitForAssetKeys(keys = [], timeoutMs = 1800) {
    const pending = [...new Set(keys)]
      .map((key) => imageAssets.get(key)?.loadPromise)
      .filter(Boolean);
    if (!pending.length) return;
    await Promise.race([
      Promise.allSettled(pending),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }

  function preloadCriticalAssets() {
    if (!theme.assetBase) return [];
    const keys = [];
    queueAsset(keys, "player", theme.player.asset);
    queueAsset(keys, "background", theme.background?.asset);
    queueAsset(keys, "background:fallback", theme.background?.fallbackAsset);
    queueAsset(keys, "hero:0", theme.heroRealms?.[0]?.asset);
    for (const [type, enemy] of Object.entries(theme.enemies || {})) {
      if (type !== "boss") queueAsset(keys, `enemy:${type}`, enemy.asset);
    }
    for (const [type, weapon] of Object.entries(theme.weapons || {})) queueAsset(keys, `weapon:${type}`, weapon.asset);
    queueAsset(keys, "pickup:xp", theme.pickups?.xp?.asset);
    queueAsset(keys, "pickup:health", theme.pickups?.health?.asset);
    for (const [name, file] of Object.entries(theme.hudIcons || {})) queueAsset(keys, `hud:${name}`, file);
    return keys;
  }

  function preloadBattleDeferredAssets() {
    if (!theme.assetBase) return [];
    const keys = [];
    queueAsset(keys, "enemy:boss", theme.enemies?.boss?.asset);
    for (const [index, hero] of (theme.heroRealms || []).entries()) {
      queueAsset(keys, `hero:${index}`, hero.asset);
    }
    for (const [slot, slotConfig] of Object.entries(theme.equipmentSlots || {})) {
      for (const [index, file] of (slotConfig.assets || []).entries()) {
        queueAsset(keys, `equip:${slot}:${index + 1}`, file);
      }
    }
    for (const [name, file] of Object.entries(theme.hudIcons || {})) queueAsset(keys, `hud:${name}`, file);
    return keys;
  }

  function preloadHomeAssetsForTab(tab = "chapters") {
    if (!theme.assetBase) return [];
    const keys = [];
    const meta = theme.meta || {};
    queueAsset(keys, "home:bg", meta.homeAssets?.background);
    queueAsset(keys, `home:tab:${tab}`, meta.homeAssets?.tabs?.[tab]);
    if (tab === "chapters" || tab === "journey" || tab === "materials" || tab === "quests") {
      for (const chapter of meta.chapters || []) {
        queueAsset(keys, `chapter:bg:${chapter.id}`, chapter.background || chapter.fallbackBackground);
        queueAsset(keys, `chapter:boss:${chapter.id}`, chapter.bossAsset || chapter.background || chapter.fallbackBackground);
      }
    }
    if (tab === "start" || tab === "artifacts") {
      for (const artifact of meta.artifacts || []) queueAsset(keys, `artifact:${artifact.id}`, artifact.icon);
    }
    if (tab === "start" || tab === "cultivation") {
      for (const cultivation of meta.cultivations || []) {
        queueAsset(keys, `cultivation:${cultivation.id}`, cultivation.icon);
      }
    }
    if (tab === "start" || tab === "talents") {
      for (const tree of meta.talentTrees || []) queueAsset(keys, `talent-tree:${tree.id}`, tree.icon);
    }
    if (tab === "facilities") {
      for (const facility of meta.facilities || []) queueAsset(keys, `facility:${facility.id}`, facility.icon);
    }
    if (tab === "bestiary") {
      for (const chapter of meta.chapters || []) {
        queueAsset(keys, `bestiary:${chapter.id}`, chapter.bossAsset || chapter.background || chapter.fallbackBackground);
      }
    }
    return keys;
  }

  function preloadThemeAssets() {
    const keys = [...preloadCriticalAssets(), ...preloadBattleDeferredAssets()];
    for (const tab of HOME_PRELOAD_TABS) keys.push(...preloadHomeAssetsForTab(tab));
    return [...new Set(keys)];
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

  return {
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
  };
}

export function createImageHtmlHelpers({ theme, optimizedAssetFile }) {
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

  return {
    assetUrl,
    optimizedAssetUrl,
    thumbnailAsset,
    homeImage,
  };
}
