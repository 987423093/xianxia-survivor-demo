import { readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const scratchDirs = ["tmp", "output", ".superpowers"];

async function removeIfExists(relativePath) {
  const url = new URL(relativePath, root);
  await rm(url, { recursive: true, force: true });
}

async function removeDsStore(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeDsStore(entryPath);
      return;
    }
    if (entry.name === ".DS_Store") {
      await rm(entryPath, { force: true });
    }
  }));
}

await Promise.all(scratchDirs.map(removeIfExists));
await removeDsStore(fileURLToPath(root));

console.log("artifact cleanup ok");
