import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { flattenUiOutputs, loadUiAssetManifest } from "./lib/xianxia-ui-assets.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const demoDir = join(root, "demo/assets/xianxia");
const rawDir = join(root, "assets/generated/xianxia/raw");
const python = "/Users/zhoutao/miniconda3/bin/python3";
const manifest = loadUiAssetManifest(root);
const assets = flattenUiOutputs(manifest);

await mkdir(demoDir, { recursive: true });
await mkdir(rawDir, { recursive: true });

const panelFallback = "home-dongfu-bg.png";
const buttonPrimaryFallback = "ui-button-primary-1.png";
const buttonPrimaryStrongFallback = "ui-button-primary-2.png";
const buttonSecondaryFallback = "ui-button-secondary-1.png";
const buttonSecondaryStrongFallback = "ui-button-secondary-2.png";

function sourceFor(asset) {
  if (asset.type === "tab") return "";
  if (asset.type === "panel") return panelFallback;
  if (asset.type === "button") {
    if (asset.state === "active" || asset.state === "emphasis") {
      return ["startRun", "applyRecommendation"].includes(asset.key)
        ? buttonPrimaryStrongFallback
        : buttonSecondaryStrongFallback;
    }
    return ["startRun", "applyRecommendation"].includes(asset.key)
      ? buttonPrimaryFallback
      : buttonSecondaryFallback;
  }
  return "";
}

const seeded = [];
for (const asset of assets) {
  const sourceFile = sourceFor(asset);
  if (!sourceFile) continue;
  const source = join(demoDir, sourceFile);
  const rawTarget = join(rawDir, asset.output);
  const demoTarget = join(demoDir, asset.output);
  if (!existsSync(source) || (existsSync(rawTarget) && existsSync(demoTarget))) continue;
  const [width, height] = String(asset.size || "2048x1152").split("x").map((value) => Number(value) || 0);
  const result = spawnSync(
    python,
    ["-", source, rawTarget, demoTarget, String(width), String(height)],
    {
      input: `
from PIL import Image
import sys

src, raw_out, demo_out, width, height = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
img = Image.open(src).convert("RGBA")
resized = img.resize((width, height), Image.LANCZOS)
resized.save(raw_out)
resized.save(demo_out)
`,
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to seed ${asset.output}: ${result.stderr || result.stdout}`);
  }
  seeded.push(asset.output);
}

console.log(JSON.stringify({ seeded }, null, 2));
