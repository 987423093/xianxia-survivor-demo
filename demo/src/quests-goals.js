/**
 * 创建悬赏与目标模块。
 * 入参：运行时状态、界面节点、洞府状态以及章节/构筑/奇遇分析依赖。
 * 出参：悬赏进度、局内目标、历练建议、结果页下一步和相关渲染方法。
 * 作用：把悬赏、目标提示、局后建议和历练路线从入口文件中拆出，统一维护目标链路。
 */
export function createQuestsGoals({
  game,
  ui,
  theme,
  homeState,
  metaConfig,
  getMetaState,
  clamp,
  formatTime,
  realmLabel,
  mapById,
  unique,
  currencyName,
  currencyToken,
  formatCost,
  formatCostTokens,
  isUnlocked,
  unlockConditionText,
  firstClearSummary,
  recommendChapterForMaterial,
  nextChapterGoal,
  nextQuestGoal,
  nextUpgradeGoal,
  nextEventProgressGoal,
  chapterClearCount,
  totalDifficultyCount,
  difficultyProgressCount,
  chapterReadinessReport,
  weaknessPatchPlan,
  comboPreviewRows,
  comboRecordContext,
  buildPreviewState,
  resolveEventChoices,
  eventFollowupTargets,
  hasSeenRunEvent,
  eventFollowupHintText,
  getRunEventConfig,
  getSelectedDifficulty,
  getSelectedChapter,
  challengeRewardSummary,
  chapterDropEstimate,
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

  function formatChancePercent(chance = 0) {
    return `${Math.round(clamp(chance, 0, 1) * 100)}%`;
  }

  function comboNextMilestone(bestCount = 0) {
    return [1, 3, 5, 8, 12].find((target) => bestCount < target) || bestCount + 5;
  }

  function questChapterName(quest) {
    return mapById(metaConfig.chapters)[quest.chapterId]?.name || quest.chapterId || "";
  }

  function questDifficultyName(quest) {
    return mapById(metaConfig.difficulties)[quest.difficultyId]?.name || quest.difficultyId || "";
  }

  function comboQuestProgressValue(quest, records = metaState.records) {
    const combos = records?.combos || {};
    const rows = quest.comboId ? [combos[quest.comboId]] : Object.values(combos);
    if (quest.type === "comboSeen") return rows.some((record) => (record?.bestCount || 0) > 0) ? 1 : 0;
    if (quest.type === "comboBest") return Math.max(0, ...rows.map((record) => record?.bestCount || 0));
    return 0;
  }

  function currentRunComboQuestValue(quest) {
    const rows = quest.comboId ? [game.runStats?.combos?.[quest.comboId] || 0] : Object.values(game.runStats?.combos || {});
    if (quest.type === "comboSeen") return rows.some((count) => count > 0) ? 1 : 0;
    if (quest.type === "comboBest") return Math.max(0, ...rows);
    return 0;
  }

  function questProgress(quest) {
    const records = metaState.records || {};
    if (quest.type === "runs") return { value: records.runs || 0, target: quest.target || 1 };
    if (quest.type === "totalKills") return { value: records.totalKills || 0, target: quest.target || 1 };
    if (quest.type === "highestRealmLevel") return { value: records.highestRealmLevel || 1, target: quest.target || 1 };
    if (quest.type === "comboSeen" || quest.type === "comboBest") return { value: comboQuestProgressValue(quest, records), target: quest.target || 1 };
    if (quest.type === "chapterClear") {
      const chapterRecord = records.chapters?.[quest.chapterId];
      const cleared = chapterRecord?.clearedDifficulties?.includes(quest.difficultyId || "mortal");
      return { value: cleared ? 1 : 0, target: 1 };
    }
    return { value: 0, target: quest.target || 1 };
  }

  function runQuestProgress(quest) {
    const base = questProgress(quest);
    if (quest.type === "runs") return { ...base, value: Math.max(base.value, (metaState.records?.runs || 0) + 1) };
    if (quest.type === "totalKills") return { ...base, value: Math.max(base.value, (metaState.records?.totalKills || 0) + game.killCount) };
    if (quest.type === "highestRealmLevel") return { ...base, value: Math.max(base.value, game.player?.level || 1) };
    if (quest.type === "comboSeen" || quest.type === "comboBest") return { ...base, value: Math.max(base.value, currentRunComboQuestValue(quest)) };
    if (quest.type === "chapterClear" && quest.chapterId === game.chapter?.id && quest.difficultyId === game.difficulty?.id) {
      return { ...base, value: game.runStats?.bossKilled ? 1 : base.value };
    }
    return base;
  }

  function questProgressText(quest, progress) {
    if (quest.type === "highestRealmLevel") return `${realmLabel(progress.value)} / ${realmLabel(progress.target)}`;
    if (quest.type === "comboSeen") return progress.value >= progress.target ? "已悟得合术" : "尚未触发组合";
    if (quest.type === "comboBest") return `最佳 ${Math.min(progress.value, progress.target)} / ${progress.target} 次`;
    if (quest.type === "chapterClear") {
      return progress.value >= progress.target
        ? "已镇压"
        : `${questChapterName(quest)} ${questDifficultyName(quest)} 未首通`;
    }
    return `${Math.min(progress.value, progress.target)} / ${progress.target}`;
  }

  function questState(quest) {
    const progress = questProgress(quest);
    const claimed = (metaState.records.claimedQuests || []).includes(quest.id);
    const complete = progress.value >= progress.target;
    return { progress, claimed, complete, claimable: complete && !claimed };
  }

  function runQuestState(quest) {
    const progress = runQuestProgress(quest);
    const claimed = (metaState.records.claimedQuests || []).includes(quest.id);
    const complete = progress.value >= progress.target;
    return { progress, claimed, complete, claimable: complete && !claimed };
  }

  function questProgressPercent(progress) {
    return clamp((progress.value / Math.max(1, progress.target)) * 100, 0, 100);
  }

  function claimableQuestCount() {
    return (metaConfig.quests || []).filter((quest) => questState(quest).claimable).length;
  }

  function claimableQuestRows(limit = 3) {
    return (metaConfig.quests || [])
      .map((quest) => ({ quest, state: questState(quest) }))
      .filter(({ state }) => state.claimable)
      .slice(0, limit);
  }

  function renderQuestCompletionSummary() {
    const rows = claimableQuestRows();
    if (!rows.length) return "";
    return `
      <div class="quest-complete-summary">
        <strong>悬赏可领取</strong>
        ${rows
          .map(({ quest }) => `<span><b>${quest.name}</b><small>${formatCostTokens(quest.rewards, "material-token reward-token")}</small></span>`)
          .join("")}
      </div>
    `;
  }

  function journeyRecommendationRows() {
    const rows = [];
    const claimable = claimableQuestRows(1)[0];
    if (claimable) {
      rows.push({
        label: "先领奖励",
        title: claimable.quest.name,
        body: `悬赏已完成，领取后获得 ${formatCost(claimable.quest.rewards)}。`,
        action: "打开悬赏",
        tab: "quests",
      });
    }

    const chapter = nextChapterGoal();
    if (chapter) {
      const locked = !isUnlocked("chapters", chapter.id);
      rows.push({
        label: locked ? "解锁路线" : "下一章",
        title: chapter.name,
        body: locked ? `需要先完成：${unlockConditionText(chapter.unlock)}。` : `目标：${chapter.bossName} 首通，奖励 ${firstClearSummary(chapter)}。`,
        action: "查看章节",
        tab: "chapters",
      });
    }

    const upgrade = nextUpgradeGoal();
    if (upgrade) {
      const missingEntries = Object.entries(upgrade.missing);
      rows.push({
        label: missingEntries.length ? "补材料" : "可升级",
        title: `${upgrade.kind} · ${upgrade.name}`,
        body: missingEntries.length
          ? `缺 ${formatCost(upgrade.missing)}，${unique(missingEntries.map(([key]) => recommendChapterForMaterial(key)).filter(Boolean)).join(" / ") || "继续刷当前章节"}。`
          : `材料已够，建议升到 Lv.${upgrade.level + 1}。`,
        action: missingEntries.length ? "看材料" : `看${upgrade.kind}`,
        tab: missingEntries.length ? "materials" : upgrade.kind === "天赋" ? "talents" : upgrade.kind === "法宝" ? "artifacts" : upgrade.kind === "功法" ? "cultivation" : "facilities",
        focusMaterials: missingEntries.map(([key]) => key),
      });
    }

    const eventGoal = nextEventProgressGoal();
    if (eventGoal) {
      if (eventGoal.kind === "branch") {
        rows.push({
          label: "补奇遇分支",
          title: `${eventGoal.event.label} ${eventGoal.seenCount}/${eventGoal.totalCount}`,
          body: `${eventGoal.chapter.name} · ${eventGoal.difficulty.name} 还有未见走法：${eventGoal.unseenChoices.map((choice) => choice.label).join(" / ")}。`,
          action: "看路线",
          tab: "journey",
        });
      } else if (eventGoal.kind === "event") {
        rows.push({
          label: "补奇遇图鉴",
          title: eventGoal.event.label,
          body: `${eventGoal.chapter.name} · ${eventGoal.difficulty.name} 仍未遭遇，下一局可优先补齐本章奇遇记录。`,
          action: "看图鉴",
          tab: "journey",
        });
      } else if (eventGoal.kind === "followup") {
        rows.push({
          label: "补连锁奇遇",
          title: `${eventGoal.event.label} ${eventGoal.seenCount}/${eventGoal.totalCount}`,
          body: `${eventGoal.chapter.name} 还有未触发连锁：${eventGoal.unseenRoutes.map((target) => target.routeLabel).join(" / ")}。`,
          action: "看路线",
          tab: "journey",
        });
      } else if (eventGoal.kind === "secret") {
        rows.push({
          label: "补隐秘奇遇",
          title: `${eventGoal.event.label} ${eventGoal.seenCount}/${eventGoal.totalCount}`,
          body: `${eventGoal.chapter.name} 还有未触发秘径：${eventGoal.unseenRoutes.map((target) => `${target.routeLabel}${target.chance ? ` ${formatChancePercent(target.chance)}` : ""}`).join(" / ")}。`,
          action: "看路线",
          tab: "journey",
        });
      }
    }

    const questGoal = nextQuestGoal();
    if (questGoal && !claimable) {
      rows.push({
        label: "悬赏目标",
        title: questGoal.quest.name,
        body: questProgressText(questGoal.quest, questGoal.state.progress),
        action: "打开悬赏",
        tab: "quests",
      });
    }

    return rows.slice(0, 4);
  }

  function materialResultRecommendation() {
    if (!homeState.targetMaterial || !game.runStats?.rewards) return null;
    const materialName = currencyName(homeState.targetMaterial);
    const gained = game.runStats.rewards[homeState.targetMaterial] || 0;
    const unlocking = homeState.targetMaterialMode === "unlock";
    return {
      label: unlocking ? "路线解锁" : "材料路线",
      title: unlocking ? `${game.chapter?.name || "当前章节"}已推进` : `${materialName}路线`,
      body: gained > 0
        ? `本局获得 ${materialName} ${gained}，可回材料页继续比较收益路线。`
        : unlocking
          ? `回材料页继续查看${materialName}路线，确认下一步可刷章节。`
          : `本局未获得${materialName}，回材料页切换路线或难度。`,
      action: "回材料页",
      tab: "materials",
      focusMaterials: [homeState.targetMaterial],
      previewDifficulty: homeState.targetMaterialDifficulty || game.difficulty?.id || "",
    };
  }

  function resultRecommendationRows() {
    const rows = [];
    const materialRoute = materialResultRecommendation();
    if (materialRoute) rows.push(materialRoute);
    const unlocks = game.runStats?.unlocks || [];
    if (unlocks.length) {
      rows.push({
        label: game.runStats?.bossKilled ? "首通收获" : "新进展",
        title: unlocks[0],
        body: unlocks.slice(1, 4).join(" / ") || "新内容已加入洞府，可调整章节、构筑或继续修炼。",
        action: "查看章节",
        tab: "chapters",
      });
    }
    if (claimableQuestCount() > 0) {
      const claimable = claimableQuestRows(1)[0];
      rows.push({
        label: "可领奖励",
        title: `${claimableQuestCount()} 个悬赏可领取`,
        body: claimable ? `${claimable.quest.name}：${formatCost(claimable.quest.rewards)}` : "领取后可继续升级战力。",
        action: "打开悬赏",
        tab: "quests",
      });
    }
    if (!game.runStats?.bossKilled && game.chapter) {
      const readiness = chapterReadinessReport();
      const weak = readiness.rows.filter((row) => row.state === "偏弱");
      const patch = weaknessPatchPlan();
      rows.push({
        label: "战备复盘",
        title: `${game.chapter.bossName} 尚未镇压`,
        body: weak.length ? `短板：${weak.map((row) => `${row.key}${row.value}/${row.need}`).join(" / ")}，${readiness.summary}。` : `当前 ${readiness.tier}，建议按本章策令重整构筑。`,
        action: patch.available && !patch.applied ? "补短板并调构筑" : "调构筑",
        tab: "start",
        postAction: patch.available && !patch.applied ? "applyWeaknessPatch" : "",
      });
    }
    const existingTabs = new Set(rows.map((row) => `${row.label}:${row.tab}`));
    for (const row of journeyRecommendationRows()) {
      const key = `${row.label}:${row.tab}`;
      if (existingTabs.has(key)) continue;
      rows.push(row);
      existingTabs.add(key);
      if (rows.length >= 4) break;
    }
    return rows.slice(0, 4);
  }

  function comboJourneyRows() {
    const preview = buildPreviewState();
    return comboPreviewRows(preview).map((combo) => {
      const record = combo.record || {};
      const nextTarget = comboNextMilestone(record.bestCount || 0);
      const remaining = Math.max(0, nextTarget - (record.bestCount || 0));
      const missingText = combo.ready
        ? "本局构筑已成型"
        : combo.missing.length
          ? `缺 ${combo.missing.join(" / ")}`
          : combo.plan.missing.length
            ? `待解锁 ${combo.plan.missing.join(" / ")}`
            : "可套用组合";
      return {
        ...combo,
        nextTarget,
        remaining,
        missingText,
        routeLabel: record.bestCount ? "冲刺新档" : "首次见招",
        context: record.bestCount ? comboRecordContext(record) : combo.unlockText,
      };
    });
  }

  function renderComboJourneyPanel() {
    const rows = comboJourneyRows();
    return `
      <section class="home-card combo-route">
        <div class="build-preview-head">
          <h2>合术路线</h2>
          <small>${rows.filter((row) => row.record.bestCount).length}/${rows.length} 已见招</small>
        </div>
        <div class="combo-route-grid">
          ${rows
            .map((combo) => `
              <article class="${combo.ready ? "ready" : ""}">
                <div class="combo-route-head">
                  <span>${combo.routeLabel}</span>
                  <strong>${combo.name}</strong>
                </div>
                <p>${combo.desc}</p>
                <div class="combo-route-record">
                  <span><b>${combo.record.bestCount || 0}</b>最佳</span>
                  <span><b>${combo.record.lastCount || 0}</b>上局</span>
                  <span><b>${combo.record.runs || 0}</b>成型</span>
                  <span><b>${combo.nextTarget}</b>目标</span>
                </div>
                <small>${combo.missingText} · ${combo.context}</small>
                <div class="combo-route-actions">
                  <button data-action="apply-combo" data-id="${combo.id}" ${combo.plan.usable ? "" : "disabled"}>${combo.ready ? "重套组合" : "套用组合"}</button>
                  <button data-action="open-tab" data-tab="bestiary" type="button">看图鉴</button>
                  <button data-action="open-tab" data-tab="quests" type="button">做悬赏</button>
                </div>
              </article>
            `)
            .join("")}
        </div>
      </section>
    `;
  }

  function eventCodexRows() {
    const eventRows = [];
    const difficulty = getSelectedDifficulty();
    for (const chapter of metaConfig.chapters || []) {
      for (const event of chapter.runEvents || []) {
        if (eventRows.some((row) => row.id === event.id)) continue;
        const record = metaState.records?.events?.[event.id] || {};
        if (event.hidden && !record.count) continue;
        const choices = resolveEventChoices(event, difficulty);
        const choiceLabels = choices.map((choice) => choice.label);
        const routeTargets = eventFollowupTargets(event, difficulty);
        const followups = routeTargets.map((target) => eventFollowupHintText(target)).filter(Boolean);
        const seenChoices = choices.filter((choice) => record.choices?.[choice.id]);
        const unseenChoices = choices.filter((choice) => !record.choices?.[choice.id]);
        const seenFollowups = routeTargets.filter((target) => record.followups?.[target.eventId]);
        eventRows.push({
          id: event.id,
          label: event.label,
          chapterId: chapter.id,
          chapterName: chapter.name,
          summary: event.summary || "",
          count: record.count || 0,
          choices: Object.values(record.choices || {}),
          blessings: Object.values(record.blessings || {}),
          followups: Object.values(record.followups || {}),
          choiceLabels,
          followupHints: followups,
          seenChoiceCount: seenChoices.length,
          choiceTotal: choices.length,
          unseenChoiceLabels: unseenChoices.map((choice) => choice.label),
          seenFollowupCount: seenFollowups.length,
          followupTotal: routeTargets.length,
          tags: event.tags || [],
        });
      }
    }
    return eventRows.sort((a, b) => b.count - a.count || a.chapterName.localeCompare(b.chapterName, "zh-CN"));
  }

  function chapterEventRouteRows() {
    return (metaConfig.chapters || []).map((chapter) => {
      const routes = [];
      let seen = 0;
      let total = 0;
      for (const event of chapter.runEvents || []) {
        if (event.hidden && !hasSeenRunEvent(event.id)) continue;
        const record = metaState.records?.events?.[event.id] || {};
        for (const target of eventFollowupTargets(event, getSelectedDifficulty())) {
          total += 1;
          if (record.followups?.[target.eventId]) seen += 1;
          routes.push(`${event.label} · ${eventFollowupHintText(target)}`);
        }
      }
      return {
        chapter,
        routes,
        seen,
        total,
        unlocked: isUnlocked("chapters", chapter.id),
      };
    });
  }

  function renderEventJourneyPanel() {
    const eventRows = eventCodexRows();
    const routeRows = chapterEventRouteRows();
    return `
      <section class="journey-grid event-journey-grid">
        <article class="home-card journey-card event-route-card">
          <div class="journey-card-head">
            <span>章节奇遇路线</span>
            <b>${routeRows.filter((row) => row.routes.length).length} 条连锁</b>
          </div>
          <div class="event-route-list">
            ${routeRows
              .map((row) => `
                <span class="${row.unlocked ? "" : "locked"}">
                  <b>${row.chapter.name}</b>
                  <small>${row.routes.length ? `已探 ${row.seen}/${row.total} · ${row.routes.join(" / ")}` : "当前章节暂无连锁奇遇"}</small>
                </span>
              `)
              .join("")}
          </div>
        </article>
        <article class="home-card journey-card event-codex-card">
          <div class="journey-card-head">
            <span>奇遇图鉴</span>
            <b>${eventRows.filter((row) => row.count > 0).length}/${eventRows.length} 已见</b>
          </div>
          <div class="event-codex-list">
            ${eventRows
              .map((row) => `
                <span class="${row.count > 0 ? "seen" : ""}">
                  <b>${row.label}${row.choiceTotal ? ` · 分支 ${row.seenChoiceCount}/${row.choiceTotal}` : ""}${row.followupTotal ? ` · 连锁 ${row.seenFollowupCount}/${row.followupTotal}` : ""}</b>
                  <small>${row.chapterName} · ${row.count ? `遭遇 ${row.count} 次` : "未遭遇"}${row.summary ? ` · ${row.summary}` : ""}</small>
                  <em>${row.choiceLabels.length ? `分支：${row.choiceLabels.join(" / ")}` : "固定收益"}${row.unseenChoiceLabels.length ? ` · 未见：${row.unseenChoiceLabels.join(" / ")}` : ""}${row.followupHints.length ? ` · 连锁：${row.followupHints.join(" / ")}` : ""}${row.blessings.length ? ` · 加持：${row.blessings.map((item) => item.label).join(" / ")}` : ""}</em>
                </span>
              `)
              .join("")}
          </div>
        </article>
      </section>
    `;
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

  function activeRunQuestRows(limit = 2) {
    return (metaConfig.quests || [])
      .map((quest) => ({ quest, state: runQuestState(quest) }))
      .filter(({ state }) => !state.claimed)
      .sort((a, b) => {
        const aDone = a.state.complete ? 0 : 1;
        const bDone = b.state.complete ? 0 : 1;
        return aDone - bDone || questProgressPercent(b.state.progress) - questProgressPercent(a.state.progress);
      })
      .slice(0, limit);
  }

  function runComboGoal() {
    const readyCombos = comboPreviewRows().filter((combo) => combo.ready);
    if (!readyCombos.length) return null;
    const triggered = readyCombos
      .map((combo) => ({ ...combo, count: game.runStats?.combos?.[combo.id] || 0 }))
      .sort((a, b) => b.count - a.count);
    const best = triggered[0];
    const target = 1;
    const complete = best.count >= target;
    return {
      id: best.id,
      title: best.name,
      complete,
      progress: complete ? 100 : 0,
      text: complete ? `${best.name} 已触发 ${best.count} 次` : `${readyCombos.map((combo) => combo.name).join(" / ")} 待触发`,
    };
  }

  function runMaterialGoal() {
    if (!homeState.targetMaterial || !game.chapter || !game.difficulty) return null;
    const amount = chapterDropEstimate(game.chapter, game.difficulty)[homeState.targetMaterial] || 0;
    const unlocking = homeState.targetMaterialMode === "unlock";
    const complete = unlocking ? Boolean(game.runStats?.bossKilled) : amount > 0 && Boolean(game.runStats?.bossKilled);
    return {
      label: unlocking ? "解锁路线" : "材料路线",
      complete,
      progress: complete ? 100 : game.runStats?.bossKilled ? 100 : 0,
      text: unlocking
        ? `${game.chapter.name}${game.difficulty.name}首通后回材料页刷${currencyName(homeState.targetMaterial)}`
        : `镇压 ${game.chapter.bossName} 后预计 ${currencyName(homeState.targetMaterial)} ${amount}`,
    };
  }

  function runEventChallengeGoal() {
    const challenge = game.activeEventChallenge;
    if (!challenge || challenge.resolved) return null;
    const remaining = Math.max(0, challenge.endsAt - game.time);
    return {
      label: "限时试炼",
      complete: challenge.defeated >= challenge.targetCount,
      progress: clamp((challenge.defeated / Math.max(1, challenge.targetCount)) * 100, 0, 100),
      text: `${challenge.label} ${challenge.defeated}/${challenge.targetCount} · 余 ${remaining.toFixed(1)}s${challengeRewardSummary(challenge) ? ` · ${challengeRewardSummary(challenge)}` : ""}`,
    };
  }

  function renderRunGoals() {
    if (!ui.runGoals || !metaConfig || !metaState) return;
    if (!game.goalTrackingActive || game.state !== "playing") {
      ui.runGoals.classList.add("hidden");
      ui.runGoals.innerHTML = "";
      return;
    }
    const chapterGoal = runChapterGoal();
    const comboGoal = runComboGoal();
    const materialGoal = runMaterialGoal();
    const eventChallengeGoal = runEventChallengeGoal();
    const questRows = activeRunQuestRows(chapterGoal || comboGoal || materialGoal || eventChallengeGoal ? 1 : 2);
    if (!chapterGoal && !comboGoal && !materialGoal && !eventChallengeGoal && !questRows.length) {
      ui.runGoals.classList.add("hidden");
      ui.runGoals.innerHTML = "";
      return;
    }
    const rows = [];
    if (eventChallengeGoal) {
      rows.push(`
        <span class="${eventChallengeGoal.complete ? "complete" : ""}">
          <b>${eventChallengeGoal.label}</b>
          <em>${eventChallengeGoal.text}</em>
          <i style="--goal-progress:${eventChallengeGoal.progress}%"></i>
        </span>
      `);
    }
    if (materialGoal) {
      rows.push(`
        <span class="${materialGoal.complete ? "complete" : ""}">
          <b>${materialGoal.label}</b>
          <em>${materialGoal.text}</em>
          <i style="--goal-progress:${materialGoal.progress}%"></i>
        </span>
      `);
    }
    if (chapterGoal) {
      rows.push(`
        <span class="${chapterGoal.complete ? "complete" : ""}">
          <b>首通</b>
          <em>${chapterGoal.text}</em>
          <i style="--goal-progress:${chapterGoal.complete ? 100 : 0}%"></i>
        </span>
      `);
    }
    if (comboGoal) {
      rows.push(`
        <span class="${comboGoal.complete ? "complete" : ""}">
          <b>合术</b>
          <em>${comboGoal.text}</em>
          <i style="--goal-progress:${comboGoal.progress}%"></i>
        </span>
      `);
    }
    for (const { quest, state } of questRows) {
      rows.push(`
        <span class="${state.complete ? "complete" : ""}">
          <b>悬赏</b>
          <em>${quest.name} · ${questProgressText(quest, state.progress)}</em>
          <i style="--goal-progress:${questProgressPercent(state.progress)}%"></i>
        </span>
      `);
    }
    ui.runGoals.classList.remove("hidden");
    ui.runGoals.innerHTML = `<strong>本局目标</strong>${rows.join("")}`;
  }

  function clearGoalToastTimer() {
    if (!game.goalToastTimer) return;
    clearTimeout(game.goalToastTimer);
    game.goalToastTimer = null;
  }

  function scheduleNextGoalToast() {
    clearGoalToastTimer();
    game.goalToastTimer = setTimeout(() => {
      game.goalToastTimer = null;
      game.goalToast = null;
      if (game.state !== "playing" || !game.goalTrackingActive) {
        renderGoalToast();
        return;
      }
      playNextGoalToast();
    }, game.goalToast?.life || 2200);
  }

  function playNextGoalToast() {
    if (game.goalToast || !game.goalToastQueue.length) {
      renderGoalToast();
      return;
    }
    game.goalToast = game.goalToastQueue.shift();
    game.goalToast.startedAt = Date.now();
    renderGoalToast();
    scheduleNextGoalToast();
  }

  function pushGoalNotice(key, title, detail) {
    if (!game.runStats.goalNotices) game.runStats.goalNotices = [];
    if (game.runStats.goalNotices.includes(key)) return;
    game.runStats.goalNotices.push(key);
    game.goalToastQueue.push({ title, detail, startedAt: 0, life: 2200 });
    playNextGoalToast();
    addText(title, game.player.x, game.player.y - 118, "#9dffca");
    if (detail) addText(detail, game.player.x, game.player.y - 94, "#f4d778");
  }

  function updateRunGoalNotices() {
    if (!metaConfig || !metaState || game.state !== "playing" || !game.goalTrackingActive) return;
    const chapterGoal = runChapterGoal();
    if (chapterGoal?.complete) pushGoalNotice(`chapter:${game.chapter.id}:${game.difficulty.id}`, "首通目标完成", chapterGoal.title);
    const comboGoal = runComboGoal();
    if (comboGoal?.complete) pushGoalNotice(`combo:${comboGoal.id}`, "合术目标完成", comboGoal.title);
    for (const { quest, state } of activeRunQuestRows(3)) {
      if (state.complete) pushGoalNotice(`quest:${quest.id}`, "悬赏目标完成", quest.name);
    }
  }

  function renderGoalToast() {
    if (!ui.goalToast) return;
    if (!game.goalToast || game.state !== "playing") {
      ui.goalToast.classList.add("hidden");
      ui.goalToast.innerHTML = "";
      return;
    }
    ui.goalToast.classList.remove("hidden");
    ui.goalToast.innerHTML = `<strong>${game.goalToast.title}</strong>${game.goalToast.detail ? `<span>${game.goalToast.detail}</span>` : ""}`;
  }

  function renderResultNextSteps() {
    if (!ui.resultNextSteps || !metaConfig || !metaState) return;
    const rows = resultRecommendationRows().slice(0, 3);
    if (!rows.length) {
      ui.resultNextSteps.classList.add("hidden");
      ui.resultNextSteps.innerHTML = "";
      return;
    }
    ui.resultNextSteps.classList.remove("hidden");
    ui.resultNextSteps.innerHTML = `
      <strong>下一步</strong>
      <div>
        ${rows
          .map((row) => `
            <article data-tab="${row.tab}">
              <span>${row.label}</span>
              <b>${row.title}</b>
              <p>${row.body}</p>
              <button data-action="result-open-tab" data-tab="${row.tab}" data-post-action="${row.postAction || ""}" data-focus-materials="${(row.focusMaterials || []).join(",")}" data-preview-difficulty="${row.previewDifficulty || ""}" type="button">${row.action}</button>
            </article>
          `)
          .join("")}
      </div>
    `;
  }

  return {
    questProgress,
    questProgressText,
    questState,
    questProgressPercent,
    claimableQuestCount,
    claimableQuestRows,
    renderQuestCompletionSummary,
    journeyRecommendationRows,
    renderComboJourneyPanel,
    renderEventJourneyPanel,
    renderRunGoals,
    clearGoalToastTimer,
    updateRunGoalNotices,
    renderGoalToast,
    renderResultNextSteps,
    pushGoalNotice,
    resultRecommendationRows,
  };
}
