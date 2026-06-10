import { readFile } from "node:fs/promises";

const errors = [];

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
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

assertIncludes(styles, '[data-ui-mode="mobile"]', "styles.css");
assertIncludes(styles, ".boot-overlay", "styles.css");
assertIncludes(styles, ".mobile-top-bar", "styles.css");

assertIncludes(main, 'dataset.uiMode', "main.js");
assertIncludes(main, "isPortraitMobile()", "main.js");
assertIncludes(main, "setBootPhase(", "main.js");

assertIncludes(assets, "preloadCriticalAssets", "assets.js");
assertIncludes(assets, "preloadBattleDeferredAssets", "assets.js");
assertIncludes(assets, "preloadHomeAssetsForTab", "assets.js");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("mobile shell checks ok");
