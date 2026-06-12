import { spawn } from "node:child_process";

const baseUrl = process.env.WEB_RUNTIME_URL || process.env.DEMO_URL || "http://127.0.0.1:6273";
const errors = [];
let managedServer = null;

const checks = [
  {
    name: "default home",
    path: "/",
    expectType: "text/html",
    includes: ["云栖修真录 Demo", "homePanel", "eventChoicePanel", "./src/main.js"],
  },
  {
    name: "office theme",
    path: "/?theme=office",
    expectType: "text/html",
    includes: ["云栖修真录 Demo", "homePanel"],
  },
  {
    name: "cat theme",
    path: "/?theme=cat",
    expectType: "text/html",
    includes: ["云栖修真录 Demo", "homePanel"],
  },
  {
    name: "cleared debug meta",
    path: "/?debugMeta=cleared",
    expectType: "text/html",
    includes: ["云栖修真录 Demo", "homePanel"],
  },
  {
    name: "boss debug route",
    path: "/?debugBoss=1&chapter=thunder-gate&difficulty=heaven",
    expectType: "text/html",
    includes: ["云栖修真录 Demo", "game"],
  },
  {
    name: "stylesheet",
    path: "/styles.css",
    expectType: "text/css",
    includes: [".home-shell", ".save-tools", ".material-route-runs", ".reward-source-cards", ".chapter-reward-highlights", ".reward-chip", ".cost-hint-actions", ".first-clear-reward-summary", ".run-blessing-summary", ".run-event-choice-title"],
  },
  {
    name: "main module",
    path: "/src/main.js",
    expectType: "text/javascript",
    includes: [],
  },
  {
    name: "theme registry module",
    path: "/src/content-registry/index.js",
    expectType: "text/javascript",
    includes: ["createThemeRegistry(", "createThemeContentRegistry(", "xianxiaContent"],
  },
  {
    name: "theme catalog module",
    path: "/src/content-registry/themes.js",
    expectType: "text/javascript",
    includes: ["xianxiaTheme", "currencies", "runEvents", "choicePrompt", "choicesByDifficulty", "followupEventId", "secretFollowup", "hidden: true"],
  },
  {
    name: "bootstrap query module",
    path: "/src/bootstrap/runtime/query.js",
    expectType: "text/javascript",
    includes: ["readBootConfig(", "new URLSearchParams", "themeCatalog.xianxia"],
  },
  {
    name: "bootstrap ui shell module",
    path: "/src/bootstrap/runtime/ui-shell.js",
    expectType: "text/javascript",
    includes: ["collectUi(", "createPointerState(", "createUiShell(", "setQuestBadge(", "decorateHomeTabs("],
  },
  {
    name: "runtime module",
    path: "/src/gameplay/run-runtime.js",
    expectType: "text/javascript",
    includes: ["spawnEnemyAt(", "startRunFromHome(", "finishRun(", "updateEventChallenge()", "spawnRewardPickups(", "debugResolveEventId", "eventChallengeId", "unlockConditionText("],
  },
  {
    name: "build planner module",
    path: "/src/meta/progression/build-planner.js",
    expectType: "text/javascript",
    includes: ["materialRouteRunsText(", "chapterRewardHighlights(", "renderBestiaryRewardHighlights(", "primaryMissingMaterial(", "renderRunEventPreview(", "chapterBuildContextTags("],
  },
  {
    name: "run events module",
    path: "/src/gameplay/run-events.js",
    expectType: "text/javascript",
    includes: ["currentRunEvents(", "recordRunEvent(", "spawnEventAmbush(", "ambushSummaryText(", "startEventChallenge(", "openRunEventChoice(", "maybeTriggerRunEventFollowups(", "secretFollowup"],
  },
  {
    name: "quests module",
    path: "/src/meta/progression/quests-goals.js",
    expectType: "text/javascript",
    includes: ["renderEventJourneyPanel(", "runEventChallengeGoal(", "renderResultNextSteps(", "renderGoalToast("],
  },
  {
    name: "rewards module",
    path: "/src/meta/progression/rewards-summary.js",
    expectType: "text/javascript",
    includes: ["chapterRewardChipRows(", "calculateRewardSourceBreakdown(", "renderFirstClearRewardSummary(", "renderRunBlessingsSummary(", "renderPauseBuildSummary("],
  },
  {
    name: "home ui assets module",
    path: "/src/ui/home/ui-assets.js",
    expectType: "text/javascript",
    includes: ["createHomeUiAssets(", "preloadMobileNavRows(", "buttonAttrs(", "panelAttrs("],
  },
  {
    name: "resources module",
    path: "/src/resources/assets.js",
    expectType: "text/javascript",
    includes: ["createAssetManager(", "preloadCriticalAssets(", "preloadBattleDeferredAssets(", "HOME_PRELOAD_TABS"],
  },
];

async function fetchCheck(check) {
  const url = new URL(check.path, baseUrl);
  const response = await fetch(url);
  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const row = {
    name: check.name,
    path: check.path,
    status: response.status,
    bytes: body.length,
    contentType,
    ok: response.ok,
  };
  if (!response.ok) errors.push(`${check.name} returned HTTP ${response.status}`);
  if (check.expectType && !contentType.includes(check.expectType)) {
    errors.push(`${check.name} expected ${check.expectType}, got ${contentType || "empty content-type"}`);
  }
  for (const text of check.includes || []) {
    if (!body.includes(text)) errors.push(`${check.name} missing expected text: ${text}`);
  }
  return row;
}

async function canReachRuntime() {
  try {
    const response = await fetch(new URL("/", baseUrl), { signal: AbortSignal.timeout(800) });
    await response.arrayBuffer();
    return response.ok;
  } catch {
    return false;
  }
}

function canManageServer(url) {
  return ["127.0.0.1", "localhost"].includes(url.hostname);
}

async function waitForRuntime(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await canReachRuntime()) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

async function ensureRuntimeServer() {
  if (await canReachRuntime()) return;
  const url = new URL(baseUrl);
  if (!canManageServer(url)) return;
  managedServer = spawn(process.execPath, ["scripts/serve-web-runtime.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PORT: url.port || "6273" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let startupOutput = "";
  managedServer.stdout?.on("data", (chunk) => {
    startupOutput += chunk.toString();
  });
  managedServer.stderr?.on("data", (chunk) => {
    startupOutput += chunk.toString();
  });
  if (!(await waitForRuntime())) {
    managedServer.kill();
    managedServer = null;
    throw new Error(`Timed out starting web runtime server. ${startupOutput.trim()}`);
  }
}

function cleanupManagedServer() {
  if (!managedServer) return;
  managedServer.kill();
  managedServer = null;
}

let rows = [];
try {
  await ensureRuntimeServer();
  rows = await Promise.all(checks.map(fetchCheck));
} catch (error) {
  console.error(`web-runtime smoke failed to reach ${baseUrl}`);
  console.error(error?.message || error);
  console.error("Start the web runtime with: npm run web-runtime");
  process.exit(1);
} finally {
  cleanupManagedServer();
}

console.table(rows);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("web-runtime smoke ok");
}
