/**
 * 创建元进度存储模块。
 * 入参：主题配置、洞府状态、界面节点、调试参数以及导入后的刷新回调。
 * 出参：元进度读写、存档导入导出、货币显示和章节选择相关方法。
 * 作用：把洞府存档、解锁、材料文案和选择状态从入口文件中抽离，统一维护元进度状态。
 */
export function createMetaStore({
  theme,
  metaConfig,
  ui,
  homeState,
  requestedChapter = "",
  requestedDifficulty = "",
  debugMetaMode = "",
  onImportApplied = () => {},
}) {
  let metaState = metaConfig ? loadMetaState() : null;

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function mapById(items = []) {
    return Object.fromEntries(items.map((item) => [item.id, item]));
  }

  function getStartingTalentSlots(state = metaState) {
    const cushion = state?.progression?.facilities?.cushion || 0;
    return 1 + (cushion >= 3 ? 1 : 0) + (cushion >= 7 ? 1 : 0);
  }

  function createDefaultMetaState() {
    const firstChapter = metaConfig?.chapters?.[0]?.id || "cloud-bamboo-valley";
    const firstDifficulty = metaConfig?.difficulties?.[0]?.id || "mortal";
    const defaultArtifacts = (metaConfig?.artifacts || []).filter((item) => item.unlock?.type === "default").map((item) => item.id);
    const defaultTalents = (metaConfig?.startingTalents || []).filter((item) => item.unlock?.type === "default").map((item) => item.id);
    const defaultCultivations = (metaConfig?.cultivations || []).filter((item) => item.unlock?.type === "default").map((item) => item.id);
    const selectedArtifact = defaultArtifacts[0] || metaConfig?.artifacts?.[0]?.id || "";
    const selectedCultivation = defaultCultivations[0] || metaConfig?.cultivations?.[0]?.id || "";
    return {
      version: 1,
      currencies: {
        spiritStone: 0,
        dao: 0,
        mysticIron: 0,
        spiritEssence: 0,
        thunderShard: 0,
      },
      selected: {
        chapterId: firstChapter,
        difficultyId: firstDifficulty,
        artifactId: selectedArtifact,
        cultivationId: selectedCultivation,
        startingTalentIds: defaultTalents.slice(0, 1),
      },
      unlocks: {
        chapters: [firstChapter],
        difficulties: { [firstChapter]: [firstDifficulty] },
        artifacts: defaultArtifacts,
        startingTalents: defaultTalents,
        cultivations: defaultCultivations,
      },
      progression: {
        talentTree: Object.fromEntries((metaConfig?.talentTrees || []).map((tree) => [tree.id, 0])),
        facilities: Object.fromEntries((metaConfig?.facilities || []).map((facility) => [facility.id, 0])),
        artifacts: Object.fromEntries(defaultArtifacts.map((id) => [id, 1])),
        cultivations: Object.fromEntries(defaultCultivations.map((id) => [id, 1])),
      },
      records: {
        runs: 0,
        totalKills: 0,
        bestSurvivalSeconds: 0,
        highestRealmLevel: 1,
        claimedQuests: [],
        combos: {},
        events: {},
        chapters: {
          [firstChapter]: {
            bestDifficulty: firstDifficulty,
            clearedDifficulties: [],
            bestTime: 0,
            bestKills: 0,
          },
        },
      },
    };
  }

  function sanitizeMetaState(raw) {
    if (!metaConfig) return null;
    const defaults = createDefaultMetaState();
    const state = raw && typeof raw === "object" ? raw : {};
    const selected = { ...defaults.selected, ...(state.selected || {}) };
    const chapterIds = (metaConfig.chapters || []).map((chapter) => chapter.id);
    const unlocks = {
      chapters: unique(chapterIds.length ? chapterIds : [...(defaults.unlocks.chapters || []), ...((state.unlocks || {}).chapters || [])]),
      difficulties: { ...defaults.unlocks.difficulties, ...((state.unlocks || {}).difficulties || {}) },
      artifacts: unique([...(defaults.unlocks.artifacts || []), ...((state.unlocks || {}).artifacts || [])]),
      startingTalents: unique([...(defaults.unlocks.startingTalents || []), ...((state.unlocks || {}).startingTalents || [])]),
      cultivations: unique([...(defaults.unlocks.cultivations || []), ...((state.unlocks || {}).cultivations || [])]),
    };
    if (!unlocks.chapters.includes(selected.chapterId)) selected.chapterId = unlocks.chapters[0] || defaults.selected.chapterId;
    if (!unlocks.artifacts.includes(selected.artifactId)) selected.artifactId = unlocks.artifacts[0] || defaults.selected.artifactId;
    if (!unlocks.cultivations.includes(selected.cultivationId)) selected.cultivationId = unlocks.cultivations[0] || defaults.selected.cultivationId;
    selected.startingTalentIds = unique(selected.startingTalentIds).filter((id) => unlocks.startingTalents.includes(id));
    selected.startingTalentIds = selected.startingTalentIds.slice(0, getStartingTalentSlots(state));
    const progression = {
      talentTree: { ...defaults.progression.talentTree, ...((state.progression || {}).talentTree || {}) },
      facilities: { ...defaults.progression.facilities, ...((state.progression || {}).facilities || {}) },
      artifacts: { ...defaults.progression.artifacts, ...((state.progression || {}).artifacts || {}) },
      cultivations: { ...defaults.progression.cultivations, ...((state.progression || {}).cultivations || {}) },
    };
    for (const artifactId of unlocks.artifacts) progression.artifacts[artifactId] = Math.max(1, progression.artifacts[artifactId] || 1);
    for (const cultivationId of unlocks.cultivations) progression.cultivations[cultivationId] = Math.max(1, progression.cultivations[cultivationId] || 1);
    return {
      ...defaults,
      version: 1,
      currencies: { ...defaults.currencies, ...(state.currencies || {}) },
      selected,
      unlocks,
      progression,
      records: {
        ...defaults.records,
        ...(state.records || {}),
        claimedQuests: unique((state.records || {}).claimedQuests),
        combos: { ...defaults.records.combos, ...((state.records || {}).combos || {}) },
        events: { ...defaults.records.events, ...((state.records || {}).events || {}) },
        chapters: { ...defaults.records.chapters, ...((state.records || {}).chapters || {}) },
      },
    };
  }

  function applyDebugMetaState(state) {
    if (debugMetaMode === "quests") {
      return sanitizeMetaState({
        ...state,
        records: {
          ...state.records,
          runs: Math.max(state.records?.runs || 0, 1),
          totalKills: Math.max(state.records?.totalKills || 0, 120),
          highestRealmLevel: Math.max(state.records?.highestRealmLevel || 1, 4),
          claimedQuests: [],
        },
      });
    }
    if (debugMetaMode === "combos") {
      return sanitizeMetaState({
        ...state,
        currencies: {
          ...state.currencies,
          spiritStone: Math.max(state.currencies?.spiritStone || 0, 9999),
          dao: Math.max(state.currencies?.dao || 0, 9999),
          mysticIron: Math.max(state.currencies?.mysticIron || 0, 9999),
          spiritEssence: Math.max(state.currencies?.spiritEssence || 0, 9999),
          thunderShard: Math.max(state.currencies?.thunderShard || 0, 9999),
        },
        unlocks: {
          ...state.unlocks,
          artifacts: unique([...(state.unlocks?.artifacts || []), "red-lotus-lamp"]),
          cultivations: unique([...(state.unlocks?.cultivations || []), "fire-lotus-scripture"]),
          startingTalents: unique([...(state.unlocks?.startingTalents || []), "talisman-fate", "sword-heart", "full-meridian"]),
        },
        selected: {
          ...state.selected,
          artifactId: "red-lotus-lamp",
          cultivationId: "fire-lotus-scripture",
          startingTalentIds: ["talisman-fate", "sword-heart", "full-meridian"],
        },
        progression: {
          ...state.progression,
          facilities: { ...state.progression?.facilities, cushion: 7 },
          artifacts: { ...state.progression?.artifacts, "red-lotus-lamp": 6 },
          cultivations: { ...state.progression?.cultivations, "fire-lotus-scripture": 3 },
        },
      });
    }
    if (debugMetaMode === "shortage") {
      return sanitizeMetaState({
        ...state,
        currencies: {
          ...state.currencies,
          spiritStone: 0,
          dao: 0,
          mysticIron: 0,
          spiritEssence: 0,
          thunderShard: 0,
        },
        unlocks: {
          ...state.unlocks,
          artifacts: unique([...(state.unlocks?.artifacts || []), "qingming-sword-case"]),
          cultivations: unique([...(state.unlocks?.cultivations || []), "sword-scripture"]),
          startingTalents: unique([...(state.unlocks?.startingTalents || []), "sword-heart"]),
        },
        selected: {
          ...state.selected,
          artifactId: "qingming-sword-case",
          cultivationId: "sword-scripture",
          startingTalentIds: ["sword-heart"],
        },
        progression: {
          ...state.progression,
          talentTree: { ...state.progression?.talentTree, sword: 12, spirit: 12, body: 12, movement: 12 },
          artifacts: { ...state.progression?.artifacts, "qingming-sword-case": 9 },
          cultivations: { ...state.progression?.cultivations, "sword-scripture": 3 },
          facilities: { ...state.progression?.facilities, field: 10, alchemy: 10, forge: 10, library: 10, cushion: 10, "thunder-pool": 10 },
        },
      });
    }
    if (debugMetaMode === "cleared") {
      return sanitizeMetaState({
        ...state,
        unlocks: {
          ...state.unlocks,
          chapters: unique([...(state.unlocks?.chapters || []), "cloud-bamboo-valley"]),
          difficulties: {
            ...state.unlocks?.difficulties,
            "cloud-bamboo-valley": unique([...(state.unlocks?.difficulties?.["cloud-bamboo-valley"] || []), "mortal", "mystic"]),
          },
        },
        records: {
          ...state.records,
          chapters: {
            ...state.records?.chapters,
            "cloud-bamboo-valley": {
              ...(state.records?.chapters?.["cloud-bamboo-valley"] || {}),
              bestDifficulty: "mortal",
              clearedDifficulties: unique([...(state.records?.chapters?.["cloud-bamboo-valley"]?.clearedDifficulties || []), "mortal"]),
              bestTime: Math.max(state.records?.chapters?.["cloud-bamboo-valley"]?.bestTime || 0, 120),
              bestKills: Math.max(state.records?.chapters?.["cloud-bamboo-valley"]?.bestKills || 0, 160),
            },
          },
        },
        selected: {
          ...state.selected,
          chapterId: "cloud-bamboo-valley",
          difficultyId: "mortal",
        },
      });
    }
    if (debugMetaMode !== "milestones") return state;
    return sanitizeMetaState({
      ...state,
      currencies: {
        ...state.currencies,
        spiritStone: Math.max(state.currencies?.spiritStone || 0, 9999),
        dao: Math.max(state.currencies?.dao || 0, 9999),
        mysticIron: Math.max(state.currencies?.mysticIron || 0, 9999),
        spiritEssence: Math.max(state.currencies?.spiritEssence || 0, 9999),
        thunderShard: Math.max(state.currencies?.thunderShard || 0, 9999),
      },
      unlocks: {
        ...state.unlocks,
        artifacts: unique([...(state.unlocks?.artifacts || []), "qingming-sword-case"]),
        cultivations: unique([...(state.unlocks?.cultivations || []), "sword-scripture"]),
        startingTalents: unique([...(state.unlocks?.startingTalents || []), "sword-heart"]),
      },
      selected: {
        ...state.selected,
        artifactId: "qingming-sword-case",
        cultivationId: "sword-scripture",
        startingTalentIds: ["sword-heart"],
      },
      progression: {
        ...state.progression,
        talentTree: { ...state.progression?.talentTree, sword: 8, spirit: 5 },
        artifacts: { ...state.progression?.artifacts, "qingming-sword-case": 6 },
      },
    });
  }

  function loadMetaState() {
    if (!metaConfig) return null;
    try {
      const loaded = sanitizeMetaState(JSON.parse(localStorage.getItem(metaConfig.saveKey) || "null"));
      return applyDebugMetaState(loaded);
    } catch {
      return applyDebugMetaState(createDefaultMetaState());
    }
  }

  function getMetaState() {
    return metaState;
  }

  function setMetaState(nextState) {
    metaState = nextState;
    return metaState;
  }

  function updateMetaState(updater) {
    metaState = updater(metaState);
    return metaState;
  }

  function saveMetaState() {
    if (!metaConfig || !metaState) return;
    localStorage.setItem(metaConfig.saveKey, JSON.stringify(metaState));
  }

  function setSaveStatus(message, error = false) {
    if (!ui.saveStatus) return;
    ui.saveStatus.textContent = message;
    ui.saveStatus.classList.toggle("error", error);
  }

  function exportMetaSave() {
    if (!metaConfig || !metaState || !ui.saveDataBox) return;
    ui.saveDataBox.value = JSON.stringify(metaState, null, 2);
    setSaveStatus("已导出当前存档。");
  }

  function resetHomeMaterialFocus() {
    homeState.focusedMaterials = [];
    homeState.targetMaterial = "";
    homeState.targetMaterialMode = "";
    homeState.targetMaterialDifficulty = "";
    homeState.materialPreviewDifficultyId = "";
  }

  function importMetaSave() {
    if (!metaConfig || !ui.saveDataBox) return;
    const raw = ui.saveDataBox.value.trim();
    if (!raw) {
      setSaveStatus("请先粘贴存档 JSON。", true);
      return;
    }
    try {
      metaState = sanitizeMetaState(JSON.parse(raw));
      resetHomeMaterialFocus();
      saveMetaState();
      onImportApplied();
      setSaveStatus("已导入并应用存档。");
    } catch {
      setSaveStatus("存档 JSON 解析失败。", true);
    }
  }

  function getSelectedChapter() {
    if (!metaConfig) return null;
    const chapters = mapById(metaConfig.chapters);
    if (requestedChapter && chapters[requestedChapter]) return chapters[requestedChapter];
    return chapters[metaState?.selected?.chapterId] || metaConfig.chapters[0];
  }

  function getSelectedDifficulty() {
    if (!metaConfig) return null;
    const difficulties = mapById(metaConfig.difficulties);
    if (requestedDifficulty && difficulties[requestedDifficulty]) return difficulties[requestedDifficulty];
    return difficulties[metaState?.selected?.difficultyId] || metaConfig.difficulties[0];
  }

  function currencyName(key) {
    return metaConfig?.currencies?.[key]?.name || key;
  }

  function currencyConfig(key) {
    return metaConfig?.currencies?.[key] || { name: key, color: "#f7f3e8", iconText: key.slice(0, 1), icon: "" };
  }

  function currencyIconHtml(config, className = "material-token-icon") {
    if (!config?.icon || !theme.assetBase) return "";
    return `<img class="${className}" src="${theme.assetBase}${config.icon}" alt="" aria-hidden="true" decoding="async" />`;
  }

  function currencyToken(key, value = null, className = "material-token") {
    const config = currencyConfig(key);
    const amount = value === null || value === undefined ? "" : ` ${Math.floor(value)}`;
    const icon = currencyIconHtml(config) || `<b class="material-token-glyph">${config.iconText || config.name.slice(0, 1)}</b>`;
    return `<span class="${className}" style="--material-color:${config.color || "#f7f3e8"}">${icon}<span class="material-token-copy">${config.name}${amount}</span></span>`;
  }

  function isUnlocked(kind, id) {
    if (!metaState) return true;
    // Mobile UI iteration phase: expose all chapter cards so visual switching can be reviewed directly.
    if (kind === "chapters") return true;
    if (kind === "artifacts") return metaState.unlocks.artifacts.includes(id);
    if (kind === "startingTalents") return metaState.unlocks.startingTalents.includes(id);
    if (kind === "cultivations") return metaState.unlocks.cultivations.includes(id);
    return true;
  }

  function formatCost(cost) {
    return Object.entries(cost || {})
      .filter(([, value]) => value > 0)
      .map(([key, value]) => `${currencyName(key)} ${value}`)
      .join(" / ");
  }

  function formatCostTokens(cost, className = "material-token") {
    return Object.entries(cost || {})
      .filter(([, value]) => value > 0)
      .map(([key, value]) => currencyToken(key, value, className))
      .join("");
  }

  function setSelectedChapterForBuild(chapterId) {
    if (!chapterId || !metaState) return;
    metaState.selected.chapterId = chapterId;
    const allowed = metaState.unlocks.difficulties[chapterId] || ["mortal"];
    if (!allowed.includes(metaState.selected.difficultyId)) metaState.selected.difficultyId = allowed[0] || "mortal";
  }

  function ensureChapterRecord(chapterId) {
    if (!metaState.records.chapters[chapterId]) {
      metaState.records.chapters[chapterId] = {
        bestDifficulty: "mortal",
        clearedDifficulties: [],
        bestTime: 0,
        bestKills: 0,
      };
    }
    return metaState.records.chapters[chapterId];
  }

  function unlockDisplayName(kind, id) {
    const maps = {
      chapters: mapById(metaConfig.chapters),
      artifacts: mapById(metaConfig.artifacts),
      startingTalents: mapById(metaConfig.startingTalents),
      cultivations: mapById(metaConfig.cultivations),
    };
    return maps[kind]?.[id]?.name || id;
  }

  function unlockMany(kind, ids = [], messages = []) {
    for (const id of ids || []) {
      if (!id) continue;
      const list = metaState.unlocks[kind];
      if (Array.isArray(list) && !list.includes(id)) {
        list.push(id);
        messages.push(`解锁 ${unlockDisplayName(kind, id)}`);
      }
      if (kind === "artifacts" && !metaState.progression.artifacts[id]) metaState.progression.artifacts[id] = 1;
      if (kind === "cultivations" && !metaState.progression.cultivations[id]) metaState.progression.cultivations[id] = 1;
    }
  }

  function unlockManyDetailed(kind, ids = [], messages = [], collected = {}) {
    for (const id of ids || []) {
      if (!id) continue;
      const list = metaState.unlocks[kind];
      if (Array.isArray(list) && !list.includes(id)) {
        list.push(id);
        messages.push(`解锁 ${unlockDisplayName(kind, id)}`);
        if (!collected[kind]) collected[kind] = [];
        collected[kind].push(id);
      }
      if (kind === "artifacts" && !metaState.progression.artifacts[id]) metaState.progression.artifacts[id] = 1;
      if (kind === "cultivations" && !metaState.progression.cultivations[id]) metaState.progression.cultivations[id] = 1;
    }
  }

  return {
    metaConfig,
    getMetaState,
    setMetaState,
    updateMetaState,
    createDefaultMetaState,
    sanitizeMetaState,
    saveMetaState,
    exportMetaSave,
    importMetaSave,
    setSaveStatus,
    getSelectedChapter,
    getSelectedDifficulty,
    getStartingTalentSlots,
    currencyName,
    currencyConfig,
    currencyToken,
    isUnlocked,
    formatCost,
    formatCostTokens,
    unique,
    mapById,
    setSelectedChapterForBuild,
    ensureChapterRecord,
    unlockDisplayName,
    unlockMany,
    unlockManyDetailed,
    resetHomeMaterialFocus,
  };
}
