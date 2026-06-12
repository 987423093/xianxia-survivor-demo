import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST_PATH = "assets/image2-prompts/xianxia/ui-assets.manifest.json";

const NAV_STATE_SUFFIX = {
  idle: "Render the idle mobile top-nav state. Make it feel like a compact sect plaque for a primary route tab: horizontally stable, centered, no detached ornaments, enough inner contrast for one short Chinese label, and visibly different from a large CTA button. Single centered subject only on a pure white background. Clean isolated edges. No surrounding scene, no floor plane, no cast shadow, and no ambient glow outside the plaque silhouette.",
  active: "Render the active selected mobile top-nav state. Keep the same silhouette family as idle, but tighten the gold edge, brighten the inner jade core, and make it feel claimed and focused rather than explosive. Single centered subject only on a pure white background. Clean isolated edges. No surrounding scene, no floor plane, no cast shadow, and no ambient glow outside the plaque silhouette. Any brightness increase must stay inside the plaque silhouette.",
};

const BUTTON_STATE_SUFFIX = {
  idle: "Render the calm idle state. Keep the plaque stable, readable, and restrained, with clear center breathing room for later UI text placement. Single centered subject only on a pure white background. Clean isolated edges. No surrounding scene, no floor plane, no cast shadow, and no ambient glow outside the frame.",
  active: "Render the active selected state. Keep the same shape, but brighten the inner jade glow, tighten the gold edge, and make the action feel confirmed rather than explosive. Single centered subject only on a pure white background. Clean isolated edges. No surrounding scene, no floor plane, no cast shadow, and no ambient glow outside the frame. Any brightness increase must stay inside the plaque silhouette.",
  emphasis: "Render the emphasis call-to-action state. Keep the same family shape, but add slightly stronger inner light, denser gold highlights, and more decisive forward energy without becoming neon. Single centered subject only on a pure white background. Clean isolated edges. No surrounding scene, no floor plane, no cast shadow, and no ambient glow outside the frame. Keep a solid plaque silhouette that occupies most of the canvas; inner light must stay inside the frame and must not emit rays, flares, or detached light outside the silhouette.",
};

export function uiAssetManifestPath(root) {
  return join(root, MANIFEST_PATH);
}

export function loadUiAssetManifest(root) {
  const path = uiAssetManifestPath(root);
  if (!existsSync(path)) return { tabs: [], panels: [], buttons: [] };
  return JSON.parse(readFileSync(path, "utf8"));
}

export function buttonStatePromptSuffix(state = "idle") {
  return BUTTON_STATE_SUFFIX[state] || BUTTON_STATE_SUFFIX.idle;
}

export function navStatePromptSuffix(state = "idle") {
  return NAV_STATE_SUFFIX[state] || NAV_STATE_SUFFIX.idle;
}

export function flattenUiAssetManifest(manifest, options = {}) {
  const {
    group = "all",
    only = "",
    state = "",
  } = options;

  const targetGroups = group === "all"
    ? new Set(["navs", "tabs", "panels", "buttons"])
    : new Set(String(group).split(",").map((item) => item.trim()).filter(Boolean));
  const rows = [];

  if (targetGroups.has("navs")) {
    for (const nav of manifest.navs || []) {
      const states = state
        ? [state]
        : Array.isArray(nav.states) && nav.states.length
          ? nav.states
          : ["idle"];
      for (const stateKey of states) {
        const output = nav.outputs?.[stateKey];
        if (!output) continue;
        rows.push({
          type: "nav",
          group: "navs",
          key: nav.key,
          state: stateKey,
          output,
          promptFile: nav.promptFile,
          promptSuffix: nav.statePrompts?.[stateKey] || navStatePromptSuffix(stateKey),
          size: nav.size,
          background: nav.background,
        });
      }
    }
  }

  if (targetGroups.has("tabs")) {
    for (const tab of manifest.tabs || []) {
      rows.push({
        type: "tab",
        group: "tabs",
        key: tab.key,
        output: tab.output,
        promptFile: tab.promptFile,
        size: tab.size,
        background: tab.background,
        tabScope: tab.tabScope || [tab.key],
        fallbackKey: tab.fallbackKey || "",
      });
    }
  }

  if (targetGroups.has("panels")) {
    for (const panel of manifest.panels || []) {
      rows.push({
        type: "panel",
        group: "panels",
        key: panel.key,
        output: panel.output,
        promptFile: panel.promptFile,
        size: panel.size,
        background: panel.background,
        tabScope: panel.tabScope || [],
        fallbackKey: panel.fallbackKey || "",
      });
    }
  }

  if (targetGroups.has("buttons")) {
    for (const button of manifest.buttons || []) {
      const states = state
        ? [state]
        : Array.isArray(button.states) && button.states.length
          ? button.states
          : ["idle"];
      for (const stateKey of states) {
        const output = button.outputs?.[stateKey];
        if (!output) continue;
        rows.push({
          type: "button",
          group: "buttons",
          key: button.key,
          state: stateKey,
          output,
          promptFile: button.promptFile,
          promptSuffix: button.statePrompts?.[stateKey] || buttonStatePromptSuffix(stateKey),
          size: button.size,
          background: button.background,
          tabScope: button.tabScope || [],
          fallbackKey: button.fallbackKey || "",
        });
      }
    }
  }

  if (!only) return rows;
  return rows.filter((row) => row.key === only || `${row.key}:${row.state || ""}` === only);
}

export function flattenUiOutputs(manifest, options = {}) {
  return flattenUiAssetManifest(manifest, options).map((row) => ({
    ...row,
    output: row.output,
  }));
}
