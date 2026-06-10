/**
 * 创建洞府页签渲染器。
 * 入参：上下文 getter，用于按需读取当前元进度、洞府状态和渲染辅助函数。
 * 出参：各洞府页签对应的 HTML 渲染方法。
 * 作用：把洞府内容渲染从主流程中拆开，保留按职责组织的界面模块。
 */
export function createHomeRenderers(getContext) {
  function selectedBuildSummary() {
    const ctx = getContext();
    const artifact = ctx.selectedArtifact();
    const cultivation = ctx.selectedCultivation();
    const talents = ctx.selectedTalents();
    const tagIds = ctx.collectBuildTags([artifact, cultivation, ...talents]);
    return `
      <div class="build-summary">
        <span>${artifact ? ctx.homeImage(artifact.icon, artifact.name, "summary-icon") : ""}<b>本命法宝</b>${artifact?.name || "未选择"} Lv.${ctx.metaState.progression.artifacts[artifact?.id] || 1}</span>
        <span><b>初始天赋</b>${talents.length ? talents.map((item) => item.name).join(" / ") : "未选择"}</span>
        <span>${cultivation ? ctx.homeImage(cultivation.icon, cultivation.name, "summary-icon") : ""}<b>起手功法</b>${cultivation?.name || "未选择"} Lv.${ctx.metaState.progression.cultivations[cultivation?.id] || 1}</span>
        <span class="build-tags"><b>流派</b>${tagIds.length ? tagIds.map(ctx.styleTagToken).join("") : "未成型"}</span>
      </div>
    `;
  }

  function materialNeedSummary(key) {
    const ctx = getContext();
    const needs = [];
    for (const tree of ctx.metaConfig.talentTrees || []) {
      const level = ctx.metaState.progression.talentTree[tree.id] || 0;
      if (level < tree.maxLevel && ctx.upgradeCost("talent", tree.id, level)[key]) needs.push(tree.name);
    }
    for (const artifact of ctx.metaConfig.artifacts || []) {
      const level = ctx.metaState.progression.artifacts[artifact.id] || 0;
      if (ctx.isUnlocked("artifacts", artifact.id) && level < artifact.maxLevel && ctx.upgradeCost("artifact", artifact.id, level)[key]) {
        needs.push(artifact.shortName || artifact.name);
      }
    }
    for (const cultivation of ctx.metaConfig.cultivations || []) {
      const level = ctx.metaState.progression.cultivations[cultivation.id] || 0;
      if (ctx.isUnlocked("cultivations", cultivation.id) && level < cultivation.maxLevel && ctx.upgradeCost("cultivation", cultivation.id, level)[key]) {
        needs.push(cultivation.name);
      }
    }
    for (const facility of ctx.metaConfig.facilities || []) {
      const level = ctx.metaState.progression.facilities[facility.id] || 0;
      if (level < facility.maxLevel && ctx.upgradeCost("facility", facility.id, level)[key]) needs.push(facility.name);
    }
    return ctx.unique(needs).slice(0, 4);
  }

  function materialNeedAmount(key) {
    const ctx = getContext();
    let amount = 0;
    for (const tree of ctx.metaConfig.talentTrees || []) {
      const level = ctx.metaState.progression.talentTree[tree.id] || 0;
      if (level < tree.maxLevel) amount += ctx.upgradeCost("talent", tree.id, level)[key] || 0;
    }
    for (const artifact of ctx.metaConfig.artifacts || []) {
      const level = ctx.metaState.progression.artifacts[artifact.id] || 0;
      if (ctx.isUnlocked("artifacts", artifact.id) && level < artifact.maxLevel) amount += ctx.upgradeCost("artifact", artifact.id, level)[key] || 0;
    }
    for (const cultivation of ctx.metaConfig.cultivations || []) {
      const level = ctx.metaState.progression.cultivations[cultivation.id] || 0;
      if (ctx.isUnlocked("cultivations", cultivation.id) && level < cultivation.maxLevel) amount += ctx.upgradeCost("cultivation", cultivation.id, level)[key] || 0;
    }
    for (const facility of ctx.metaConfig.facilities || []) {
      const level = ctx.metaState.progression.facilities[facility.id] || 0;
      if (level < facility.maxLevel) amount += ctx.upgradeCost("facility", facility.id, level)[key] || 0;
    }
    return amount;
  }

  function materialNeedAmountText(key, amount) {
    const ctx = getContext();
    if (amount <= 0) return `<span class="home-muted">暂无升级需求</span>`;
    const owned = Math.floor(ctx.metaState.currencies[key] || 0);
    const missing = Math.max(0, amount - owned);
    return `
      <span class="material-need-amount">
        <b>${ctx.uiActionIcon("upgrade", "总需", "hint-inline-icon")}<span>${ctx.currencyToken(key, amount, "material-token route-token")}</span></b>
        <small>${missing > 0 ? `${ctx.uiActionIcon("route", "缺口", "hint-inline-icon")}${ctx.currencyToken(key, missing, "material-token route-token")}` : "当前已覆盖近期升级"}</small>
      </span>
    `;
  }

  function renderBuildPlanner() {
    const ctx = getContext();
    const rows = ctx.buildPreviewRows();
    const selectedChapter = ctx.getSelectedChapter();
    const recommendation = ctx.chapterBuildRecommendation();
    const readiness = ctx.chapterReadinessReport();
    const patchPlan = ctx.weaknessPatchPlan();
    const talentMap = ctx.mapById(ctx.metaConfig.startingTalents);
    const presetCards = (ctx.metaConfig.loadoutPresets || [])
      .map((preset) => {
        const availability = ctx.presetAvailability(preset);
        const recommended = (preset.recommendedChapters || []).includes(selectedChapter?.id);
        return `
          <article class="preset-card ${availability.available ? "" : "partial"} ${recommended ? "recommended" : ""}">
            <div>
              <h3>${preset.name}</h3>
              <p>${preset.desc}</p>
              <div class="build-tags">${(preset.tags || []).map(ctx.styleTagToken).join("")}</div>
              <small>${availability.available ? `适合：${(preset.recommendedChapters || []).map((id) => ctx.mapById(ctx.metaConfig.chapters)[id]?.name || id).join(" / ") || "通用"}` : `可先套用已解锁项，缺少：${availability.missing.join(" / ")}`}</small>
            </div>
            <button data-action="apply-preset" data-id="${preset.id}" ${availability.usable ? "" : "disabled"}>${availability.available ? (recommended ? "本章推荐" : "套用") : "套用已解锁"}</button>
          </article>
        `;
      })
      .join("");
    return `
      <div class="build-planner">
        <section class="home-card chapter-build-card ${recommendation.applied ? "applied" : ""}">
          <div class="build-preview-head">
            <h2>本章策令</h2>
            <small>${recommendation.applied ? "已按本章配置" : "按章节和 Boss 机制推荐"}</small>
          </div>
          <div class="chapter-build-target">
            <span>${recommendation.artifact ? ctx.homeImage(recommendation.artifact.icon, recommendation.artifact.name, "summary-icon") : ""}<b>法宝</b>${recommendation.artifact?.name || "暂无"}</span>
            <span>${recommendation.cultivation ? ctx.homeImage(recommendation.cultivation.icon, recommendation.cultivation.name, "summary-icon") : ""}<b>功法</b>${recommendation.cultivation?.name || "暂无"}</span>
            <span><b>天赋</b>${recommendation.talentIds.map((id) => talentMap[id]?.name || id).join(" / ") || "暂无"}</span>
          </div>
          <div class="build-tags">${recommendation.tags.map(ctx.styleTagToken).join("")}</div>
          <div class="readiness-panel ${readiness.tier === "稳压" ? "ready" : readiness.tier === "偏险" ? "risky" : ""}">
            <div class="readiness-head">
              <strong>${readiness.tier}</strong>
              <span>战备 ${readiness.power.total} / 需求 ${readiness.expected}</span>
            </div>
            <div class="readiness-bars">
              ${readiness.rows
                .map((row) => `
                  <span class="${row.state === "充足" ? "ready" : row.state === "偏弱" ? "weak" : ""}" style="--readiness:${Math.round(ctx.clamp(row.ratio, 0, 1.3) * 100)}%">
                    <b>${row.key}</b>
                    <em>${row.value}/${row.need}</em>
                    <i>${row.state}</i>
                  </span>
                `)
                .join("")}
            </div>
            <small>${readiness.summary}</small>
            ${patchPlan.available && !patchPlan.applied ? `
              <div class="readiness-action">
                <span>${patchPlan.reason}：${patchPlan.names.slice(0, 3).join(" / ")}</span>
                <button data-action="apply-weakness-patch" type="button">补短板</button>
              </div>
            ` : ""}
          </div>
          <ul class="chapter-build-reasons">
            ${recommendation.reasons.map((reason) => `<li>${reason}</li>`).join("")}
          </ul>
          ${recommendation.missing.length ? `<small class="cost-hint">预设未全解锁：${recommendation.missing.join(" / ")}，已用可用组件替代。</small>` : ""}
          <button data-action="apply-chapter-recommendation" ${recommendation.applied ? "disabled" : ""}>${recommendation.applied ? "已套用" : "套用本章推荐"}</button>
        </section>
        <section class="home-card build-preview-card">
          <div class="build-preview-head">
            <h2>入局预览</h2>
            <small>${ctx.getSelectedChapter()?.name || "当前章节"} · ${ctx.getSelectedDifficulty()?.name || "当前难度"}</small>
          </div>
          <div class="preview-stats">
            ${rows.map(([label, value]) => `<span><b>${label}</b>${value}</span>`).join("")}
          </div>
          ${ctx.renderComboPreview()}
        </section>
        <section class="home-card preset-panel">
          <div class="build-preview-head">
            <h2>构筑预设</h2>
            <small>只会套用已解锁的法宝、功法和天赋槽。</small>
          </div>
          <div class="preset-grid">${presetCards}</div>
        </section>
      </div>
    `;
  }

  function renderChapterTab() {
    const ctx = getContext();
    return `${ctx.renderHomeBanner("chapters")}<div class="home-grid chapter-grid">${ctx.metaConfig.chapters
      .map((chapter) => {
        const locked = !ctx.isUnlocked("chapters", chapter.id);
        const selected = ctx.metaState.selected.chapterId === chapter.id;
        const record = ctx.metaState.records.chapters[chapter.id];
        const difficulty = selected ? ctx.getSelectedDifficulty() : ctx.metaConfig.difficulties[0];
        return `
          <article class="home-card chapter-card ${locked ? "locked" : ""} ${selected ? "selected" : ""}">
            ${ctx.homeImage(ctx.thumbnailAsset(chapter.background || chapter.fallbackBackground), chapter.name, "home-thumb", chapter.background || chapter.fallbackBackground)}
            <div class="home-card-body">
              <h2>${chapter.name}</h2>
              <p>${chapter.desc}</p>
              <small>Boss：${chapter.bossName} · 最佳 ${record?.bestKills || 0} 斩妖 / ${ctx.formatTime(record?.bestTime || 0)}</small>
            </div>
            <div class="chapter-rewards">
              <span>主要掉落</span>
              ${ctx.chapterRewardChipRows(chapter, difficulty)}
            </div>
            ${ctx.chapterRewardHighlights(chapter, difficulty, locked)}
            ${ctx.renderRunEventPreview(chapter, difficulty, locked)}
            ${ctx.renderChapterMaterialTarget(chapter, difficulty, selected)}
            ${ctx.renderBossGuide(chapter, difficulty)}
            ${ctx.renderChapterReadiness(chapter, difficulty, locked)}
            <small class="chapter-unlock">${locked ? `解锁：${ctx.unlockConditionText(chapter.unlock)}` : `首通：${ctx.firstClearSummary(chapter)}`}</small>
            <div class="difficulty-row">
              ${ctx.metaConfig.difficulties
                .map((difficulty) => `<button data-action="select-difficulty" data-chapter="${chapter.id}" data-difficulty="${difficulty.id}" class="${selected && ctx.metaState.selected.difficultyId === difficulty.id ? "active" : ""}" ${locked || !ctx.difficultyAllowed(chapter.id, difficulty.id) ? "disabled" : ""}>${difficulty.name}</button>`)
                .join("")}
            </div>
            <button data-action="select-chapter" data-id="${chapter.id}" ${locked ? "disabled" : ""}>${selected ? "已选择" : "选择章节"}</button>
            <button data-action="tune-chapter-build" data-id="${chapter.id}" ${locked ? "disabled" : ""}>调构筑</button>
          </article>
        `;
      })
      .join("")}</div>`;
  }

  function renderMaterialsTab() {
    const ctx = getContext();
    const selectedDifficulty = ctx.materialPreviewDifficulty();
    return `
      ${ctx.renderHomeBanner("materials")}
      ${ctx.renderMaterialDifficultyPreview()}
      <div class="materials-dashboard">
        ${Object.entries(ctx.metaConfig.currencies)
          .map(([key, config]) => {
            const needs = materialNeedSummary(key);
            const needAmount = materialNeedAmount(key);
            const focused = ctx.homeState.focusedMaterials.includes(key);
            return `
              <article class="home-card material-card ${focused ? "focused" : ""}" data-material="${key}">
                <div class="material-card-head" style="--material-color:${config.color || "#f7f3e8"}">
                  ${config.icon ? ctx.homeImage(config.icon, config.name, "material-card-icon material-card-icon-img") : `<span class="material-card-icon" aria-hidden="true">${config.iconText || config.name.slice(0, 1)}</span>`}
                  <div class="material-card-title">
                    <h2>${config.name}</h2>
                    <span>${config.desc || ""}</span>
                  </div>
                  <strong class="material-card-balance">${Math.floor(ctx.metaState.currencies[key] || 0)}</strong>
                  ${focused ? `<em class="material-card-focus">当前缺口</em>` : ""}
                </div>
                <dl>
                  <div><dt>来源</dt><dd>${config.source || "战斗结算"}</dd></div>
                  <div><dt>用途</dt><dd>${needs.length ? needs.join(" / ") : config.usage || "后续成长"}</dd></div>
                  <div><dt>近期需求</dt><dd>${materialNeedAmountText(key, needAmount)}</dd></div>
                  <div><dt>刷图</dt><dd class="material-farm-routes">${ctx.materialFarmRoute(key, selectedDifficulty)}</dd></div>
                </dl>
              </article>
            `;
          })
          .join("")}
      </div>
      <div class="home-card drop-matrix">
        <h2>章节收益预览</h2>
        <div class="drop-grid">
          ${ctx.metaConfig.chapters
            .map((chapter) => `
              <article class="${ctx.isUnlocked("chapters", chapter.id) ? "" : "locked"}">
                <strong>${chapter.name}</strong>
                <span>${chapter.bossName}</span>
                <div>${ctx.chapterDropSummary(chapter, selectedDifficulty)}</div>
              </article>
            `)
            .join("")}
        </div>
      </div>
    `;
  }

  function renderMobileHomeLanding() {
    const ctx = getContext();
    const selectedChapter = ctx.getSelectedChapter();
    const selectedDifficulty = ctx.getSelectedDifficulty();
    const recommendation = ctx.chapterBuildRecommendation();
    const nextQuest = ctx.nextQuestGoal();
    const rewardsSummary = nextQuest
      ? `${nextQuest.quest.name} · ${ctx.questProgressText(nextQuest.quest, nextQuest.state.progress)}`
      : `${ctx.claimableQuestCount()} 个悬赏可领取`;
    return `
      ${ctx.renderHomeBanner("home")}
      <div class="mobile-home-landing-hero">
        <div>
          <strong>今日洞府策令</strong>
          <p>先确认章节和构筑，再一键入世。其余情报收进详情页，不让主入口变长。</p>
        </div>
        <button data-action="open-mobile-home-section" data-section="more" type="button">查看更多</button>
      </div>
      <div class="mobile-home-landing-grid">
        <article class="home-card mobile-home-card mobile-home-card-primary">
          <span class="mobile-home-card-kicker">继续开局</span>
          <h2>${selectedChapter?.name || "未定章节"}</h2>
          <p>${selectedDifficulty?.name || "未定难度"} · ${selectedChapter?.bossName || "先选章节再入世"}</p>
          <small>${selectedChapter?.desc || "当前章节尚未选择。"}</small>
          <div class="mobile-home-card-actions">
            <button data-action="start-run" type="button">入世斩妖</button>
            <button data-action="open-mobile-home-section" data-section="chapters" type="button">调整章节</button>
          </div>
        </article>
        <article class="home-card mobile-home-card">
          <span class="mobile-home-card-kicker">当前构筑</span>
          <h2>本局起手</h2>
          <div class="mobile-home-build-summary">
            ${selectedBuildSummary()}
          </div>
          <div class="mobile-home-card-actions">
            <button data-action="open-mobile-home-section" data-section="build" type="button">调整构筑</button>
          </div>
        </article>
        <article class="home-card mobile-home-card">
          <span class="mobile-home-card-kicker">可领奖励</span>
          <h2>${ctx.claimableQuestCount()} 个悬赏待处理</h2>
          <p>${rewardsSummary}</p>
          <small>先领掉现成奖励，再决定这一局刷什么。</small>
          <div class="mobile-home-card-actions">
            <button data-action="open-mobile-home-section" data-section="quests" type="button">查看悬赏</button>
          </div>
        </article>
        <article class="home-card mobile-home-card">
          <span class="mobile-home-card-kicker">章节推荐</span>
          <h2>${recommendation.artifact?.name || "通用构筑"}</h2>
          <p>${recommendation.reasons?.[0] || "按当前章节和 Boss 机制推荐开局组件。"}</p>
          <div class="build-tags">${recommendation.tags.map(ctx.styleTagToken).join("")}</div>
          <div class="mobile-home-card-actions">
            <button data-action="apply-chapter-recommendation" type="button">套用推荐</button>
            <button data-action="open-mobile-home-section" data-section="chapters" type="button">看章节详情</button>
          </div>
        </article>
      </div>
    `;
  }

  function renderMobileHomeMore() {
    const ctx = getContext();
    const rows = [
      { tab: "journey", title: "历练总览", desc: "看章节首通、成长缺口和下一步刷图建议。" },
      { tab: "materials", title: "材料路线", desc: "按材料缺口查看章节收益与推荐路线。" },
      { tab: "bestiary", title: "Boss 图鉴", desc: "查看 Boss 技能、阶段和推荐构筑。" },
      { tab: "talents", title: "天赋树", desc: "统一查看可升级天赋与里程碑效果。" },
      { tab: "artifacts", title: "法宝", desc: "切换本命法宝并查看升级成本。" },
      { tab: "cultivation", title: "功法", desc: "切换起手功法并查看成长收益。" },
      { tab: "facilities", title: "洞府设施", desc: "查看蒲团、炼丹、藏经阁等局外成长。" },
    ];
    return `
      ${ctx.renderHomeBanner("more")}
      <section class="mobile-home-more">
        <div class="mobile-home-more-head">
          <div>
            <strong>更多事务</strong>
            <p>材料、图鉴、成长和存档工具都收在这里，避免首页变成桌面版缩小图。</p>
          </div>
          <button data-action="open-mobile-home-section" data-section="home" type="button">回首页</button>
        </div>
        <div class="mobile-home-more-grid">
          ${rows.map((row) => `
            <article class="home-card mobile-home-more-card">
              <h2>${row.title}</h2>
              <p>${row.desc}</p>
              <button data-action="open-mobile-more-tab" data-tab="${row.tab}" type="button">进入详情</button>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderJourneyTab() {
    const ctx = getContext();
    const chapterCount = ctx.metaConfig.chapters?.length || 0;
    const difficultyTotal = ctx.totalDifficultyCount();
    const claimedQuestCount = (ctx.metaState.records.claimedQuests || []).length;
    const questTotal = ctx.metaConfig.quests?.length || 0;
    const chapterGoal = ctx.nextChapterGoal();
    const questGoal = ctx.nextQuestGoal();
    const upgradeGoal = ctx.nextUpgradeGoal();
    const recommendations = ctx.journeyRecommendationRows();
    return `
      ${ctx.renderHomeBanner("journey")}
      <section class="journey-dashboard">
        <article class="home-card journey-hero">
          <div>
            <h2>历练总览</h2>
            <p>把章节首通、悬赏、境界和下一次升级串成一条路线，回洞府后先看这里决定下一局刷什么。</p>
          </div>
          <div class="journey-score">
            <strong>${ctx.chapterClearCount()}/${chapterCount}</strong>
            <span>章节已首通</span>
          </div>
        </article>
        <article class="home-card journey-stats">
          <span><b>${ctx.formatTime(ctx.metaState.records.bestSurvivalSeconds || 0)}</b>最长存活</span>
          <span><b>${ctx.metaState.records.totalKills || 0}</b>累计斩妖</span>
          <span><b>${ctx.realmLabel(ctx.metaState.records.highestRealmLevel || 1)}</b>最高境界</span>
          <span><b>${ctx.difficultyProgressCount()}/${difficultyTotal}</b>难度首通</span>
        </article>
      </section>
      <section class="journey-grid">
        <article class="home-card journey-card">
          <div class="journey-card-head">
            <span>章节路线</span>
            <b>${chapterGoal ? chapterGoal.name : "全章已开"}</b>
          </div>
          <p>${chapterGoal ? (ctx.isUnlocked("chapters", chapterGoal.id) ? `${chapterGoal.bossName} 尚未凡境首通。` : ctx.unlockConditionText(chapterGoal.unlock)) : "当前章节线已完成基础首通，可以转向高难和材料刷取。"}</p>
          <div class="quest-progress">
            <div><span style="width:${chapterCount ? (ctx.chapterClearCount() / chapterCount) * 100 : 0}%"></span></div>
            <small>${ctx.chapterClearCount()} / ${chapterCount} 章节</small>
          </div>
        </article>
        <article class="home-card journey-card">
          <div class="journey-card-head">
            <span>悬赏进度</span>
            <b>${ctx.claimableQuestCount()} 可领取</b>
          </div>
          <p>${questGoal ? `${questGoal.quest.name}：${ctx.questProgressText(questGoal.quest, questGoal.state.progress)}` : "悬赏已全部领取，后续可以继续扩展周常和高难目标。"}</p>
          <div class="quest-progress">
            <div><span style="width:${questTotal ? (claimedQuestCount / questTotal) * 100 : 0}%"></span></div>
            <small>${claimedQuestCount} / ${questTotal} 已领取</small>
          </div>
        </article>
        <article class="home-card journey-card">
          <div class="journey-card-head">
            <span>下一次成长</span>
            <b>${upgradeGoal ? `${upgradeGoal.kind} · ${upgradeGoal.name}` : "全部满级"}</b>
          </div>
          <p>${upgradeGoal ? (Object.keys(upgradeGoal.missing).length ? `还缺 ${ctx.formatCost(upgradeGoal.missing)}。` : `材料已够，可升到 Lv.${upgradeGoal.level + 1}。`) : "当前成长线已经拉满。"}</p>
          <div class="journey-materials">${upgradeGoal ? ctx.formatCostTokens(upgradeGoal.cost, "material-token reward-token") : ""}</div>
        </article>
      </section>
      ${ctx.renderEventJourneyPanel()}
      ${ctx.renderComboJourneyPanel()}
      <section class="home-card journey-next">
        <div class="build-preview-head">
          <h2>下一步建议</h2>
          <small>${ctx.getSelectedChapter()?.name || "当前章节"} · ${ctx.getSelectedDifficulty()?.name || "当前难度"}</small>
        </div>
        <div class="journey-recommendations">
          ${recommendations
            .map((row) => `
              <article>
                <span>${row.label}</span>
                <strong>${row.title}</strong>
                <p>${row.body}</p>
                <button data-action="open-tab" data-tab="${row.tab}" data-focus-materials="${(row.focusMaterials || []).join(",")}" type="button">${row.action}</button>
              </article>
            `)
            .join("")}
        </div>
      </section>
    `;
  }

  function renderQuestsTab() {
    const ctx = getContext();
    return `
      ${ctx.renderHomeBanner("quests")}
      ${ctx.renderQuestCompletionSummary()}
      <div class="home-grid quest-grid">
        ${ctx.metaConfig.quests
          .map((quest) => {
            const state = ctx.questState(quest);
            const percent = ctx.questProgressPercent(state.progress);
            return `
              <article class="home-card quest-card ${state.claimed ? "claimed" : ""} ${state.claimable ? "claimable" : ""}">
                <div class="quest-card-head">
                  <div>
                    <h2>${quest.name}</h2>
                    <p>${quest.desc}</p>
                  </div>
                  <span>${state.claimed ? "已领取" : state.claimable ? "可领取" : "进行中"}</span>
                </div>
                <div class="quest-progress">
                  <div><span style="width:${percent}%"></span></div>
                  <small>${ctx.questProgressText(quest, state.progress)}</small>
                </div>
                <div class="quest-rewards">
                  ${ctx.formatCostTokens(quest.rewards, "material-token reward-token")}
                </div>
                <button data-action="claim-quest" data-id="${quest.id}" ${state.claimable ? "" : "disabled"}>${state.claimed ? "已领取" : "领取悬赏"}</button>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderBestiaryTab() {
    const ctx = getContext();
    const selectedDifficulty = ctx.getSelectedDifficulty();
    return `
      ${ctx.renderHomeBanner("bestiary")}
      <section class="bestiary-overview">
        <article class="home-card bestiary-hero">
          <div>
            <h2>Boss 图鉴</h2>
            <p>按章节查看 Boss 技能、阶段、推荐构筑和首通记录。选定挑战后可直接回到开局页调整构筑，再入世开战。</p>
          </div>
          <div class="bestiary-score">
            <strong>${ctx.difficultyProgressCount()}/${ctx.totalDifficultyCount()}</strong>
            <span>难度首通</span>
          </div>
        </article>
      </section>
      ${ctx.renderComboCodex()}
      <div class="bestiary-grid">
        ${ctx.metaConfig.chapters
          .map((chapter) => {
            const locked = !ctx.isUnlocked("chapters", chapter.id);
            const selected = ctx.metaState.selected.chapterId === chapter.id;
            const record = ctx.bossRecordSummary(chapter);
            const difficulty = selected ? selectedDifficulty : ctx.metaConfig.difficulties[0];
            const mechanics = chapter.bossMechanics || {};
            const presetNames = ctx.matchingPresetNames(chapter);
            return `
              <article class="home-card bestiary-card ${locked ? "locked" : ""} ${selected ? "selected" : ""}">
                <div class="bestiary-portrait">
                  ${ctx.homeImage(chapter.bossAsset || chapter.background || chapter.fallbackBackground, chapter.bossName, "bestiary-boss", chapter.background || chapter.fallbackBackground)}
                  <span>${locked ? "未遭遇" : record.cleared.length ? "已镇压" : "待挑战"}</span>
                </div>
                <div class="bestiary-body">
                  <div class="bestiary-head">
                    <div>
                      <h2>${chapter.bossName}</h2>
                      <p>${mechanics.subtitle || chapter.name}</p>
                    </div>
                    <small>${chapter.name}</small>
                  </div>
                  <div class="bestiary-record">
                    <span><b>${record.clearedText}</b>首通记录</span>
                    <span><b>${ctx.formatTime(record.bestTime)}</b>最佳存活</span>
                    <span><b>${record.bestKills}</b>最高斩妖</span>
                  </div>
                  <div class="boss-skill-list bestiary-skills">
                    ${(mechanics.skills || [])
                      .map((skill) => `
                        <span class="boss-skill">
                          <b>${skill.name}</b>
                          <small>${ctx.bossSkillSummary(skill, difficulty)}</small>
                        </span>
                      `)
                      .join("")}
                  </div>
                  <div class="bestiary-notes">
                    <span>阶段：${ctx.bossPhaseTimeline(chapter)}</span>
                    <span>推荐：${ctx.chapterBuildContextTags(chapter).map(ctx.styleTagToken).join("")}${presetNames.length ? ` ${presetNames.join(" / ")}` : ""}</span>
                    <span>掉落与首通</span>
                    ${ctx.chapterRewardChipRows(chapter, difficulty)}
                  </div>
                  ${ctx.renderBestiaryRewardHighlights(chapter, difficulty, locked)}
                  ${ctx.renderRunEventPreview(chapter, difficulty, locked)}
                  ${ctx.renderChapterReadiness(chapter, difficulty, locked)}
                  ${ctx.renderBestiaryPatchAction(chapter, difficulty, locked)}
                  <div class="difficulty-row bestiary-actions">
                    ${ctx.metaConfig.difficulties
                      .map((item) => `<button data-action="select-bestiary-difficulty" data-chapter="${chapter.id}" data-difficulty="${item.id}" class="${selected && ctx.metaState.selected.difficultyId === item.id ? "active" : ""}" ${locked || !ctx.difficultyAllowed(chapter.id, item.id) ? "disabled" : ""}>${item.name}</button>`)
                      .join("")}
                    <button data-action="challenge-boss" data-id="${chapter.id}" ${locked ? "disabled" : ""}>${selected ? "当前挑战" : "选择挑战"}</button>
                    <button data-action="tune-chapter-build" data-id="${chapter.id}" ${locked ? "disabled" : ""}>调构筑</button>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderStartBuildTab() {
    const ctx = getContext();
    const slots = ctx.getStartingTalentSlots();
    const artifactMap = ctx.mapById(ctx.metaConfig.artifacts);
    const cultivationMap = ctx.mapById(ctx.metaConfig.cultivations);
    return `
      ${ctx.renderHomeBanner("start")}
      ${selectedBuildSummary()}
      ${renderBuildPlanner()}
      ${ctx.renderBuildSynergyPanel()}
      <div class="home-list build-loadout">
        <article class="home-card home-loadout-card">
          <h2>本命法宝</h2>
          <div class="slot-row">${ctx.metaConfig.artifacts
            .map((artifact) => `<button data-action="select-artifact" data-id="${artifact.id}" class="choice-chip ${ctx.metaState.selected.artifactId === artifact.id ? "active" : ""}" ${!ctx.isUnlocked("artifacts", artifact.id) ? "disabled" : ""}>${ctx.homeImage(artifact.icon, artifact.name, "chip-icon")}<span>${artifact.shortName || artifact.name}</span>${ctx.collectBuildTags([artifact]).slice(0, 2).map(ctx.styleTagToken).join("")}</button>`)
            .join("")}</div>
        </article>
        <article class="home-card home-loadout-card">
          <h2>初始天赋 ${ctx.metaState.selected.startingTalentIds.length}/${slots}</h2>
          <div class="slot-row">${ctx.metaConfig.startingTalents
            .map((talent) => `<button data-action="toggle-talent" data-id="${talent.id}" class="${ctx.metaState.selected.startingTalentIds.includes(talent.id) ? "active" : ""}" ${!ctx.isUnlocked("startingTalents", talent.id) ? "disabled" : ""}>${talent.name}${ctx.collectBuildTags([talent]).slice(0, 1).map(ctx.styleTagToken).join("")}</button>`)
            .join("")}</div>
          <small>悟道蒲团 3/7 级会增加天赋槽。</small>
        </article>
        <article class="home-card home-loadout-card">
          <h2>起手功法</h2>
          <div class="slot-row">${ctx.metaConfig.cultivations
            .map((cultivation) => `<button data-action="select-cultivation" data-id="${cultivation.id}" class="choice-chip ${ctx.metaState.selected.cultivationId === cultivation.id ? "active" : ""}" ${!ctx.isUnlocked("cultivations", cultivation.id) ? "disabled" : ""}>${ctx.homeImage(cultivation.icon || artifactMap[cultivation.spell]?.icon || cultivationMap[cultivation.id]?.icon, cultivation.name, "chip-icon")}<span>${cultivation.name}</span>${ctx.collectBuildTags([cultivation]).slice(0, 2).map(ctx.styleTagToken).join("")}</button>`)
            .join("")}</div>
        </article>
      </div>
    `;
  }

  function renderTalentTreeTab() {
    const ctx = getContext();
    return `${ctx.renderHomeBanner("talents")}<div class="home-grid">${ctx.metaConfig.talentTrees
      .map((tree) => {
        const level = ctx.metaState.progression.talentTree[tree.id] || 0;
        const maxed = level >= tree.maxLevel;
        const cost = maxed ? {} : ctx.upgradeCost("talent", tree.id, level);
        return `
          <article class="home-card visual-card">
            ${ctx.homeImage(tree.icon, tree.name, "home-icon")}
            <div class="home-card-body">
              <h2>${tree.name} Lv.${level}/${tree.maxLevel}</h2>
              <p>${tree.desc}</p>
              <small>当前：${level ? ctx.effectSummary(tree.effects, level) : "未修炼"}</small>
              ${ctx.milestoneSummary(tree, level, { kind: "talent", id: tree.id })}
            </div>
            <button class="action-button" data-action="upgrade-talent" data-id="${tree.id}" ${maxed || !ctx.hasCurrency(cost) ? "disabled" : ""}>${ctx.uiActionIcon("upgrade", "升级")}${maxed ? "<span>已圆满</span>" : "<span>升级</span>"}</button>
            ${!maxed ? `<div class="action-cost-row">${ctx.formatCostTokens(cost, "material-token action-cost-token")}</div>` : ""}
            ${ctx.renderCostHint(cost)}
          </article>
        `;
      })
      .join("")}</div>`;
  }

  function renderArtifactsTab() {
    const ctx = getContext();
    return `${ctx.renderHomeBanner("artifacts")}<div class="home-grid">${ctx.metaConfig.artifacts
      .map((artifact) => {
        const unlocked = ctx.isUnlocked("artifacts", artifact.id);
        const level = ctx.metaState.progression.artifacts[artifact.id] || 0;
        const maxed = level >= artifact.maxLevel;
        const cost = unlocked && !maxed ? ctx.upgradeCost("artifact", artifact.id, level) : {};
        return `
          <article class="home-card visual-card ${!unlocked ? "locked" : ""} ${ctx.metaState.selected.artifactId === artifact.id ? "selected" : ""}">
            ${ctx.homeImage(artifact.icon, artifact.name, "home-icon artifact-icon")}
            <div class="home-card-body">
              <h2>${artifact.name} ${unlocked ? `Lv.${level}/${artifact.maxLevel}` : ""}</h2>
              <p>${artifact.desc}</p>
              <small>${artifact.tags?.join(" / ") || ""}${unlocked ? " · " : ""}${unlocked ? ctx.effectSummary(artifact.effects, level || 1) : "未解锁"}</small>
              ${unlocked ? ctx.milestoneSummary(artifact, level, { kind: "artifact", id: artifact.id }) : ""}
            </div>
            <button data-action="select-artifact" data-id="${artifact.id}" ${!unlocked ? "disabled" : ""}>设为本命</button>
            <button class="action-button" data-action="upgrade-artifact" data-id="${artifact.id}" ${!unlocked || maxed || !ctx.hasCurrency(cost) ? "disabled" : ""}>${ctx.uiActionIcon("upgrade", "升级")}${maxed ? "<span>已满级</span>" : "<span>升级</span>"}</button>
            ${unlocked && !maxed ? `<div class="action-cost-row">${ctx.formatCostTokens(cost, "material-token action-cost-token")}</div>` : ""}
            ${unlocked ? ctx.renderCostHint(cost) : `<small class="cost-hint compact-lock">${ctx.uiActionIcon("unlock", "解锁", "hint-inline-icon")}<span>${ctx.unlockConditionText(artifact.unlock)}</span></small>`}
          </article>
        `;
      })
      .join("")}</div>`;
  }

  function renderCultivationTab() {
    const ctx = getContext();
    return `${ctx.renderHomeBanner("cultivation")}<div class="home-grid">${ctx.metaConfig.cultivations
      .map((cultivation) => {
        const unlocked = ctx.isUnlocked("cultivations", cultivation.id);
        const level = ctx.metaState.progression.cultivations[cultivation.id] || 0;
        const maxed = level >= cultivation.maxLevel;
        const cost = unlocked && !maxed ? ctx.upgradeCost("cultivation", cultivation.id, level) : {};
        return `
          <article class="home-card visual-card ${!unlocked ? "locked" : ""} ${ctx.metaState.selected.cultivationId === cultivation.id ? "selected" : ""}">
            ${ctx.homeImage(cultivation.icon, cultivation.name, "home-icon")}
            <div class="home-card-body">
              <h2>${cultivation.name} ${unlocked ? `Lv.${level}/${cultivation.maxLevel}` : ""}</h2>
              <p>${cultivation.desc}</p>
              <small>${unlocked ? ctx.effectSummary(cultivation.effects, level || 1) : "未解锁"}</small>
              ${unlocked ? ctx.milestoneSummary(cultivation, level, { kind: "cultivation", id: cultivation.id }) : ""}
            </div>
            <button data-action="select-cultivation" data-id="${cultivation.id}" ${!unlocked ? "disabled" : ""}>设为起手</button>
            <button class="action-button" data-action="upgrade-cultivation" data-id="${cultivation.id}" ${!unlocked || maxed || !ctx.hasCurrency(cost) ? "disabled" : ""}>${ctx.uiActionIcon("upgrade", "升级")}${maxed ? "<span>已满级</span>" : "<span>升级</span>"}</button>
            ${unlocked && !maxed ? `<div class="action-cost-row">${ctx.formatCostTokens(cost, "material-token action-cost-token")}</div>` : ""}
            ${unlocked ? ctx.renderCostHint(cost) : `<small class="cost-hint compact-lock">${ctx.uiActionIcon("unlock", "解锁", "hint-inline-icon")}<span>${ctx.unlockConditionText(cultivation.unlock)}</span></small>`}
          </article>
        `;
      })
      .join("")}</div>`;
  }

  function renderFacilitiesTab() {
    const ctx = getContext();
    return `${ctx.renderHomeBanner("facilities")}<div class="home-grid">${ctx.metaConfig.facilities
      .map((facility) => {
        const level = ctx.metaState.progression.facilities[facility.id] || 0;
        const maxed = level >= facility.maxLevel;
        const cost = maxed ? {} : ctx.upgradeCost("facility", facility.id, level);
        return `
          <article class="home-card visual-card">
            ${ctx.homeImage(facility.icon, facility.name, "home-icon facility-icon")}
            <div class="home-card-body">
              <h2>${facility.name} Lv.${level}/${facility.maxLevel}</h2>
              <p>${facility.desc}</p>
              <small>当前：${level ? ctx.effectSummary(facility.effects, level) : "未建设"}</small>
              ${ctx.milestoneSummary(facility, level, { kind: "facility", id: facility.id })}
            </div>
            <button class="action-button" data-action="upgrade-facility" data-id="${facility.id}" ${maxed || !ctx.hasCurrency(cost) ? "disabled" : ""}>${ctx.uiActionIcon("upgrade", "升级")}${maxed ? "<span>已满级</span>" : "<span>升级</span>"}</button>
            ${!maxed ? `<div class="action-cost-row">${ctx.formatCostTokens(cost, "material-token action-cost-token")}</div>` : ""}
            ${ctx.renderCostHint(cost)}
          </article>
        `;
      })
      .join("")}</div>`;
  }

  return {
    mobileHomeLanding: renderMobileHomeLanding,
    mobileHomeMore: renderMobileHomeMore,
    chapters: renderChapterTab,
    materials: renderMaterialsTab,
    journey: renderJourneyTab,
    quests: renderQuestsTab,
    bestiary: renderBestiaryTab,
    start: renderStartBuildTab,
    talents: renderTalentTreeTab,
    artifacts: renderArtifactsTab,
    cultivation: renderCultivationTab,
    facilities: renderFacilitiesTab,
  };
}
