import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

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

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) errors.push(`${label} missing: ${expected}`);
}

const [html, styles, main, assets] = await Promise.all([
  read("demo/index.html"),
  read("demo/styles.css"),
  read("demo/src/main.js"),
  read("demo/src/assets.js"),
]);

assertIncludes(html, 'id="bootOverlay"', "index.html");
assertIncludes(html, 'id="mobileTopBar"', "index.html");
assertIncludes(html, 'id="mobileStatusDock"', "index.html");
assertIncludes(html, 'id="mobileBattleDrawer"', "index.html");
assertIncludes(html, 'id="mobileHomeNav"', "index.html");
assertIncludes(html, 'id="mobileHomeLanding"', "index.html");

assertIncludes(styles, '[data-ui-mode="mobile"]', "styles.css");
assertIncludes(styles, ".boot-overlay", "styles.css");
assertIncludes(styles, ".mobile-top-bar", "styles.css");
assertIncludes(styles, ".mobile-battle-drawer", "styles.css");
assertIncludes(styles, ".mobile-home-nav", "styles.css");
assertIncludes(styles, ".mobile-home-landing", "styles.css");
assertIncludes(styles, "ui-button-primary-1.png", "styles.css");
assertIncludes(styles, "ui-button-secondary-1.png", "styles.css");
assertIncludes(styles, "ui-button-nav-idle-1.png", "styles.css");
assertIncludes(styles, "ui-button-nav-active-1.png", "styles.css");

assertIncludes(main, 'dataset.uiMode', "main.js");
assertIncludes(main, "isPortraitMobile()", "main.js");
assertIncludes(main, "setBootPhase(", "main.js");
assertIncludes(main, "syncMobileBattleDrawer()", "main.js");
assertIncludes(main, 'homeState.mobileHomeSection', "main.js");
assertIncludes(main, 'mobile-home-more', "main.js");

assertIncludes(assets, "preloadCriticalAssets", "assets.js");
assertIncludes(assets, "preloadBattleDeferredAssets", "assets.js");
assertIncludes(assets, "preloadHomeAssetsForTab", "assets.js");

await Promise.all([
  assertFile("demo/assets/xianxia/home-tab-home.png"),
  assertFile("demo/assets/xianxia/home-tab-more.png"),
  assertFile("demo/assets/xianxia/home-tab-journey.png"),
  assertFile("demo/assets/xianxia/home-tab-materials.png"),
  assertFile("demo/assets/xianxia/home-tab-quests.png"),
  assertFile("demo/assets/xianxia/home-tab-bestiary.png"),
]);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("mobile shell checks ok");
