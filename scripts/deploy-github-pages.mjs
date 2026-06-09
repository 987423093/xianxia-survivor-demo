import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const defaultBranch = "main";
const workflowFile = "deploy-pages.yml";
const workflowPath = `.github/workflows/${workflowFile}`;
const deployPaths = ["package.json", "scripts", "demo", workflowPath];
const pollIntervalMs = 5000;
const maxPollCount = 60;

const args = new Map();
const flags = new Set();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const next = process.argv[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(arg, next);
    index += 1;
  } else {
    flags.add(arg);
  }
}

const branch = args.get("--branch") || defaultBranch;
const commitMessage = args.get("--message") || "chore: deploy demo to github pages";
const skipCommit = flags.has("--skip-commit");
const skipWait = flags.has("--skip-wait");
const privateRepo = flags.has("--private");

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(output || `${command} ${commandArgs.join(" ")} failed`);
  }

  return options.capture ? result.stdout.trim() : "";
}

function tryRun(command, commandArgs) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function info(message) {
  console.log(`\n==> ${message}`);
}

function ensureFile(path, message) {
  if (!existsSync(resolve(path))) throw new Error(message);
}

function ensureCleanIndex() {
  const staged = tryRun("git", ["diff", "--cached", "--quiet"]);
  if (staged.status !== 0) {
    throw new Error("The git index already has staged changes. Commit or unstage them before deploying.");
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "xianxia-survivor-demo";
}

function getCurrentOwner() {
  return run("gh", ["api", "user", "--jq", ".login"], { capture: true });
}

function getOriginUrl() {
  const result = tryRun("git", ["remote", "get-url", "origin"]);
  return result.status === 0 ? result.stdout.trim() : "";
}

function getRepoFullName(originUrl) {
  const result = tryRun("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();

  const match = originUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  return match ? match[1] : "";
}

function ensureBranch() {
  const current = run("git", ["branch", "--show-current"], { capture: true });
  if (current === branch) return;

  const hasBranch = tryRun("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  if (hasBranch.status === 0) {
    run("git", ["switch", branch]);
    return;
  }

  run("git", ["switch", "-c", branch]);
}

function ensureRemote() {
  const existing = getOriginUrl();
  if (existing) return existing;

  const owner = args.get("--owner") || getCurrentOwner();
  const repoName = args.get("--repo") || slugify(basename(root));
  const fullName = `${owner}/${repoName}`;
  const visibility = privateRepo ? "--private" : "--public";

  const view = tryRun("gh", ["repo", "view", fullName, "--json", "url", "-q", ".url"]);
  if (view.status !== 0) {
    run("gh", ["repo", "create", fullName, visibility, "--description", "HTML5 canvas xianxia survivor demo"]);
  } else if (!privateRepo) {
    run("gh", ["repo", "edit", fullName, "--visibility", "public", "--accept-visibility-change-consequences"]);
  }

  const url = run("gh", ["repo", "view", fullName, "--json", "url", "-q", ".url"], { capture: true });
  run("git", ["remote", "add", "origin", `${url}.git`]);
  return `${url}.git`;
}

function stageDeployPaths() {
  run("git", ["add", ...deployPaths]);
  run("git", ["reset", "--", "*.md", ":(glob)**/*.md"]);
}

function commitDeployChanges() {
  if (skipCommit) return;

  stageDeployPaths();
  const staged = tryRun("git", ["diff", "--cached", "--quiet"]);
  if (staged.status === 0) {
    console.log("No deployment file changes to commit.");
    return;
  }

  run("git", ["commit", "-m", commitMessage]);
}

function enablePages(fullName) {
  const current = tryRun("gh", ["api", `repos/${fullName}/pages`, "--jq", ".html_url"]);
  if (current.status === 0 && current.stdout.trim()) return current.stdout.trim();

  const created = tryRun("gh", [
    "api",
    "--method",
    "POST",
    `repos/${fullName}/pages`,
    "-H",
    "Accept: application/vnd.github+json",
    "-f",
    "build_type=workflow",
    "--jq",
    ".html_url",
  ]);
  if (created.status === 0 && created.stdout.trim()) return created.stdout.trim();

  const output = [created.stdout, created.stderr].filter(Boolean).join("\n").trim();
  throw new Error(`Could not enable GitHub Pages. ${output}`);
}

function dispatchWorkflow(fullName) {
  run("gh", ["workflow", "run", workflowFile, "--repo", fullName, "--ref", branch]);
}

function latestRun(fullName, headSha) {
  const output = run("gh", [
    "run",
    "list",
    "--repo",
    fullName,
    "--workflow",
    workflowFile,
    "--branch",
    branch,
    "--commit",
    headSha,
    "--limit",
    "1",
    "--json",
    "databaseId,status,conclusion,url,displayTitle,createdAt",
  ], { capture: true });
  return JSON.parse(output)[0];
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForWorkflow(fullName, headSha) {
  if (skipWait) return null;

  for (let attempt = 1; attempt <= maxPollCount; attempt += 1) {
    const runInfo = latestRun(fullName, headSha);
    if (!runInfo) {
      sleep(pollIntervalMs);
      continue;
    }

    console.log(`Workflow ${runInfo.databaseId}: ${runInfo.status}${runInfo.conclusion ? `/${runInfo.conclusion}` : ""}`);
    if (runInfo.status === "completed") {
      if (runInfo.conclusion !== "success") {
        run("gh", ["run", "view", String(runInfo.databaseId), "--repo", fullName, "--log-failed"]);
        throw new Error(`GitHub Pages deployment failed: ${runInfo.url}`);
      }
      return runInfo;
    }

    sleep(pollIntervalMs);
  }

  throw new Error("Timed out waiting for GitHub Pages deployment.");
}

function printSummary(fullName, pagesUrl, runInfo) {
  console.log("");
  console.log("Deployment complete.");
  console.log(`Repository: https://github.com/${fullName}`);
  console.log(`Pages: ${pagesUrl}`);
  console.log(`Workflow: ${runInfo?.url || `https://github.com/${fullName}/actions/workflows/${workflowFile}`}`);
}

ensureFile("demo/index.html", "demo/index.html is required for GitHub Pages deployment.");
ensureFile(workflowPath, `${workflowPath} is required for GitHub Pages deployment.`);

info("Checking tools and repository");
run("gh", ["auth", "status"]);
ensureCleanIndex();
ensureBranch();

info("Preparing commit");
commitDeployChanges();

info("Preparing GitHub remote");
const originUrl = ensureRemote();
const fullName = getRepoFullName(originUrl);
if (!fullName) throw new Error("Could not determine GitHub repository name.");

info("Pushing branch");
run("git", ["push", "-u", "origin", branch]);
const headSha = run("git", ["rev-parse", "HEAD"], { capture: true });

info("Enabling GitHub Pages");
const pagesUrl = enablePages(fullName);

info("Running Pages workflow");
dispatchWorkflow(fullName);
const runInfo = waitForWorkflow(fullName, headSha);

printSummary(fullName, pagesUrl, runInfo);
