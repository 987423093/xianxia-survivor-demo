import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import {
  MOBILE_SHELL_PUBLIC_METHODS,
  MOBILE_SHELL_REQUIRED_CLASSES,
  MOBILE_SHELL_REQUIRED_IDS,
} from "../web-runtime/src/bootstrap/runtime/mobile-shell-contract.js";
import { createPointerState, createUiShell } from "../web-runtime/src/bootstrap/runtime/ui-shell.js";
import { ASSET_PIPELINE_PUBLIC_METHODS, HOME_PRELOAD_TABS } from "../web-runtime/src/resources/asset-pipeline-contract.js";

const errors = [];

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

function createClassList() {
  return {
    toggle() {},
    contains() {
      return false;
    },
  };
}

function createUiStub() {
  return {
    body: { dataset: {}, classList: createClassList() },
    bootOverlay: { classList: createClassList(), setAttribute() {} },
    bootPhase: { textContent: "" },
    bootProgress: { style: {} },
    mobileBattleShell: { classList: createClassList(), setAttribute() {} },
    mobileBattleDrawer: { classList: createClassList(), setAttribute() {} },
    mobileDrawerGoals: { classList: createClassList(), innerHTML: "" },
    mobileGrowthBtn: { setAttribute() {} },
    runGoals: { innerHTML: "", classList: createClassList() },
    homeShell: { classList: createClassList() },
    mobileHomeNav: { querySelectorAll() { return []; } },
    startRunBtn: { classList: { add() {} }, setAttribute() {}, removeAttribute() {}, dataset: {} },
    closeHomeBtn: { classList: { add() {} }, setAttribute() {}, removeAttribute() {}, dataset: {} },
    saveToolsToggleBtn: { classList: { add() {} }, setAttribute() {}, removeAttribute() {}, dataset: {} },
    homeTabs: { querySelectorAll() { return []; } },
    homePanel: { classList: createClassList() },
  };
}

const [html, styles, assetsSource] = await Promise.all([
  read("web-runtime/index.html"),
  read("web-runtime/styles.css"),
  read("web-runtime/src/resources/assets.js"),
]);

await Promise.all([
  assertFile("web-runtime/src/bootstrap/runtime/ui-shell.js"),
  assertFile("web-runtime/src/bootstrap/runtime/mobile-shell-contract.js"),
  assertFile("web-runtime/src/resources/assets.js"),
  assertFile("web-runtime/src/resources/asset-pipeline-contract.js"),
  assertFile("web-runtime/assets/xianxia/home-tab-home.png"),
  assertFile("web-runtime/assets/xianxia/home-tab-more.png"),
  assertFile("web-runtime/assets/xianxia/home-tab-journey.png"),
  assertFile("web-runtime/assets/xianxia/home-tab-materials.png"),
  assertFile("web-runtime/assets/xianxia/home-tab-quests.png"),
  assertFile("web-runtime/assets/xianxia/home-tab-bestiary.png"),
]);

for (const id of MOBILE_SHELL_REQUIRED_IDS) {
  assert(html.includes(`id="${id}"`), `index.html missing mobile shell id ${id}`);
}

assert(styles.includes('[data-ui-mode="mobile"]'), "styles.css missing mobile ui mode selector");
for (const className of MOBILE_SHELL_REQUIRED_CLASSES) {
  assert(styles.includes(`.${className}`), `styles.css missing mobile shell class .${className}`);
}
assert(styles.includes("ui-button-primary-1.png"), "styles.css missing primary button asset hook");
assert(styles.includes("ui-button-secondary-1.png"), "styles.css missing secondary button asset hook");
assert(styles.includes("ui-button-nav-idle-1.png"), "styles.css missing nav idle asset hook");
assert(styles.includes("ui-button-nav-active-1.png"), "styles.css missing nav active asset hook");

assert(ASSET_PIPELINE_PUBLIC_METHODS.length >= 6, "asset pipeline contract should expose preload lifecycle methods");
assert(HOME_PRELOAD_TABS.includes("chapters") && HOME_PRELOAD_TABS.includes("bestiary"), "asset pipeline contract missing home preload tabs");
assert(assetsSource.includes("HOME_PRELOAD_TABS"), "resources/assets.js should preload tabs through the shared contract");

const pointer = createPointerState();
assert(pointer.active === false, "createPointerState should initialize inactive pointer");
assert(pointer.origin?.x === 0 && pointer.current?.y === 0, "createPointerState should initialize pointer coordinates");

const uiShell = createUiShell({
  windowRef: {
    innerWidth: 390,
    innerHeight: 844,
    matchMedia(query) {
      if (query.includes("max-width")) return { matches: true };
      if (query.includes("orientation")) return { matches: true };
      return { matches: false };
    },
    setTimeout(task) {
      task();
    },
  },
  documentRef: {
    createElement() {
      return {
        className: "",
        textContent: "",
        setAttribute() {},
      };
    },
  },
  ui: createUiStub(),
  homeState: {
    mobileHomeSection: "home",
    mobileGrowthOpen: false,
    saveToolsOpen: false,
  },
  homeUiAssets: {
    tabBanner() {
      return "";
    },
    navAttrs() {
      return "";
    },
    buttonAttrs() {
      return "";
    },
  },
  homeImage() {
    return "";
  },
  game: { state: "playing" },
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },
});

for (const methodName of MOBILE_SHELL_PUBLIC_METHODS) {
  assert(typeof uiShell[methodName] === "function", `createUiShell missing method ${methodName}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("mobile shell checks ok");
