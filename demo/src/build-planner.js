/**
 * 创建构筑与章节规划模块。
 * 入参：元进度、章节配置、洞府状态，以及奇遇/Boss/运行时辅助能力。
 * 出参：构筑推荐、材料路线、章节战备、组合图鉴、升级与结算推进相关方法。
 * 作用：把洞府构筑、材料规划、章节分析和组合图鉴从入口文件中抽离，统一收口为显式依赖模块。
 */
export function createBuildPlanner({
  game,
  ui,
  theme,
  homeState,
  metaConfig,
  getMetaState,
  saveMetaState,
  getSelectedChapter,
  getSelectedDifficulty,
  getStartingTalentSlots,
  currencyName,
  currencyToken,
  formatCost,
  isUnlocked,
  mapById,
  unique,
  homeImage,
  difficultyAllowed,
  unlockConditionText,
  shouldRevealRunEvent,
  eventFollowupTargets,
  eventFollowupHintText,
  resolveEventValue,
  resolveEventAmbush,
  resolveEventChallenge,
  resolveEventChoices,
  resolveEventCurrencies,
  followupEventSummary,
  challengeRewardSummary,
  ambushSummaryText,
  effectValue,
  ensurePath,
  cloneWeapons,
  spellCombos,
  bossSkillModsForDifficulty,
  effectiveBossSkillConfig,
  activeRunBlessingRows,
  getQuestState,
  addText,
}) {
  const metaState = new Proxy({}, {
    get(_target, key) {
      return getMetaState()?.[key];
    },
    set(_target, key, value) {
      const current = getMetaState();
      if (current) current[key] = value;
      return true;
    },
  });

  function firstClearSummary(chapter) {
    const unlocks = chapter?.firstClearUnlocks || {};
    const names = [
      ...(unlocks.chapters || []).map((id) => mapById(metaConfig.chapters)[id]?.name || id),
      ...(unlocks.artifacts || []).map((id) => mapById(metaConfig.artifacts)[id]?.name || id),
      ...(unlocks.startingTalents || []).map((id) => mapById(metaConfig.startingTalents)[id]?.name || id),
      ...(unlocks.cultivations || []).map((id) => mapById(metaConfig.cultivations)[id]?.name || id),
    ].filter(Boolean);
    return names.length ? names.join(" / ") : "高难度与材料收益";
  }

  function selectedArtifact() {
    return mapById(metaConfig.artifacts)[metaState.selected?.artifactId] || null;
  }

  function comboRecord(id) {
    return metaState?.records?.combos?.[id] || null;
  }

  function selectedCultivation() {
    return mapById(metaConfig.cultivations)[metaState.selected?.cultivationId] || null;
  }

  function selectedTalents() {
    const talentMap = mapById(metaConfig.startingTalents);
    return (metaState.selected?.startingTalentIds || []).map((id) => talentMap[id]).filter(Boolean);
  }

  function selectedCultivationSpell() {
    return selectedCultivation()?.spell || "keyboard";
  }

  function upgradeSpellKey(upgrade) {
    if (!upgrade || upgrade.kind !== "spell") return "";
    if (upgrade.id?.includes("coffee")) return "coffee";
    if (upgrade.id?.includes("invoice")) return "invoice";
    if (upgrade.id?.includes("ultimate")) return "ultimate";
    return "keyboard";
  }

  function weightedShuffle(items, weightFor) {
    return [...items]
      .map((item) => {
        const weight = Math.max(0.01, weightFor(item));
        return { item, rank: Math.random() ** (1 / weight) };
      })
      .sort((a, b) => b.rank - a.rank)
      .map(({ item }) => item);
  }

  function cultivationUpgradeBiasSummary() {
    const spell = selectedCultivationSpell();
    const spellName = spell === "ultimate" ? theme.spells?.ultimate?.label : theme.weapons?.[spell]?.name || theme.spells?.[spell]?.label || "御剑成阵";
    return `${selectedCultivation()?.name || "无功法"}偏向 ${spellName}`;
  }

  function chooseUpgrades() {
    if (!theme.spellUpgrades || !theme.equipmentUpgrades) {
      const pool = [...theme.upgrades].sort(() => Math.random() - 0.5);
      return pool.slice(0, 3);
    }
    const biasedSpell = selectedCultivationSpell();
    const spellPool = weightedShuffle(theme.spellUpgrades, (upgrade) => {
      const key = upgradeSpellKey(upgrade);
      if (key === biasedSpell) return 3.2;
      if (biasedSpell === "ultimate" && key === "invoice") return 1.45;
      if (biasedSpell === "coffee" && key === "invoice") return 1.35;
      if (biasedSpell === "invoice" && key === "coffee") return 1.2;
      return 1;
    });
    const equipmentPool = theme.equipmentUpgrades
      .filter((upgrade) => (game.equipment[upgrade.slot]?.tier || 0) < (theme.equipmentSlots[upgrade.slot]?.maxTier || 3))
      .sort(() => Math.random() - 0.5);
    const fatePool = [...(theme.fateUpgrades || [])].sort(() => Math.random() - 0.5);
    const choices = [];
    if (spellPool[0]) choices.push(spellPool[0]);
    if (equipmentPool[0]) choices.push(equipmentPool[0]);
    const randomPool = [...spellPool.slice(1), ...equipmentPool.slice(1), ...fatePool].sort(() => Math.random() - 0.5);
    if (randomPool[0]) choices.push(randomPool[0]);
    while (choices.length < 3 && fatePool[choices.length]) choices.push(fatePool[choices.length]);
    return choices.slice(0, 3);
  }

  function upgradeKindLabel(upgrade) {
    if (upgrade.kind === "equipment") return "装备";
    if (upgrade.kind === "spell") return "法术";
    return "机缘";
  }

  function upgradeIcon(upgrade) {
    if (upgrade.kind === "equipment") {
      const tier = Math.min((game.equipment[upgrade.slot]?.tier || 0) + 1, theme.equipmentSlots[upgrade.slot]?.maxTier || 3);
      return theme.equipmentSlots[upgrade.slot]?.assets?.[tier - 1] || "";
    }
    if (upgrade.id?.includes("coffee")) return theme.spells?.coffee?.icon || "";
    if (upgrade.id?.includes("invoice")) return theme.spells?.invoice?.icon || "";
    if (upgrade.id?.includes("ultimate")) return theme.spells?.ultimate?.icon || "";
    return theme.spells?.keyboard?.icon || "";
  }

  function upgradeSubtitle(upgrade) {
    if (upgrade.kind !== "equipment") return upgrade.title;
    const tier = Math.min((game.equipment[upgrade.slot]?.tier || 0) + 1, theme.equipmentSlots[upgrade.slot]?.maxTier || 3);
    return `${theme.equipmentSlots[upgrade.slot]?.name || "装备"} ${tier}阶`;
  }

  function applySelectedUpgrade(upgrade) {
    if (upgrade.kind === "equipment") {
      const slotState = game.equipment[upgrade.slot];
      const maxTier = theme.equipmentSlots[upgrade.slot]?.maxTier || 3;
      const nextTier = Math.min(maxTier, (slotState?.tier || 0) + 1);
      game.equipment[upgrade.slot] = { tier: nextTier };
      upgrade.apply?.(game, nextTier);
      game.breakthroughFx = {
        age: 0,
        life: 0.95,
        type: "equipment",
        label: `${theme.equipmentSlots[upgrade.slot]?.name || "装备"}${nextTier}`,
      };
      addText(`${theme.equipmentSlots[upgrade.slot]?.name || "装备"} ${nextTier}阶`, game.player.x, game.player.y - 70, "#b9f3ff");
      return;
    }
    upgrade.apply(game);
    if (upgrade.id === "damage" || upgrade.id === "cooldown" || upgrade.id === "burst") game.weapons.keyboard.level += 1;
  }

  function openUpgradePanel() {
    game.state = "upgrading";
    ui.upgradeChoices.innerHTML = "";
    for (const upgrade of chooseUpgrades()) {
      const button = document.createElement("button");
      button.className = "choice";
      button.type = "button";
      button.dataset.kind = upgrade.kind || "fate";
      const icon = upgradeIcon(upgrade);
      button.innerHTML = `
        ${icon ? homeImage(icon, "", "choice-icon") : ""}
        <span class="choice-meta"><b class="choice-tag">${upgradeKindLabel(upgrade)}</b><b class="choice-rarity">${upgrade.rarity || "黄"}</b></span>
        ${upgradeSubtitle(upgrade)}
        <span class="choice-desc">${upgrade.desc}</span>
      `;
      button.addEventListener("click", () => {
        applySelectedUpgrade(upgrade);
        ui.upgradePanel.classList.add("hidden");
        game.state = "playing";
        addText(upgrade.kind === "equipment" ? "法宝入体！" : "悟了！", game.player.x, game.player.y - 70, "#8dffba");
        game.camera.shake = 10;
      });
      ui.upgradeChoices.appendChild(button);
    }
    ui.upgradePanel.classList.remove("hidden");
  }

  function addCurrencies(delta) {
    for (const [key, value] of Object.entries(delta || {})) {
      metaState.currencies[key] = Math.max(0, Math.floor((metaState.currencies[key] || 0) + value));
    }
  }

  function hasCurrency(cost) {
    return Object.entries(cost || {}).every(([key, value]) => (metaState?.currencies?.[key] || 0) >= value);
  }

  function spendCurrency(cost) {
    if (!hasCurrency(cost)) return false;
    for (const [key, value] of Object.entries(cost || {})) metaState.currencies[key] -= value;
    saveMetaState();
    return true;
  }

  function selectedBuildNameSummary() {
    const parts = [
      selectedArtifact()?.name,
      selectedCultivation()?.name,
      ...selectedTalents().map((talent) => talent.name),
    ].filter(Boolean);
    return parts.length ? parts.join(" / ") : "";
  }

  function chapterDropEstimate(chapter, difficulty = getSelectedDifficulty()) {
    if (!chapter) return {};
    const formula = theme.balance?.rewardFormula || {};
    const difficultyMultiplier = difficulty?.rewardMultiplier || 1;
    const chapterMultiplier = chapter.rewardMultiplier || 1;
    const drops = chapter.drops || {};
    return {
      spiritStone: Math.floor((formula.spiritStoneBossBonus ?? 120) * chapterMultiplier * difficultyMultiplier),
      dao: Math.floor((formula.daoBossBonus ?? 30) * chapterMultiplier * difficultyMultiplier),
      mysticIron: Math.floor((drops.mysticIron || formula.fallbackMysticIronBossDrop || 2) * difficultyMultiplier),
      spiritEssence: Math.floor((drops.spiritEssence || 0) * Math.min(formula.spiritEssenceRewardCap ?? 2.2, chapterMultiplier * difficultyMultiplier)),
      thunderShard: drops.thunderShard || 0,
    };
  }

  function chapterDropSummary(chapter, difficulty = getSelectedDifficulty()) {
    const estimate = chapterDropEstimate(chapter, difficulty);
    const entries = Object.entries(estimate).filter(([, value]) => value > 0);
    return entries.length ? entries.map(([key, value]) => currencyToken(key, value)).join("") : `<span class="home-muted">通关后获得基础资源</span>`;
  }

  function materialChapters(key) {
    return (metaConfig?.chapters || [])
      .filter((chapter) => {
        if (key === "spiritStone" || key === "dao") return true;
        if (key === "mysticIron") return (chapter.drops?.mysticIron || 0) > 0;
        if (key === "spiritEssence") return (chapter.drops?.spiritEssence || 0) > 0;
        if (key === "thunderShard") return (chapter.drops?.thunderShard || 0) > 0;
        return false;
      })
      .sort((a, b) => {
        const aUnlocked = isUnlocked("chapters", a.id) ? 0 : 1;
        const bUnlocked = isUnlocked("chapters", b.id) ? 0 : 1;
        const aValue = chapterDropEstimate(a)[key] || 0;
        const bValue = chapterDropEstimate(b)[key] || 0;
        return aUnlocked - bUnlocked || bValue - aValue;
      });
  }

  function recommendChapterForMaterial(key) {
    const chapter = materialChapters(key)[0];
    if (!chapter) return "";
    const locked = !isUnlocked("chapters", chapter.id);
    return `${locked ? "后续解锁" : "建议刷"}：${chapter.name}`;
  }

  function materialRouteLockReason(chapter, difficulty) {
    if (!isUnlocked("chapters", chapter.id)) return "章节未解锁";
    if (!difficultyAllowed(chapter.id, difficulty?.id || "mortal")) return `${difficulty?.name || "难度"}未解锁`;
    return "";
  }

  function materialRouteLockRank(chapter, difficulty) {
    if (!isUnlocked("chapters", chapter.id)) return 2;
    if (!difficultyAllowed(chapter.id, difficulty?.id || "mortal")) return 1;
    return 0;
  }

  function nearestUnlockedChapterFor(chapter) {
    const chapterMap = mapById(metaConfig.chapters || []);
    let current = chapter;
    let fallback = chapter;
    for (let guard = 0; current && guard < 12; guard += 1) {
      if (isUnlocked("chapters", current.id)) return current;
      const prerequisite = current.unlock?.type === "chapterClear" ? chapterMap[current.unlock.chapterId] : null;
      if (!prerequisite) return fallback;
      fallback = prerequisite;
      current = prerequisite;
    }
    return fallback || chapter;
  }

  function materialRouteUnlockHint(chapter, difficulty) {
    if (!isUnlocked("chapters", chapter.id)) {
      const target = nearestUnlockedChapterFor(chapter);
      return target?.id && target.id !== chapter.id
        ? `先通关${target.name}推进章节链`
        : `先${unlockConditionText(chapter.unlock).replace(/\s+/g, "")}`;
    }
    if (difficultyAllowed(chapter.id, difficulty?.id || "mortal")) return "";
    const difficulties = metaConfig.difficulties || [];
    const index = difficulties.findIndex((item) => item.id === difficulty?.id);
    const previous = difficulties[index - 1];
    if (previous) return `先通关${chapter.name}${previous.name}`;
    return `先通关${chapter.name}`;
  }

  function materialRouteUnlockTarget(chapter, difficulty) {
    if (!chapter) return null;
    if (!isUnlocked("chapters", chapter.id)) {
      const prerequisite = nearestUnlockedChapterFor(chapter);
      return prerequisite ? { chapterId: prerequisite.id, difficultyId: "mortal" } : null;
    }
    if (difficultyAllowed(chapter.id, difficulty?.id || "mortal")) return null;
    const difficulties = metaConfig.difficulties || [];
    const index = difficulties.findIndex((item) => item.id === difficulty?.id);
    const previous = difficulties[index - 1] || difficulties[0];
    return previous ? { chapterId: chapter.id, difficultyId: previous.id } : { chapterId: chapter.id, difficultyId: "mortal" };
  }

  function totalMaterialNeedAmount(key) {
    let amount = 0;
    for (const tree of metaConfig.talentTrees || []) {
      const level = metaState.progression.talentTree[tree.id] || 0;
      if (level < tree.maxLevel) amount += upgradeCost("talent", tree.id, level)[key] || 0;
    }
    for (const artifact of metaConfig.artifacts || []) {
      const level = metaState.progression.artifacts[artifact.id] || 0;
      if (isUnlocked("artifacts", artifact.id) && level < artifact.maxLevel) amount += upgradeCost("artifact", artifact.id, level)[key] || 0;
    }
    for (const cultivation of metaConfig.cultivations || []) {
      const level = metaState.progression.cultivations[cultivation.id] || 0;
      if (isUnlocked("cultivations", cultivation.id) && level < cultivation.maxLevel) amount += upgradeCost("cultivation", cultivation.id, level)[key] || 0;
    }
    for (const facility of metaConfig.facilities || []) {
      const level = metaState.progression.facilities[facility.id] || 0;
      if (level < facility.maxLevel) amount += upgradeCost("facility", facility.id, level)[key] || 0;
    }
    return amount;
  }

  function materialRouteRunsText(key, amount, locked = false) {
    const needAmount = totalMaterialNeedAmount(key);
    const owned = Math.floor(metaState.currencies[key] || 0);
    const missing = Math.max(0, needAmount - owned);
    if (missing <= 0 || amount <= 0) return "";
    const runs = Math.max(1, Math.ceil(missing / amount));
    const summary = locked
      ? runs === 1
        ? "解锁后 1 局可补齐缺口"
        : `解锁后约 ${runs} 局补齐缺口`
      : runs === 1
        ? "当前路线可补齐缺口"
        : `约 ${runs} 局补齐缺口`;
    return `
      <span class="material-route-runs">
        <b>${summary}</b>
        <small>缺 ${currencyToken(key, missing, "material-token route-token")} / 局 ${currencyToken(key, amount, "material-token route-token")}</small>
      </span>
    `;
  }

  function materialRouteRewardNote(key, chapter, difficulty, amount) {
    const difficultyId = difficulty?.id || "mortal";
    const difficultyName = difficulty?.name || "当前难度";
    const record = metaState.records.chapters?.[chapter.id];
    const cleared = (record?.clearedDifficulties || []).includes(difficultyId);
    if (cleared) {
      return `<span class="material-route-reward-note repeat"><b>复刷收益</b>${difficultyName}已首通，适合稳定补${currencyName(key)}。</span>`;
    }
    return `<span class="material-route-reward-note first"><b>首通待拿</b>${difficultyName}首通可解锁${firstClearSummary(chapter)}，同时预计${currencyToken(key, amount, "material-token route-token")}。</span>`;
  }

  function materialFarmRoute(key, difficulty = getSelectedDifficulty()) {
    const routes = materialChapters(key)
      .map((chapter) => {
        const lockReason = materialRouteLockReason(chapter, difficulty);
        const unlockTarget = materialRouteUnlockTarget(chapter, difficulty);
        return {
          chapter,
          amount: chapterDropEstimate(chapter, difficulty)[key] || 0,
          locked: Boolean(lockReason),
          lockRank: materialRouteLockRank(chapter, difficulty),
          lockReason,
          unlockHint: materialRouteUnlockHint(chapter, difficulty),
          unlockTarget,
        };
      })
      .filter((route) => route.amount > 0)
      .sort((a, b) => a.lockRank - b.lockRank || b.amount - a.amount)
      .slice(0, 2);
    if (!routes.length) return `<span class="home-muted">暂无推荐</span>`;
    return routes
      .map(({ chapter, amount, locked, lockReason, unlockHint, unlockTarget }) => `
        <span class="material-farm-route ${locked ? "locked" : ""}">
          <b>${chapter.name}</b>
          <small>${difficulty?.name || "当前难度"}预计 ${currencyToken(key, amount, "material-token route-token")}${lockReason ? `<em>${lockReason}</em>` : ""}</small>
          ${materialRouteRewardNote(key, chapter, difficulty, amount)}
          ${materialRouteRunsText(key, amount, locked)}
          ${unlockHint ? `<span class="material-route-hint">${unlockHint}</span>` : ""}
          <button
            data-action="${locked ? "unlock-material-route" : "farm-material-route"}"
            data-id="${chapter.id}"
            data-difficulty="${difficulty?.id || ""}"
            data-material="${key}"
            ${unlockTarget ? `data-target-chapter="${unlockTarget.chapterId}" data-target-difficulty="${unlockTarget.difficultyId}"` : ""}
            type="button"
          >${locked ? "去解锁" : "去刷"}</button>
        </span>
      `)
      .join("");
  }

  function materialPreviewDifficulty() {
    const difficultyMap = mapById(metaConfig.difficulties || []);
    const selected = difficultyMap[homeState.materialPreviewDifficultyId || metaState.selected?.difficultyId];
    return selected || getSelectedDifficulty() || metaConfig.difficulties?.[0];
  }

  function renderMaterialDifficultyPreview() {
    const current = materialPreviewDifficulty();
    return `
      <div class="material-difficulty-preview">
        <span>收益难度预览</span>
        <div>
          ${(metaConfig.difficulties || [])
            .map((difficulty) => `<button data-action="preview-material-difficulty" data-difficulty="${difficulty.id}" class="${current?.id === difficulty.id ? "active" : ""}" type="button">${difficulty.name}</button>`)
            .join("")}
        </div>
      </div>
    `;
  }

  function missingCost(cost = {}) {
    return Object.fromEntries(
      Object.entries(cost)
        .map(([key, value]) => [key, Math.max(0, Math.floor(value - (metaState?.currencies?.[key] || 0)))])
        .filter(([, value]) => value > 0),
    );
  }

  function primaryMissingMaterial(cost = {}) {
    return Object.entries(missingCost(cost))
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key)[0] || "";
  }

  function renderCostHint(cost = {}) {
    const missing = missingCost(cost);
    const entries = Object.entries(missing);
    if (!entries.length) return "";
    const missingKeys = entries.map(([key]) => key);
    const recommendations = unique(entries.map(([key]) => recommendChapterForMaterial(key)).filter(Boolean));
    const material = primaryMissingMaterial(cost);
    const difficulty = getSelectedDifficulty() || metaConfig?.difficulties?.[0];
    const route = material ? materialChapters(material)[0] : null;
    const routeLocked = route ? materialRouteLockReason(route, difficulty) : "";
    const unlockTarget = route && routeLocked ? materialRouteUnlockTarget(route, difficulty) : null;
    const routeButton = route
      ? `<button
          data-action="${routeLocked ? "unlock-material-route" : "farm-material-route"}"
          data-id="${route.id}"
          data-material="${material}"
          data-difficulty="${difficulty?.id || ""}"
          ${unlockTarget ? `data-target-chapter="${unlockTarget.chapterId}" data-target-difficulty="${unlockTarget.difficultyId}"` : ""}
          type="button"
        >${routeLocked ? "去解锁" : `去刷${route.name}`}</button>`
      : "";
    return `
      <div class="cost-hint">
        <span>缺 ${formatCost(missing)}${recommendations.length ? ` · ${recommendations.join(" / ")}` : ""}</span>
        <div class="cost-hint-actions">
          ${routeButton}
          <button data-action="open-tab" data-tab="materials" data-focus-materials="${missingKeys.join(",")}" type="button">看材料</button>
        </div>
      </div>
    `;
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

  function unlockProgressAfterRun() {
    if (!metaConfig || !game.chapter) return [];
    const messages = [];
    const chapterId = game.chapter.id;
    const difficultyId = game.difficulty?.id || "mortal";
    const record = ensureChapterRecord(chapterId);
    record.bestTime = Math.max(record.bestTime || 0, Math.floor(game.time));
    record.bestKills = Math.max(record.bestKills || 0, game.killCount);
    const cleared = game.runStats.bossKilled;
    game.runStats.firstClearRewards = null;
    if (cleared && !record.clearedDifficulties.includes(difficultyId)) {
      record.clearedDifficulties.push(difficultyId);
      messages.push(`${game.chapter.name}${game.difficulty?.name || ""}首通`);
      const unlocks = game.chapter.firstClearUnlocks || {};
      const firstClearRewards = { chapterId, difficultyId, chapters: [], artifacts: [], startingTalents: [], cultivations: [], difficultyUnlockId: "" };
      unlockManyDetailed("chapters", unlocks.chapters, messages, firstClearRewards);
      unlockManyDetailed("artifacts", unlocks.artifacts, messages, firstClearRewards);
      unlockManyDetailed("startingTalents", unlocks.startingTalents, messages, firstClearRewards);
      unlockManyDetailed("cultivations", unlocks.cultivations, messages, firstClearRewards);
      for (const chapter of metaConfig.chapters) {
        if (!metaState.unlocks.difficulties[chapter.id]) metaState.unlocks.difficulties[chapter.id] = ["mortal"];
      }
      if (difficultyId === "mortal" && !metaState.unlocks.difficulties[chapterId].includes("mystic")) {
        metaState.unlocks.difficulties[chapterId].push("mystic");
        messages.push(`解锁 ${game.chapter.name}玄境`);
        firstClearRewards.difficultyUnlockId = "mystic";
      }
      if (difficultyId === "mystic" && !metaState.unlocks.difficulties[chapterId].includes("heaven")) {
        metaState.unlocks.difficulties[chapterId].push("heaven");
        messages.push(`解锁 ${game.chapter.name}天境`);
        firstClearRewards.difficultyUnlockId = "heaven";
      }
      if ([...(firstClearRewards.chapters || []), ...(firstClearRewards.artifacts || []), ...(firstClearRewards.startingTalents || []), ...(firstClearRewards.cultivations || []), firstClearRewards.difficultyUnlockId].filter(Boolean).length) {
        game.runStats.firstClearRewards = firstClearRewards;
      }
    }
    metaState.records.runs += 1;
    metaState.records.totalKills += game.killCount;
    metaState.records.bestSurvivalSeconds = Math.max(metaState.records.bestSurvivalSeconds || 0, Math.floor(game.time));
    metaState.records.highestRealmLevel = Math.max(metaState.records.highestRealmLevel || 1, game.player.level);
    updateComboRecordsAfterRun();
    return messages;
  }

  function formatTime(seconds) {
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60).toString().padStart(2, "0");
    const secs = (total % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  }

  function upgradeCost(kind, id, level) {
    const costs = theme.balance?.upgradeCosts || {};
    if (kind === "talent") {
      const config = costs.talent || {};
      return { [config.currency || "spiritStone"]: Math.floor((config.base ?? 80) * Math.pow(config.growth ?? 1.32, level)) };
    }
    if (kind === "artifact") {
      const config = costs.artifact || {};
      return {
        spiritStone: Math.floor((config.spiritStoneBase ?? 120) * Math.pow(config.spiritStoneGrowth ?? 1.4, level)),
        mysticIron: Math.max(1, Math.floor(level / (config.mysticIronEvery ?? 2))),
      };
    }
    if (kind === "cultivation") {
      const config = costs.cultivation || {};
      return {
        dao: (config.daoBase ?? 20) + level * (config.daoPerLevel ?? 18),
        spiritEssence: (config.spiritEssenceBase ?? 8) + level * (config.spiritEssencePerLevel ?? 6),
      };
    }
    if (kind === "facility") {
      const config = costs.facility || {};
      const cost = { spiritStone: Math.floor((config.spiritStoneBase ?? 160) * Math.pow(config.spiritStoneGrowth ?? 1.45, level)) };
      if (id === "cushion" || id === "library") cost.dao = (config.daoBase ?? 8) + level * (config.daoPerLevel ?? 5);
      if (id === "forge") cost.mysticIron = Math.max(1, Math.floor(level / (config.mysticIronEvery ?? 2)));
      if (id === "thunderPool") cost.thunderShard = Math.max(1, Math.floor(level / (config.thunderShardEvery ?? 3)));
      return cost;
    }
    return {};
  }

  const effectLabelMap = {
    "weapon.keyboard.burst": "飞剑数量",
    "weapon.keyboard.damage": "飞剑伤害",
    "weapon.keyboard.damageMultiplier": "飞剑伤害",
    "weapon.keyboard.level": "御剑成阵等级",
    "weapon.coffee.unlocked": "解锁业火莲华",
    "weapon.coffee.level": "业火莲华等级",
    "weapon.coffee.radius": "业火莲华范围",
    "weapon.coffee.damage": "业火莲华伤害",
    "weapon.invoice.unlocked": "解锁雷符万钧",
    "weapon.invoice.level": "雷符万钧等级",
    "weapon.invoice.damage": "雷符万钧伤害",
    "energy.value": "初始灵力",
    "energy.gainMultiplier": "灵力获取",
    "ultimate.damageMultiplier": "天劫雷瀑伤害",
    "player.pickupRadius": "拾取范围",
    "player.maxHp": "气血上限",
    "player.hp": "气血",
    "player.damageReduction": "受到伤害降低",
    "player.speedMultiplier": "移动速度",
    spellPowerBonus: "法术伤害",
    "run.xpMultiplier": "修为获取",
    "run.healMultiplier": "回血丹效果",
    "run.killHeal": "斩妖回复",
    "run.energyRegen": "灵力恢复",
    "run.eliteDamageBonus": "对精英伤害",
    "reward.spiritStoneMultiplier": "结算灵石",
  };

  function effectLabel(target) {
    if (effectLabelMap[target]) return effectLabelMap[target];
    return String(target || "")
      .replace("weapon.keyboard", "飞剑")
      .replace("weapon.coffee", "业火莲华")
      .replace("weapon.invoice", "雷符万钧")
      .replace("player", "角色")
      .replace("energy", "灵力")
      .replace("ultimate", "天劫雷瀑")
      .replace("run", "局内")
      .replace("reward", "结算")
      .replace(/\./g, " ");
  }

  function formatEffectValue(effect, value) {
    if (effect.op === "set") return "解锁";
    const rounded = Number(value.toFixed?.(3) ?? value);
    const isPercent = /Multiplier|Reduction|Bonus|reward\.|healMultiplier|xpMultiplier|gainMultiplier|speedMultiplier/.test(effect.target);
    const display = isPercent ? Math.round(rounded * 100) : Number(rounded.toFixed?.(2) ?? rounded);
    return display > 0 ? `+${display}${isPercent ? "%" : ""}` : `${display}${isPercent ? "%" : ""}`;
  }

  function effectSummary(effects = [], level = 1) {
    if (!effects.length) return "";
    return effects
      .slice(0, 2)
      .map((effect) => {
        const value = effectValue(effect, level);
        return `${effectLabel(effect.target)} ${formatEffectValue(effect, value)}`;
      })
      .join(" / ");
  }

  function nextMilestoneBenefit(item, milestone) {
    const level = Number(milestone?.level || 0);
    const effects = item?.milestoneEffects?.[level] || item?.milestoneEffects?.[String(level)] || [];
    const summary = effectSummary(effects, level);
    if (summary) return `收益 ${summary}`;
    return milestone?.text ? `突破 ${milestone.text}` : "";
  }

  function addCostTotals(total, cost) {
    for (const [key, value] of Object.entries(cost || {})) total[key] = (total[key] || 0) + value;
    return total;
  }

  function nextMilestoneCostPlan(kind, id, currentLevel = 0, milestone) {
    if (!kind || !id || !milestone?.level) return null;
    const targetLevel = Number(milestone.level);
    if (!Number.isFinite(targetLevel) || targetLevel <= currentLevel) return null;
    const totalCost = {};
    for (let step = currentLevel; step < targetLevel; step += 1) {
      addCostTotals(totalCost, upgradeCost(kind, id, step));
    }
    const missing = missingCost(totalCost);
    const affordable = !Object.keys(missing).length;
    return {
      affordable,
      cost: totalCost,
      id,
      kind,
      label: affordable ? `冲刺成本 ${formatCost(totalCost)}` : `还缺 ${formatCost(missing)}`,
      missingKeys: Object.keys(missing),
      targetLevel,
    };
  }

  function milestoneProgressLevel(kind, id) {
    if (kind === "talent") return metaState.progression.talentTree[id] || 0;
    if (kind === "artifact") return metaState.progression.artifacts[id] || 1;
    if (kind === "cultivation") return metaState.progression.cultivations[id] || 1;
    if (kind === "facility") return metaState.progression.facilities[id] || 0;
    return 0;
  }

  function setMilestoneProgressLevel(kind, id, level) {
    if (kind === "talent") metaState.progression.talentTree[id] = level;
    if (kind === "artifact") metaState.progression.artifacts[id] = level;
    if (kind === "cultivation") metaState.progression.cultivations[id] = level;
    if (kind === "facility") metaState.progression.facilities[id] = level;
  }

  function rushMilestone(kind, id, targetLevel) {
    const currentLevel = milestoneProgressLevel(kind, id);
    const plan = nextMilestoneCostPlan(kind, id, currentLevel, { level: Number(targetLevel) });
    if (!plan?.affordable || !spendCurrency(plan.cost)) return false;
    setMilestoneProgressLevel(kind, id, plan.targetLevel);
    if (kind === "facility") metaState.selected.startingTalentIds = metaState.selected.startingTalentIds.slice(0, getStartingTalentSlots());
    return true;
  }

  function milestoneSummary(item, level = 0, upgrade = {}) {
    const milestones = Object.entries(item?.milestones || {});
    if (!milestones.length) return "";
    const next = milestones
      .map(([milestone, text]) => ({ level: Number(milestone), text }))
      .filter((milestone) => milestone.level > level)
      .sort((a, b) => a.level - b.level)[0];
    const nextBenefit = nextMilestoneBenefit(item, next);
    const nextCostPlan = nextMilestoneCostPlan(upgrade.kind, upgrade.id || item?.id, level, next);
    return `
      <div class="milestone-list">
        ${milestones
          .map(([milestone, text]) => {
            const active = level >= Number(milestone);
            return `<span class="${active ? "active" : ""}"><b>${milestone}级</b>${text}</span>`;
          })
          .join("")}
      </div>
      ${next ? `
        <div class="next-milestone">
          <b>下一档 ${next.level}级</b>
          <span>${next.text}</span>
          ${nextBenefit ? `<em>${nextBenefit}</em>` : ""}
          ${nextCostPlan ? `<small class="next-milestone-cost">${nextCostPlan.label}</small>` : ""}
          ${nextCostPlan ? `<button class="milestone-rush" data-action="rush-milestone" data-kind="${nextCostPlan.kind}" data-id="${nextCostPlan.id}" data-level="${nextCostPlan.targetLevel}" ${nextCostPlan.affordable ? "" : "disabled"} type="button">冲到 ${nextCostPlan.targetLevel}级</button>` : ""}
          ${nextCostPlan && !nextCostPlan.affordable ? `<button class="milestone-materials" data-action="open-tab" data-tab="materials" data-focus-materials="${nextCostPlan.missingKeys.join(",")}" type="button">看材料</button>` : ""}
          <small>还差 ${next.level - level} 级</small>
        </div>
      ` : `
        <div class="next-milestone complete">
          <b>里程碑圆满</b>
          <span>已激活全部关键突破。</span>
        </div>
      `}
    `;
  }

  function normalizeStyleTag(tag) {
    if (!tag) return "";
    const aliases = {
      飞剑: "sword",
      攻击: "sword",
      灵火: "fire",
      范围: "fire",
      雷符: "thunder",
      爆发: "thunder",
      生存: "survival",
      护体: "survival",
      成长: "growth",
      拾取: "growth",
      控场: "control",
      法器: "control",
    };
    return metaConfig.styleTags?.[tag] ? tag : aliases[tag] || "";
  }

  function collectBuildTags(items = []) {
    const names = new Set();
    for (const item of items) {
      for (const tag of item?.tags || []) {
        const normalized = normalizeStyleTag(tag);
        if (normalized) names.add(normalized);
      }
      const text = `${item?.name || ""}${item?.desc || ""}${item?.id || ""}`;
      if (/剑|sword|keyboard/.test(text)) names.add("sword");
      if (/火|莲|coffee|fire/.test(text)) names.add("fire");
      if (/雷|符|thunder|invoice|ultimate/.test(text)) names.add("thunder");
      if (/气血|减伤|护|龟|回血|survival/.test(text)) names.add("survival");
      if (/修为|灵力|拾取|成长|growth/.test(text)) names.add("growth");
      if (/控|铃|震|control/.test(text)) names.add("control");
    }
    return [...names];
  }

  function styleTagToken(tagId) {
    const tag = metaConfig.styleTags?.[tagId] || { name: tagId, color: "#f7f3e8" };
    return `<span class="style-tag" style="--tag-color:${tag.color || "#f7f3e8"}">${tag.name}</span>`;
  }

  function selectedBuildItems() {
    return [selectedArtifact(), selectedCultivation(), ...selectedTalents()].filter(Boolean);
  }

  function selectedBuildTagCounts() {
    const counts = {};
    for (const item of selectedBuildItems()) {
      const tags = collectBuildTags([item]);
      for (const tag of tags) counts[tag] = (counts[tag] || 0) + 1;
    }
    return counts;
  }

  function activeBuildSynergies() {
    const counts = selectedBuildTagCounts();
    return (metaConfig.buildSynergies || [])
      .map((synergy) => {
        const tagCount = (synergy.tags || []).reduce((sum, tag) => sum + (counts[tag] || 0), 0);
        const complete = (synergy.tags || []).every((tag) => counts[tag] > 0);
        return { ...synergy, tagCount, complete };
      })
      .filter((synergy) => synergy.complete);
  }

  function chapterPressureTags(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
    const scores = {};
    const add = (tag, value = 1) => {
      if (!tag) return;
      scores[tag] = (scores[tag] || 0) + value;
    };
    for (const tag of chapter?.recommendedTags || []) add(tag, 2.4);
    const difficultyId = difficulty?.id || metaState?.selected?.difficultyId || "mortal";
    if (difficultyId === "mystic") {
      add("survival", 0.8);
      add("growth", 0.3);
    }
    if (difficultyId === "heaven") {
      add("survival", 1.4);
      add("thunder", 0.5);
    }
    for (const skill of chapter?.bossMechanics?.skills || []) {
      if (skill.shape === "summon") {
        add("fire", 0.8);
        add("sword", 0.4);
      }
      if (["line", "ring", "pool", "pull"].includes(skill.shape)) add("survival", 0.5);
      if (skill.followup || skill.pattern) add("control", 0.35);
      if ((skill.damage || 0) >= 23) add("survival", 0.4);
      if ((skill.count || 0) >= 4) add("fire", 0.35);
    }
    return scores;
  }

  function scoreBuildItemForChapter(item, chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
    if (!item) return 0;
    const pressure = chapterPressureTags(chapter, difficulty);
    const tags = collectBuildTags([item]);
    let score = tags.reduce((sum, tag) => sum + (pressure[tag] || 0), 0);
    const text = `${item.name || ""}${item.desc || ""}`;
    const bossShapes = (chapter?.bossMechanics?.skills || []).map((skill) => skill.shape);
    if (bossShapes.includes("summon") && /范围|火|莲|飞剑|剑/.test(text)) score += 0.7;
    if (bossShapes.some((shape) => ["pool", "line", "ring", "pull"].includes(shape)) && /气血|减伤|移速|护|龟|回血/.test(text)) score += 0.8;
    if (bossShapes.includes("ring") && /雷|灵力|雷瀑|护/.test(text)) score += 0.45;
    return score;
  }

  function bestUnlockedBuildItem(kind, chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
    const collection = metaConfig?.[kind] || [];
    return collection
      .filter((item) => isUnlocked(kind, item.id))
      .map((item) => ({ item, score: scoreBuildItemForChapter(item, chapter, difficulty) }))
      .sort((a, b) => b.score - a.score || (a.item.name || "").localeCompare(b.item.name || ""))
      [0]?.item || null;
  }

  function presetAvailability(preset) {
    const missing = [];
    let usable = false;
    if (preset.artifactId && !isUnlocked("artifacts", preset.artifactId)) missing.push(unlockDisplayName("artifacts", preset.artifactId));
    else if (preset.artifactId) usable = true;
    if (preset.cultivationId && !isUnlocked("cultivations", preset.cultivationId)) missing.push(unlockDisplayName("cultivations", preset.cultivationId));
    else if (preset.cultivationId) usable = true;
    for (const talentId of preset.talentIds || []) {
      if (!isUnlocked("startingTalents", talentId)) missing.push(unlockDisplayName("startingTalents", talentId));
      else usable = true;
    }
    return { available: missing.length === 0, usable, missing };
  }

  function chapterBuildRecommendation() {
    const chapter = getSelectedChapter();
    const difficulty = getSelectedDifficulty();
    const slots = getStartingTalentSlots();
    const pressure = chapterPressureTags(chapter, difficulty);
    const tags = Object.entries(pressure)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 3);
    const directPreset = (metaConfig.loadoutPresets || []).find((preset) => {
      const availability = presetAvailability(preset);
      return availability.usable && (preset.recommendedChapters || []).includes(chapter?.id);
    });
    const artifact = directPreset?.artifactId && isUnlocked("artifacts", directPreset.artifactId)
      ? mapById(metaConfig.artifacts)[directPreset.artifactId]
      : bestUnlockedBuildItem("artifacts", chapter, difficulty);
    const cultivation = directPreset?.cultivationId && isUnlocked("cultivations", directPreset.cultivationId)
      ? mapById(metaConfig.cultivations)[directPreset.cultivationId]
      : bestUnlockedBuildItem("cultivations", chapter, difficulty);
    const presetTalents = (directPreset?.talentIds || []).filter((id) => isUnlocked("startingTalents", id));
    const scoredTalents = (metaConfig.startingTalents || [])
      .filter((talent) => isUnlocked("startingTalents", talent.id) && !presetTalents.includes(talent.id))
      .map((talent) => ({ talent, score: scoreBuildItemForChapter(talent, chapter, difficulty) }))
      .sort((a, b) => b.score - a.score || (a.talent.name || "").localeCompare(b.talent.name || ""))
      .map(({ talent }) => talent.id);
    const talentIds = unique([...presetTalents, ...scoredTalents]).slice(0, slots);
    const selected = metaState.selected || {};
    const applied =
      (!artifact?.id || selected.artifactId === artifact.id)
      && (!cultivation?.id || selected.cultivationId === cultivation.id)
      && talentIds.every((id) => selected.startingTalentIds?.includes(id));
    const missing = [];
    if (directPreset) {
      const availability = presetAvailability(directPreset);
      missing.push(...availability.missing);
    }
    const reasons = [
      `${chapter?.bossName || "本章 Boss"}：${(chapter?.bossMechanics?.skills || []).slice(0, 2).map((skill) => skill.name).join(" / ") || "常规妖潮"}`,
      tags.length ? `推荐流派：${tags.map((tag) => metaConfig.styleTags?.[tag]?.name || tag).join(" / ")}` : "推荐流派：通用",
      directPreset ? `匹配预设：${directPreset.name}` : "按已解锁组件动态配装",
    ];
    return { chapter, difficulty, tags, artifact, cultivation, talentIds, directPreset, missing: unique(missing), reasons, applied };
  }

  function applyChapterBuildRecommendation() {
    const recommendation = chapterBuildRecommendation();
    if (!recommendation.artifact && !recommendation.cultivation && !recommendation.talentIds.length) return false;
    if (recommendation.artifact?.id) metaState.selected.artifactId = recommendation.artifact.id;
    if (recommendation.cultivation?.id) metaState.selected.cultivationId = recommendation.cultivation.id;
    metaState.selected.startingTalentIds = recommendation.talentIds.slice(0, getStartingTalentSlots());
    return true;
  }

  function weaknessPatchTags(row, chapter = getSelectedChapter()) {
    if (!row) return chapter?.recommendedTags || ["growth"];
    if (row.key === "生存") return ["survival", "control"];
    if (row.key === "成长") return ["growth", "thunder", "sword"];
    return [...(chapter?.recommendedTags || []), "sword", "fire", "thunder"];
  }

  function scoreBuildItemForTags(item, targetTags = []) {
    if (!item) return 0;
    const tags = collectBuildTags([item]);
    const text = `${item.name || ""}${item.desc || ""}${item.id || ""}`;
    let score = tags.reduce((sum, tag) => sum + (targetTags.includes(tag) ? 3 : 0), 0);
    if (targetTags.includes("survival") && /气血|减伤|护|龟|回血|丹田/.test(text)) score += 2;
    if (targetTags.includes("growth") && /修为|灵力|拾取|成长|周天|葫芦/.test(text)) score += 2;
    if (targetTags.some((tag) => ["sword", "fire", "thunder"].includes(tag)) && /剑|火|莲|雷|符|伤害|爆发/.test(text)) score += 1.5;
    return score;
  }

  function bestUnlockedBuildItemForTags(kind, tags = []) {
    const best = (metaConfig?.[kind] || [])
      .filter((item) => isUnlocked(kind, item.id))
      .map((item) => ({ item, score: scoreBuildItemForTags(item, tags) }))
      .sort((a, b) => b.score - a.score || (a.item.name || "").localeCompare(b.item.name || ""))
      [0];
    return best?.score > 0 ? best.item : null;
  }

  function weaknessPatchPlan(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
    const readiness = chapterReadinessReport(buildPreviewState(), chapter, difficulty);
    const weakest = [...readiness.rows].sort((a, b) => a.ratio - b.ratio)[0];
    if (!weakest || weakest.state !== "偏弱") return { readiness, weakest, available: false, applied: true, reason: "暂无明显短板" };
    const tags = weaknessPatchTags(weakest);
    const slots = getStartingTalentSlots();
    const artifact = bestUnlockedBuildItemForTags("artifacts", tags);
    const cultivation = bestUnlockedBuildItemForTags("cultivations", tags);
    const patchTalentIds = (metaConfig.startingTalents || [])
      .filter((talent) => isUnlocked("startingTalents", talent.id))
      .map((talent) => ({ talent, score: scoreBuildItemForTags(talent, tags) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || (a.talent.name || "").localeCompare(b.talent.name || ""))
      .map(({ talent }) => talent.id)
      .slice(0, slots);
    const currentTalentIds = metaState.selected?.startingTalentIds || [];
    const talentIds = unique([...patchTalentIds, ...currentTalentIds]).slice(0, slots);
    const selected = metaState.selected || {};
    const applied =
      (!artifact?.id || selected.artifactId === artifact.id)
      && (!cultivation?.id || selected.cultivationId === cultivation.id)
      && talentIds.every((id) => selected.startingTalentIds?.includes(id));
    const names = [
      artifact?.shortName || artifact?.name,
      cultivation?.name,
      ...patchTalentIds.map((id) => mapById(metaConfig.startingTalents)[id]?.name),
    ].filter(Boolean);
    return { readiness, weakest, tags, artifact, cultivation, talentIds, names, available: Boolean(artifact || cultivation || talentIds.length), applied, reason: `补${weakest.key}` };
  }

  function applyWeaknessPatchPlan(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
    const plan = weaknessPatchPlan(chapter, difficulty);
    if (!plan.available) return false;
    if (plan.artifact?.id) metaState.selected.artifactId = plan.artifact.id;
    if (plan.cultivation?.id) metaState.selected.cultivationId = plan.cultivation.id;
    metaState.selected.startingTalentIds = plan.talentIds.slice(0, getStartingTalentSlots());
    return true;
  }

  function buildPowerSummary(preview = buildPreviewState()) {
    const weaponScore = Math.round(
      (preview.weapons.keyboard?.damage || 0) * (preview.weapons.keyboard?.burst || 1) * 0.45
        + (preview.weapons.coffee?.unlocked ? (preview.weapons.coffee.damage || 0) * Math.max(1, (preview.weapons.coffee.radius || 0) / 70) * 0.9 : 0)
        + (preview.weapons.invoice?.unlocked ? (preview.weapons.invoice.damage || 0) * 1.2 : 0)
        + (preview.ultimate?.damage || 0) * 0.28
    );
    const sustainScore = Math.round(
      (preview.player.maxHp || 0) * 0.26
        + (preview.player.damageReduction || 0) * 420
        + (preview.runMods.killHeal || 0) * 3
        + (preview.runMods.energyRegen || 0) * 24
    );
    const growthScore = Math.round(
      (preview.runMods.xpMultiplier || 0) * 360
        + (preview.energy.gainMultiplier || 0) * 210
        + (preview.player.pickupRadius || 0) * 0.18
        + (preview.energy.value || 0) * 0.25
    );
    const total = Math.max(0, weaponScore + sustainScore + growthScore);
    const tier = total >= 210 ? "成型" : total >= 160 ? "可战" : "起步";
    return { weaponScore, sustainScore, growthScore, total, tier };
  }

  function chapterReadinessReport(preview = buildPreviewState(), chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
    const difficultyId = difficulty?.id || "mortal";
    const pressure = chapterPressureTags(chapter, difficulty);
    const pressureTotal = Math.max(1, Object.values(pressure).reduce((sum, value) => sum + value, 0));
    const power = buildPowerSummary(preview);
    const difficultyFactor = difficultyId === "heaven" ? 1.28 : difficultyId === "mystic" ? 1.14 : 1;
    const bossPressure = (chapter?.enemyMods?.hp || 1) * 18 + (chapter?.enemyMods?.damage || 1) * 16 + (chapter?.spawnMods?.cap || 1) * 10;
    const expected = Math.round((92 + bossPressure + pressureTotal * 8) * difficultyFactor);
    const totalRatio = power.total / Math.max(1, expected);
    const rows = [
      {
        key: "输出",
        value: power.weaponScore,
        need: Math.round(expected * (0.42 + (pressure.sword || pressure.fire || pressure.thunder ? 0.04 : 0))),
        hint: "补飞剑/灵火/雷符伤害",
      },
      {
        key: "生存",
        value: power.sustainScore,
        need: Math.round(expected * (0.28 + (pressure.survival || 0) * 0.025)),
        hint: "补气血、减伤或回血",
      },
      {
        key: "成长",
        value: power.growthScore,
        need: Math.round(expected * (0.24 + (pressure.growth || 0) * 0.025)),
        hint: "补修为、灵力或拾取",
      },
    ].map((row) => {
      const ratio = row.value / Math.max(1, row.need);
      const state = ratio >= 1.08 ? "充足" : ratio >= 0.82 ? "可战" : "偏弱";
      return { ...row, ratio, state };
    });
    const weak = rows.filter((row) => row.state === "偏弱");
    const tier = totalRatio >= 1.12 && !weak.length ? "稳压" : totalRatio >= 0.88 ? "可战" : "偏险";
    const summary = weak.length ? `建议先${weak.map((row) => row.hint).join("，")}` : `${chapter?.bossName || "Boss"}当前压力可控`;
    return { tier, expected, totalRatio, rows, summary, power };
  }

  function createPreviewState() {
    return {
      player: {
        maxHp: theme.player.maxHp,
        speed: theme.player.speed,
        pickupRadius: theme.player.pickupRadius,
        damageReduction: 0,
        speedMultiplier: 0,
      },
      weapons: cloneWeapons(),
      energy: { value: 0, gainMultiplier: 0 },
      ultimate: { damage: theme.ultimate?.damage || 0, damageMultiplier: 0 },
      runMods: { xpMultiplier: 0, healMultiplier: 0, killHeal: 0, energyRegen: 0, eliteDamageBonus: 0, reward: { spiritStoneMultiplier: 0 } },
      spellPowerBonus: 0,
    };
  }

  function resolvePreviewEffectTarget(preview, target) {
    const mapped = target
      .replace(/^weapon\./, "weapons.")
      .replace(/^player\./, "player.")
      .replace(/^energy\./, "energy.")
      .replace(/^ultimate\./, "ultimate.")
      .replace(/^run\./, "runMods.")
      .replace(/^reward\./, "runMods.reward.");
    return ensurePath(preview, mapped.split("."));
  }

  function applyPreviewEffect(preview, effect, level = 1) {
    const { holder, key } = resolvePreviewEffectTarget(preview, effect.target);
    const value = effectValue(effect, level);
    if (effect.op === "set") {
      holder[key] = value;
      return;
    }
    if (effect.op === "multiply") {
      holder[key] = (holder[key] ?? 1) * value;
      return;
    }
    holder[key] = (holder[key] || 0) + value;
    if (typeof effect.max === "number") holder[key] = Math.min(effect.max, holder[key]);
  }

  function applyPreviewEffects(preview, effects = [], level = 1) {
    for (const effect of effects) applyPreviewEffect(preview, effect, level);
  }

  function applyPreviewMilestoneEffects(preview, item, level = 0) {
    for (const [milestone, effects] of Object.entries(item?.milestoneEffects || {})) {
      if (level >= Number(milestone)) applyPreviewEffects(preview, effects, level);
    }
  }

  function buildPreviewState() {
    const preview = createPreviewState();
    const artifact = selectedArtifact();
    const cultivation = selectedCultivation();
    const artifactLevel = metaState.progression.artifacts[artifact?.id] || 1;
    const cultivationLevel = metaState.progression.cultivations[cultivation?.id] || 1;
    for (const tree of metaConfig.talentTrees || []) {
      const level = Math.min(tree.maxLevel || 12, metaState.progression.talentTree[tree.id] || 0);
      if (level > 0) {
        applyPreviewEffects(preview, tree.effects, level);
        applyPreviewMilestoneEffects(preview, tree, level);
      }
    }
    if (artifact) {
      applyPreviewEffects(preview, artifact.effects, artifactLevel);
      applyPreviewMilestoneEffects(preview, artifact, artifactLevel);
    }
    if (cultivation) applyPreviewEffects(preview, cultivation.effects, cultivationLevel);
    for (const talent of selectedTalents()) applyPreviewEffects(preview, talent.effects, 1);
    for (const synergy of activeBuildSynergies()) applyPreviewEffects(preview, synergy.effects, 1);
    if (preview.player.speedMultiplier) preview.player.speed *= 1 + preview.player.speedMultiplier;
    for (const weapon of Object.values(preview.weapons)) {
      if (weapon.damageMultiplier) weapon.damage = Math.round(weapon.damage * (1 + weapon.damageMultiplier));
    }
    if (preview.ultimate.damageMultiplier) preview.ultimate.damage = Math.round(preview.ultimate.damage * (1 + preview.ultimate.damageMultiplier));
    preview.player.maxHp = Math.round(preview.player.maxHp);
    preview.player.speed = Math.round(preview.player.speed);
    preview.player.pickupRadius = Math.round(preview.player.pickupRadius);
    preview.energy.value = Math.round(Math.max(0, Math.min(preview.energy.value || 0, preview.energy.max || 100)));
    return preview;
  }

  function buildPreviewRows() {
    const preview = buildPreviewState();
    return [
      ["气血", preview.player.maxHp],
      ["移速", preview.player.speed],
      ["拾取", preview.player.pickupRadius],
      ["飞剑", `${preview.weapons.keyboard?.burst || 1}剑 / 伤害 ${preview.weapons.keyboard?.damage || 0}`],
      ["业火", preview.weapons.coffee?.unlocked ? `${preview.weapons.coffee.level || 1}重 / 范围 ${Math.round(preview.weapons.coffee.radius || 0)}` : "未起手"],
      ["雷符", preview.weapons.invoice?.unlocked ? `${preview.weapons.invoice.level || 1}重 / 伤害 ${preview.weapons.invoice.damage || 0}` : "未起手"],
      ["初始灵力", preview.energy.value || 0],
      ["修为获取", `+${Math.round((preview.runMods.xpMultiplier || 0) * 100)}%`],
      ["升级偏向", cultivationUpgradeBiasSummary()],
    ];
  }

  function comboPlanAvailability(combo) {
    const plan = combo.plan || {};
    const missing = [];
    let usable = false;
    if (plan.artifactId && !isUnlocked("artifacts", plan.artifactId)) missing.push(unlockDisplayName("artifacts", plan.artifactId));
    else if (plan.artifactId) usable = true;
    if (plan.cultivationId && !isUnlocked("cultivations", plan.cultivationId)) missing.push(unlockDisplayName("cultivations", plan.cultivationId));
    else if (plan.cultivationId) usable = true;
    for (const talentId of plan.talentIds || []) {
      if (!isUnlocked("startingTalents", talentId)) missing.push(unlockDisplayName("startingTalents", talentId));
      else usable = true;
    }
    return { usable, missing };
  }

  function comboPreviewRows(preview = buildPreviewState()) {
    const availableBySpell = {
      "御剑成阵": (preview.weapons.keyboard?.level || 0) > 0 || preview.weapons.keyboard?.unlocked,
      "业火莲华": Boolean(preview.weapons.coffee?.unlocked),
      "雷符万钧": Boolean(preview.weapons.invoice?.unlocked),
    };
    return spellCombos.map((combo) => {
      const missing = combo.recipe.filter((name) => !availableBySpell[name]);
      const record = comboRecord(combo.id) || {};
      const plan = comboPlanAvailability(combo);
      return { ...combo, ready: missing.length === 0, missing, record, plan };
    });
  }

  function applyComboPlan(comboId) {
    const combo = spellCombos.find((item) => item.id === comboId);
    if (!combo || !comboPlanAvailability(combo).usable) return false;
    const plan = combo.plan || {};
    if (plan.artifactId && isUnlocked("artifacts", plan.artifactId)) metaState.selected.artifactId = plan.artifactId;
    if (plan.cultivationId && isUnlocked("cultivations", plan.cultivationId)) metaState.selected.cultivationId = plan.cultivationId;
    const slots = getStartingTalentSlots();
    const nextTalents = [...(metaState.selected.startingTalentIds || [])];
    for (const talentId of plan.talentIds || []) {
      if (!isUnlocked("startingTalents", talentId) || nextTalents.includes(talentId)) continue;
      if (nextTalents.length < slots) nextTalents.push(talentId);
    }
    metaState.selected.startingTalentIds = nextTalents.slice(0, slots);
    return true;
  }

  function renderComboPreview() {
    const rows = comboPreviewRows();
    return `
      <div class="combo-preview">
        <strong>法术组合</strong>
        <div>
          ${rows
            .map((combo) => `
              <article class="${combo.ready ? "ready" : ""}">
                <span>${combo.ready ? "可触发" : "缺组件"}</span>
                <b>${combo.name}</b>
                <small>${combo.ready ? combo.desc : `还缺：${combo.missing.join(" / ")}`}</small>
                <em>${combo.record.bestCount ? `最佳 ${combo.record.bestCount} 次` : combo.recipe.join(" + ")}</em>
                <button data-action="apply-combo" data-id="${combo.id}" ${combo.plan.usable ? "" : "disabled"}>${combo.ready ? "重套组合" : combo.plan.missing.length ? "套用已解锁" : "套用组合"}</button>
              </article>
            `)
            .join("")}
        </div>
      </div>
    `;
  }

  function renderBuildSynergyPanel() {
    const preview = buildPreviewState();
    const power = buildPowerSummary(preview);
    const active = activeBuildSynergies();
    const counts = selectedBuildTagCounts();
    const candidates = (metaConfig.buildSynergies || [])
      .filter((synergy) => !active.some((item) => item.id === synergy.id))
      .map((synergy) => {
        const missing = (synergy.tags || []).filter((tag) => !counts[tag]);
        return { ...synergy, missing };
      })
      .sort((a, b) => a.missing.length - b.missing.length)
      .slice(0, 2);
    return `
      <section class="home-card build-synergy-panel">
        <div class="build-preview-head">
          <h2>流派共鸣</h2>
          <small>${power.tier} · 战力 ${power.total}</small>
        </div>
        <div class="power-score">
          <span><b>${power.weaponScore}</b>输出</span>
          <span><b>${power.sustainScore}</b>生存</span>
          <span><b>${power.growthScore}</b>成长</span>
        </div>
        <div class="synergy-list">
          ${active.length
            ? active.map((synergy) => `
                <article class="active">
                  <div><strong>${synergy.name}</strong>${(synergy.tags || []).map(styleTagToken).join("")}</div>
                  <p>${synergy.desc}</p>
                  <small>${effectSummary(synergy.effects, 1)}</small>
                </article>
              `).join("")
            : `<article><div><strong>尚未共鸣</strong></div><p>让法宝、功法和初始天赋至少凑齐同一条推荐组合，会获得额外入局效果。</p></article>`}
          ${candidates
            .map((synergy) => `
              <article>
                <div><strong>${synergy.name}</strong>${(synergy.tags || []).map(styleTagToken).join("")}</div>
                <p>还缺：${synergy.missing.map((tag) => metaConfig.styleTags?.[tag]?.name || tag).join(" / ")}</p>
              </article>
            `)
            .join("")}
        </div>
      </section>
    `;
  }

  function chapterRewardMultiplierText(difficulty) {
    const multiplier = difficulty?.rewardMultiplier || 1;
    if (multiplier <= 1) return "当前难度按基础收益结算";
    return `当前难度奖励 x${multiplier.toFixed(1)} · 额外 ${Math.round((multiplier - 1) * 100)}%`;
  }

  function chapterRewardHighlights(chapter, difficulty, locked = false) {
    if (locked) return "";
    const difficultyId = difficulty?.id || "mortal";
    const difficultyName = difficulty?.name || "当前难度";
    const record = metaState.records.chapters?.[chapter.id];
    const cleared = (record?.clearedDifficulties || []).includes(difficultyId);
    const clearDetail = cleared
      ? `${difficultyName}已首通，适合复刷 ${chapterDropSummary(chapter, difficulty)}`
      : `${difficultyName}首通可解锁 ${firstClearSummary(chapter)}`;
    return `
      <div class="chapter-reward-highlights">
        <span class="chapter-reward-pill bonus">
          <b>${difficultyName}收益</b>
          <small>${chapterRewardMultiplierText(difficulty)}</small>
        </span>
        <span class="chapter-reward-pill ${cleared ? "repeat" : "first"}">
          <b>${cleared ? "已首通" : "首通待拿"}</b>
          <small>${clearDetail}</small>
        </span>
      </div>
    `;
  }

  function chapterEventTagIds(chapter) {
    return unique((chapter?.runEvents || []).filter((event) => !event.hidden || shouldRevealRunEvent(event)).flatMap((event) => event.tags || []));
  }

  function chapterBuildContextTags(chapter) {
    return unique([...(chapter?.recommendedTags || []), ...chapterEventTagIds(chapter)]);
  }

  function runEventDetailText(event, difficulty = getSelectedDifficulty()) {
    const damage = resolveEventValue(event, "damage", difficulty);
    const ambush = resolveEventAmbush(event, difficulty);
    const challenge = resolveEventChallenge(event, difficulty);
    const choices = resolveEventChoices(event, difficulty);
    const followupText = eventFollowupTargets(event, difficulty).map((target) => eventFollowupHintText(target)).join(" / ");
    const parts = [
      event.summary || "",
      choices.length ? `可择 ${choices.map((choice) => choice.label).join(" / ")}` : "",
      followupText ? `连锁 ${followupText}` : event.followupEventId ? `连锁 ${followupEventSummary(event.followupEventId)}` : "",
      event.healRatio ? `回血 ${Math.round(event.healRatio * 100)}%` : "",
      event.energy ? `灵力 +${Math.round(event.energy)}` : "",
      damage > 0 ? `代价 ${Math.round(damage)}` : "",
      Object.keys(ambush).length ? `伏击 ${ambushSummaryText(ambush)}` : "",
      challenge ? `试炼 ${Math.round(challenge.duration || 12)}s` : "",
      challenge ? challengeRewardSummary(challenge) : "",
      formatCost(resolveEventCurrencies(event, "rewards", difficulty)),
      formatCost(resolveEventCurrencies(event, "pickupRewards", difficulty)),
    ].filter(Boolean);
    return parts.join(" / ");
  }

  function renderRunEventPreview(chapter, difficulty, locked = false) {
    const events = (chapter?.runEvents || []).filter((event) => !event.hidden || shouldRevealRunEvent(event));
    if (locked || !events.length) return "";
    return `
      <div class="chapter-event-preview">
        <strong>章节奇遇</strong>
        <div class="chapter-event-list">
          ${events
            .map((event) => `
              <span class="chapter-event-pill ${event.kind || "event"}">
                <b>${event.label}</b>
                <small>${runEventDetailText(event, difficulty)}</small>
                ${(event.tags || []).length ? `<em>${(event.tags || []).map(styleTagToken).join("")}</em>` : ""}
              </span>
            `)
            .join("")}
        </div>
      </div>
    `;
  }

  function renderBestiaryRewardHighlights(chapter, difficulty, locked = false) {
    if (locked) return "";
    return `<div class="bestiary-rewards">${chapterRewardHighlights(chapter, difficulty, locked)}</div>`;
  }

  function chapterClearCount() {
    return (metaConfig?.chapters || []).filter((chapter) => {
      const record = metaState.records.chapters?.[chapter.id];
      return record?.clearedDifficulties?.length > 0;
    }).length;
  }

  function difficultyProgressCount() {
    return (metaConfig?.chapters || []).reduce((total, chapter) => {
      const record = metaState.records.chapters?.[chapter.id];
      return total + (record?.clearedDifficulties?.length || 0);
    }, 0);
  }

  function totalDifficultyCount() {
    return (metaConfig?.chapters?.length || 0) * (metaConfig?.difficulties?.length || 0);
  }

  function nextChapterGoal() {
    const chapters = metaConfig?.chapters || [];
    return chapters.find((chapter) => {
      if (!isUnlocked("chapters", chapter.id)) return false;
      const record = metaState.records.chapters?.[chapter.id];
      return !(record?.clearedDifficulties || []).includes("mortal");
    }) || chapters.find((chapter) => !isUnlocked("chapters", chapter.id)) || null;
  }

  function nextQuestGoal() {
    return (metaConfig.quests || [])
      .map((quest) => ({ quest, state: getQuestState()(quest) }))
      .find(({ state }) => !state.claimed) || null;
  }

  function upgradeCandidates() {
    const rows = [];
    for (const tree of metaConfig.talentTrees || []) {
      const level = metaState.progression.talentTree[tree.id] || 0;
      if (level < tree.maxLevel) rows.push({ kind: "天赋", name: tree.name, level, maxLevel: tree.maxLevel, cost: upgradeCost("talent", tree.id, level) });
    }
    for (const artifact of metaConfig.artifacts || []) {
      const level = metaState.progression.artifacts[artifact.id] || 0;
      if (isUnlocked("artifacts", artifact.id) && level < artifact.maxLevel) rows.push({ kind: "法宝", name: artifact.shortName || artifact.name, level, maxLevel: artifact.maxLevel, cost: upgradeCost("artifact", artifact.id, level) });
    }
    for (const cultivation of metaConfig.cultivations || []) {
      const level = metaState.progression.cultivations[cultivation.id] || 0;
      if (isUnlocked("cultivations", cultivation.id) && level < cultivation.maxLevel) rows.push({ kind: "功法", name: cultivation.name, level, maxLevel: cultivation.maxLevel, cost: upgradeCost("cultivation", cultivation.id, level) });
    }
    for (const facility of metaConfig.facilities || []) {
      const level = metaState.progression.facilities[facility.id] || 0;
      if (level < facility.maxLevel) rows.push({ kind: "洞府", name: facility.name, level, maxLevel: facility.maxLevel, cost: upgradeCost("facility", facility.id, level) });
    }
    return rows;
  }

  function nextUpgradeGoal() {
    return upgradeCandidates()
      .map((item) => {
        const missing = missingCost(item.cost);
        const missingTotal = Object.values(missing).reduce((sum, value) => sum + value, 0);
        return { ...item, missing, missingTotal };
      })
      .sort((a, b) => a.missingTotal - b.missingTotal || a.level - b.level)[0] || null;
  }

  function currentDifficultyEventProgress(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
    if (!chapter || !difficulty) return [];
    return (chapter.runEvents || []).map((event) => {
      const record = metaState.records?.events?.[event.id] || {};
      const choices = resolveEventChoices(event, difficulty);
      const seenChoices = choices.filter((choice) => record.choices?.[choice.id]);
      const unseenChoices = choices.filter((choice) => !record.choices?.[choice.id]);
      const routeTargets = eventFollowupTargets(event, difficulty);
      const seenRoutes = routeTargets.filter((target) => record.followups?.[target.eventId]);
      const unseenRoutes = routeTargets.filter((target) => !record.followups?.[target.eventId]);
      const unseenSecretRoutes = unseenRoutes.filter((target) => target.kind === "secret");
      const unseenChainRoutes = unseenRoutes.filter((target) => target.kind !== "secret");
      return { event, record, choices, seenChoices, unseenChoices, routeTargets, seenRoutes, unseenRoutes, unseenSecretRoutes, unseenChainRoutes };
    });
  }

  function nextEventProgressGoal(chapter = getSelectedChapter(), difficulty = getSelectedDifficulty()) {
    const progress = currentDifficultyEventProgress(chapter, difficulty);
    const missingBranch = progress.find((row) => row.choices.length && row.unseenChoices.length);
    if (missingBranch) {
      return { kind: "branch", chapter, difficulty, event: missingBranch.event, unseenChoices: missingBranch.unseenChoices, seenCount: missingBranch.seenChoices.length, totalCount: missingBranch.choices.length };
    }
    const missingEncounter = progress.find((row) => !row.record.count && !row.event.hidden);
    if (missingEncounter) return { kind: "event", chapter, difficulty, event: missingEncounter.event };
    const missingSecret = progress.find((row) => row.unseenSecretRoutes.length);
    if (missingSecret) {
      return { kind: "secret", chapter, difficulty, event: missingSecret.event, unseenRoutes: missingSecret.unseenSecretRoutes, seenCount: missingSecret.seenRoutes.length, totalCount: missingSecret.routeTargets.length };
    }
    const missingFollowup = progress.find((row) => row.unseenChainRoutes.length);
    if (missingFollowup) {
      return { kind: "followup", chapter, difficulty, event: missingFollowup.event, unseenRoutes: missingFollowup.unseenChainRoutes, seenCount: missingFollowup.seenRoutes.length, totalCount: missingFollowup.routeTargets.length };
    }
    return null;
  }

  function bossSkillShapeLabel(skill) {
    const map = { circle: "范围预警", line: "直线预警", cone: "扇形预警", pool: "持续地面", pull: "牵引控场", ring: "环形封锁", summon: "召唤压制" };
    return map[skill.shape] || "机制";
  }

  function bossSkillPhaseLabel(skill) {
    if (!skill.phase) return "开场";
    if (skill.phase === 1) return "70% 后";
    if (skill.phase === 2) return "35% 后";
    return `${skill.phase} 阶`;
  }

  function bossSkillSummary(skill, difficulty = getSelectedDifficulty()) {
    const effective = effectiveBossSkillConfig(skill, difficulty);
    const parts = [
      bossSkillShapeLabel(effective),
      bossSkillPhaseLabel(effective),
      effective.telegraph ? `预警 ${effective.telegraph.toFixed(2)}s` : "",
      effective.count && effective.count !== skill.count ? `数量 ${effective.count}` : "",
      effective.duration ? `留场 ${effective.duration.toFixed(1)}s` : "",
      effective.damage && effective.damage !== skill.damage ? `伤害 ${effective.damage}` : "",
      skill.followup ? "组合技" : "",
    ];
    return parts.filter(Boolean).join(" · ");
  }

  function matchingPresetNames(chapter) {
    const tags = chapterBuildContextTags(chapter);
    const directMatches = (metaConfig.loadoutPresets || [])
      .filter((preset) => (preset.recommendedChapters || []).includes(chapter.id))
      .map((preset) => preset.name);
    if (directMatches.length) return directMatches.slice(0, 3);
    return (metaConfig.loadoutPresets || [])
      .filter((preset) => tags.some((tag) => (preset.tags || []).includes(tag)))
      .map((preset) => preset.name)
      .slice(0, 3);
  }

  function bossRecordSummary(chapter) {
    const record = metaState.records.chapters?.[chapter.id];
    const cleared = record?.clearedDifficulties || [];
    const clearedNames = cleared.map((id) => mapById(metaConfig.difficulties)[id]?.name || id).join(" / ");
    return {
      cleared,
      clearedText: clearedNames || "尚未首通",
      bestTime: record?.bestTime || 0,
      bestKills: record?.bestKills || 0,
    };
  }

  function bossPhaseTimeline(chapter) {
    const phases = chapter.bossMechanics?.phaseTexts || [];
    if (!phases.length) return "血量阶段变化";
    return phases.map((text, index) => `${index === 0 ? "70%" : "35%"} ${text}`).join(" / ");
  }

  function comboRecordContext(record) {
    const chapter = mapById(metaConfig.chapters)[record?.bestChapter];
    const difficulty = mapById(metaConfig.difficulties)[record?.bestDifficulty];
    return [chapter?.name, difficulty?.name].filter(Boolean).join(" · ") || "尚无记录";
  }

  function renderComboCodex() {
    return `
      <section class="combo-codex">
        ${spellCombos
          .map((combo) => {
            const record = comboRecord(combo.id) || {};
            return `
              <article class="home-card combo-card">
                <div class="combo-card-head">
                  <div>
                    <h2>${combo.name}</h2>
                    <p>${combo.desc}</p>
                  </div>
                  <span>${record.bestCount ? "已见招" : "待验证"}</span>
                </div>
                <div class="combo-recipe">
                  ${combo.recipe.map((name) => `<b>${name}</b>`).join("<i>+</i>")}
                </div>
                <div class="combo-record">
                  <span><b>${record.bestCount || 0}</b>最佳触发</span>
                  <span><b>${record.lastCount || 0}</b>上次触发</span>
                  <span><b>${record.runs || 0}</b>成型局数</span>
                </div>
                <small>${record.bestCount ? comboRecordContext(record) : combo.unlockText}</small>
              </article>
            `;
          })
          .join("")}
      </section>
    `;
  }

  function difficultySummary(chapter, difficulty) {
    const pacing = theme.balance?.difficultyPacing?.[difficulty?.id] || {};
    const bossAt = bossAtForChapterConfig(chapter, difficulty);
    const hpMultiplier = pacing.bossHpMultiplier || 1;
    const mods = bossSkillModsForDifficulty(difficulty);
    const mechanics = [
      mods.cooldown && mods.cooldown !== 1 ? `技能冷却 x${mods.cooldown.toFixed(2)}` : "",
      mods.telegraph && mods.telegraph !== 1 ? `预警 x${mods.telegraph.toFixed(2)}` : "",
      mods.countBonus ? `技能数量 +${mods.countBonus}` : "",
    ].filter(Boolean);
    return `${difficulty.desc || ""} Boss ${bossAt}s 出场 / 血量 x${hpMultiplier.toFixed(2)} / 奖励 x${(difficulty.rewardMultiplier || 1).toFixed(1)}${mechanics.length ? ` / ${mechanics.join(" / ")}` : ""}`;
  }

  function bossAtForChapterConfig(chapter, difficulty) {
    const target = theme.balance?.bossTargets?.chapterBossAt?.[chapter?.id] ?? chapter?.bossAt;
    const multiplier = theme.balance?.difficultyPacing?.[difficulty?.id]?.bossAtMultiplier || 1;
    return typeof target === "number" ? Math.round(target * multiplier) : target || 0;
  }

  function renderBossGuide(chapter, difficulty) {
    const mechanics = chapter.bossMechanics || {};
    const presetNames = matchingPresetNames(chapter);
    return `
      <div class="boss-guide">
        <div class="boss-guide-head">
          <strong>${chapter.bossName}</strong>
          <span>${mechanics.subtitle || "章节 Boss"}</span>
        </div>
        <div class="boss-skill-list">
          ${(mechanics.skills || [])
            .map((skill) => `
              <span class="boss-skill">
                <b>${skill.name}</b>
                <small>${bossSkillSummary(skill, difficulty)}</small>
              </span>
            `)
            .join("")}
        </div>
        <div class="boss-guide-foot">
          <span>阶段：${(mechanics.phaseTexts || []).join(" / ") || "血量阶段变化"}</span>
          <span>推荐：${chapterBuildContextTags(chapter).map(styleTagToken).join("")}${presetNames.length ? ` ${presetNames.join(" / ")}` : ""}</span>
          <span>难度：${difficultySummary(chapter, difficulty)}</span>
        </div>
      </div>
    `;
  }

  function renderChapterReadiness(chapter, difficulty, locked = false) {
    if (locked) return "";
    const readiness = chapterReadinessReport(buildPreviewState(), chapter, difficulty);
    const weak = readiness.rows.filter((row) => row.state === "偏弱");
    const detail = weak.length ? `短板：${weak.map((row) => row.key).join(" / ")}` : readiness.summary;
    return `
      <div class="chapter-readiness ${readiness.tier === "稳压" ? "ready" : readiness.tier === "偏险" ? "risky" : ""}">
        <span><b>${readiness.tier}</b>当前构筑</span>
        <em>战备 ${readiness.power.total} / 需求 ${readiness.expected}</em>
        <small>${detail}</small>
      </div>
    `;
  }

  function renderBestiaryPatchAction(chapter, difficulty, locked = false) {
    if (locked) return "";
    const patchPlan = weaknessPatchPlan(chapter, difficulty);
    if (!patchPlan.available || patchPlan.applied) return "";
    return `
      <div class="readiness-action bestiary-patch-action">
        <span>${patchPlan.reason}：${patchPlan.names.slice(0, 3).join(" / ")}</span>
        <button data-action="patch-bestiary-build" data-id="${chapter.id}" data-difficulty="${difficulty.id}" type="button">补短板</button>
      </div>
    `;
  }

  function renderChapterMaterialTarget(chapter, difficulty, selected = false) {
    if (!selected || !homeState.targetMaterial) return "";
    const amount = chapterDropEstimate(chapter, difficulty)[homeState.targetMaterial] || 0;
    if (amount <= 0) return "";
    const unlocking = homeState.targetMaterialMode === "unlock";
    return `
      <div class="chapter-material-target ${unlocking ? "unlocking" : ""}">
        <span>${unlocking ? "解锁" : "刷"}${currencyName(homeState.targetMaterial)}路线</span>
        <b>${difficulty?.name || "当前难度"}预计 ${currencyToken(homeState.targetMaterial, amount, "material-token route-token")}</b>
        ${unlocking ? `<small>完成这里后再回材料页刷目标路线</small>` : ""}
      </div>
    `;
  }

  function setSelectedChapterForBuild(chapterId) {
    if (!chapterId || !metaState) return;
    metaState.selected.chapterId = chapterId;
    const allowed = metaState.unlocks.difficulties[chapterId] || ["mortal"];
    if (!allowed.includes(metaState.selected.difficultyId)) metaState.selected.difficultyId = allowed[0] || "mortal";
  }

  function runChapterGoal() {
    if (!game.chapter || !game.difficulty) return null;
    const record = metaState?.records?.chapters?.[game.chapter.id];
    const cleared = record?.clearedDifficulties?.includes(game.difficulty.id);
    if (cleared) return null;
    return {
      title: `${game.chapter.name} ${game.difficulty.name}`,
      text: game.runStats?.bossKilled ? `${game.chapter.bossName} 已镇压` : `镇压 ${game.chapter.bossName}`,
      complete: Boolean(game.runStats?.bossKilled),
    };
  }

  function runComboGoal() {
    const readyCombos = comboPreviewRows().filter((combo) => combo.ready);
    if (!readyCombos.length) return null;
    const triggered = readyCombos
      .map((combo) => ({ ...combo, count: game.runStats?.combos?.[combo.id] || 0 }))
      .sort((a, b) => b.count - a.count);
    const best = triggered[0];
    const complete = best.count >= 1;
    return {
      id: best.id,
      title: best.name,
      complete,
      progress: complete ? 100 : 0,
      text: complete ? `${best.name} 已触发 ${best.count} 次` : `${readyCombos.map((combo) => combo.name).join(" / ")} 待触发`,
    };
  }

  function updateComboRecordsAfterRun() {
    if (!metaState?.records || !game.runStats?.combos) return;
    if (!metaState.records.combos) metaState.records.combos = {};
    for (const combo of spellCombos) {
      const count = game.runStats.combos[combo.id] || 0;
      if (count <= 0) continue;
      const existing = metaState.records.combos[combo.id] || {};
      metaState.records.combos[combo.id] = {
        bestCount: Math.max(existing.bestCount || 0, count),
        lastCount: count,
        runs: (existing.runs || 0) + 1,
        bestChapter: count > (existing.bestCount || 0) ? game.chapter?.id || existing.bestChapter || "" : existing.bestChapter || "",
        bestDifficulty: count > (existing.bestCount || 0) ? game.difficulty?.id || existing.bestDifficulty || "" : existing.bestDifficulty || "",
      };
    }
  }

  function equipmentSummaryText() {
    const equipped = Object.entries(game.equipment || {})
      .filter(([, state]) => state.tier > 0)
      .map(([slot, state]) => `${theme.equipmentSlots?.[slot]?.name || slot}${state.tier}`);
    const blessingCount = activeRunBlessingRows().length;
    const base = equipped.length ? equipped.join(" / ") : "未着法器";
    return blessingCount ? `${base} · 奇遇加持 ${blessingCount}` : base;
  }

  return {
    firstClearSummary,
    selectedCultivationSpell,
    upgradeSpellKey,
    chooseUpgrades,
    openUpgradePanel,
    addCurrencies,
    hasCurrency,
    spendCurrency,
    selectedBuildNameSummary,
    chapterDropEstimate,
    chapterDropSummary,
    materialChapters,
    recommendChapterForMaterial,
    materialFarmRoute,
    materialPreviewDifficulty,
    renderMaterialDifficultyPreview,
    missingCost,
    primaryMissingMaterial,
    renderCostHint,
    ensureChapterRecord,
    unlockProgressAfterRun,
    formatTime,
    upgradeCost,
    effectLabel,
    formatEffectValue,
    effectSummary,
    nextMilestoneBenefit,
    nextMilestoneCostPlan,
    rushMilestone,
    milestoneSummary,
    selectedArtifact,
    selectedCultivation,
    selectedTalents,
    collectBuildTags,
    styleTagToken,
    activeBuildSynergies,
    chapterBuildRecommendation,
    applyChapterBuildRecommendation,
    weaknessPatchPlan,
    applyWeaknessPatchPlan,
    chapterReadinessReport,
    buildPreviewState,
    buildPreviewRows,
    comboPreviewRows,
    comboRecordContext,
    applyComboPlan,
    renderComboPreview,
    renderBuildSynergyPanel,
    presetAvailability,
    chapterRewardMultiplierText,
    chapterRewardHighlights,
    chapterBuildContextTags,
    renderRunEventPreview,
    renderBestiaryRewardHighlights,
    chapterClearCount,
    difficultyProgressCount,
    totalDifficultyCount,
    nextChapterGoal,
    nextQuestGoal,
    nextUpgradeGoal,
    nextEventProgressGoal,
    bossSkillSummary,
    matchingPresetNames,
    bossRecordSummary,
    bossPhaseTimeline,
    renderComboCodex,
    renderBossGuide,
    renderChapterReadiness,
    renderBestiaryPatchAction,
    renderChapterMaterialTarget,
    setSelectedChapterForBuild,
    runChapterGoal,
    runComboGoal,
    updateComboRecordsAfterRun,
    equipmentSummaryText,
  };
}
