export function readBootConfig(search, themeCatalog) {
  const params = new URLSearchParams(search);
  const requestedTheme = params.get("theme") || "xianxia";

  return {
    requestedTheme,
    requestedChapter: params.get("chapter") || "",
    requestedDifficulty: params.get("difficulty") || "",
    debugBossOnLoad: params.get("debugBoss") === "1",
    debugMetaMode: params.get("debugMeta") || "",
    debugFinishOnStart: params.get("debugFinish") === "1",
    debugSecretRoutes: params.get("debugSecret") === "1",
    debugResolveEventId: params.get("debugResolveEvent") || "",
    debugResolveEventChoice: params.get("debugResolveEventChoice") || "",
    debugResolveEventChain: Math.max(0, Math.floor(Number(params.get("debugResolveEventChain") || 0))),
    debugOpenTab: params.get("debugOpenTab") || "",
    debugResultMode: params.get("debugResult") || "",
    debugTargetMaterial: params.get("debugMaterial") || "",
    debugTargetMaterialMode: params.get("debugMaterialMode") || "",
    debugTargetMaterialDifficulty: params.get("debugMaterialDifficulty") || "",
    theme: themeCatalog[requestedTheme] || themeCatalog.xianxia,
  };
}
