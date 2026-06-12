import { mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const assetDir = join(root, "web-runtime/assets/xianxia");
const thumbDir = join(assetDir, "thumbs");
const cwebp = process.env.CWEBP || "cwebp";

const chapterBackgrounds = new Set([
  "battle-map.png",
  "map-stone-array.png",
  "map-blood-wasteland.png",
  "map-thunder-gate.png",
]);

function runCwebp(args) {
  const result = spawnSync(cwebp, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`cwebp failed: ${result.stderr || result.stdout}`);
  }
}

async function fileSize(path) {
  return existsSync(path) ? (await stat(path)).size : 0;
}

await mkdir(thumbDir, { recursive: true });

const files = (await readdir(assetDir)).filter((file) => extname(file).toLowerCase() === ".png");
const rows = [];

for (const file of files) {
  const source = join(assetDir, file);
  const webpFile = file.replace(/\.png$/i, ".webp");
  const webpOut = join(assetDir, webpFile);
  const quality = chapterBackgrounds.has(file) || file.startsWith("home-") ? "74" : "80";

  runCwebp(["-quiet", "-q", quality, source, "-o", webpOut]);
  rows.push({
    file,
    png: await fileSize(source),
    webp: await fileSize(webpOut),
  });

  if (chapterBackgrounds.has(file)) {
    const thumbOut = join(thumbDir, webpFile);
    runCwebp(["-quiet", "-q", "78", "-resize", "520", "0", source, "-o", thumbOut]);
    rows.push({
      file: `thumbs/${webpFile}`,
      png: await fileSize(source),
      webp: await fileSize(thumbOut),
    });
  }
}

const totalPng = rows.filter((row) => !row.file.startsWith("thumbs/")).reduce((sum, row) => sum + row.png, 0);
const totalWebp = rows.filter((row) => !row.file.startsWith("thumbs/")).reduce((sum, row) => sum + row.webp, 0);

console.table(rows.map((row) => ({
  file: row.file,
  pngKB: Math.round(row.png / 1024),
  webpKB: Math.round(row.webp / 1024),
  saved: row.png ? `${Math.round((1 - row.webp / row.png) * 100)}%` : "",
})));

console.log(JSON.stringify({
  pngMB: Number((totalPng / 1024 / 1024).toFixed(2)),
  webpMB: Number((totalWebp / 1024 / 1024).toFixed(2)),
  savedPercent: totalPng ? Math.round((1 - totalWebp / totalPng) * 100) : 0,
}, null, 2));
