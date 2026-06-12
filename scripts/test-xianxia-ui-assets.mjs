import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { xianxiaContent } from "../web-runtime/src/content-registry/index.js";
import {
  HOME_BUTTON_ACTIONS_BY_TAB,
  HOME_PANEL_ROLES_BY_TAB,
  HOME_TAB_KEYS,
  MOBILE_NAV_KEYS,
  UI_BUTTON_KEYS,
  UI_BUTTON_STATES,
  UI_NAV_STATES,
} from "../web-runtime/src/content-registry/home-ui-contract.js";
import { createHomeUiAssets } from "../web-runtime/src/ui/home/ui-assets.js";

const errors = [];

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

await Promise.all([
  assertFile("web-runtime/src/ui/home/ui-assets.js"),
  assertFile("web-runtime/src/ui/home/renderers.js"),
  assertFile("web-runtime/src/content-registry/home-ui-contract.js"),
  assertFile("web-runtime/index.html"),
  assertFile("assets/image2-prompts/xianxia/ui-assets.manifest.json"),
]);

const [manifestSource, indexSource] = await Promise.all([
  read("assets/image2-prompts/xianxia/ui-assets.manifest.json"),
  read("web-runtime/index.html"),
]);

let manifest = null;
try {
  manifest = JSON.parse(manifestSource);
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

  for (const key of MOBILE_NAV_KEYS) {
    const row = navMap.get(key);
    assert(Boolean(row), `ui asset manifest missing nav key ${key}`);
    assert(Array.isArray(row?.states), `ui asset manifest nav ${key} missing states`);
    assert(row?.states?.join(",") === UI_NAV_STATES.join(","), `ui asset manifest nav ${key} should define ${UI_NAV_STATES.join(",")}`);
    for (const state of UI_NAV_STATES) {
      assert(Boolean(row?.outputs?.[state]), `ui asset manifest nav ${key} missing output for ${state}`);
    }
  }

  for (const key of HOME_TAB_KEYS) {
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

  for (const key of UI_BUTTON_KEYS) {
    const row = buttonMap.get(key);
    assert(Boolean(row), `ui asset manifest missing button key ${key}`);
    assert(Array.isArray(row?.states), `ui asset manifest button ${key} missing states`);
    assert(row?.states?.join(",") === UI_BUTTON_STATES.join(","), `ui asset manifest button ${key} should define ${UI_BUTTON_STATES.join(",")}`);
    for (const state of UI_BUTTON_STATES) {
      assert(Boolean(row?.outputs?.[state]), `ui asset manifest button ${key} missing output for ${state}`);
    }
  }
}

const homeVisuals = xianxiaContent.homeVisuals;
const uiAssets = homeVisuals.uiAssets;
assert(Boolean(uiAssets), "xianxia content registry is missing uiAssets");

const resolver = createHomeUiAssets({
  homeVisuals,
  optimizedAssetUrl(file) {
    return `/demo-assets/${file}`;
  },
});

for (const key of MOBILE_NAV_KEYS) {
  for (const state of UI_NAV_STATES) {
    assert(Boolean(resolver.navPath(key, state)), `ui asset resolver missing nav path ${key}.${state}`);
    assert(resolver.navAttrs(key, state).includes(`data-ui-nav="${key}"`), `ui asset resolver missing nav attrs for ${key}.${state}`);
  }
}

for (const key of HOME_TAB_KEYS) {
  assert(Boolean(resolver.tabBanner(key)), `ui asset resolver missing tab banner ${key}`);
  const preloadRows = resolver.preloadRowsForTab(key);
  assert(Array.isArray(preloadRows) && preloadRows.length > 0, `ui asset resolver missing preload rows for tab ${key}`);
  for (const role of HOME_PANEL_ROLES_BY_TAB[key] || []) {
    assert(preloadRows.some((row) => row.key === `ui:panel:${key}:${role}`), `ui asset preload rows missing panel ${key}.${role}`);
  }
  for (const action of HOME_BUTTON_ACTIONS_BY_TAB[key] || []) {
    assert(preloadRows.some((row) => row.key.includes(`ui:button:${action}:`)), `ui asset preload rows missing button ${action} for tab ${key}`);
  }
}

const mobileNavRows = resolver.preloadMobileNavRows();
assert(mobileNavRows.length >= MOBILE_NAV_KEYS.length * UI_NAV_STATES.length - 2, "ui asset resolver missing mobile nav preload rows");

if (uiAssets) {
  for (const key of MOBILE_NAV_KEYS) {
    assert(Boolean(uiAssets.navs?.[key]?.idle), `xianxia uiAssets.navs.${key}.idle is missing`);
    assert(Boolean(uiAssets.navs?.[key]?.active), `xianxia uiAssets.navs.${key}.active is missing`);
  }
  for (const key of HOME_TAB_KEYS) {
    assert(Boolean(uiAssets.tabs?.[key]), `xianxia uiAssets.tabs missing ${key}`);
  }
  assert(Boolean(uiAssets.panels?.shared?.primary), "xianxia uiAssets.panels.shared.primary is missing");
  assert(Boolean(uiAssets.buttons?.shared?.primary?.idle), "xianxia uiAssets.buttons.shared.primary.idle is missing");
  assert(Boolean(uiAssets.buttons?.shared?.secondary?.idle), "xianxia uiAssets.buttons.shared.secondary.idle is missing");

  for (const key of expectedThemePanelKeys) {
    const [tab, role] = key.split(".");
    assert(Boolean(uiAssets.panels?.[tab]?.[role]), `xianxia uiAssets.panels.${tab}.${role} is missing`);
  }

  for (const key of UI_BUTTON_KEYS) {
    const button = uiAssets.buttons?.[key];
    assert(Boolean(button), `xianxia uiAssets.buttons missing ${key}`);
    for (const state of UI_BUTTON_STATES) {
      assert(Boolean(button?.[state]), `xianxia uiAssets.buttons.${key}.${state} is missing`);
    }
  }
}

assert(indexSource.includes('data-tab="home"'), "web-runtime/index.html missing home tab button");
assert(indexSource.includes('data-tab="more"'), "web-runtime/index.html missing more tab button");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("xianxia ui asset checks ok");
