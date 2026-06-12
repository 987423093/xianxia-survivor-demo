import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { flattenUiOutputs, loadUiAssetManifest } from "./lib/xianxia-ui-assets.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const rawDir = join(root, "assets/generated/xianxia/raw");
const demoDir = join(root, "demo/assets/xianxia");
const python = "/Users/zhoutao/miniconda3/bin/python3";
const uiManifest = loadUiAssetManifest(root);

const maps = ["map-stone-array.png", "map-blood-wasteland.png", "map-thunder-gate.png"];
const homeBackgrounds = ["home-dongfu-bg.png"];
const mobileRunDashboards = [
  "mobile-run-dashboard-portrait-v2.png",
  "mobile-run-dashboard-stone-array.png",
  "mobile-run-dashboard-blood-wasteland.png",
  "mobile-run-dashboard-thunder-gate.png",
];
const homeBanners = [
  "home-tab-home.png",
  "home-tab-more.png",
  "home-tab-chapters.png",
  "home-tab-start.png",
  "home-tab-journey.png",
  "home-tab-materials.png",
  "home-tab-quests.png",
  "home-tab-bestiary.png",
  "home-tab-talents.png",
  "home-tab-artifacts.png",
  "home-tab-cultivation.png",
  "home-tab-facilities.png",
];
const bosses = [
  "boss-mountain-yao-king.png",
  "boss-black-array-master.png",
  "boss-blood-demon-lord.png",
  "boss-thunder-tribulation-lord.png",
];
const homeIcons = [
  "artifact-qingming-sword-case.png",
  "artifact-red-lotus-lamp.png",
  "artifact-thunder-seal.png",
  "artifact-spirit-gourd.png",
  "artifact-black-turtle-armor.png",
  "artifact-demon-bell.png",
  "facility-field.png",
  "facility-alchemy.png",
  "facility-forge.png",
  "facility-library.png",
  "facility-cushion.png",
  "facility-thunder-pool.png",
  "path-sword.png",
  "path-spirit.png",
  "path-body.png",
  "path-movement.png",
  "path-forge.png",
];
const hudIcons = [
  "hud-timer.png",
  "hud-realm.png",
  "hud-kill.png",
  "hud-skill.png",
  "hud-home.png",
  "hud-pause.png",
  "hud-hp.png",
  "hud-energy.png",
  "hud-xp.png",
  "hud-artifact.png",
];
const uiIcons = [
  "currency-spirit-stone.png",
  "currency-dao.png",
  "currency-mystic-iron.png",
  "currency-spirit-essence.png",
  "currency-thunder-shard.png",
  "ui-upgrade.png",
  "ui-unlock.png",
  "ui-route.png",
];
const rawSheetSources = Object.fromEntries(uiIcons.map((file) => [file, "ui-icon-sheet.png"]));
const uiAssets = flattenUiOutputs(uiManifest);

function inspectPng(file) {
  if (!existsSync(file)) return null;
  const result = spawnSync(
    python,
    [
      "-",
      file,
    ],
    {
      input: `
from PIL import Image
import json
import sys

path = sys.argv[1]
img = Image.open(path).convert("RGBA")
alpha = img.getchannel("A")
print(json.dumps({
    "mode": img.mode,
    "size": img.size,
    "alphaMin": min(alpha.getdata()),
    "alphaMax": max(alpha.getdata()),
}))
`,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) return { error: (result.stderr || result.stdout).trim() };
  return JSON.parse(result.stdout);
}

function rawExists(file) {
  const sheet = rawSheetSources[file];
  if (sheet) {
    const directSheet = join(rawDir, sheet);
    const dot = sheet.lastIndexOf(".");
    if (existsSync(directSheet) || existsSync(join(rawDir, `${sheet.slice(0, dot)}-1${sheet.slice(dot)}`))) return true;
  }
  const direct = join(rawDir, file);
  if (existsSync(direct)) return true;
  const dot = file.lastIndexOf(".");
  return existsSync(join(rawDir, `${file.slice(0, dot)}-1${file.slice(dot)}`));
}

const expected = [
  ...maps.map((file) => ({ file, size: "2048x1152", alpha: "opaque" })),
  ...homeBackgrounds.map((file) => ({ file, size: "2048x1152", alpha: "opaque" })),
  ...mobileRunDashboards.map((file) => ({ file, size: "1152x2048", alpha: "opaque" })),
  ...homeBanners.map((file) => ({ file, size: "1536x640", alpha: "opaque" })),
  ...bosses.map((file) => ({ file, size: "1024x1024", alpha: "transparent" })),
  ...homeIcons.map((file) => ({ file, size: "1024x1024", alpha: "transparent" })),
  ...hudIcons.map((file) => ({ file, size: "1024x1024", alpha: "transparent" })),
  ...uiIcons.map((file) => ({ file, size: "512x512", alpha: "transparent" })),
  ...uiAssets.map((asset) => ({
    file: asset.output,
    size: asset.size,
    alpha: asset.type === "button" || asset.type === "nav"
      ? "transparent"
      : asset.background === "opaque" ? "opaque" : "transparent",
    allowSizeAtLeast: asset.type === "panel",
  })),
];

function parseSize(size) {
  const [width, height] = String(size).split("x").map((value) => Number(value));
  return { width, height };
}

function sizeMatches(actualSize, expectedSize, allowSizeAtLeast = false) {
  if (actualSize === expectedSize) return true;
  if (!allowSizeAtLeast) return false;
  const actual = parseSize(actualSize);
  const expected = parseSize(expectedSize);
  return actual.width >= expected.width
    && actual.height >= expected.height
    && actual.width <= expected.width + 80
    && actual.height <= expected.height + 80;
}

const rows = expected.map(({ file, size: expectedSize, alpha: expectedAlpha, allowSizeAtLeast = false }) => {
  const rawPath = join(rawDir, file);
  const demoPath = join(demoDir, file);
  const inspected = inspectPng(demoPath);
  const size = inspected?.size ? inspected.size.join("x") : "";
  const alpha = inspected ? `${inspected.alphaMin}-${inspected.alphaMax}` : "";
  return {
    file,
    raw: rawExists(file),
    demo: existsSync(demoPath),
    expectedSize,
    expectedAlpha,
    mode: inspected?.mode || "",
    size,
    alpha,
    okSize: sizeMatches(size, expectedSize, allowSizeAtLeast),
    okAlpha: expectedAlpha === "transparent" ? alpha === "0-255" : alpha === "255-255",
  };
});

console.table(rows);

const invalid = rows.filter((row) => !row.raw || !row.demo || !row.okSize || !row.okAlpha);
if (invalid.length) {
  console.error(`invalid xianxia assets: ${invalid.map((row) => row.file).join(", ")}`);
  process.exitCode = 1;
}
