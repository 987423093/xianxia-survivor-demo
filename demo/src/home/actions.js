/**
 * 创建洞府交互处理器。
 * 入参：洞府状态、元进度、构筑操作与渲染刷新依赖。
 * 出参：处理洞府按钮行为的事件分发方法。
 * 作用：把洞府面板的交互编排从主流程文件中抽离，按动作职责集中管理。
 */
export function createHomeActionHandler({
  homeState,
  getUiMode = () => "desktop",
  getMetaState,
  getMetaConfig,
  setSelectedChapterForBuild,
  difficultyAllowed,
  getSelectedChapter,
  getSelectedDifficulty,
  applyWeaknessPatchPlan,
  mapById,
  presetAvailability,
  isUnlocked,
  getStartingTalentSlots,
  applyChapterBuildRecommendation,
  applyComboPlan,
  rushMilestone,
  upgradeCost,
  spendCurrency,
  questState,
  addCurrencies,
  unique,
  saveMetaState,
  homeController,
  startRunFromHome = () => {},
}) {
  function syncMobileSectionForTab(tab) {
    if (getUiMode() !== "mobile") return;
    if (tab === "start") {
      homeState.mobileHomeSection = "build";
      return;
    }
    if (tab === "quests") {
      homeState.mobileHomeSection = "quests";
      return;
    }
    if (tab === "chapters") {
      homeState.mobileHomeSection = "chapters";
      return;
    }
    if (tab === "home" || tab === "mobile-home") {
      homeState.mobileHomeSection = "home";
      return;
    }
    homeState.mobileHomeSection = "more";
    homeState.mobileHomeMoreTab = tab;
  }

  function openTab(target) {
    homeState.focusedMaterials = target.dataset.focusMaterials
      ? target.dataset.focusMaterials.split(",").filter(Boolean)
      : [];
    homeState.targetMaterial = "";
    homeState.targetMaterialMode = "";
    homeState.targetMaterialDifficulty = "";
    homeState.activeTab = target.dataset.tab;
    syncMobileSectionForTab(target.dataset.tab);
  }

  function applyMaterialRoute(target, mode) {
    const metaState = getMetaState();
    const chapterId = mode === "unlock" ? target.dataset.targetChapter || target.dataset.id : target.dataset.id;
    const difficultyId = mode === "unlock" ? target.dataset.targetDifficulty : target.dataset.difficulty;
    setSelectedChapterForBuild(chapterId);
    if (difficultyId && difficultyAllowed(chapterId, difficultyId)) {
      metaState.selected.difficultyId = difficultyId;
    }
    homeState.focusedMaterials = [];
    homeState.targetMaterial = target.dataset.material || "";
    homeState.targetMaterialMode = mode;
    homeState.targetMaterialDifficulty = target.dataset.difficulty || "";
    homeState.activeTab = "chapters";
    syncMobileSectionForTab("chapters");
  }

  function applyPreset(id) {
    const metaState = getMetaState();
    const metaConfig = getMetaConfig();
    const preset = mapById(metaConfig.loadoutPresets)[id];
    if (!preset || !presetAvailability(preset).usable) return;
    if (preset.artifactId && isUnlocked("artifacts", preset.artifactId)) metaState.selected.artifactId = preset.artifactId;
    if (preset.cultivationId && isUnlocked("cultivations", preset.cultivationId)) metaState.selected.cultivationId = preset.cultivationId;
    const slots = getStartingTalentSlots();
    metaState.selected.startingTalentIds = (preset.talentIds || [])
      .filter((talentId) => isUnlocked("startingTalents", talentId))
      .slice(0, slots);
  }

  function toggleTalent(id) {
    const metaState = getMetaState();
    const list = metaState.selected.startingTalentIds;
    if (list.includes(id)) {
      metaState.selected.startingTalentIds = list.filter((item) => item !== id);
      return;
    }
    if (list.length < getStartingTalentSlots() && isUnlocked("startingTalents", id)) {
      metaState.selected.startingTalentIds = [...list, id];
    }
  }

  function upgradeNode(kind, id) {
    const metaState = getMetaState();
    const metaConfig = getMetaConfig();
    const configMap = {
      talent: mapById(metaConfig.talentTrees),
      artifact: mapById(metaConfig.artifacts),
      cultivation: mapById(metaConfig.cultivations),
      facility: mapById(metaConfig.facilities),
    };
    const levelMap = {
      talent: metaState.progression.talentTree,
      artifact: metaState.progression.artifacts,
      cultivation: metaState.progression.cultivations,
      facility: metaState.progression.facilities,
    };
    const baseLevel = {
      talent: 0,
      artifact: 1,
      cultivation: 1,
      facility: 0,
    };
    const item = configMap[kind]?.[id];
    const levels = levelMap[kind];
    const level = (levels?.[id] ?? baseLevel[kind]);
    const cost = upgradeCost(kind, id, level);
    if (!item || level >= item.maxLevel || !spendCurrency(cost)) return;
    levels[id] = level + 1;
    if (kind === "facility") {
      metaState.selected.startingTalentIds = metaState.selected.startingTalentIds.slice(0, getStartingTalentSlots());
    }
  }

  function claimQuest(id) {
    const metaState = getMetaState();
    const metaConfig = getMetaConfig();
    const quest = mapById(metaConfig.quests || [])[id];
    const state = quest ? questState(quest) : null;
    if (!quest || !state?.claimable) return;
    addCurrencies(quest.rewards || {});
    metaState.records.claimedQuests = unique([...(metaState.records.claimedQuests || []), quest.id]);
  }

  return function handleHomeAction(target) {
    const metaState = getMetaState();
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !metaState) return;

    if (action === "start-run") {
      startRunFromHome();
      return;
    }

    if (action === "open-mobile-home-section") {
      const section = target.dataset.section || "home";
      homeState.mobileHomeSection = section;
      if (section === "home") homeState.activeTab = "chapters";
      if (section === "build") homeState.activeTab = "start";
      if (section === "quests") homeState.activeTab = "quests";
      if (section === "chapters") homeState.activeTab = "chapters";
      if (section === "more") homeState.mobileHomeMoreTab = "more";
      homeController.renderHomePanel();
      return;
    }

    if (action === "open-mobile-more-tab") {
      homeState.mobileHomeSection = "more";
      homeState.mobileHomeMoreTab = target.dataset.tab || "more";
      homeState.activeTab = homeState.mobileHomeMoreTab;
      homeController.renderHomePanel();
      return;
    }

    if (action === "open-tab" && target.dataset.tab) {
      openTab(target);
      saveMetaState();
      homeController.updateQuestBadges();
      homeController.renderHomePanel();
      return;
    }

    if (action === "select-chapter") setSelectedChapterForBuild(id);
    if (action === "farm-material-route") applyMaterialRoute(target, "farm");
    if (action === "unlock-material-route") applyMaterialRoute(target, "unlock");
    if (action === "preview-material-difficulty") homeState.materialPreviewDifficultyId = target.dataset.difficulty || "";
    if (action === "select-difficulty" || action === "select-bestiary-difficulty") {
      metaState.selected.chapterId = target.dataset.chapter;
      metaState.selected.difficultyId = target.dataset.difficulty;
    }
    if (action === "challenge-boss") setSelectedChapterForBuild(id);
    if (action === "tune-chapter-build") {
      setSelectedChapterForBuild(id);
      homeState.activeTab = "start";
      syncMobileSectionForTab("start");
    }
    if (action === "patch-bestiary-build") {
      setSelectedChapterForBuild(id);
      if (target.dataset.difficulty) metaState.selected.difficultyId = target.dataset.difficulty;
      applyWeaknessPatchPlan(getSelectedChapter(), getSelectedDifficulty());
      syncMobileSectionForTab("chapters");
    }
    if (action === "select-artifact") metaState.selected.artifactId = id;
    if (action === "select-cultivation") metaState.selected.cultivationId = id;
    if (action === "apply-preset") applyPreset(id);
    if (action === "apply-chapter-recommendation") applyChapterBuildRecommendation();
    if (action === "apply-weakness-patch") applyWeaknessPatchPlan();
    if (action === "apply-combo") applyComboPlan(id);
    if (action === "rush-milestone") rushMilestone(target.dataset.kind, id, target.dataset.level);
    if (action === "toggle-talent") toggleTalent(id);
    if (action === "upgrade-talent") upgradeNode("talent", id);
    if (action === "upgrade-artifact") upgradeNode("artifact", id);
    if (action === "upgrade-cultivation") upgradeNode("cultivation", id);
    if (action === "upgrade-facility") upgradeNode("facility", id);
    if (action === "claim-quest") claimQuest(id);

    saveMetaState();
    homeController.updateQuestBadges();
    homeController.renderHomePanel();
  };
}
