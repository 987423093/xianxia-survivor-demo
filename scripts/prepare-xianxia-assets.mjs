import { copyFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { flattenUiOutputs, loadUiAssetManifest } from "./lib/xianxia-ui-assets.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const rawDir = join(root, "assets/generated/xianxia/raw");
const demoDir = join(root, "web-runtime/assets/xianxia");
const python = "/Users/zhoutao/miniconda3/bin/python3";
const uiManifest = loadUiAssetManifest(root);

const maps = ["map-stone-array.png", "map-blood-wasteland.png", "map-thunder-gate.png"];
const homeScenes = [
  "home-dongfu-bg.png",
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
const uiSheet = "ui-icon-sheet.png";
const uiSheetSlices = [
  "currency-spirit-stone.png",
  "currency-dao.png",
  "currency-mystic-iron.png",
  "currency-spirit-essence.png",
  "currency-thunder-shard.png",
  "ui-upgrade.png",
  "ui-unlock.png",
  "ui-route.png",
];

const uiAssets = flattenUiOutputs(uiManifest);
const uiButtonFiles = uiAssets.filter((asset) => asset.type === "button" || asset.type === "nav").map((asset) => asset.output);
const uiOtherFiles = uiAssets.filter((asset) => asset.type !== "button" && asset.type !== "nav").map((asset) => asset.output);

await mkdir(demoDir, { recursive: true });

function sourceFor(file) {
  const direct = join(rawDir, file);
  if (existsSync(direct)) return direct;
  const dot = file.lastIndexOf(".");
  const candidate = join(rawDir, `${file.slice(0, dot)}-1${file.slice(dot)}`);
  return existsSync(candidate) ? candidate : direct;
}

for (const file of maps) {
  const source = sourceFor(file);
  if (existsSync(source)) await copyFile(source, join(demoDir, file));
}

for (const file of homeScenes) {
  const source = sourceFor(file);
  if (existsSync(source)) await copyFile(source, join(demoDir, file));
}

for (const file of uiOtherFiles) {
  const source = sourceFor(file);
  if (existsSync(source)) await copyFile(source, join(demoDir, file));
}

for (const file of uiButtonFiles) {
  const source = sourceFor(file);
  if (!existsSync(source)) continue;
  processWhiteBackgroundSprite(source, join(demoDir, file));
}

const uiSheetSource = sourceFor(uiSheet);
if (existsSync(uiSheetSource)) {
  const slicedDir = join(rawDir, "__ui_sheet_slices__");
  await mkdir(slicedDir, { recursive: true });
  sliceSheetIcons(uiSheetSource, slicedDir, uiSheetSlices, 4, 2);
  for (const file of uiSheetSlices) {
    processWhiteBackgroundSprite(join(slicedDir, file), join(demoDir, file));
  }
}

function processWhiteBackgroundSprite(source, out) {
  const result = spawnSync(
    python,
    [
      "-",
      source,
      out,
    ],
    {
      input: `
from PIL import Image
from collections import deque
import sys

src, out = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
px = img.load()
w, h = img.size
seen = set()
queue = deque()

def is_bg(x, y):
    r, g, b, a = px[x, y]
    # Only remove bright near-white pixels connected to the canvas edge.
    return a > 0 and r > 232 and g > 232 and b > 232 and max(r, g, b) - min(r, g, b) < 22

for x in range(w):
    if is_bg(x, 0):
        queue.append((x, 0))
    if is_bg(x, h - 1):
        queue.append((x, h - 1))
for y in range(h):
    if is_bg(0, y):
        queue.append((0, y))
    if is_bg(w - 1, y):
        queue.append((w - 1, y))

while queue:
    x, y = queue.popleft()
    if (x, y) in seen or not is_bg(x, y):
        continue
    seen.add((x, y))
    r, g, b, a = px[x, y]
    px[x, y] = (r, g, b, 0)
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
            queue.append((nx, ny))

# Feather the edge one pixel inward to reduce white halos around generated sprites.
for x, y in list(seen):
    for nx in range(max(0, x - 1), min(w, x + 2)):
        for ny in range(max(0, y - 1), min(h, y + 2)):
            if (nx, ny) in seen:
                continue
            r, g, b, a = px[nx, ny]
            if a > 0 and r > 220 and g > 220 and b > 220:
                px[nx, ny] = (r, g, b, min(a, 96))
img.save(out)
`,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to process ${basename(out)}: ${result.stderr || result.stdout}`);
  }
}

function sliceSheetIcons(source, outDir, files, columns, rows) {
  const result = spawnSync(
    python,
    ["-", source, outDir, JSON.stringify(files), String(columns), String(rows)],
    {
      input: `
from PIL import Image
import json
import os
import sys

src, out_dir, files_json, cols, rows = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
files = json.loads(files_json)
img = Image.open(src).convert("RGBA")
w, h = img.size
cell_w = w // cols
cell_h = h // rows

for index, name in enumerate(files):
    col = index % cols
    row = index // cols
    left = col * cell_w
    top = row * cell_h
    tile = img.crop((left, top, left + cell_w, top + cell_h))
    tile.save(os.path.join(out_dir, name))
`,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to slice ${basename(source)}: ${result.stderr || result.stdout}`);
  }
}

for (const file of [...bosses, ...homeIcons, ...hudIcons]) {
  const source = sourceFor(file);
  if (!existsSync(source)) continue;
  const out = join(demoDir, file);
  processWhiteBackgroundSprite(source, out);
}

const existing = await readdir(demoDir);
console.log(JSON.stringify({
  copiedMaps: maps.filter((file) => existing.includes(file)),
  copiedHomeScenes: homeScenes.filter((file) => existing.includes(file)),
  copiedUiPanelsAndButtons: [...uiOtherFiles, ...uiButtonFiles].filter((file) => existing.includes(file)),
  processedUiIcons: uiSheetSlices.filter((file) => existing.includes(file)),
  processedBosses: bosses.filter((file) => existing.includes(file)),
  processedHomeIcons: homeIcons.filter((file) => existing.includes(file)),
  processedHudIcons: hudIcons.filter((file) => existing.includes(file)),
}, null, 2));
