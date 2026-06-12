/**
 * 创建局内奇遇模块。
 * 入参：运行时状态、元进度访问器、事件所需的奖励/战斗/界面回调。
 * 出参：奇遇配置解析、事件结算、事件面板、试炼推进与事件掉落相关方法。
 * 作用：把奇遇、伏击、试炼、连锁事件和事件记录从入口文件中抽离。
 */
export function createRunEvents({
  game,
  ui,
  theme,
  metaConfig,
  getMetaState,
  getSelectedDifficulty,
  clamp,
  rand,
  formatCost,
  currencyConfig,
  unique,
  effectSummary,
  debugSecretRoutes,
  spawnEnemyAt,
  damagePlayerFromBoss,
  gainEnergy,
  applyEffects,
  addText,
  addBurst,
  updateUi,
  pushGoalNotice,
}) {
  const metaState = new Proxy({}, {
    get(_target, key) {
      return getMetaState()?.[key];
    },
  });

  function defaultRunEvents() {
    return [
      {
        id: "spring",
        kind: "spring",
        label: "灵泉",
        summary: "回血与灵力",
        color: "#8dffba",
        radius: 18,
        healRatio: 0.22,
        energy: 30,
      },
      {
        id: "chest",
        kind: "chest",
        label: "秘匣",
        summary: "额外结算资源",
        color: "#f4d778",
        radius: 17,
        rewardsByDifficulty: {
          mortal: { spiritStone: 20, dao: 2 },
          mystic: { spiritStone: 28, dao: 3, mysticIron: 1 },
          heaven: { spiritStone: 36, dao: 4, thunderShard: 1 },
        },
      },
    ];
  }

  function currentRunEvents() {
    return game.chapter?.runEvents?.length ? game.chapter.runEvents : defaultRunEvents();
  }

  function getRunEventConfig(eventId) {
    const current = currentRunEvents().find((item) => item.id === eventId);
    if (current) return current;
    for (const chapter of metaConfig?.chapters || []) {
      const match = (chapter.runEvents || []).find((item) => item.id === eventId);
      if (match) return match;
    }
    return defaultRunEvents().find((item) => item.id === eventId) || null;
  }

  function resolveEventCurrencies(config, field, difficulty = game.difficulty || getSelectedDifficulty()) {
    if (!config) return {};
    const difficultyId = difficulty?.id || "mortal";
    const byDifficulty = config[`${field}ByDifficulty`];
    if (byDifficulty?.[difficultyId]) return { ...byDifficulty[difficultyId] };
    return { ...(config[field] || {}) };
  }

  function resolveEventValue(config, field, difficulty = game.difficulty || getSelectedDifficulty()) {
    if (!config) return 0;
    const difficultyId = difficulty?.id || "mortal";
    const byDifficulty = config[`${field}ByDifficulty`];
    if (Number.isFinite(byDifficulty?.[difficultyId])) return byDifficulty[difficultyId];
    return Number.isFinite(config[field]) ? config[field] : 0;
  }

  function resolveEventAmbush(config, difficulty = game.difficulty || getSelectedDifficulty()) {
    if (!config) return {};
    const difficultyId = difficulty?.id || "mortal";
    const byDifficulty = config.ambushByDifficulty;
    if (byDifficulty?.[difficultyId]) return { ...byDifficulty[difficultyId] };
    return { ...(config.ambush || {}) };
  }

  function resolveEventChallenge(config, difficulty = game.difficulty || getSelectedDifficulty()) {
    if (!config) return null;
    const difficultyId = difficulty?.id || "mortal";
    const byDifficulty = config.challengeByDifficulty;
    const challenge = byDifficulty?.[difficultyId] || config.challenge;
    return challenge ? structuredClone(challenge) : null;
  }

  function ambushSummaryText(ambush = {}) {
    const enemyNames = {
      manager: theme.enemies?.manager?.name || "小妖",
      director: theme.enemies?.director?.name || "精英",
      boss: theme.enemies?.boss?.name || "Boss",
    };
    return Object.entries(ambush)
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .map(([key, value]) => `${enemyNames[key] || key} ${value}`)
      .join(" / ");
  }

  function challengeRewardSummary(challenge = {}) {
    const successText = [formatCost(challenge.successRewards || {}), formatCost(challenge.successPickupRewards || {})].filter(Boolean).join(" / ");
    const failText = [formatCost(challenge.failRewards || {}), formatCost(challenge.failPickupRewards || {})].filter(Boolean).join(" / ");
    const rows = [];
    if (successText) rows.push(`成功 ${successText}`);
    if (failText) rows.push(`失败 ${failText}`);
    return rows.join(" / ");
  }

  function challengeStateText(challenge = {}, includeRewards = false) {
    if (!challenge) return "";
    const parts = [];
    if (challenge.result === "success") {
      parts.push(`试炼成功 ${challenge.defeated || challenge.targetCount || 0}/${challenge.targetCount || challenge.defeated || 0}`);
    } else if (challenge.result === "fail") {
      parts.push(`试炼失守 ${challenge.defeated || 0}/${challenge.targetCount || 0}`);
    } else if (challenge.active && Number.isFinite(challenge.targetCount)) {
      parts.push(`试炼进行中 ${challenge.defeated || 0}/${challenge.targetCount}`);
    } else if (Number.isFinite(challenge.targetCount)) {
      parts.push(`试炼 ${challenge.targetCount}`);
    }
    if (includeRewards && challenge.rewardText) parts.push(challenge.rewardText);
    return parts.join(" / ");
  }

  function resolveEventChoices(config, difficulty = game.difficulty || getSelectedDifficulty()) {
    if (!config) return [];
    const difficultyId = difficulty?.id || "mortal";
    const byDifficulty = config.choicesByDifficulty;
    const choices = byDifficulty?.[difficultyId] || config.choices || [];
    return choices.length ? structuredClone(choices) : [];
  }

  function resolveEventChance(config, difficulty = game.difficulty || getSelectedDifficulty()) {
    if (!config) return 0;
    const difficultyId = difficulty?.id || "mortal";
    const byDifficulty = config.chanceByDifficulty;
    if (Number.isFinite(byDifficulty?.[difficultyId])) return clamp(byDifficulty[difficultyId], 0, 1);
    return Number.isFinite(config.chance) ? clamp(config.chance, 0, 1) : 0;
  }

  function isHiddenRunEvent(config) {
    return Boolean(config?.hidden);
  }

  function hasSeenRunEvent(eventId) {
    return Boolean(metaState?.records?.events?.[eventId]?.count);
  }

  function shouldRevealRunEvent(config) {
    return !isHiddenRunEvent(config) || hasSeenRunEvent(config.id);
  }

  function resolveEventSecretFollowup(config, difficulty = game.difficulty || getSelectedDifficulty()) {
    if (!config?.secretFollowup?.eventId) return null;
    const secret = structuredClone(config.secretFollowup);
    secret.chance = debugSecretRoutes ? 1 : resolveEventChance(config.secretFollowup, difficulty);
    return secret;
  }

  function blessingSummaryText(blessing = {}) {
    return blessing.summary || effectSummary(blessing.effects || [], 1) || "";
  }

  function followupEventSummary(eventId, options = {}) {
    const config = getRunEventConfig(eventId);
    if (!config) return eventId || "";
    if (isHiddenRunEvent(config) && !options.revealHidden && !shouldRevealRunEvent(config)) {
      return options.hiddenLabel || "隐秘机缘";
    }
    return `${config.label}${config.summary ? ` · ${config.summary}` : ""}`;
  }

  function formatChancePercent(chance = 0) {
    return `${Math.round(clamp(chance, 0, 1) * 100)}%`;
  }

  function eventFollowupTargets(config, difficulty = game.difficulty || getSelectedDifficulty()) {
    const targets = resolveEventChoices(config, difficulty)
      .filter((choice) => choice.followupEventId)
      .map((choice) => ({
        routeLabel: choice.label,
        eventId: choice.followupEventId,
        hidden: Boolean(getRunEventConfig(choice.followupEventId)?.hidden),
        chance: 1,
        kind: "chain",
      }));
    const secret = resolveEventSecretFollowup(config, difficulty);
    if (secret?.eventId) {
      targets.push({
        routeLabel: secret.routeLabel || "秘径",
        eventId: secret.eventId,
        hidden: Boolean(getRunEventConfig(secret.eventId)?.hidden),
        chance: secret.chance,
        announceText: secret.announceText || "",
        kind: "secret",
      });
    }
    return targets;
  }

  function eventFollowupHintText(target) {
    const chanceText = target.kind === "secret" && target.chance > 0 && target.chance < 1 ? ` ${formatChancePercent(target.chance)}` : "";
    return `${target.routeLabel}${chanceText} -> ${followupEventSummary(target.eventId)}`;
  }

  function runEventChoiceSummary(row) {
    const choices = Object.values(row?.choices || {});
    if (!choices.length) return "";
    return `抉择 ${choices.map((choice) => `${choice.label}${choice.count > 1 ? ` ${choice.count}次` : ""}`).join(" / ")}`;
  }

  function runEventBlessingSummary(row) {
    const blessings = Object.values(row?.blessings || {});
    if (!blessings.length) return "";
    return `加持 ${blessings.map((blessing) => `${blessing.label}${blessing.summary ? ` · ${blessing.summary}` : ""}`).join(" / ")}`;
  }

  function runEventFollowupSummary(row) {
    const followups = Object.values(row?.followups || {});
    if (!followups.length) return "";
    return `连锁 ${followups.map((item) => `${item.label}${item.count > 1 ? ` ${item.count}次` : ""}`).join(" / ")}`;
  }

  function activeRunBlessingRows() {
    return Object.values(game.runStats?.blessings || {})
      .filter((row) => row.count > 0)
      .map((row) => ({
        ...row,
        text: `${row.label}${row.count > 1 ? ` ×${row.count}` : ""}${row.summary ? ` · ${row.summary}` : ""}`,
      }));
  }

  function updateMetaEventRecord(config, payload = {}) {
    if (!metaState?.records || !config?.id) return;
    if (!metaState.records.events) metaState.records.events = {};
    const existing = metaState.records.events[config.id] || {
      id: config.id,
      label: config.label,
      summary: config.summary || "",
      count: 0,
      chapters: [],
      difficulties: [],
      choices: {},
      blessings: {},
      followups: {},
    };
    existing.label = config.label || existing.label;
    existing.summary = config.summary || existing.summary;
    existing.count += 1;
    if (game.chapter?.id) existing.chapters = unique([...(existing.chapters || []), game.chapter.id]);
    if (game.difficulty?.id) existing.difficulties = unique([...(existing.difficulties || []), game.difficulty.id]);
    if (payload.choice?.id) {
      const row = existing.choices[payload.choice.id] || { label: payload.choice.label, count: 0, summary: payload.choice.summary || "" };
      row.label = payload.choice.label || row.label;
      row.count += 1;
      if (payload.choice.summary) row.summary = payload.choice.summary;
      existing.choices[payload.choice.id] = row;
    }
    if (payload.blessing?.id) {
      const row = existing.blessings[payload.blessing.id] || { label: payload.blessing.label, count: 0, summary: payload.blessing.summary || "" };
      row.label = payload.blessing.label || row.label;
      row.count += 1;
      if (payload.blessing.summary) row.summary = payload.blessing.summary;
      existing.blessings[payload.blessing.id] = row;
    }
    const followups = payload.followups || (payload.followup ? [payload.followup] : []);
    for (const followup of followups) {
      if (!followup?.id) continue;
      const row = existing.followups[followup.id] || { label: followup.label, count: 0 };
      row.label = followup.label || row.label;
      row.count += 1;
      existing.followups[followup.id] = row;
    }
    metaState.records.events[config.id] = existing;
  }

  function recordRunEvent(config, payload = {}) {
    if (!config) return;
    const events = game.runStats.events;
    if (!events.details) events.details = {};
    const entry = events.details[config.id] || {
      label: config.label,
      summary: config.summary || "",
      count: 0,
      rewards: {},
      pickupRewards: {},
      totalHeal: 0,
      totalEnergy: 0,
      totalDamage: 0,
      ambush: {},
      challenge: null,
      choices: {},
      blessings: {},
      followups: {},
    };
    entry.count += 1;
    entry.summary = config.summary || entry.summary;
    entry.totalHeal += payload.heal || 0;
    entry.totalEnergy += payload.energy || 0;
    entry.totalDamage += payload.damage || 0;
    for (const [key, value] of Object.entries(payload.rewards || {})) entry.rewards[key] = (entry.rewards[key] || 0) + value;
    for (const [key, value] of Object.entries(payload.pickupRewards || {})) entry.pickupRewards[key] = (entry.pickupRewards[key] || 0) + value;
    for (const [key, value] of Object.entries(payload.ambush || {})) entry.ambush[key] = (entry.ambush[key] || 0) + value;
    if (payload.challenge) entry.challenge = { ...(entry.challenge || {}), ...payload.challenge };
    if (payload.choice?.id) {
      const current = entry.choices[payload.choice.id] || { label: payload.choice.label, count: 0 };
      current.label = payload.choice.label || current.label;
      current.count += 1;
      if (payload.choice.summary) current.summary = payload.choice.summary;
      entry.choices[payload.choice.id] = current;
    }
    if (payload.blessing?.id) {
      const current = entry.blessings[payload.blessing.id] || { label: payload.blessing.label, count: 0, summary: payload.blessing.summary || "" };
      current.label = payload.blessing.label || current.label;
      current.count += 1;
      if (payload.blessing.summary) current.summary = payload.blessing.summary;
      entry.blessings[payload.blessing.id] = current;
    }
    const followups = payload.followups || (payload.followup ? [payload.followup] : []);
    for (const followup of followups) {
      if (!followup?.id) continue;
      const current = entry.followups[followup.id] || { label: followup.label, count: 0 };
      current.label = followup.label || current.label;
      current.count += 1;
      entry.followups[followup.id] = current;
    }
    events.details[config.id] = entry;
    updateMetaEventRecord(config, payload);
    if (config.kind === "spring") events.spring += 1;
    if (config.kind === "chest") events.chest += 1;
  }

  function patchRunEventDetail(eventId, patch = {}) {
    if (!eventId) return;
    const events = game.runStats.events;
    if (!events.details) events.details = {};
    const entry = events.details[eventId];
    if (!entry) return;
    for (const [key, value] of Object.entries(patch.rewards || {})) entry.rewards[key] = (entry.rewards[key] || 0) + value;
    for (const [key, value] of Object.entries(patch.pickupRewards || {})) entry.pickupRewards[key] = (entry.pickupRewards[key] || 0) + value;
    if (patch.challenge) entry.challenge = { ...(entry.challenge || {}), ...patch.challenge };
  }

  function recordRunBlessing(blessing, sourceLabel = "") {
    if (!blessing?.id) return null;
    if (!game.runStats.blessings) game.runStats.blessings = {};
    const existing = game.runStats.blessings[blessing.id] || {
      id: blessing.id,
      label: blessing.label || "临时加持",
      count: 0,
      summary: blessingSummaryText(blessing),
      sources: [],
    };
    existing.label = blessing.label || existing.label;
    existing.summary = blessingSummaryText(blessing) || existing.summary;
    existing.count += 1;
    if (sourceLabel) existing.sources = unique([...(existing.sources || []), sourceLabel]);
    game.runStats.blessings[blessing.id] = existing;
    return existing;
  }

  function spawnConfiguredRunEvent(config, options = {}) {
    if (!config) return null;
    const angle = options.angle ?? Math.random() * Math.PI * 2;
    const distanceFromPlayer = options.distance ?? rand(180, 310);
    const origin = options.origin || game.player;
    game.pickups.push({
      id: game.nextEntityId++,
      type: "event",
      eventType: config.id,
      eventKind: config.kind || config.id,
      label: config.label,
      color: config.color,
      x: origin.x + Math.cos(angle) * distanceFromPlayer,
      y: origin.y + Math.sin(angle) * distanceFromPlayer,
      radius: config.radius,
      age: 0,
      life: 24,
      magnet: false,
    });
    game.events.spawned += 1;
    game.events.lastEventId = config.id;
    addText(options.announceText || `${config.label}现世`, game.player.x, game.player.y - 88, config.color);
    return config;
  }

  function spawnRunEvent(eventId = "", options = {}) {
    const events = currentRunEvents();
    if (!events.length) return null;
    const explicit = eventId ? events.find((item) => item.id === eventId) : null;
    if (explicit) return spawnConfiguredRunEvent(explicit, options);
    const previousEventId = game.events.lastEventId || "";
    const pool = events.length > 1 ? events.filter((item) => item.id !== previousEventId) : events;
    const config = pool[Math.floor(Math.random() * pool.length)] || events[0];
    return spawnConfiguredRunEvent(config, options);
  }

  function spawnEventAmbush(ambush = {}, source = {}) {
    const entries = Object.entries(ambush).filter(([, value]) => Number.isFinite(value) && value > 0);
    for (const [type, count] of entries) {
      for (let index = 0; index < count; index += 1) {
        const angle = rand(0, Math.PI * 2);
        const radius = rand(120, 185);
        spawnEnemyAt(type, game.player.x + Math.cos(angle) * radius, game.player.y + Math.sin(angle) * radius, {
          color: source.color,
          affix: null,
          eventChallengeId: source.challengeId || "",
        });
      }
    }
    if (entries.length) {
      game.camera.shake = Math.max(game.camera.shake, 10);
      addText("伏击骤起！", game.player.x, game.player.y - 62, source.color || "#ff8a8a");
    }
  }

  function startEventChallenge(config, challenge, ambush = {}) {
    if (!config || !challenge) return null;
    if (game.activeEventChallenge && !game.activeEventChallenge.resolved) resolveActiveEventChallenge(false);
    const targetCount = Math.max(1, challenge.targetCount || Object.values(ambush).reduce((sum, value) => sum + value, 0));
    const active = {
      id: `${config.id}:${game.time}:${Math.random()}`,
      eventId: config.id,
      label: config.label,
      summary: config.summary || "",
      startedAt: game.time,
      endsAt: game.time + Math.max(4, challenge.duration || 12),
      targetCount,
      defeated: 0,
      successRewards: { ...(challenge.successRewards || {}) },
      successPickupRewards: { ...(challenge.successPickupRewards || {}) },
      failRewards: { ...(challenge.failRewards || {}) },
      failPickupRewards: { ...(challenge.failPickupRewards || {}) },
      ambush: { ...ambush },
      resolved: false,
      result: "",
    };
    game.activeEventChallenge = active;
    patchRunEventDetail(config.id, {
      challenge: {
        active: true,
        result: "",
        targetCount: active.targetCount,
        defeated: 0,
        rewardText: challengeRewardSummary(challenge),
      },
    });
    return active;
  }

  function addEventReward(delta) {
    const rewards = game.runStats.events.rewards;
    for (const [key, value] of Object.entries(delta || {})) rewards[key] = (rewards[key] || 0) + value;
  }

  function addPickupReward(delta) {
    const rewards = game.runStats.pickupRewards;
    for (const [key, value] of Object.entries(delta || {})) rewards[key] = (rewards[key] || 0) + value;
  }

  function spawnMaterialPickup(x, y, currencyKey, value, options = {}) {
    if (!currencyKey || !Number.isFinite(value) || value <= 0) return;
    const config = currencyConfig(currencyKey);
    game.pickups.push({
      id: game.nextEntityId++,
      type: "material",
      currencyKey,
      label: config.name,
      iconText: config.iconText || config.name.slice(0, 1),
      color: config.color || "#f7f3e8",
      x,
      y,
      value: Math.floor(value),
      radius: options.radius || 11,
      age: 0,
      magnet: false,
    });
  }

  function spawnRewardPickups(x, y, rewards = {}, options = {}) {
    const entries = Object.entries(rewards).filter(([, value]) => Number.isFinite(value) && value > 0);
    if (!entries.length) return;
    const spread = options.spread || 20;
    entries.forEach(([currencyKey, value], index) => {
      const angle = entries.length === 1 ? rand(0, Math.PI * 2) : (Math.PI * 2 * index) / entries.length;
      const distanceFromSource = entries.length === 1 ? 0 : spread + index * 4;
      spawnMaterialPickup(
        x + Math.cos(angle) * distanceFromSource,
        y + Math.sin(angle) * distanceFromSource,
        currencyKey,
        value,
        options,
      );
    });
  }

  function resolveActiveEventChallenge(success) {
    const challenge = game.activeEventChallenge;
    if (!challenge || challenge.resolved) return;
    challenge.resolved = true;
    challenge.result = success ? "success" : "fail";
    const rewardDelta = success ? challenge.successRewards : challenge.failRewards;
    const pickupDelta = success ? challenge.successPickupRewards : challenge.failPickupRewards;
    if (Object.keys(rewardDelta || {}).length) addEventReward(rewardDelta);
    if (Object.keys(pickupDelta || {}).length) spawnRewardPickups(game.player.x + 12, game.player.y - 8, pickupDelta, { radius: 10, spread: 16 });
    patchRunEventDetail(challenge.eventId, {
      rewards: rewardDelta,
      pickupRewards: pickupDelta,
      challenge: {
        active: false,
        result: challenge.result,
        targetCount: challenge.targetCount,
        defeated: Math.min(challenge.targetCount, challenge.defeated),
        rewardText: challengeRewardSummary({
          successRewards: challenge.successRewards,
          successPickupRewards: challenge.successPickupRewards,
          failRewards: challenge.failRewards,
          failPickupRewards: challenge.failPickupRewards,
        }),
      },
    });
    const title = success ? `${challenge.label} 试炼完成` : `${challenge.label} 试炼失守`;
    const detail = [ambushSummaryText(challenge.ambush), formatCost(rewardDelta), formatCost(pickupDelta)].filter(Boolean).join(" / ") || "只保住了基础收益";
    pushGoalNotice(`event:${challenge.id}:${challenge.result}`, title, detail);
    addText(title, game.player.x, game.player.y - 86, success ? "#9dffca" : "#ff9a9a");
    game.activeEventChallenge = null;
  }

  function updateEventChallenge() {
    const challenge = game.activeEventChallenge;
    if (!challenge || challenge.resolved || game.state !== "playing") return;
    if (challenge.defeated >= challenge.targetCount) {
      resolveActiveEventChallenge(true);
      return;
    }
    if (game.time >= challenge.endsAt) resolveActiveEventChallenge(false);
  }

  function updateRunEvents() {
    if (!game.events) return;
    if (game.time < (game.events.nextAt || 0)) return;
    spawnRunEvent();
    game.events.nextAt = game.time + rand(32, 46);
  }

  function resolveRunEventOutcome(config, choice = null) {
    const source = choice ? { ...config, label: choice.label || config.label, summary: choice.summary || config.summary, color: choice.color || config.color } : config;
    const mergeRewardMaps = (base = {}, extra = {}) => {
      const merged = { ...base };
      for (const [key, value] of Object.entries(extra || {})) merged[key] = (merged[key] || 0) + value;
      return merged;
    };
    const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
    const choiceOverridesDamage = choice && (hasOwn(choice, "damage") || hasOwn(choice, "damageByDifficulty"));
    const choiceOverridesAmbush = choice && (hasOwn(choice, "ambush") || hasOwn(choice, "ambushByDifficulty"));
    const choiceOverridesChallenge = choice && (hasOwn(choice, "challenge") || hasOwn(choice, "challengeByDifficulty"));
    const healRatio = typeof (choice && hasOwn(choice, "healRatio") ? choice.healRatio : config.healRatio) === "number"
      ? (choice && hasOwn(choice, "healRatio") ? choice.healRatio : config.healRatio)
      : 0;
    const heal = healRatio ? Math.round(game.player.maxHp * healRatio) : 0;
    return {
      source,
      displayLabel: choice ? `${config.label}·${choice.label || "抉择"}` : config.label,
      heal,
      energy: Math.round(choice && hasOwn(choice, "energy") ? choice.energy || 0 : config.energy || 0),
      rewards: mergeRewardMaps(resolveEventCurrencies(config, "rewards"), choice ? resolveEventCurrencies(choice, "rewards") : {}),
      pickupRewards: mergeRewardMaps(resolveEventCurrencies(config, "pickupRewards"), choice ? resolveEventCurrencies(choice, "pickupRewards") : {}),
      damage: choiceOverridesDamage ? resolveEventValue(choice, "damage") : resolveEventValue(config, "damage"),
      ambush: choiceOverridesAmbush ? resolveEventAmbush(choice) : resolveEventAmbush(config),
      challenge: choiceOverridesChallenge ? resolveEventChallenge(choice) : resolveEventChallenge(config),
      followupEventId: choice?.followupEventId || config.followupEventId || "",
      secretFollowup: choice?.secretFollowup ? resolveEventSecretFollowup(choice) : resolveEventSecretFollowup(config),
      choice: choice ? { id: choice.id, label: choice.label || "抉择", summary: choice.summary || "" } : null,
      blessing: choice?.blessing ? structuredClone(choice.blessing) : source.blessing ? structuredClone(source.blessing) : null,
    };
  }

  function runEventOutcomeParts(outcome) {
    return [
      outcome.heal > 0 ? `气血 +${outcome.heal}` : "",
      outcome.energy > 0 ? `灵力 +${outcome.energy}` : "",
      outcome.damage > 0 ? `代价 -${outcome.damage}` : "",
      Object.keys(outcome.ambush || {}).length ? `伏击 ${ambushSummaryText(outcome.ambush)}` : "",
      outcome.challenge ? `试炼 ${Math.round((outcome.challenge.duration || 12) * 10) / 10}s` : "",
      formatCost(outcome.rewards),
      Object.keys(outcome.pickupRewards || {}).length ? `掉落 ${formatCost(outcome.pickupRewards)}` : "",
      outcome.blessing ? `加持 ${outcome.blessing.label}${blessingSummaryText(outcome.blessing) ? ` · ${blessingSummaryText(outcome.blessing)}` : ""}` : "",
    ].filter(Boolean);
  }

  function applyRunEventBlessing(blessing, sourceLabel = "") {
    if (!blessing?.effects?.length) return null;
    const previousMaxHp = game.player.maxHp;
    applyEffects(blessing.effects, 1);
    const maxHpGain = Math.max(0, game.player.maxHp - previousMaxHp);
    if (maxHpGain > 0) game.player.hp = Math.min(game.player.maxHp, game.player.hp + maxHpGain);
    game.player.hp = clamp(game.player.hp, 0, game.player.maxHp);
    game.energy.value = clamp(game.energy.value || 0, 0, game.energy.max || 100);
    return recordRunBlessing(blessing, sourceLabel);
  }

  function triggerRunEventFollowup(config, followupEventId, options = {}) {
    if (!followupEventId || game.state !== "playing") return null;
    if (!game.runStats.eventChains) game.runStats.eventChains = {};
    const chainKey = `${options.chainType || "chain"}:${config.id}->${followupEventId}`;
    if (game.runStats.eventChains[chainKey]) return null;
    const followup = getRunEventConfig(followupEventId);
    if (!followup) return null;
    game.runStats.eventChains[chainKey] = (game.runStats.eventChains[chainKey] || 0) + 1;
    spawnConfiguredRunEvent(followup, {
      distance: options.distance ?? 118,
      origin: game.player,
      announceText: options.announceText || `${followup.label}被引动`,
    });
    return { id: followup.id, label: followup.label, kind: options.chainType || "chain" };
  }

  function maybeTriggerRunEventFollowups(config, outcome) {
    if (game.state !== "playing") return [];
    const triggered = [];
    if (outcome?.followupEventId) {
      const normal = triggerRunEventFollowup(config, outcome.followupEventId, { chainType: "chain" });
      if (normal) triggered.push(normal);
    }
    const secret = outcome?.secretFollowup;
    if (secret?.eventId && secret.chance > 0 && Math.random() <= secret.chance) {
      const rare = triggerRunEventFollowup(config, secret.eventId, {
        chainType: "secret",
        distance: 132,
        announceText: secret.announceText || "隐秘机缘显现",
      });
      if (rare) triggered.push(rare);
    }
    return triggered;
  }

  function applyRunEventOutcome(config, pickup, choice = null) {
    const outcome = resolveRunEventOutcome(config, choice);
    if (outcome.heal > 0) game.player.hp = Math.min(game.player.maxHp, game.player.hp + outcome.heal);
    if (outcome.energy > 0) gainEnergy(outcome.energy);
    if (Object.keys(outcome.rewards).length) addEventReward(outcome.rewards);
    if (Object.keys(outcome.pickupRewards).length) spawnRewardPickups(pickup.x, pickup.y, outcome.pickupRewards, { radius: 10, spread: 14 });
    const actualDamage = outcome.damage > 0 ? damagePlayerFromBoss(outcome.damage, { color: outcome.source.color || "#ff7676" }) : 0;
    const recordedBlessing = outcome.blessing ? applyRunEventBlessing(outcome.blessing, config.label) : null;
    const canContinue = game.state === "playing";
    const activeChallenge = canContinue && outcome.challenge ? startEventChallenge(config, outcome.challenge, outcome.ambush) : null;
    if (Object.keys(outcome.ambush).length && canContinue) {
      spawnEventAmbush(outcome.ambush, { ...outcome.source, challengeId: activeChallenge?.id || "" });
    }
    const triggeredFollowups = canContinue ? maybeTriggerRunEventFollowups(config, outcome) : [];
    recordRunEvent(config, {
      heal: outcome.heal,
      energy: outcome.energy,
      damage: actualDamage,
      rewards: outcome.rewards,
      pickupRewards: outcome.pickupRewards,
      ambush: outcome.ambush,
      choice: outcome.choice,
      blessing: recordedBlessing ? { id: recordedBlessing.id, label: recordedBlessing.label, summary: recordedBlessing.summary } : null,
      followups: triggeredFollowups,
      challenge: activeChallenge
        ? {
            active: true,
            result: "",
            targetCount: activeChallenge.targetCount,
            defeated: 0,
            rewardText: challengeRewardSummary(outcome.challenge),
          }
        : null,
    });
    if (game.state !== "ended") {
      const followupText = triggeredFollowups.length ? ` / 连锁 ${triggeredFollowups.map((item) => item.label).join(" / ")}` : "";
      addText(
        `${outcome.displayLabel} ${runEventOutcomeParts({ ...outcome, damage: actualDamage }).join(" / ")}${followupText}`.trim(),
        game.player.x,
        game.player.y - 42,
        pickup.color || outcome.source.color || "#f4d778",
      );
      addBurst(pickup.x, pickup.y, pickup.color || outcome.source.color || "#f4d778", config.kind === "spring" ? 18 : 20);
    }
  }

  function renderRunEventChoicePanel() {
    const pending = game.activeEventChoice;
    if (!pending || !ui.eventChoicePanel || !ui.eventChoiceOptions) return;
    if (ui.eventChoiceTitle) ui.eventChoiceTitle.textContent = `${pending.config.label} · 抉择`;
    if (ui.eventChoiceSubtitle) {
      ui.eventChoiceSubtitle.textContent = pending.config.choicePrompt || pending.config.summary || "此番机缘，可择一路。";
    }
    ui.eventChoiceOptions.innerHTML = pending.options
      .map((choice) => {
        const outcome = resolveRunEventOutcome(pending.config, choice);
        const choiceSummary = [choice.desc || choice.summary || "", ...runEventOutcomeParts(outcome)].filter(Boolean).join(" / ");
        return `
          <button class="choice run-event-choice" data-kind="${choice.kind || "fate"}" data-choice-id="${choice.id}" type="button">
            <span class="choice-meta">
              <b class="choice-tag">奇遇</b>
              <b class="choice-rarity">${choice.rarity || "机缘"}</b>
            </span>
            <strong class="run-event-choice-title">${choice.label}</strong>
            <span class="choice-desc">${choiceSummary}</span>
          </button>
        `;
      })
      .join("");
    ui.eventChoicePanel.classList.remove("hidden");
  }

  function openRunEventChoice(config, pickup) {
    const options = resolveEventChoices(config);
    if (!options.length || !ui.eventChoicePanel || !ui.eventChoiceOptions) return false;
    game.activeEventChoice = {
      config,
      pickup: { x: pickup.x, y: pickup.y, color: pickup.color || config.color || "#f4d778" },
      options,
    };
    game.state = "event-choice";
    renderRunEventChoicePanel();
    updateUi();
    return true;
  }

  function selectRunEventChoice(choiceId) {
    const pending = game.activeEventChoice;
    if (!pending) return false;
    const choice = pending.options.find((item) => item.id === choiceId) || pending.options[0];
    ui.eventChoicePanel?.classList.add("hidden");
    game.activeEventChoice = null;
    if (game.state === "event-choice") game.state = "playing";
    applyRunEventOutcome(pending.config, pending.pickup, choice);
    updateUi();
    return true;
  }

  function pickupBonusForBoss(drops = {}) {
    const scale = game.difficulty?.id === "heaven" ? 0.22 : game.difficulty?.id === "mystic" ? 0.18 : 0.15;
    const bonus = {};
    for (const [key, amount] of Object.entries(drops)) {
      if (!Number.isFinite(amount) || amount <= 0) continue;
      bonus[key] = key === "thunderShard" ? 1 : Math.max(1, Math.floor(amount * scale));
    }
    return bonus;
  }

  function rewardPickupsForEnemy(enemy) {
    if (enemy.type === "director") {
      const chance = game.difficulty?.id === "heaven" ? 0.8 : game.difficulty?.id === "mystic" ? 0.55 : 0.35;
      return Math.random() < chance ? { mysticIron: 1 } : null;
    }
    if (enemy.type === "boss") {
      return pickupBonusForBoss(game.chapter?.drops || {});
    }
    return null;
  }

  function collectRunEvent(pickup) {
    const config = getRunEventConfig(pickup.eventType) || {
      id: pickup.eventType,
      kind: pickup.eventKind || pickup.eventType,
      label: pickup.label || "奇遇",
      summary: "",
    };
    if (resolveEventChoices(config).length && openRunEventChoice(config, pickup)) return;
    applyRunEventOutcome(config, pickup);
  }

  return {
    defaultRunEvents,
    currentRunEvents,
    getRunEventConfig,
    resolveEventCurrencies,
    resolveEventValue,
    resolveEventAmbush,
    resolveEventChallenge,
    ambushSummaryText,
    challengeRewardSummary,
    challengeStateText,
    resolveEventChoices,
    hasSeenRunEvent,
    shouldRevealRunEvent,
    followupEventSummary,
    eventFollowupTargets,
    eventFollowupHintText,
    runEventChoiceSummary,
    runEventBlessingSummary,
    runEventFollowupSummary,
    activeRunBlessingRows,
    updateRunEvents,
    updateEventChallenge,
    addEventReward,
    addPickupReward,
    spawnMaterialPickup,
    spawnRewardPickups,
    resolveActiveEventChallenge,
    spawnRunEvent,
    selectRunEventChoice,
    collectRunEvent,
    rewardPickupsForEnemy,
  };
}
