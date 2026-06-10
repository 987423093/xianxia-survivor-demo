import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const python = "/Users/zhoutao/miniconda3/bin/python3";
const generator = "/Users/zhoutao/.codex/skills/image2/scripts/generate_image2.py";
const promptDir = join(root, "assets/image2-prompts/xianxia");
const outDir = join(root, "assets/generated/xianxia/raw");

const assets = [
  { name: "map-stone-array", size: "2048x1152", background: "opaque" },
  { name: "map-blood-wasteland", size: "2048x1152", background: "opaque" },
  { name: "map-thunder-gate", size: "2048x1152", background: "opaque" },
  { name: "boss-mountain-yao-king", size: "1024x1024", background: "opaque" },
  { name: "boss-black-array-master", size: "1024x1024", background: "opaque" },
  { name: "boss-blood-demon-lord", size: "1024x1024", background: "opaque" },
  { name: "boss-thunder-tribulation-lord", size: "1024x1024", background: "opaque" },
  { name: "home-dongfu-bg", size: "2048x1152", background: "opaque" },
  { name: "home-tab-chapters", size: "1536x640", background: "opaque" },
  { name: "home-tab-start", size: "1536x640", background: "opaque" },
  { name: "home-tab-talents", size: "1536x640", background: "opaque" },
  { name: "home-tab-artifacts", size: "1536x640", background: "opaque" },
  { name: "home-tab-cultivation", size: "1536x640", background: "opaque" },
  { name: "home-tab-facilities", size: "1536x640", background: "opaque" },
  { name: "artifact-qingming-sword-case", size: "1024x1024", background: "opaque" },
  { name: "artifact-red-lotus-lamp", size: "1024x1024", background: "opaque" },
  { name: "artifact-thunder-seal", size: "1024x1024", background: "opaque" },
  { name: "artifact-spirit-gourd", size: "1024x1024", background: "opaque" },
  { name: "artifact-black-turtle-armor", size: "1024x1024", background: "opaque" },
  { name: "artifact-demon-bell", size: "1024x1024", background: "opaque" },
  { name: "facility-field", size: "1024x1024", background: "opaque" },
  { name: "facility-alchemy", size: "1024x1024", background: "opaque" },
  { name: "facility-forge", size: "1024x1024", background: "opaque" },
  { name: "facility-library", size: "1024x1024", background: "opaque" },
  { name: "facility-cushion", size: "1024x1024", background: "opaque" },
  { name: "facility-thunder-pool", size: "1024x1024", background: "opaque" },
  { name: "path-sword", size: "1024x1024", background: "opaque" },
  { name: "path-spirit", size: "1024x1024", background: "opaque" },
  { name: "path-body", size: "1024x1024", background: "opaque" },
  { name: "path-movement", size: "1024x1024", background: "opaque" },
  { name: "path-forge", size: "1024x1024", background: "opaque" },
  { name: "hud-timer", size: "1024x1024", background: "opaque" },
  { name: "hud-realm", size: "1024x1024", background: "opaque" },
  { name: "hud-kill", size: "1024x1024", background: "opaque" },
  { name: "hud-skill", size: "1024x1024", background: "opaque" },
  { name: "hud-home", size: "1024x1024", background: "opaque" },
  { name: "hud-pause", size: "1024x1024", background: "opaque" },
  { name: "hud-hp", size: "1024x1024", background: "opaque" },
  { name: "hud-energy", size: "1024x1024", background: "opaque" },
  { name: "hud-xp", size: "1024x1024", background: "opaque" },
  { name: "hud-artifact", size: "1024x1024", background: "opaque" },
];

const options = {
  force: process.argv.includes("--force"),
  transport: valueArg("--transport") || (process.argv.includes("--urllib") ? "urllib" : ""),
  only: valueArg("--only"),
  model: valueArg("--model"),
  quality: valueArg("--quality") || "high",
  timeout: valueArg("--timeout") || "600",
  mapSize: valueArg("--map-size"),
  bossSize: valueArg("--boss-size"),
  bannerSize: valueArg("--banner-size"),
  iconSize: valueArg("--icon-size"),
};

function valueArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function sizeForAsset(asset) {
  if (asset.name.startsWith("map-") || asset.name === "home-dongfu-bg") return options.mapSize || asset.size;
  if (asset.name.startsWith("home-tab-")) return options.bannerSize || asset.size;
  if (asset.name.startsWith("artifact-") || asset.name.startsWith("facility-") || asset.name.startsWith("path-") || asset.name.startsWith("hud-")) {
    return options.iconSize || asset.size;
  }
  return options.bossSize || asset.size;
}

function existingRawPath(name) {
  const direct = join(outDir, `${name}.png`);
  if (existsSync(direct)) return direct;
  const candidate = join(outDir, `${name}-1.png`);
  return existsSync(candidate) ? candidate : "";
}

await mkdir(outDir, { recursive: true });

const failures = [];
for (const asset of assets) {
  if (options.only && asset.name !== options.only) continue;
  const size = sizeForAsset(asset);
  const out = join(outDir, `${asset.name}.png`);
  const existing = existingRawPath(asset.name);
  if (existing && !options.force) {
    console.log(`skip existing ${existing}`);
    continue;
  }
  const args = [
    generator,
    ...(options.model ? ["--model", options.model] : []),
    "--prompt-file",
    join(promptDir, `${asset.name}.txt`),
    "--size",
    size,
    "--quality",
    options.quality,
    "--output-format",
    "png",
    "--background",
    asset.background,
    "--timeout",
    options.timeout,
    "--force",
    "--out",
    out,
  ];
  if (options.transport) args.splice(args.length - 2, 0, "--transport", options.transport);
  console.log(`generate ${asset.name} (${size}, ${options.quality}) -> ${out}`);
  const result = spawnSync(python, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) failures.push(asset.name);
}

if (failures.length) {
  console.error(`failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("all xianxia missing assets generated");
}
