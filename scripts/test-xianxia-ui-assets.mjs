import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { xianxiaTheme } from "../demo/src/theme.js";

const errors = [];

const expectedTabKeys = [
  "home",
  "more",
  "chapters",
  "start",
  "journey",
  "materials",
  "quests",
  "bestiary",
  "talents",
  "artifacts",
  "cultivation",
  "facilities",
];

const expectedNavKeys = [
  "home",
  "build",
  "quests",
  "chapters",
  "more",
];

const expectedManifestPanelKeys = [
  "home.dailyDecree",
  "home.continueRun",
  "home.currentBuild",
  "home.claimableRewards",
  "home.chapterRecommendation",
  "more.header",
  "more.journey",
  "more.materials",
  "more.quests",
  "more.bestiary",
  "more.talents",
  "more.artifacts",
  "more.cultivation",
  "more.facilities",
  "chapters.overview",
  "chapters.chapterCard",
  "chapters.drops",
  "chapters.encounter",
  "chapters.boss",
];

const expectedThemePanelKeys = [
  "start.overview",
  "journey.hero",
  "materials.overview",
  "quests.overview",
  "bestiary.hero",
  "talents.overview",
  "artifacts.overview",
  "cultivation.overview",
  "facilities.overview",
];

const expectedButtonKeys = [
  "startRun",
  "openMore",
  "backHome",
  "openChapters",
  "openBuild",
  "openQuests",
  "applyRecommendation",
  "enterDetail",
  "returnBattle",
  "saveTools",
];

await assertFile("demo/src/home/ui-assets.js");
await assertFile("demo/src/home/renderers.js");
await assertFile("demo/src/main.js");
await assertFile("demo/index.html");

const [uiAssetsSource, renderersSource, mainSource, indexSource] = await Promise.all([
  read("demo/src/home/ui-assets.js"),
  read("demo/src/home/renderers.js"),
  read("demo/src/main.js"),
  read("demo/index.html"),
]);

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function assertFile(relativePath) {
  try {
    await access(new URL(`../${relativePath}`, import.meta.url), constants.F_OK);
  } catch {
    errors.push(`missing file: ${relativePath}`);
  }
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function byKey(rows = []) {
  return new Map(rows.map((row) => [row.key, row]));
}

await assertFile("assets/image2-prompts/xianxia/ui-assets.manifest.json");

let manifest = null;
try {
  manifest = JSON.parse(await read("assets/image2-prompts/xianxia/ui-assets.manifest.json"));
} catch (error) {
  errors.push(`failed to read ui asset manifest: ${error.message}`);
}

if (manifest) {
  assert(Array.isArray(manifest.tabs), "ui asset manifest missing tabs array");
  assert(Array.isArray(manifest.panels), "ui asset manifest missing panels array");
  assert(Array.isArray(manifest.buttons), "ui asset manifest missing buttons array");
  assert(Array.isArray(manifest.navs), "ui asset manifest missing navs array");

  const navMap = byKey(manifest.navs);
  const tabMap = byKey(manifest.tabs);
  const panelMap = byKey(manifest.panels);
  const buttonMap = byKey(manifest.buttons);

  for (const key of expectedNavKeys) {
    const row = navMap.get(key);
    assert(Boolean(row), `ui asset manifest missing nav key ${key}`);
    assert(Array.isArray(row?.states), `ui asset manifest nav ${key} missing states`);
    assert(row?.states?.join(",") === "idle,active", `ui asset manifest nav ${key} should define idle,active states`);
    for (const state of ["idle", "active"]) {
      assert(Boolean(row?.outputs?.[state]), `ui asset manifest nav ${key} missing output for ${state}`);
    }
  }

  for (const key of expectedTabKeys) {
    const row = tabMap.get(key);
    assert(Boolean(row), `ui asset manifest missing tab key ${key}`);
    assert(Boolean(row?.output), `ui asset manifest tab ${key} missing output`);
    assert(Boolean(row?.promptFile), `ui asset manifest tab ${key} missing promptFile`);
  }

  for (const key of expectedManifestPanelKeys) {
    const row = panelMap.get(key);
    assert(Boolean(row), `ui asset manifest missing panel key ${key}`);
    assert(Boolean(row?.output), `ui asset manifest panel ${key} missing output`);
    assert(Boolean(row?.promptFile), `ui asset manifest panel ${key} missing promptFile`);
    assert(Boolean(row?.fallbackKey), `ui asset manifest panel ${key} missing fallbackKey`);
  }

  for (const key of expectedButtonKeys) {
    const row = buttonMap.get(key);
    assert(Boolean(row), `ui asset manifest missing button key ${key}`);
    assert(Array.isArray(row?.states), `ui asset manifest button ${key} missing states`);
    assert(row?.states?.join(",") === "idle,active,emphasis", `ui asset manifest button ${key} should define idle,active,emphasis states`);
    for (const state of ["idle", "active", "emphasis"]) {
      assert(Boolean(row?.outputs?.[state]), `ui asset manifest button ${key} missing output for ${state}`);
    }
  }
}

const uiAssets = xianxiaTheme.meta?.uiAssets;
assert(Boolean(uiAssets), "xianxiaTheme.meta.uiAssets is missing");

if (uiAssets) {
  for (const key of expectedNavKeys) {
    assert(Boolean(uiAssets.navs?.[key]?.idle), `xianxiaTheme.meta.uiAssets.navs.${key}.idle is missing`);
    assert(Boolean(uiAssets.navs?.[key]?.active), `xianxiaTheme.meta.uiAssets.navs.${key}.active is missing`);
  }
  for (const key of expectedTabKeys) {
    assert(Boolean(uiAssets.tabs?.[key]), `xianxiaTheme.meta.uiAssets.tabs missing ${key}`);
  }
  assert(Boolean(uiAssets.panels?.shared?.primary), "xianxiaTheme.meta.uiAssets.panels.shared.primary is missing");
  assert(Boolean(uiAssets.buttons?.shared?.primary?.idle), "xianxiaTheme.meta.uiAssets.buttons.shared.primary.idle is missing");
  assert(Boolean(uiAssets.buttons?.shared?.secondary?.idle), "xianxiaTheme.meta.uiAssets.buttons.shared.secondary.idle is missing");

  for (const key of expectedThemePanelKeys) {
    const [tab, role] = key.split(".");
    assert(Boolean(uiAssets.panels?.[tab]?.[role]), `xianxiaTheme.meta.uiAssets.panels.${tab}.${role} is missing`);
  }

  for (const key of expectedButtonKeys) {
    const button = uiAssets.buttons?.[key];
    assert(Boolean(button), `xianxiaTheme.meta.uiAssets.buttons missing ${key}`);
    assert(Boolean(button?.idle), `xianxiaTheme.meta.uiAssets.buttons.${key}.idle is missing`);
    assert(Boolean(button?.active), `xianxiaTheme.meta.uiAssets.buttons.${key}.active is missing`);
    assert(Boolean(button?.emphasis), `xianxiaTheme.meta.uiAssets.buttons.${key}.emphasis is missing`);
  }

  assert(Boolean(uiAssets.panels?.start?.overview), "xianxiaTheme.meta.uiAssets.panels.start.overview is missing");
  assert(Boolean(uiAssets.panels?.journey?.hero), "xianxiaTheme.meta.uiAssets.panels.journey.hero is missing");
  assert(Boolean(uiAssets.panels?.materials?.overview), "xianxiaTheme.meta.uiAssets.panels.materials.overview is missing");
  assert(Boolean(uiAssets.panels?.quests?.overview), "xianxiaTheme.meta.uiAssets.panels.quests.overview is missing");
  assert(Boolean(uiAssets.panels?.bestiary?.hero), "xianxiaTheme.meta.uiAssets.panels.bestiary.hero is missing");
}

assert(uiAssetsSource.includes("panelTabRoles"), "demo/src/home/ui-assets.js missing panelTabRoles");
assert(uiAssetsSource.includes("buttonTabActions"), "demo/src/home/ui-assets.js missing buttonTabActions");
assert(uiAssetsSource.includes("preloadMobileNavRows"), "demo/src/home/ui-assets.js missing preloadMobileNavRows");
assert(uiAssetsSource.includes("navAttrs"), "demo/src/home/ui-assets.js missing navAttrs helper");
assert(uiAssetsSource.includes("buttonFallbacks"), "demo/src/home/ui-assets.js missing buttonFallbacks support");
assert(renderersSource.includes("semanticCta("), "demo/src/home/renderers.js missing semanticCta helper");
assert(renderersSource.includes("home: renderHomeTab"), "demo/src/home/renderers.js missing desktop home renderer export");
assert(renderersSource.includes("more: renderMoreTab"), "demo/src/home/renderers.js missing desktop more renderer export");
assert(renderersSource.includes('uiPanelAttrs("journey", "hero")'), "demo/src/home/renderers.js missing journey hero semantic panel");
assert(renderersSource.includes('uiPanelAttrs("materials", "overview")'), "demo/src/home/renderers.js missing materials overview semantic panel");
assert(renderersSource.includes('uiPanelAttrs("quests", "overview")'), "demo/src/home/renderers.js missing quests overview semantic panel");
assert(renderersSource.includes('uiPanelAttrs("bestiary", "hero")'), "demo/src/home/renderers.js missing bestiary hero semantic panel");
assert(renderersSource.includes('uiPanelAttrs("talents", "overview")'), "demo/src/home/renderers.js missing talents overview semantic panel");
assert(renderersSource.includes('uiPanelAttrs("artifacts", "overview")'), "demo/src/home/renderers.js missing artifacts overview semantic panel");
assert(renderersSource.includes('uiPanelAttrs("cultivation", "overview")'), "demo/src/home/renderers.js missing cultivation overview semantic panel");
assert(renderersSource.includes('uiPanelAttrs("facilities", "overview")'), "demo/src/home/renderers.js missing facilities overview semantic panel");
assert(mainSource.includes("decorateSemanticHomeButtons()"), "demo/src/main.js missing semantic home button decoration");
assert(mainSource.includes("decorateMobileHomeNav()"), "demo/src/main.js missing mobile nav decoration");
assert(indexSource.includes('data-tab="home"'), "demo/index.html missing home tab button");
assert(indexSource.includes('data-tab="more"'), "demo/index.html missing more tab button");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("xianxia ui asset checks ok");
