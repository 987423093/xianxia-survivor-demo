/**
 * 创建洞府 UI 资产解析器。
 * 入参：主题元配置与资源 URL 处理函数。
 * 出参：页签横幅、功能块和动作按钮的读取与 HTML 属性辅助方法。
 * 作用：把洞府 UI 资产协议从模板字符串和样式类中抽离，统一走语义 key。
 */
export function createHomeUiAssets({ metaConfig, optimizedAssetUrl }) {
  const uiAssets = metaConfig?.uiAssets || {};
  const navAssets = uiAssets.navs || {};
  const tabAssets = uiAssets.tabs || {};
  const panelAssets = uiAssets.panels || {};
  const buttonAssets = uiAssets.buttons || {};
  const panelFallbacks = uiAssets.panelFallbacks || {};
  const buttonFallbacks = uiAssets.buttonFallbacks || {};
  const panelTabRoles = {
    home: ["dailyDecree", "continueRun", "currentBuild", "claimableRewards", "chapterRecommendation"],
    more: ["header", "journey", "materials", "quests", "bestiary", "talents", "artifacts", "cultivation", "facilities"],
    chapters: ["overview", "chapterCard", "drops", "encounter", "boss"],
    start: ["overview"],
    journey: ["hero"],
    materials: ["overview"],
    quests: ["overview"],
    bestiary: ["hero"],
    talents: ["overview"],
    artifacts: ["overview"],
    cultivation: ["overview"],
    facilities: ["overview"],
  };
  const buttonTabActions = {
    home: ["openMore", "startRun", "openChapters", "openBuild", "openQuests", "applyRecommendation"],
    more: ["backHome", "enterDetail"],
    chapters: ["openChapters", "applyRecommendation", "startRun"],
    start: ["startRun", "applyRecommendation"],
    journey: ["openChapters", "openQuests"],
    materials: ["openChapters"],
    quests: ["openQuests"],
    bestiary: ["startRun", "openChapters", "openBuild"],
    talents: ["applyRecommendation"],
    artifacts: ["applyRecommendation"],
    cultivation: ["applyRecommendation"],
    facilities: ["applyRecommendation"],
  };

  function urlFor(file = "") {
    return file ? optimizedAssetUrl(file) : "";
  }

  function panelPath(tab = "", role = "") {
    if (panelAssets?.[tab]?.[role]) return panelAssets[tab][role];
    const fallbackRole = panelFallbacks?.[tab]?.[role];
    if (fallbackRole && panelAssets?.shared?.[fallbackRole]) return panelAssets.shared[fallbackRole];
    return panelAssets?.shared?.primary || "";
  }

  function fallbackButtonKind(action = "", kind = "primary") {
    const fallback = buttonFallbacks?.[action];
    if (fallback === "secondary") return "secondary";
    if (fallback === "primary") return "primary";
    return kind;
  }

  function buttonPaths(action = "", state = "idle") {
    const asset = buttonAssets?.[action] || {};
    const sharedPrimary = buttonAssets?.shared?.primary || {};
    const sharedSecondary = buttonAssets?.shared?.secondary || {};
    const fallback = [
      asset[state],
      asset.idle,
      sharedPrimary[state],
      sharedPrimary.idle,
    ].find(Boolean) || "";
    const secondaryFallback = [
      asset[state],
      asset.idle,
      sharedSecondary[state],
      sharedSecondary.idle,
      fallback,
    ].find(Boolean) || "";
    return {
      primary: fallback,
      secondary: secondaryFallback,
    };
  }

  function buttonPath(action = "", state = "idle", kind = "primary") {
    const paths = buttonPaths(action, state);
    return fallbackButtonKind(action, kind) === "secondary" ? paths.secondary : paths.primary;
  }

  function tabBanner(tab = "") {
    return tabAssets?.[tab] || metaConfig?.homeAssets?.tabs?.[tab] || "";
  }

  function navPath(section = "", state = "idle") {
    const asset = navAssets?.[section] || navAssets?.shared || {};
    return asset[state] || asset.idle || "";
  }

  function panelStyle(tab = "", role = "") {
    const file = panelPath(tab, role);
    return file ? `--panel-bg:url('${urlFor(file)}')` : "";
  }

  function navStyle(section = "", state = "idle") {
    const file = navPath(section, state);
    return file ? `--nav-bg:url('${urlFor(file)}')` : "";
  }

  function buttonStyle(action = "", state = "idle", kind = "primary") {
    const file = buttonPath(action, state, kind);
    return file ? `--button-bg:url('${urlFor(file)}')` : "";
  }

  function panelAttrs(tab = "", role = "") {
    const style = panelStyle(tab, role);
    return `${style ? ` style="${style}"` : ""} data-ui-panel="${role}" data-ui-panel-tab="${tab}"`;
  }

  function buttonAttrs(action = "", state = "idle", kind = "primary") {
    const style = buttonStyle(action, state, kind);
    return `${style ? ` style="${style}"` : ""} data-ui-action="${action}" data-ui-action-state="${state}" data-ui-action-kind="${kind}"`;
  }

  function navAttrs(section = "", state = "idle") {
    const style = navStyle(section, state);
    return `${style ? ` style="${style}"` : ""} data-ui-nav="${section}" data-ui-nav-state="${state}"`;
  }

  function preloadMobileNavRows() {
    const rows = [];
    for (const section of ["home", "build", "quests", "more"]) {
      for (const state of ["idle", "active"]) {
        const file = navPath(section, state);
        if (file) rows.push({ key: `ui:nav:${section}:${state}`, file });
      }
    }
    return rows;
  }

  function preloadRowsForTab(tab = "") {
    const rows = [];
    const banner = tabBanner(tab);
    if (banner) rows.push({ key: `ui:tab:${tab}`, file: banner });
    for (const role of panelTabRoles[tab] || Object.keys(panelAssets?.[tab] || {})) {
      const file = panelPath(tab, role);
      if (file) rows.push({ key: `ui:panel:${tab}:${role}`, file });
    }
    for (const action of buttonTabActions[tab] || []) {
      const kind = action === "startRun" ? "primary" : "secondary";
      const state = action === "startRun" ? "emphasis" : "idle";
      const file = buttonPath(action, state, kind);
      if (file) rows.push({ key: `ui:button:${action}:${state}:${kind}`, file });
    }
    for (const action of ["returnBattle", "saveTools"]) {
      const file = buttonPath(action, "idle", "secondary");
      if (file) rows.push({ key: `ui:button:${action}:idle:secondary`, file });
    }
    return rows;
  }

  return {
    tabBanner,
    navPath,
    panelPath,
    buttonPath,
    navStyle,
    panelStyle,
    buttonStyle,
    navAttrs,
    panelAttrs,
    buttonAttrs,
    preloadMobileNavRows,
    preloadRowsForTab,
  };
}
