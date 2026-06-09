import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const branch = "main";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(output || `${command} ${args.join(" ")} failed`);
  }

  return options.capture ? result.stdout.trim() : "";
}

function tryRun(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function hasArg(name) {
  return process.argv.includes(name);
}

function ensureFile(path, message) {
  if (!existsSync(path)) {
    throw new Error(message);
  }
}

function slugify(value) {
  const fallback = "xianxia-survivor-demo";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || fallback;
}

function getOriginUrl() {
  const result = tryRun("git", ["remote", "get-url", "origin"]);
  return result.status === 0 ? result.stdout.trim() : "";
}

function getCurrentOwner() {
  return run("gh", ["api", "user", "--jq", ".login"], { capture: true });
}

function getRepoFullName(originUrl) {
  const result = tryRun("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();

  const match = originUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  return match ? match[1] : "";
}

function ensureMainBranch() {
  const branchResult = tryRun("git", ["branch", "--show-current"]);
  const current = branchResult.stdout.trim();
  if (current === branch) return;

  const hasMain = tryRun("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  if (hasMain.status === 0) {
    run("git", ["switch", branch]);
    return;
  }

  run("git", ["switch", "-c", branch]);
}

function stageDeploymentFiles() {
  run("git", ["add", "package.json", "scripts", "demo", ".github/workflows/deploy-pages.yml"]);
  run("git", ["reset", "--", "*.md", ":(glob)**/*.md"]);
}

function commitIfNeeded() {
  stageDeploymentFiles();
  const staged = tryRun("git", ["diff", "--cached", "--quiet"]);
  if (staged.status === 0) {
    console.log("No deployment file changes to commit.");
    return;
  }
  run("git", ["commit", "-m", "chore: deploy demo to github pages"]);
}

function ensureRemote() {
  const existing = getOriginUrl();
  if (existing) return existing;

  const owner = argValue("--owner") || getCurrentOwner();
  const repoName = argValue("--repo") || slugify(basename(root));
  const fullName = `${owner}/${repoName}`;
  const visibility = hasArg("--private") ? "--private" : "--public";

  const view = tryRun("gh", ["repo", "view", fullName, "--json", "url", "-q", ".url"]);
  if (view.status !== 0) {
    run("gh", ["repo", "create", fullName, visibility, "--description", "HTML5 canvas xianxia survivor demo"]);
  }

  const url = run("gh", ["repo", "view", fullName, "--json", "url", "-q", ".url"], { capture: true });
  run("git", ["remote", "add", "origin", `${url}.git`]);
  return `${url}.git`;
}

function enablePages(fullName) {
  const current = tryRun("gh", ["api", `repos/${fullName}/pages`, "--jq", ".html_url"]);
  if (current.status === 0) return current.stdout.trim();

  const created = tryRun("gh", ["api", "--method", "POST", `repos/${fullName}/pages`, "-f", "build_type=workflow", "--jq", ".html_url"]);
  if (created.status === 0) return created.stdout.trim();

  console.warn("GitHub Pages was not enabled through the API. The workflow may enable it on first deploy, or you can set Pages source to GitHub Actions in repository settings.");
  return "";
}

ensureFile(resolve("demo/index.html"), "demo/index.html is required for GitHub Pages deployment.");
ensureFile(resolve(".github/workflows/deploy-pages.yml"), "GitHub Pages workflow is missing.");

run("gh", ["auth", "status"]);
ensureMainBranch();
commitIfNeeded();
const originUrl = ensureRemote();
const fullName = getRepoFullName(originUrl);
if (!fullName) throw new Error("Could not determine GitHub repository name.");

run("git", ["push", "-u", "origin", branch]);
const pagesUrl = enablePages(fullName);

console.log("");
console.log(`Repository: https://github.com/${fullName}`);
if (pagesUrl) console.log(`Pages: ${pagesUrl}`);
console.log(`Actions: https://github.com/${fullName}/actions/workflows/deploy-pages.yml`);
