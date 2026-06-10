/**
 * 创建洞府模块的本地状态。
 * 入参：调试参数。
 * 出参：洞府页签、材料路线和面板返回态。
 * 作用：把洞府相关的零散局部变量收口到一个对象里，方便模块化管理。
 */
export function createHomeState({
  debugTargetMaterial = "",
  debugTargetMaterialMode = "",
  debugTargetMaterialDifficulty = "",
} = {}) {
  return {
    activeTab: "chapters",
    previousGameState: "playing",
    mobileGrowthOpen: false,
    mobileHomeSection: "home",
    mobileHomeMoreTab: "more",
    saveToolsOpen: false,
    focusedMaterials: [],
    preloadedTabs: new Set(),
    targetMaterial: debugTargetMaterial,
    targetMaterialMode: debugTargetMaterial
      ? (debugTargetMaterialMode === "unlock" ? "unlock" : "farm")
      : "",
    targetMaterialDifficulty: debugTargetMaterial ? debugTargetMaterialDifficulty : "",
    materialPreviewDifficultyId: "",
  };
}
