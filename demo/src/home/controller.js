/**
 * 创建洞府面板控制器。
 * 入参：洞府 UI、状态对象、渲染器和游戏态回调。
 * 出参：洞府相关的打开、关闭、渲染与徽标刷新方法。
 * 作用：把洞府面板的控制流从主循环文件中抽离，保留明确的模块边界。
 */
export function createHomeController({
  ui,
  game,
  metaConfig,
  homeState,
  getMetaState,
  setMetaState,
  sanitizeMetaState,
  optimizedAssetUrl,
  claimableQuestCount,
  setQuestBadge,
  renderers,
  clearGoalToastTimer,
  updateUi,
}) {
  function renderCurrencies() {
    const metaState = getMetaState();
    if (!ui.metaCurrencies || !metaConfig || !metaState) return;
    ui.metaCurrencies.innerHTML = Object.entries(metaConfig.currencies)
      .map(([key, config]) => `<span class="meta-currency" style="color:${config.color}">${config.name} ${metaState.currencies[key] || 0}</span>`)
      .join("");
  }

  function updateQuestBadges() {
    const metaState = getMetaState();
    const count = metaConfig && metaState ? claimableQuestCount() : 0;
    setQuestBadge(ui.homeBtn, count, "可领取悬赏");
    const questTab = ui.homeTabs?.querySelector('button[data-tab="quests"]');
    setQuestBadge(questTab, count, "可领取悬赏");
  }

  function renderHomePanel() {
    if (!metaConfig || !ui.homePanel || !ui.homeContent) return;
    const normalized = sanitizeMetaState(getMetaState());
    setMetaState(normalized);
    if (metaConfig.homeAssets?.background) {
      ui.homePanel.style.setProperty("--home-bg", `url("${optimizedAssetUrl(metaConfig.homeAssets.background)}")`);
    }
    renderCurrencies();
    for (const button of ui.homeTabs.querySelectorAll("button")) {
      button.classList.toggle("active", button.dataset.tab === homeState.activeTab);
    }
    updateQuestBadges();
    const renderer = renderers[homeState.activeTab] || renderers.chapters;
    ui.homeContent.innerHTML = renderer();
  }

  function open(defaultTab = homeState.activeTab) {
    if (!metaConfig || !ui.homePanel) return;
    homeState.previousGameState = game.state === "home" ? homeState.previousGameState : game.state;
    homeState.activeTab = defaultTab;
    game.state = "home";
    game.goalTrackingActive = false;
    clearGoalToastTimer();
    ui.pausePanel.classList.add("hidden");
    ui.upgradePanel.classList.add("hidden");
    ui.resultPanel.classList.add("hidden");
    ui.runGoals?.classList.add("hidden");
    ui.goalToast?.classList.add("hidden");
    renderHomePanel();
    ui.homePanel.classList.remove("hidden");
  }

  function close() {
    if (!metaConfig || !ui.homePanel) return;
    ui.homePanel.classList.add("hidden");
    game.state = homeState.previousGameState === "paused" ? "paused" : "playing";
    if (game.state === "paused") ui.pausePanel.classList.remove("hidden");
    if (game.state === "playing") {
      game.goalTrackingActive = true;
      updateUi();
    }
    game.lastFrame = performance.now();
  }

  return {
    renderCurrencies,
    updateQuestBadges,
    renderHomePanel,
    open,
    close,
  };
}
