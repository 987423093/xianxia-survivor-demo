/**
 * 创建奖励与摘要模块。
 * 入参：运行时状态、元进度访问器，以及奖励展示所需的货币、构筑和奇遇辅助函数。
 * 出参：章节奖励卡片、局后结算拆解、暂停面板摘要等渲染方法。
 * 作用：把奖励结算、暂停摘要和章节掉落展示从入口文件中抽离，减少主文件的展示逻辑噪音。
 */
export function createRewardsSummary({
  game,
  theme,
  metaConfig,
  getMetaState,
  homeImage,
  thumbnailAsset,
  currencyName,
  currencyConfig,
  currencyToken,
  formatCost,
  formatCostTokens,
  chapterDropEstimate,
  getSelectedDifficulty,
  damageSourceName,
  selectedArtifact,
  selectedCultivation,
  selectedTalents,
  activeBuildSynergies,
  activeRunBlessingRows,
  runEventChoiceSummary,
  runEventBlessingSummary,
  runEventFollowupSummary,
  challengeStateText,
  enemyAffixes,
  spellCombos,
  selectedCultivationSpell,
  scaledDamage,
  realmLabel,
  formatTime,
  ambushSummaryText,
}) {
  const metaState = new Proxy({}, {
    get(_target, key) {
      return getMetaState()?.[key];
    },
  });

  function rewardChip({ title, detail = "", asset = "", color = "#f7f3e8", tone = "default", iconText = "" }) {
    const icon = asset ? homeImage(asset, title, "reward-chip-icon", asset) : `<span class="reward-chip-glyph">${iconText || title.slice(0, 1)}</span>`;
    return `
      <span class="reward-chip ${tone}" style="--reward-chip-color:${color}">
        ${icon}
        <span class="reward-chip-text">
          <b>${title}</b>
          ${detail ? `<small>${detail}</small>` : ""}
        </span>
      </span>
    `;
  }

  function difficultyRewardChip(chapter, difficultyId) {
    const difficulty = Object.fromEntries((metaConfig.difficulties || []).map((item) => [item.id, item]))[difficultyId];
    if (!chapter || !difficulty) return "";
    return rewardChip({
      title: difficulty.name,
      detail: `${chapter.name}新难度`,
      asset: thumbnailAsset(chapter.background || chapter.fallbackBackground),
      tone: "unlock",
    });
  }

  function rewardCurrencyChips(chapter, difficulty) {
    const estimate = chapterDropEstimate(chapter, difficulty);
    return Object.entries(estimate)
      .filter(([, amount]) => amount > 0)
      .map(([key, amount]) => {
        const config = currencyConfig(key);
        return rewardChip({
          title: config.name,
          detail: `预计 ${Math.floor(amount)}`,
          color: config.color || "#f7f3e8",
          tone: "currency",
          iconText: config.iconText || config.name.slice(0, 1),
        });
      })
      .join("");
  }

  function firstClearRewardChips(chapter) {
    const unlocks = chapter.firstClearUnlocks || {};
    const chapterMap = Object.fromEntries((metaConfig.chapters || []).map((item) => [item.id, item]));
    const artifactMap = Object.fromEntries((metaConfig.artifacts || []).map((item) => [item.id, item]));
    const talentMap = Object.fromEntries((metaConfig.startingTalents || []).map((item) => [item.id, item]));
    const cultivationMap = Object.fromEntries((metaConfig.cultivations || []).map((item) => [item.id, item]));
    const rows = [
      ...(unlocks.chapters || []).map((id) => {
        const item = chapterMap[id];
        return item ? rewardChip({ title: item.name, detail: "新章节", asset: thumbnailAsset(item.background || item.fallbackBackground), tone: "unlock" }) : "";
      }),
      ...(unlocks.artifacts || []).map((id) => {
        const item = artifactMap[id];
        return item ? rewardChip({ title: item.shortName || item.name, detail: "法宝解锁", asset: item.icon, tone: "unlock" }) : "";
      }),
      ...(unlocks.startingTalents || []).map((id) => {
        const item = talentMap[id];
        return item ? rewardChip({ title: item.name, detail: "天赋解锁", asset: item.icon, tone: "unlock" }) : "";
      }),
      ...(unlocks.cultivations || []).map((id) => {
        const item = cultivationMap[id];
        return item ? rewardChip({ title: item.name, detail: "功法解锁", asset: item.icon, tone: "unlock" }) : "";
      }),
    ].filter(Boolean);
    return rows.join("") || `<span class="home-muted">高难与材料收益</span>`;
  }

  function chapterRewardChipRows(chapter, difficulty) {
    return `
      <div class="reward-chip-groups">
        <div class="reward-chip-group">
          <span class="reward-chip-label">掉落</span>
          ${rewardCurrencyChips(chapter, difficulty)}
        </div>
        <div class="reward-chip-group">
          <span class="reward-chip-label">首通</span>
          ${firstClearRewardChips(chapter)}
        </div>
      </div>
    `;
  }

  function renderFirstClearRewardSummary() {
    const snapshot = game.runStats.firstClearRewards;
    if (!snapshot || !metaConfig) return "";
    const chapterMap = Object.fromEntries((metaConfig.chapters || []).map((item) => [item.id, item]));
    const artifactMap = Object.fromEntries((metaConfig.artifacts || []).map((item) => [item.id, item]));
    const talentMap = Object.fromEntries((metaConfig.startingTalents || []).map((item) => [item.id, item]));
    const cultivationMap = Object.fromEntries((metaConfig.cultivations || []).map((item) => [item.id, item]));
    const difficultyMap = Object.fromEntries((metaConfig.difficulties || []).map((item) => [item.id, item]));
    const chapter = chapterMap[snapshot.chapterId];
    const difficulty = difficultyMap[snapshot.difficultyId];
    const chips = [
      ...(snapshot.chapters || []).map((id) => {
        const item = chapterMap[id];
        return item ? rewardChip({ title: item.name, detail: "新章节", asset: thumbnailAsset(item.background || item.fallbackBackground), tone: "unlock" }) : "";
      }),
      ...(snapshot.artifacts || []).map((id) => {
        const item = artifactMap[id];
        return item ? rewardChip({ title: item.shortName || item.name, detail: "法宝解锁", asset: item.icon, tone: "unlock" }) : "";
      }),
      ...(snapshot.startingTalents || []).map((id) => {
        const item = talentMap[id];
        return item ? rewardChip({ title: item.name, detail: "天赋解锁", asset: item.icon, tone: "unlock" }) : "";
      }),
      ...(snapshot.cultivations || []).map((id) => {
        const item = cultivationMap[id];
        return item ? rewardChip({ title: item.name, detail: "功法解锁", asset: item.icon, tone: "unlock" }) : "";
      }),
      snapshot.difficultyUnlockId ? difficultyRewardChip(chapter, snapshot.difficultyUnlockId) : "",
    ].filter(Boolean);
    if (!chips.length) return "";
    return `
      <div class="first-clear-reward-summary">
        <strong>首通奖励</strong>
        <small>${chapter?.name || "当前章节"} · ${difficulty?.name || "当前难度"}</small>
        <div class="reward-chip-group">${chips.join("")}</div>
      </div>
    `;
  }

  function calculateRunRewards() {
    if (!metaConfig) return null;
    const formula = game.balance?.rewardFormula || {};
    const chapterMultiplier = game.chapter?.rewardMultiplier || 1;
    const difficultyMultiplier = game.difficulty?.rewardMultiplier || 1;
    const rewardMultiplier = chapterMultiplier * difficultyMultiplier;
    const bossBonus = game.runStats.bossKilled ? formula.spiritStoneBossBonus ?? 120 : 0;
    const daoBossBonus = game.runStats.bossKilled ? formula.daoBossBonus ?? 30 : 0;
    const fieldBonus = 1 + (game.runMods.reward?.spiritStoneMultiplier || 0);
    const drops = game.chapter?.drops || {};
    const eventRewards = game.runStats.events?.rewards || {};
    const pickupRewards = game.runStats.pickupRewards || {};
    return {
      spiritStone: Math.floor((game.killCount * (formula.spiritStonePerKill ?? 2) + game.time * (formula.spiritStonePerSecond ?? 0.6) + bossBonus) * rewardMultiplier * fieldBonus) + (eventRewards.spiritStone || 0) + (pickupRewards.spiritStone || 0),
      dao: Math.floor((game.player.level * (formula.daoPerLevel ?? 4) + game.time * (formula.daoPerSecond ?? 0.05) + daoBossBonus) * rewardMultiplier) + (eventRewards.dao || 0) + (pickupRewards.dao || 0),
      mysticIron: Math.floor((game.runStats.eliteKills + (game.runStats.bossKilled ? drops.mysticIron || formula.fallbackMysticIronBossDrop || 2 : 0)) * difficultyMultiplier) + (eventRewards.mysticIron || 0) + (pickupRewards.mysticIron || 0),
      spiritEssence: Math.floor((game.runStats.breakthroughs * (formula.spiritEssencePerBreakthrough ?? 3) + game.runStats.xpCollected / (formula.spiritEssenceXpDivisor ?? 80) + (game.runStats.bossKilled ? drops.spiritEssence || 0 : 0)) * Math.min(formula.spiritEssenceRewardCap ?? 2.2, rewardMultiplier)) + (eventRewards.spiritEssence || 0) + (pickupRewards.spiritEssence || 0),
      thunderShard: (game.runStats.bossKilled ? drops.thunderShard || 0 : 0) + (eventRewards.thunderShard || 0) + (pickupRewards.thunderShard || 0),
    };
  }

  function calculateRewardBreakdown(rewards = {}) {
    if (!metaConfig) return [];
    const formula = game.balance?.rewardFormula || {};
    const chapterMultiplier = game.chapter?.rewardMultiplier || 1;
    const difficultyMultiplier = game.difficulty?.rewardMultiplier || 1;
    const rewardMultiplier = chapterMultiplier * difficultyMultiplier;
    const fieldBonus = 1 + (game.runMods.reward?.spiritStoneMultiplier || 0);
    const drops = game.chapter?.drops || {};
    const eventRewards = game.runStats.events?.rewards || {};
    const pickupRewards = game.runStats.pickupRewards || {};
    return [
      {
        key: "spiritStone",
        amount: rewards.spiritStone || 0,
        parts: [
          `${game.killCount} 斩妖`,
          `闭关 ${formatTime(game.time)}`,
          game.runStats.bossKilled ? "Boss 击败" : "",
          fieldBonus > 1 ? "灵田加成" : "",
          eventRewards.spiritStone ? `奇遇 +${eventRewards.spiritStone}` : "",
          pickupRewards.spiritStone ? `战场拾取 +${pickupRewards.spiritStone}` : "",
        ],
        multiplier: rewardMultiplier * fieldBonus,
      },
      {
        key: "dao",
        amount: rewards.dao || 0,
        parts: [
          `${realmLabel(game.player.level)}`,
          `闭关 ${formatTime(game.time)}`,
          game.runStats.bossKilled ? "Boss 击败" : "",
          eventRewards.dao ? `奇遇 +${eventRewards.dao}` : "",
          pickupRewards.dao ? `战场拾取 +${pickupRewards.dao}` : "",
        ],
        multiplier: rewardMultiplier,
      },
      {
        key: "mysticIron",
        amount: rewards.mysticIron || 0,
        parts: [
          `${game.runStats.eliteKills || 0} 精英`,
          game.runStats.bossKilled ? `Boss 掉落 ${drops.mysticIron || formula.fallbackMysticIronBossDrop || 2}` : "",
          eventRewards.mysticIron ? `奇遇 +${eventRewards.mysticIron}` : "",
          pickupRewards.mysticIron ? `战场拾取 +${pickupRewards.mysticIron}` : "",
        ],
        multiplier: difficultyMultiplier,
      },
      {
        key: "spiritEssence",
        amount: rewards.spiritEssence || 0,
        parts: [
          `${game.runStats.breakthroughs || 0} 次突破`,
          `修为收集 ${Math.floor(game.runStats.xpCollected || 0)}`,
          game.runStats.bossKilled && drops.spiritEssence ? `Boss 掉落 ${drops.spiritEssence}` : "",
          eventRewards.spiritEssence ? `奇遇 +${eventRewards.spiritEssence}` : "",
          pickupRewards.spiritEssence ? `战场拾取 +${pickupRewards.spiritEssence}` : "",
        ],
        multiplier: Math.min(formula.spiritEssenceRewardCap ?? 2.2, rewardMultiplier),
      },
      {
        key: "thunderShard",
        amount: rewards.thunderShard || 0,
        parts: [
          game.runStats.bossKilled && drops.thunderShard ? `${game.chapter?.name || "章节"} Boss` : "",
          eventRewards.thunderShard ? `奇遇 +${eventRewards.thunderShard}` : "",
          pickupRewards.thunderShard ? `战场拾取 +${pickupRewards.thunderShard}` : "",
        ],
        multiplier: 1,
      },
    ].filter((item) => item.amount > 0);
  }

  function calculateRewardSourceBreakdown(rewards = {}) {
    if (!metaConfig) return [];
    const formula = game.balance?.rewardFormula || {};
    const chapterMultiplier = game.chapter?.rewardMultiplier || 1;
    const difficultyMultiplier = game.difficulty?.rewardMultiplier || 1;
    const rewardMultiplier = chapterMultiplier * difficultyMultiplier;
    const fieldBonus = 1 + (game.runMods.reward?.spiritStoneMultiplier || 0);
    const drops = game.chapter?.drops || {};
    const eventRewards = game.runStats.events?.rewards || {};
    const pickupRewards = game.runStats.pickupRewards || {};
    const spiritStoneBase = [
      { label: "斩妖", amount: Math.floor(game.killCount * (formula.spiritStonePerKill ?? 2)) },
      { label: "闭关", amount: Math.floor(game.time * (formula.spiritStonePerSecond ?? 0.6)) },
      { label: "Boss", amount: game.runStats.bossKilled ? formula.spiritStoneBossBonus ?? 120 : 0 },
    ].filter((part) => part.amount > 0);
    const daoBase = [
      { label: "境界", amount: Math.floor(game.player.level * (formula.daoPerLevel ?? 4)) },
      { label: "闭关", amount: Math.floor(game.time * (formula.daoPerSecond ?? 0.05)) },
      { label: "Boss", amount: game.runStats.bossKilled ? formula.daoBossBonus ?? 30 : 0 },
    ].filter((part) => part.amount > 0);
    const mysticIronBase = [
      { label: "精英", amount: Math.floor(game.runStats.eliteKills || 0) },
      { label: "Boss", amount: game.runStats.bossKilled ? drops.mysticIron || formula.fallbackMysticIronBossDrop || 2 : 0 },
    ].filter((part) => part.amount > 0);
    const spiritEssenceBase = [
      { label: "突破", amount: Math.floor((game.runStats.breakthroughs || 0) * (formula.spiritEssencePerBreakthrough ?? 3)) },
      { label: "修为", amount: Math.floor((game.runStats.xpCollected || 0) / (formula.spiritEssenceXpDivisor ?? 80)) },
      { label: "Boss", amount: game.runStats.bossKilled ? drops.spiritEssence || 0 : 0 },
    ].filter((part) => part.amount > 0);
    const thunderShardBase = [
      { label: "Boss", amount: game.runStats.bossKilled ? drops.thunderShard || 0 : 0 },
    ].filter((part) => part.amount > 0);
    const spiritEssenceMultiplier = Math.min(formula.spiritEssenceRewardCap ?? 2.2, rewardMultiplier);
    const rows = [
      {
        key: "spiritStone",
        total: rewards.spiritStone || 0,
        baseParts: spiritStoneBase,
        baseTotal: spiritStoneBase.reduce((sum, part) => sum + part.amount, 0),
        scaledTotal: Math.floor(spiritStoneBase.reduce((sum, part) => sum + part.amount, 0) * rewardMultiplier * fieldBonus),
        multipliers: [
          `章节 x${chapterMultiplier.toFixed(2)}`,
          `难度 x${difficultyMultiplier.toFixed(2)}`,
          fieldBonus > 1 ? `灵田 x${fieldBonus.toFixed(2)}` : "",
        ].filter(Boolean),
        extraParts: [
          { label: "奇遇", amount: eventRewards.spiritStone || 0 },
          { label: "战场拾取", amount: pickupRewards.spiritStone || 0 },
        ].filter((part) => part.amount > 0),
      },
      {
        key: "dao",
        total: rewards.dao || 0,
        baseParts: daoBase,
        baseTotal: daoBase.reduce((sum, part) => sum + part.amount, 0),
        scaledTotal: Math.floor(daoBase.reduce((sum, part) => sum + part.amount, 0) * rewardMultiplier),
        multipliers: [`章节 x${chapterMultiplier.toFixed(2)}`, `难度 x${difficultyMultiplier.toFixed(2)}`],
        extraParts: [
          { label: "奇遇", amount: eventRewards.dao || 0 },
          { label: "战场拾取", amount: pickupRewards.dao || 0 },
        ].filter((part) => part.amount > 0),
      },
      {
        key: "mysticIron",
        total: rewards.mysticIron || 0,
        baseParts: mysticIronBase,
        baseTotal: mysticIronBase.reduce((sum, part) => sum + part.amount, 0),
        scaledTotal: Math.floor(mysticIronBase.reduce((sum, part) => sum + part.amount, 0) * difficultyMultiplier),
        multipliers: difficultyMultiplier !== 1 ? [`难度 x${difficultyMultiplier.toFixed(2)}`] : [],
        extraParts: [
          { label: "奇遇", amount: eventRewards.mysticIron || 0 },
          { label: "战场拾取", amount: pickupRewards.mysticIron || 0 },
        ].filter((part) => part.amount > 0),
      },
      {
        key: "spiritEssence",
        total: rewards.spiritEssence || 0,
        baseParts: spiritEssenceBase,
        baseTotal: spiritEssenceBase.reduce((sum, part) => sum + part.amount, 0),
        scaledTotal: Math.floor(spiritEssenceBase.reduce((sum, part) => sum + part.amount, 0) * spiritEssenceMultiplier),
        multipliers: [`奖励倍率 x${spiritEssenceMultiplier.toFixed(2)}`],
        extraParts: [
          { label: "奇遇", amount: eventRewards.spiritEssence || 0 },
          { label: "战场拾取", amount: pickupRewards.spiritEssence || 0 },
        ].filter((part) => part.amount > 0),
      },
      {
        key: "thunderShard",
        total: rewards.thunderShard || 0,
        baseParts: thunderShardBase,
        baseTotal: thunderShardBase.reduce((sum, part) => sum + part.amount, 0),
        scaledTotal: thunderShardBase.reduce((sum, part) => sum + part.amount, 0),
        multipliers: [],
        extraParts: [
          { label: "奇遇", amount: eventRewards.thunderShard || 0 },
          { label: "战场拾取", amount: pickupRewards.thunderShard || 0 },
        ].filter((part) => part.amount > 0),
      },
    ];
    return rows.filter((row) => row.total > 0);
  }

  function renderRewardBreakdown(rewards = {}) {
    const rows = calculateRewardBreakdown(rewards);
    if (!rows.length) return `<span>获得：暂无</span>`;
    return `
      <div class="reward-total">${formatCostTokens(rewards, "material-token reward-token")}</div>
      <div class="reward-breakdown">
        ${rows
          .map((row) => {
            const multiplier = row.multiplier && row.multiplier !== 1 ? ` · 倍率 x${row.multiplier.toFixed(2)}` : "";
            return `<span>${currencyToken(row.key, row.amount, "material-token reward-token")}<small>${row.parts.filter(Boolean).join(" / ")}${multiplier}</small></span>`;
          })
          .join("")}
      </div>
    `;
  }

  function renderRewardSourceBreakdown() {
    if (!metaConfig || !game.runStats?.rewards) return "";
    const sourceRows = calculateRewardSourceBreakdown(game.runStats.rewards);
    return `
      <div class="reward-source-breakdown">
        <strong>奖励来源</strong>
        <div class="reward-source-cards">
          ${sourceRows
            .map((row) => {
              const extraTotal = row.extraParts.reduce((sum, part) => sum + part.amount, 0);
              const pipeline = [
                `基础 ${row.baseTotal}`,
                row.multipliers.length ? `结算 ${row.scaledTotal}` : "",
                extraTotal > 0 ? `额外 +${extraTotal}` : "",
              ].filter(Boolean).join(" -> ");
              return `
                <article class="reward-source-card">
                  <div class="reward-source-card-head">
                    ${currencyToken(row.key, row.total, "material-token reward-token")}
                    <small>${pipeline}</small>
                  </div>
                  <span><b>基础</b><small>${row.baseParts.map((part) => `${part.label} +${part.amount}`).join(" / ") || "无"}</small></span>
                  ${row.multipliers.length ? `<span><b>倍率</b><small>${row.multipliers.join(" / ")}</small></span>` : ""}
                  ${row.extraParts.length ? `<span><b>额外</b><small>${row.extraParts.map((part) => `${part.label} +${part.amount}`).join(" / ")}</small></span>` : ""}
                </article>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function damageBreakdownRows(limit = 3) {
    return Object.entries(game.runStats.damageBySource || {})
      .map(([source, amount]) => ({
        source,
        name: damageSourceName(source),
        amount: Math.round(amount || 0),
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  function renderDamageBreakdown() {
    const rows = damageBreakdownRows();
    if (!rows.length) return "";
    const total = Math.max(1, Math.round(game.runStats.damageDealt || 0));
    const top = rows[0];
    return `
      <div class="run-breakdown">
        <strong>本局输出</strong>
        <span>最强法术：${top.name} ${top.amount}</span>
        <div class="damage-breakdown">
          ${rows
            .map((row) => `<span><b>${row.name}</b><small>${row.amount} · ${Math.round((row.amount / total) * 100)}%</small></span>`)
            .join("")}
        </div>
      </div>
    `;
  }

  function runEventSummaryRows() {
    const events = game.runStats.events || {};
    const pickupText = formatCost(game.runStats.pickupRewards || {});
    const detailRows = Object.values(events.details || {})
      .filter((row) => row.count > 0)
      .map((row) => {
        const notes = [
          row.summary ? `${row.count} 次 · ${row.summary}` : `${row.count} 次`,
          formatCost(row.rewards || {}),
          formatCost(row.pickupRewards || {}),
          row.totalHeal ? `回血 ${row.totalHeal}` : "",
          row.totalEnergy ? `灵力 ${row.totalEnergy}` : "",
          row.totalDamage ? `代价 ${row.totalDamage}` : "",
          Object.keys(row.ambush || {}).length ? `伏击 ${ambushSummaryText(row.ambush)}` : "",
          runEventChoiceSummary(row),
          runEventBlessingSummary(row),
          runEventFollowupSummary(row),
          challengeStateText(row.challenge, true),
        ].filter(Boolean);
        return `<span><b>${row.label}</b><small>${notes.join(" / ")}</small></span>`;
      });
    return [
      ...detailRows,
      pickupText ? `<span><b>战场拾取</b><small>${pickupText}</small></span>` : "",
    ].filter(Boolean);
  }

  function affixSummaryRows() {
    return Object.entries(game.runStats.affixes || {})
      .map(([id, count]) => {
        const affix = enemyAffixes[id];
        if (!affix || count <= 0) return "";
        return `<span><b>${affix.name}</b><small>${count} 只 · ${affix.desc}</small></span>`;
      })
      .filter(Boolean);
  }

  function spellCodexRows() {
    const spellNotes = {
      keyboard: "主轴远程飞剑，负责清线与触发飞剑附符。",
      coffee: "近身持续灼烧，命中后可引动火莲引雷。",
      invoice: "自动散射雷符，是两条合术路线的关键组件。",
      ultimate: "消耗满灵力释放大范围雷瀑，适合清场和压 Boss 血线。",
    };
    const spellIds = ["keyboard", "coffee", "invoice", "ultimate"];
    return spellIds.map((id) => {
      const spell = theme.spells?.[id] || {};
      const weapon = game.weapons?.[id];
      const unlocked = id === "ultimate" ? Boolean(theme.spells?.ultimate) : Boolean(weapon?.unlocked || weapon?.level > 0);
      const metrics = id === "ultimate"
        ? [
            `伤害 ${Math.round(scaledDamage(game.ultimate?.damage || spell.damage || 0))}`,
            `灵力 ${Math.floor(game.energy.value || 0)}/${game.energy.max || 100}`,
          ]
        : [
            weapon?.level ? `${weapon.level}重` : "0重",
            weapon?.damage ? `伤害 ${Math.round(scaledDamage(weapon.damage))}` : "",
            weapon?.burst ? `${weapon.burst}发` : "",
            weapon?.radius ? `范围 ${Math.round(weapon.radius)}` : "",
            weapon?.cooldown ? `${weapon.cooldown.toFixed(2)}s` : "",
          ];
      const combos = spellCombos
        .filter((combo) => combo.recipe.includes(spell.label || weapon?.name))
        .map((combo) => {
          const count = game.runStats?.combos?.[combo.id] || 0;
          return `${combo.name}${count ? ` ${count}次` : ""}`;
        });
      return {
        id,
        name: spell.label || weapon?.name || damageSourceName(id),
        type: spell.type || "法术",
        icon: spell.icon || weapon?.asset || "",
        unlocked,
        status: unlocked ? (id === "ultimate" ? "可施放" : "已悟得") : "待悟",
        metrics: metrics.filter(Boolean).join(" / "),
        note: spellNotes[id] || "",
        combos,
      };
    });
  }

  function renderSpellCodex() {
    return `
      <div class="pause-spell-codex">
        ${spellCodexRows()
          .map((spell) => `
            <article class="${spell.unlocked ? "unlocked" : "locked"}">
              ${spell.icon ? homeImage(spell.icon, spell.name, "pause-spell-icon") : ""}
              <div>
                <div class="pause-spell-head">
                  <b>${spell.name}</b>
                  <span>${spell.status}</span>
                </div>
                <small>${spell.metrics || spell.type}</small>
                <p>${spell.note}</p>
                ${spell.combos.length ? `<em>关联：${spell.combos.join(" / ")}</em>` : ""}
              </div>
            </article>
          `)
          .join("")}
      </div>
    `;
  }

  function activeComboRows() {
    const rows = [];
    if (game.weapons.coffee?.unlocked && game.weapons.invoice?.unlocked) {
      const count = game.runStats?.combos?.fireThunder || 0;
      rows.push(`<span><b>火莲引雷</b><small>${count ? `已触发 ${count} 次` : "业火命中后引动雷符"}</small></span>`);
    }
    if ((game.weapons.keyboard?.level > 0 || game.weapons.keyboard?.unlocked) && game.weapons.invoice?.unlocked) {
      const count = game.runStats?.combos?.swordTalisman || 0;
      rows.push(`<span><b>飞剑附符</b><small>${count ? `已触发 ${count} 次` : "飞剑命中后附着雷符"}</small></span>`);
    }
    return rows;
  }

  function selectedBuildNameSummary() {
    if (!metaConfig || !metaState) return "";
    const parts = [
      selectedArtifact()?.name,
      selectedCultivation()?.name,
      ...selectedTalents().map((talent) => talent.name),
    ].filter(Boolean);
    return parts.length ? parts.join(" / ") : "";
  }

  function renderRunBlessingsSummary() {
    const rows = activeRunBlessingRows();
    if (!rows.length) return "";
    return `
      <div class="run-blessing-summary">
        <strong>本局加持</strong>
        <div class="run-blessing-grid">
          ${rows.map((row) => `<span><b>${row.label}</b><small>${row.text}</small></span>`).join("")}
        </div>
      </div>
    `;
  }

  function renderPauseBuildSummary() {
    const comboRows = activeComboRows();
    const damageRows = damageBreakdownRows();
    const eventRows = runEventSummaryRows();
    const affixRows = affixSummaryRows();
    const blessingSummary = renderRunBlessingsSummary();
    const buildSummary = selectedBuildNameSummary();
    const synergySummary = activeBuildSynergies().map((synergy) => synergy.name).join(" / ");
    const buildItems = [
      `${game.chapter?.name || theme.name}${game.difficulty?.name ? ` · ${game.difficulty.name}` : ""}`,
      `${realmLabel(game.player.level)} · ${theme.copy?.kills || "击退"} ${game.killCount}`,
      `气血 ${Math.max(0, Math.ceil(game.player.hp))}/${Math.ceil(game.player.maxHp)} · 灵力 ${Math.floor(game.energy.value || 0)}/${game.energy.max || 100}`,
      buildSummary,
      synergySummary ? `流派共鸣：${synergySummary}` : "",
    ].filter(Boolean);
    const spellName = theme.spells?.[selectedCultivationSpell()]?.label || selectedCultivationSpell();
    return `
      <div class="pause-meta">
        ${buildItems.map((item) => `<span>${item}</span>`).join("")}
        <span>升级偏向：${selectedCultivation()?.name || "无功法"}偏向 ${spellName}</span>
      </div>
      <div class="pause-section">
        <strong>局内法术图鉴</strong>
        ${renderSpellCodex()}
      </div>
      <div class="pause-section">
        <strong>身法</strong>
        <div class="pause-spells">
          <span><b>踏风闪避</b><small>Space / Shift / 闪避按钮 · 已用 ${game.runStats.dashes || 0} 次</small></span>
        </div>
      </div>
      ${comboRows.length ? `<div class="pause-section"><strong>法术组合</strong><div class="pause-spells">${comboRows.join("")}</div></div>` : ""}
      ${eventRows.length ? `<div class="pause-section"><strong>本局奇遇</strong><div class="pause-spells">${eventRows.join("")}</div></div>` : ""}
      ${blessingSummary ? `<div class="pause-section">${blessingSummary}</div>` : ""}
      ${affixRows.length ? `<div class="pause-section"><strong>妖魔词缀</strong><div class="pause-spells">${affixRows.join("")}</div></div>` : ""}
      ${damageRows.length ? `<div class="pause-section"><strong>输出排行</strong><div class="pause-spells">${damageRows.map((row) => `<span><b>${row.name}</b><small>${row.amount}</small></span>`).join("")}</div></div>` : ""}
    `;
  }

  return {
    chapterRewardChipRows,
    renderFirstClearRewardSummary,
    calculateRunRewards,
    renderRewardBreakdown,
    renderRewardSourceBreakdown,
    renderDamageBreakdown,
    renderRunBlessingsSummary,
    renderPauseBuildSummary,
  };
}
