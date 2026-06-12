const MOBILE_HOME_MORE_CLASS = "mobile-home-more";
const HOME_TAB_GLYPHS = {
  home: "令",
  more: "更",
  chapters: "章",
  start: "启",
  journey: "历",
  materials: "材",
  quests: "赏",
  bestiary: "鉴",
  talents: "赋",
  artifacts: "宝",
  cultivation: "功",
  facilities: "府",
};

export function collectUi(documentRef = document) {
  return {
    body: documentRef.body,
    bootOverlay: documentRef.querySelector("#bootOverlay"),
    bootPhase: documentRef.querySelector("#bootPhase"),
    bootProgress: documentRef.querySelector("#bootProgress"),
    mobileBattleShell: documentRef.querySelector("#mobileBattleShell"),
    mobileTopBar: documentRef.querySelector("#mobileTopBar"),
    mobileTimer: documentRef.querySelector("#mobileTimer"),
    mobilePauseBtn: documentRef.querySelector("#mobilePauseBtn"),
    mobileActionRail: documentRef.querySelector("#mobileActionRail"),
    mobileGrowthBtn: documentRef.querySelector("#mobileGrowthBtn"),
    mobileDashBtn: documentRef.querySelector("#mobileDashBtn"),
    mobileHomeBtn: documentRef.querySelector("#mobileHomeBtn"),
    mobileBattleDrawer: documentRef.querySelector("#mobileBattleDrawer"),
    mobileDrawerCloseBtn: documentRef.querySelector("#mobileDrawerCloseBtn"),
    mobileDrawerGoals: documentRef.querySelector("#mobileDrawerGoals"),
    mobileLevel: documentRef.querySelector("#mobileLevel"),
    mobileKills: documentRef.querySelector("#mobileKills"),
    mobileWeapon: documentRef.querySelector("#mobileWeapon"),
    mobileBossStrip: documentRef.querySelector("#mobileBossStrip"),
    mobileBossName: documentRef.querySelector("#mobileBossName"),
    mobileBossBar: documentRef.querySelector("#mobileBossBar"),
    mobileStatusDock: documentRef.querySelector("#mobileStatusDock"),
    mobileHpLabel: documentRef.querySelector("#mobileHpLabel"),
    mobileEnergyLabel: documentRef.querySelector("#mobileEnergyLabel"),
    mobileXpLabel: documentRef.querySelector("#mobileXpLabel"),
    mobileHpBar: documentRef.querySelector("#mobileHpBar"),
    mobileEnergyBar: documentRef.querySelector("#mobileEnergyBar"),
    mobileXpBar: documentRef.querySelector("#mobileXpBar"),
    mobileEquipmentSummary: documentRef.querySelector("#mobileEquipmentSummary"),
    timer: documentRef.querySelector("#timer"),
    level: documentRef.querySelector("#level"),
    kills: documentRef.querySelector("#kills"),
    weapon: documentRef.querySelector("#weapon"),
    growthBtn: documentRef.querySelector("#growthBtn"),
    dashBtn: documentRef.querySelector("#dashBtn"),
    homeBtn: documentRef.querySelector("#homeBtn"),
    pauseBtn: documentRef.querySelector("#pauseBtn"),
    hpLabel: documentRef.querySelector("#hpLabel"),
    energyLabel: documentRef.querySelector("#energyLabel"),
    xpLabel: documentRef.querySelector("#xpLabel"),
    hpBar: documentRef.querySelector("#hpBar"),
    energyBar: documentRef.querySelector("#energyBar"),
    xpBar: documentRef.querySelector("#xpBar"),
    equipmentSummary: documentRef.querySelector("#equipmentSummary"),
    bossHud: documentRef.querySelector("#bossHud"),
    bossName: documentRef.querySelector("#bossName"),
    bossBar: documentRef.querySelector("#bossBar"),
    runGoals: documentRef.querySelector("#runGoals"),
    goalToast: documentRef.querySelector("#goalToast"),
    pausePanel: documentRef.querySelector("#pausePanel"),
    pauseBuildSummary: documentRef.querySelector("#pauseBuildSummary"),
    resumeBtn: documentRef.querySelector("#resumeBtn"),
    quickRestartBtn: documentRef.querySelector("#quickRestartBtn"),
    upgradePanel: documentRef.querySelector("#upgradePanel"),
    upgradeChoices: documentRef.querySelector("#upgradeChoices"),
    eventChoicePanel: documentRef.querySelector("#eventChoicePanel"),
    eventChoiceTitle: documentRef.querySelector("#eventChoiceTitle"),
    eventChoiceSubtitle: documentRef.querySelector("#eventChoiceSubtitle"),
    eventChoiceOptions: documentRef.querySelector("#eventChoiceOptions"),
    resultPanel: documentRef.querySelector("#resultPanel"),
    resultText: documentRef.querySelector("#resultText"),
    rewardText: documentRef.querySelector("#rewardText"),
    resultNextSteps: documentRef.querySelector("#resultNextSteps"),
    resultQuestBtn: documentRef.querySelector("#resultQuestBtn"),
    restartBtn: documentRef.querySelector("#restartBtn"),
    homePanel: documentRef.querySelector("#homePanel"),
    homeShell: documentRef.querySelector(".home-shell"),
    metaCurrencies: documentRef.querySelector("#metaCurrencies"),
    mobileHomeNav: documentRef.querySelector("#mobileHomeNav"),
    mobileHomeMoreBtn: documentRef.querySelector("#mobileHomeMoreBtn"),
    mobileHomeLanding: documentRef.querySelector("#mobileHomeLanding"),
    chapterQuickModal: documentRef.querySelector("#chapterQuickModal"),
    homeTabs: documentRef.querySelector("#homeTabs"),
    homeContent: documentRef.querySelector("#homeContent"),
    startRunBtn: documentRef.querySelector("#startRunBtn"),
    closeHomeBtn: documentRef.querySelector("#closeHomeBtn"),
    exportSaveBtn: documentRef.querySelector("#exportSaveBtn"),
    importSaveBtn: documentRef.querySelector("#importSaveBtn"),
    saveDataBox: documentRef.querySelector("#saveDataBox"),
    saveStatus: documentRef.querySelector("#saveStatus"),
    saveTools: documentRef.querySelector(".save-tools"),
    saveToolsToggleBtn: documentRef.querySelector("#saveToolsToggleBtn"),
    saveToolsBody: documentRef.querySelector("#saveToolsBody"),
  };
}

export function createPointerState() {
  return {
    active: false,
    id: null,
    origin: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
  };
}

export function createUiShell({
  windowRef = window,
  documentRef = document,
  ui,
  homeState,
  homeUiAssets,
  homeImage,
  game,
  clamp,
}) {
  let uiMode = "mobile";

  function isPortraitMobile() {
    return true;
  }

  function currentUiMode() {
    return uiMode;
  }

  function defaultHomeTab() {
    return "home";
  }

  function decorateMobileHomeNav() {
    if (!ui.mobileHomeNav) return;
    for (const button of ui.mobileHomeNav.querySelectorAll("button[data-section]")) {
      const state = button.dataset.section === homeState.mobileHomeSection ? "active" : "idle";
      const attrs = homeUiAssets.navAttrs(button.dataset.section, state);
      const styleMatch = attrs.match(/style="([^"]*)"/);
      const sectionMatch = attrs.match(/data-ui-nav="([^"]*)"/);
      const stateMatch = attrs.match(/data-ui-nav-state="([^"]*)"/);
      if (styleMatch?.[1]) button.setAttribute("style", styleMatch[1]);
      else button.removeAttribute("style");
      if (sectionMatch?.[1]) button.dataset.uiNav = sectionMatch[1];
      if (stateMatch?.[1]) button.dataset.uiNavState = stateMatch[1];
    }
  }

  function syncMobileHomeShellState() {
    ui.homeShell?.classList.toggle(MOBILE_HOME_MORE_CLASS, homeState.mobileHomeSection === "more");
    decorateMobileHomeNav();
  }

  function syncMobileBattleDrawer() {
    const open = homeState.mobileGrowthOpen && currentUiMode() === "mobile" && game.state !== "home";
    ui.mobileBattleDrawer?.classList.toggle("hidden", !open);
    ui.mobileBattleDrawer?.setAttribute("aria-hidden", String(!open));
    if (ui.body) ui.body.dataset.mobileDrawer = open ? "open" : "closed";
    const hasGoals = Boolean(ui.runGoals?.innerHTML?.trim()) && !ui.runGoals?.classList.contains("hidden");
    if (ui.mobileDrawerGoals) {
      ui.mobileDrawerGoals.classList.toggle("hidden", !hasGoals);
      ui.mobileDrawerGoals.innerHTML = hasGoals ? ui.runGoals.innerHTML : "";
    }
    ui.mobileGrowthBtn?.setAttribute("aria-expanded", String(homeState.mobileGrowthOpen));
  }

  function decorateSemanticHomeButtons() {
    const rows = [
      { element: ui.startRunBtn, action: "startRun", state: "emphasis", kind: "primary" },
      { element: ui.closeHomeBtn, action: "returnBattle", state: "idle", kind: "secondary" },
      { element: ui.saveToolsToggleBtn, action: "saveTools", state: homeState.saveToolsOpen ? "active" : "idle", kind: "secondary" },
    ];
    for (const row of rows) {
      if (!row.element) continue;
      row.element.classList.add("mobile-shell-cta-btn", `mobile-shell-cta-btn-${row.kind}`);
      const attrs = homeUiAssets.buttonAttrs(row.action, row.state, row.kind);
      const styleMatch = attrs.match(/style="([^"]*)"/);
      const actionMatch = attrs.match(/data-ui-action="([^"]*)"/);
      const stateMatch = attrs.match(/data-ui-action-state="([^"]*)"/);
      const kindMatch = attrs.match(/data-ui-action-kind="([^"]*)"/);
      if (styleMatch?.[1]) row.element.setAttribute("style", styleMatch[1]);
      else row.element.removeAttribute("style");
      if (actionMatch?.[1]) row.element.dataset.uiAction = actionMatch[1];
      if (stateMatch?.[1]) row.element.dataset.uiActionState = stateMatch[1];
      if (kindMatch?.[1]) row.element.dataset.uiActionKind = kindMatch[1];
    }
  }

  function updateUiMode() {
    uiMode = "mobile";
    ui.body.dataset.uiMode = uiMode;
    ui.body.dataset.orientation = "portrait";
    ui.mobileBattleShell?.classList.remove("hidden");
    ui.mobileBattleShell?.setAttribute("aria-hidden", "false");
    if (!ui.homePanel || ui.homePanel.classList.contains("hidden")) {
      homeState.saveToolsOpen = false;
    }
    syncMobileHomeShellState();
    syncMobileBattleDrawer();
    decorateSemanticHomeButtons();
    decorateMobileHomeNav();
  }

  function toggleGrowthPanel(force) {
    homeState.mobileGrowthOpen = typeof force === "boolean" ? force : !homeState.mobileGrowthOpen;
    syncMobileBattleDrawer();
  }

  function setBootPhase(text, progress = 0) {
    if (ui.bootPhase) ui.bootPhase.textContent = text;
    if (ui.bootProgress) ui.bootProgress.style.width = `${clamp(progress, 0, 100)}%`;
  }

  function showBootOverlay(visible) {
    ui.bootOverlay?.classList.toggle("hidden", !visible);
    ui.bootOverlay?.setAttribute("aria-busy", String(visible));
  }

  function scheduleIdle(task) {
    if (typeof windowRef.requestIdleCallback === "function") {
      windowRef.requestIdleCallback(() => task(), { timeout: 1200 });
      return;
    }
    windowRef.setTimeout(task, 120);
  }

  function isCompactHud() {
    return true;
  }

  function decorateHomeTabs() {
    if (!ui.homeTabs) return;
    for (const button of ui.homeTabs.querySelectorAll("button[data-tab]")) {
      if (button.dataset.decorated === "1") continue;
      const label = button.textContent?.trim() || button.dataset.tab || "";
      button.dataset.decorated = "1";
      button.dataset.tabLabel = label;
      button.innerHTML = `
      <span class="tab-glyph" aria-hidden="true">${HOME_TAB_GLYPHS[button.dataset.tab] || label.slice(0, 1)}</span>
      <span class="tab-label">${label}</span>
    `;
    }
  }

  function renderHomeBanner(tab) {
    const asset = homeUiAssets.tabBanner(tab);
    if (!asset) return "";
    return `<div class="home-banner">${homeImage(asset, "", "home-banner-img")}</div>`;
  }

  function setQuestBadge(element, count, label = "可领取悬赏") {
    if (!element) return;
    element.querySelector(".quest-badge")?.remove();
    element.classList.toggle("has-quest-badge", count > 0);
    if (count <= 0) {
      element.removeAttribute("data-quest-count");
      return;
    }
    element.dataset.questCount = String(count);
    const badge = documentRef.createElement("span");
    badge.className = "quest-badge";
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.setAttribute("aria-label", `${label} ${count}`);
    element.appendChild(badge);
  }

  return {
    currentUiMode,
    defaultHomeTab,
    decorateHomeTabs,
    decorateMobileHomeNav,
    decorateSemanticHomeButtons,
    isCompactHud,
    renderHomeBanner,
    scheduleIdle,
    setBootPhase,
    setQuestBadge,
    showBootOverlay,
    syncMobileBattleDrawer,
    syncMobileHomeShellState,
    toggleGrowthPanel,
    updateUiMode,
  };
}
