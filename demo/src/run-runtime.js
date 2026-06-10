/**
 * 创建局内运行时模块。
 * 入参：游戏状态、界面节点、主题配置、元进度访问器，以及构筑/奇遇/结算等域模块回调。
 * 出参：运行时更新、战斗调试、局内工具函数和若干对外只读配置。
 * 作用：把战斗循环、Boss 机制、投射物、拾取物、局内 UI 和开局/结算流程从入口文件中抽离。
 */
export function createRunRuntime({
  game,
  ui,
  canvas,
  keys,
  pointer,
  theme,
  metaConfig,
  getMetaState,
  saveMetaState,
  getSelectedChapter,
  getSelectedDifficulty,
  clamp,
  rand,
  distance,
  normalize,
  mapById,
  currencyName,
  loadImageAsset,
  imageAssets,
  setHudMetric,
  isCompactHud,
  compactRealmLabel,
  realmLabel,
  getUiMode = () => "desktop",
  homeController,
  activeBuildSynergies = () => [],
  openUpgradePanel = () => {},
  addCurrencies = () => {},
  unlockProgressAfterRun = () => [],
  updateComboRecordsAfterRun = () => {},
  ensureChapterRecord = () => null,
  updateRunEvents = () => {},
  updateEventChallenge = () => {},
  spawnRunEvent = () => null,
  selectRunEventChoice = () => {},
  collectRunEvent = () => {},
  rewardPickupsForEnemy = () => null,
  addPickupReward = () => {},
  spawnRewardPickups = () => {},
  resolveActiveEventChallenge = () => {},
  clearGoalToastTimer = () => {},
  renderRunGoals = () => {},
  updateRunGoalNotices = () => {},
  renderGoalToast = () => {},
  renderResultNextSteps = () => {},
  renderQuestCompletionSummary = () => "",
  claimableQuestCount = () => 0,
  calculateRunRewards = () => null,
  renderRewardBreakdown = () => "",
  renderRewardSourceBreakdown = () => "",
  renderDamageBreakdown = () => "",
  renderRunBlessingsSummary = () => "",
  renderPauseBuildSummary = () => "",
  renderFirstClearRewardSummary = () => "",
  equipmentSummaryText = () => "",
  debugMetaMode = "",
  debugFinishOnStart = false,
  debugResolveEventId = "",
  debugResolveEventChoice = "",
  debugResolveEventChain = 0,
  debugOpenTab = "",
  debugResultMode = "",
}) {
  const damageSourceFallbacks = {
    keyboard: "御剑成阵",
    coffee: "业火莲华",
    invoice: "雷符万钧",
    fireThunder: "火莲引雷",
    swordTalisman: "飞剑附符",
    ultimate: "天劫雷瀑",
    unknown: "散修余威",
  };

  const enemyAffixes = {
    swift: { id: "swift", name: "迅捷", color: "#b9f3ff", desc: "移速提高，逼迫玩家走位。" },
    armored: { id: "armored", name: "厚甲", color: "#f4d778", desc: "气血提高，优先用高伤害法术处理。" },
    leech: { id: "leech", name: "噬灵", color: "#d68cff", desc: "碰撞命中会额外损耗灵力。" },
  };

  function damageSourceName(source) {
    if (source === "ultimate") return theme.spells?.ultimate?.name || damageSourceFallbacks.ultimate;
    return theme.weapons?.[source]?.name || damageSourceFallbacks[source] || damageSourceFallbacks.unknown;
  }

  function cloneWeapons() {
    return Object.fromEntries(Object.entries(theme.weapons).map(([key, weapon]) => [key, { ...weapon, timer: 0 }]));
  }

  function createEquipmentState() {
    return Object.fromEntries(Object.keys(theme.equipmentSlots || {}).map((slot) => [slot, { tier: 0 }]));
  }

  function getBalanceConfig() {
    return theme.balance || null;
  }

  function xpRequiredForLevel(level) {
    const curve = game.balance?.xpCurve;
    if (!curve) return game.player.nextXp ? Math.floor(game.player.nextXp * 1.32 + 16) : 36;
    const zeroBasedLevel = Math.max(0, level - 1);
    return Math.round((curve.base || 90) * Math.pow(curve.growth || 1.38, zeroBasedLevel) + (curve.flatAdd || 0) * zeroBasedLevel);
  }

  function xpForEnemy(type, fallback) {
    const curve = game.balance?.xpCurve;
    if (!curve) return fallback;
    if (type === "manager") return curve.minEnemyXp ?? fallback;
    if (type === "director") return curve.eliteXp ?? fallback;
    if (type === "boss") return curve.bossXp ?? fallback;
    return fallback;
  }

  function bossAtForChapter(chapter = game.chapter) {
    const target = game.balance?.bossTargets?.chapterBossAt?.[chapter?.id] ?? chapter?.bossAt;
    const multiplier = game.balance?.difficultyPacing?.[game.difficulty?.id]?.bossAtMultiplier || 1;
    return typeof target === "number" ? Math.round(target * multiplier) : target;
  }

  function bossHpForChapter(chapter = game.chapter, fallback) {
    const target = game.balance?.bossTargets?.chapterBossHp?.[chapter?.id] ?? fallback;
    const multiplier = game.balance?.difficultyPacing?.[game.difficulty?.id]?.bossHpMultiplier || 1;
    return typeof target === "number" ? Math.round(target * multiplier) : target;
  }

  function recordBalanceMetric(key, value) {
    if (!game.runStats.balance) game.runStats.balance = {};
    if (typeof game.runStats.balance[key] === "undefined") game.runStats.balance[key] = value;
  }

  function getBalanceSnapshot() {
    return {
      enabled: Boolean(game.balance),
      targets: structuredClone(game.balance?.runTargets || {}),
      xpCurve: structuredClone(game.balance?.xpCurve || {}),
      bossTargets: structuredClone(game.balance?.bossTargets || {}),
      difficultyPacing: structuredClone(game.balance?.difficultyPacing || {}),
      firstUpgradeTime: game.runStats?.balance?.firstUpgradeTime ?? null,
      bossSpawnTime: game.runStats?.balance?.bossSpawnTime ?? null,
      bossKillTime: game.runStats?.balance?.bossKillTime ?? null,
      bossTtk: game.runStats?.balance?.bossTtk ?? null,
      upgradeChoices: game.runStats?.breakthroughs || 0,
      nextXp: game.player?.nextXp || 0,
    };
  }

  function ensurePath(root, parts) {
    let current = root;
    for (const part of parts.slice(0, -1)) {
      if (!current[part] || typeof current[part] !== "object") current[part] = {};
      current = current[part];
    }
    return { holder: current, key: parts[parts.length - 1] };
  }

  function resolveEffectTarget(target) {
    const mapped = target
      .replace(/^weapon\./, "weapons.")
      .replace(/^player\./, "player.")
      .replace(/^energy\./, "energy.")
      .replace(/^ultimate\./, "ultimate.")
      .replace(/^run\./, "runMods.")
      .replace(/^reward\./, "runMods.reward.");
    return ensurePath(game, mapped.split("."));
  }

  function effectValue(effect, level = 1) {
    if (typeof effect.value !== "undefined") return effect.value;
    return (effect.base || 0) + (effect.perLevel || 0) * Math.max(0, level - 1);
  }

  function applyEffect(effect, level = 1) {
    const { holder, key } = resolveEffectTarget(effect.target);
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

  function applyEffects(effects = [], level = 1) {
    for (const effect of effects) applyEffect(effect, level);
  }

  function applyMilestoneEffects(item, level = 0) {
    for (const [milestone, effects] of Object.entries(item?.milestoneEffects || {})) {
      if (level >= Number(milestone)) applyEffects(effects, level);
    }
  }

  function applyMetaProgressionToRun() {
    const metaState = getMetaState();
    if (!metaConfig || !metaState) return;
    const artifactMap = mapById(metaConfig.artifacts);
    const talentMap = mapById(metaConfig.startingTalents);
    const cultivationMap = mapById(metaConfig.cultivations);

    for (const tree of metaConfig.talentTrees || []) {
      const level = Math.min(tree.maxLevel || 12, metaState.progression.talentTree[tree.id] || 0);
      if (level <= 0) continue;
      applyEffects(tree.effects, level);
      applyMilestoneEffects(tree, level);
    }

    for (const facility of metaConfig.facilities || []) {
      const level = Math.min(facility.maxLevel || 10, metaState.progression.facilities[facility.id] || 0);
      if (level > 0) applyEffects(facility.effects, level);
    }

    const artifact = artifactMap[metaState.selected.artifactId];
    const artifactLevel = metaState.progression.artifacts[artifact?.id] || 1;
    if (artifact) {
      applyEffects(artifact.effects, artifactLevel);
      applyMilestoneEffects(artifact, artifactLevel);
    }

    const cultivation = cultivationMap[metaState.selected.cultivationId];
    const cultivationLevel = metaState.progression.cultivations[cultivation?.id] || 1;
    if (cultivation) applyEffects(cultivation.effects, cultivationLevel);

    for (const talentId of metaState.selected.startingTalentIds || []) {
      const talent = talentMap[talentId];
      if (talent) applyEffects(talent.effects, 1);
    }

    for (const synergy of activeBuildSynergies()) applyEffects(synergy.effects, 1);

    if (game.player.speedMultiplier) game.player.speed *= 1 + game.player.speedMultiplier;
    for (const weapon of Object.values(game.weapons)) {
      if (weapon.damageMultiplier) weapon.damage = Math.round(weapon.damage * (1 + weapon.damageMultiplier));
    }
    if (game.ultimate.damageMultiplier) game.ultimate.damage = Math.round(game.ultimate.damage * (1 + game.ultimate.damageMultiplier));
    game.player.hp = Math.min(game.player.maxHp, Math.max(game.player.hp, game.player.maxHp));
    game.energy.value = clamp(game.energy.value || 0, 0, game.energy.max || 100);
  }

  function createRunStats() {
    return {
      eliteKills: 0,
      bossKilled: false,
      xpCollected: 0,
      breakthroughs: 0,
      damageDealt: 0,
      damageTaken: 0,
      damageBySource: {},
      dashes: 0,
      affixes: {},
      balance: {},
      goalNotices: [],
      combos: {},
      events: { spring: 0, chest: 0, rewards: {}, details: {} },
      blessings: {},
      pickupRewards: {},
      rewards: null,
      unlocks: [],
      firstClearRewards: null,
    };
  }

  function resetGame() {
    game.state = "playing";
    game.time = 0;
    game.killCount = 0;
    game.nextEntityId = 1;
    game.chapter = getSelectedChapter();
    game.difficulty = getSelectedDifficulty();
    game.balance = getBalanceConfig();
    if (game.chapter?.background) {
      theme.background.asset = game.chapter.background;
      theme.background.fallbackAsset = game.chapter.fallbackBackground || theme.background.fallbackAsset;
      loadImageAsset("background", theme.background.asset);
      loadImageAsset("background:fallback", theme.background.fallbackAsset);
    }
    game.camera = { x: 0, y: 0, shake: 0 };
    game.enemies = [];
    game.projectiles = [];
    game.pickups = [];
    game.texts = [];
    game.particles = [];
    game.spawnedOnce = new Set();
    game.waveTimers = new Map();
    game.player = {
      x: 0,
      y: 0,
      hp: theme.player.maxHp,
      maxHp: theme.player.maxHp,
      speed: theme.player.speed,
      radius: theme.player.radius,
      pickupRadius: theme.player.pickupRadius,
      xp: 0,
      nextXp: 36,
      level: 1,
      invincible: 0,
      damageReduction: 0,
      dashCooldown: 0,
      dashDuration: 0,
      dashCooldownMax: 2.4,
      dashDurationMax: 0.18,
      dashSpeed: 760,
      dashDir: { x: 1, y: 0 },
      lastMoveDir: { x: 1, y: 0 },
    };
    game.weapons = cloneWeapons();
    game.equipment = createEquipmentState();
    game.energy = { value: 0, max: 100, gainMultiplier: 1 };
    game.ultimate = { damage: theme.spells?.ultimate?.damage || 95 };
    game.combos = { fireThunderTimer: 0, swordTalismanTimer: 0 };
    game.runMods = {
      xpMultiplier: 0,
      energyRegen: 0,
      killHeal: 0,
      eliteDamageBonus: 0,
      healMultiplier: 0,
      reward: { spiritStoneMultiplier: 0 },
    };
    game.runStats = createRunStats();
    game.player.nextXp = xpRequiredForLevel(game.player.level);
    game.bossRuntime = null;
    game.bossTelegraphs = [];
    game.bossHazards = [];
    game.bossIntro = null;
    game.events = { nextAt: debugMetaMode === "events" ? 3 : 28, spawned: 0 };
    clearGoalToastTimer();
    game.goalToast = null;
    game.goalToastQueue = [];
    game.goalTrackingActive = false;
    game.activeEventChallenge = null;
    game.activeEventChoice = null;
    game.spellPowerBonus = 0;
    game.breakthroughFx = null;
    applyMetaProgressionToRun();
    ui.upgradePanel.classList.add("hidden");
    ui.eventChoicePanel?.classList.add("hidden");
    ui.resultPanel.classList.add("hidden");
    ui.resultQuestBtn?.classList.add("hidden");
    ui.runGoals?.classList.toggle("hidden", !metaConfig);
    ui.goalToast?.classList.add("hidden");
    ui.pausePanel.classList.add("hidden");
    ui.homePanel?.classList.add("hidden");
    document.querySelector(".brand strong").textContent = theme.name;
    setHudMetric(ui.hpLabel, "hp", "", theme.copy?.hp || "生命");
    setHudMetric(ui.energyLabel, "energy", "", theme.copy?.energy || "能量");
    setHudMetric(ui.xpLabel, "xp", "", theme.copy?.xp || "经验");
    setHudMetric(ui.growthBtn, "realm", "成长", "局内成长");
    setHudMetric(ui.dashBtn, "movement", "闪避", "闪避");
    setHudMetric(ui.homeBtn, "home", "洞府", "洞府");
    setHudMetric(ui.pauseBtn, "pause", "暂停", "暂停");
    ui.resumeBtn.textContent = theme.copy?.resume || "继续割草";
    ui.quickRestartBtn.textContent = theme.copy?.restart || "重新开始";
    document.querySelector("#pausePanel h1").textContent = theme.copy?.pause || "暂停中";
    document.querySelector("#upgradePanel h1").textContent = theme.copy?.upgradeTitle || "升职加薪！";
    document.querySelector("#upgradePanel p").textContent = theme.copy?.upgradeSubtitle || "选一个能力继续割草";
    document.querySelector("#resultPanel h1").textContent = theme.copy?.resultTitle || "今日绩效结算";
    ui.restartBtn.textContent = theme.copy?.restart || "再卷一局";
    updateUi();
    homeController()?.updateQuestBadges?.();
  }

  function spawnEnemy(type) {
    if (debugMetaMode === "combos" && type !== "boss") {
      const angle = rand(0, Math.PI * 2);
      const range = Math.max(48, (game.weapons.coffee?.radius || 90) - 12);
      spawnEnemyAt(type, game.player.x + Math.cos(angle) * range, game.player.y + Math.sin(angle) * range, {
        hp: Math.max(140, theme.enemies[type]?.hp || 36),
        speed: Math.max(16, theme.enemies[type]?.speed || 48),
      });
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const side = Math.floor(rand(0, 4));
    const margin = 80;
    const positions = [
      { x: rand(-rect.width / 2, rect.width / 2), y: -rect.height / 2 - margin },
      { x: rect.width / 2 + margin, y: rand(-rect.height / 2, rect.height / 2) },
      { x: rand(-rect.width / 2, rect.width / 2), y: rect.height / 2 + margin },
      { x: -rect.width / 2 - margin, y: rand(-rect.height / 2, rect.height / 2) },
    ];
    const pos = positions[side];
    spawnEnemyAt(type, game.player.x + pos.x, game.player.y + pos.y);
  }

  function affixChanceForDifficulty() {
    if (debugMetaMode === "affixes") return 0.9;
    if (game.difficulty?.id === "heaven") return 0.36;
    if (game.difficulty?.id === "mystic") return 0.22;
    return 0;
  }

  function chooseEnemyAffix(type) {
    if (type === "boss" || Math.random() > affixChanceForDifficulty()) return null;
    const pool = game.difficulty?.id === "heaven"
      ? ["swift", "armored", "leech"]
      : ["swift", "armored"];
    return enemyAffixes[pool[Math.floor(Math.random() * pool.length)]] || null;
  }

  function applyEnemyAffixStats(enemy, affix) {
    if (!affix) return enemy;
    enemy.affix = affix;
    if (affix.id === "swift") enemy.speed *= 1.34;
    if (affix.id === "armored") {
      enemy.hp = Math.round(enemy.hp * 1.45);
      enemy.maxHp = Math.round(enemy.maxHp * 1.45);
      enemy.radius += 2;
    }
    if (affix.id === "leech") enemy.damage = Math.round(enemy.damage * 0.9);
    game.runStats.affixes[affix.id] = (game.runStats.affixes[affix.id] || 0) + 1;
    return enemy;
  }

  function spawnEnemyAt(type, x, y, overrides = {}) {
    const config = theme.enemies[type];
    if (!config) return null;
    const chapterMods = game.chapter?.enemyMods || {};
    const difficultyMods = game.difficulty?.enemyMods || {};
    const hpMod = (chapterMods.hp || 1) * (difficultyMods.hp || 1);
    const speedMod = (chapterMods.speed || 1) * (difficultyMods.speed || 1);
    const damageMod = (chapterMods.damage || 1) * (difficultyMods.damage || 1);
    const enemyConfig = type === "boss" && game.chapter
      ? { ...config, hp: bossHpForChapter(game.chapter, config.hp), name: game.chapter.bossName || config.name, asset: game.chapter.bossAsset || config.asset }
      : config;
    const assetKey = enemyConfig.asset ? `enemy:${type}:${enemyConfig.asset}` : `enemy:${type}`;
    if (enemyConfig.asset && !imageAssets.has(assetKey)) loadImageAsset(assetKey, enemyConfig.asset);
    const enemy = {
      id: game.nextEntityId++,
      type,
      x,
      y,
      hp: Math.round((overrides.hp ?? enemyConfig.hp) * hpMod),
      maxHp: Math.round((overrides.hp ?? enemyConfig.hp) * hpMod),
      speed: (overrides.speed ?? enemyConfig.speed) * speedMod,
      damage: Math.round((overrides.damage ?? enemyConfig.damage) * damageMod),
      radius: overrides.radius ?? enemyConfig.radius,
      xp: xpForEnemy(type, enemyConfig.xp),
      color: overrides.color || enemyConfig.color,
      name: overrides.name || enemyConfig.name,
      asset: overrides.asset || enemyConfig.asset,
      assetKey,
      hitFlash: 0,
      bossSummon: overrides.bossSummon || false,
      eventChallengeId: overrides.eventChallengeId || "",
    };
    applyEnemyAffixStats(enemy, overrides.affix || chooseEnemyAffix(type));
    game.enemies.push(enemy);
    return enemy;
  }

  function spawnExperience(x, y, value) {
    game.pickups.push({
      id: game.nextEntityId++,
      type: "xp",
      x,
      y,
      value,
      radius: 7,
      age: 0,
      magnet: false,
    });
  }

  function spawnHealth(x, y) {
    game.pickups.push({
      id: game.nextEntityId++,
      type: "health",
      x,
      y,
      value: Math.round(22 * (1 + (game.runMods.healMultiplier || 0))),
      radius: 9,
      age: 0,
      magnet: false,
    });
  }

  function gainEnergy(amount) {
    if (!game.energy.max) return;
    game.energy.value = Math.min(game.energy.max, game.energy.value + amount * game.energy.gainMultiplier);
    if (game.energy.value >= game.energy.max && !game.ultimate.casting) castUltimate();
  }

  function addText(text, x, y, color = "#fff7c2") {
    game.texts.push({ text, x, y, color, life: 0.75, age: 0 });
  }

  function addBurst(x, y, color, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(60, 190);
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: rand(2, 5),
        color,
        life: rand(0.28, 0.62),
        age: 0,
      });
    }
  }

  function currentInputVector() {
    let x = 0;
    let y = 0;
    if (keys.has("a") || keys.has("arrowleft")) x -= 1;
    if (keys.has("d") || keys.has("arrowright")) x += 1;
    if (keys.has("w") || keys.has("arrowup")) y -= 1;
    if (keys.has("s") || keys.has("arrowdown")) y += 1;
    if (pointer.active) {
      x += clamp((pointer.current.x - pointer.origin.x) / 62, -1, 1);
      y += clamp((pointer.current.y - pointer.origin.y) / 62, -1, 1);
    }
    return normalize(x, y);
  }

  function startDash() {
    if (game.state !== "playing" || game.player.dashCooldown > 0 || game.player.dashDuration > 0) return false;
    const input = currentInputVector();
    const dir = input.x || input.y ? input : game.player.lastMoveDir || { x: 1, y: 0 };
    game.player.dashDir = normalize(dir.x, dir.y);
    game.player.lastMoveDir = { ...game.player.dashDir };
    game.player.dashDuration = game.player.dashDurationMax;
    game.player.dashCooldown = game.player.dashCooldownMax;
    game.player.invincible = Math.max(game.player.invincible, game.player.dashDurationMax + 0.08);
    game.runStats.dashes += 1;
    game.camera.shake = Math.max(game.camera.shake, 5);
    addText("踏风", game.player.x, game.player.y - 44, "#b9f3ff");
    addBurst(game.player.x, game.player.y, "#b9f3ff", 10);
    updateUi();
    return true;
  }

  function updatePlayer(dt) {
    const input = currentInputVector();
    if (input.x || input.y) game.player.lastMoveDir = { ...input };
    game.player.dashCooldown = Math.max(0, game.player.dashCooldown - dt);
    if (game.player.dashDuration > 0) {
      const step = Math.min(dt, game.player.dashDuration);
      game.player.x += game.player.dashDir.x * game.player.dashSpeed * step;
      game.player.y += game.player.dashDir.y * game.player.dashSpeed * step;
      game.player.dashDuration = Math.max(0, game.player.dashDuration - dt);
      game.player.invincible = Math.max(game.player.invincible, 0.06);
    } else if (input.x || input.y) {
      game.player.x += input.x * game.player.speed * dt;
      game.player.y += input.y * game.player.speed * dt;
    }
    game.player.invincible = Math.max(0, game.player.invincible - dt);
  }

  function updateCamera(dt) {
    const smooth = 1 - Math.pow(0.001, dt);
    game.camera.x += (game.player.x - game.camera.x) * smooth;
    game.camera.y += (game.player.y - game.camera.y) * smooth;
    game.camera.shake = Math.max(0, game.camera.shake - dt * 22);
  }

  function updateWaves(dt) {
    for (const wave of theme.waves) {
      const waveAt = wave.type === "boss" && bossAtForChapter() ? bossAtForChapter() : wave.at;
      const spawnMods = game.chapter?.spawnMods || {};
      const difficultySpawnMods = game.difficulty?.spawnMods || {};
      const rateMod = (spawnMods.rate || 1) * (difficultySpawnMods.rate || 1);
      const capMod = (spawnMods.cap || 1) * (difficultySpawnMods.cap || 1);
      const cap = Math.max(1, Math.round(wave.cap * capMod));
      if (game.time < waveAt) continue;
      const activeCount = game.enemies.filter((enemy) => enemy.type === wave.type).length;
      if (activeCount >= cap) continue;
      if (wave.once) {
        const key = `${waveAt}-${wave.type}`;
        if (!game.spawnedOnce.has(key)) {
          spawnEnemy(wave.type);
          if (wave.type === "boss") recordBalanceMetric("bossSpawnTime", game.time);
          game.spawnedOnce.add(key);
          addText(game.chapter?.bossWarning || theme.copy?.bossWarning || "老板来了！", game.player.x, game.player.y - 92, "#ffb347");
          game.camera.shake = 14;
        }
        continue;
      }
      const timer = (game.waveTimers.get(wave) || 0) - dt;
      if (timer <= 0) {
        spawnEnemy(wave.type);
        game.waveTimers.set(wave, Math.max(0.16, wave.rate * rateMod));
      } else {
        game.waveTimers.set(wave, timer);
      }
    }
  }

  function getBossEnemy() {
    return game.enemies.find((enemy) => enemy.type === "boss") || null;
  }

  function ensureBossRuntime(boss) {
    if (!boss || !game.chapter?.bossMechanics) return null;
    if (game.bossRuntime?.enemyId === boss.id) return game.bossRuntime;
    const mechanics = game.chapter.bossMechanics;
    game.bossRuntime = {
      id: game.chapter.id,
      enemyId: boss.id,
      phase: 0,
      mechanics,
      cooldowns: Object.fromEntries((mechanics.skills || []).map((skill, index) => [skill.id, 1.2 + index * 1.6])),
    };
    game.bossIntro = { age: 0, life: 2.2, title: boss.name, subtitle: mechanics.subtitle || mechanics.introText || "" };
    addText(mechanics.introText || game.chapter.bossWarning || boss.name, boss.x, boss.y - boss.radius - 62, mechanics.auraColor || "#f4d778");
    return game.bossRuntime;
  }

  function bossPhaseFor(boss) {
    const ratio = boss.hp / boss.maxHp;
    if (ratio <= 0.35) return 2;
    if (ratio <= 0.7) return 1;
    return 0;
  }

  function updateBossRuntime(dt) {
    const boss = getBossEnemy();
    if (!boss) {
      game.bossRuntime = null;
      game.bossTelegraphs = [];
      game.bossHazards = [];
      return;
    }
    const runtime = ensureBossRuntime(boss);
    if (!runtime) return;
    const nextPhase = bossPhaseFor(boss);
    if (nextPhase > runtime.phase) {
      runtime.phase = nextPhase;
      const text = runtime.mechanics.phaseTexts?.[nextPhase - 1] || `${boss.name} 进入 ${nextPhase + 1} 阶段`;
      addText(text, boss.x, boss.y - boss.radius - 50, runtime.mechanics.auraColor || "#f4d778");
      game.camera.shake = Math.max(game.camera.shake, 12 + nextPhase * 4);
      const phaseSkill = [...(runtime.mechanics.skills || [])].reverse().find((skill) => (skill.phase || 0) <= runtime.phase);
      if (phaseSkill) scheduleBossSkill(boss, phaseSkill, runtime, { phaseBurst: true });
    }
    for (const skill of runtime.mechanics.skills || []) {
      if ((skill.phase || 0) > runtime.phase) continue;
      const effectiveSkill = effectiveBossSkillConfig(skill);
      runtime.cooldowns[skill.id] = (runtime.cooldowns[skill.id] || effectiveSkill.cooldown || 6) - dt;
      if (runtime.cooldowns[skill.id] <= 0) {
        scheduleBossSkill(boss, skill, runtime);
        runtime.cooldowns[skill.id] = Math.max(1.4, (effectiveSkill.cooldown || 6) * (runtime.phase >= 2 ? 0.78 : runtime.phase >= 1 ? 0.88 : 1));
        break;
      }
    }
  }

  function bossSkillModsForDifficulty(difficulty = game.difficulty) {
    return difficulty?.bossSkillMods || {};
  }

  function effectiveBossSkillConfig(skill, difficulty = game.difficulty) {
    const mods = bossSkillModsForDifficulty(difficulty);
    return {
      ...skill,
      cooldown: (skill.cooldown || 6) * (mods.cooldown || 1),
      telegraph: Math.max(0.45, (skill.telegraph || 0.75) * (mods.telegraph || 1)),
      damage: Math.round((skill.damage || 0) * (mods.damage || 1)),
      duration: skill.duration ? skill.duration * (mods.duration || 1) : skill.duration,
      count: skill.count ? skill.count + (mods.countBonus || 0) : skill.count,
      eliteCount: skill.eliteCount ? skill.eliteCount + Math.max(0, Math.floor((mods.countBonus || 0) / 2)) : skill.eliteCount,
    };
  }

  function scheduleBossSkill(boss, skill, runtime, options = {}) {
    const effectiveSkill = effectiveBossSkillConfig(skill);
    const angleToPlayer = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
    const items = expandBossSkillTargets(boss, effectiveSkill, angleToPlayer, runtime);
    for (const target of items) {
      game.bossTelegraphs.push({
        id: `${effectiveSkill.id}-${game.time}-${Math.random()}`,
        skill: effectiveSkill,
        bossId: boss.id,
        x: target.x,
        y: target.y,
        angle: target.angle ?? angleToPlayer,
        age: target.delay ? -target.delay : 0,
        telegraph: target.telegraph || effectiveSkill.telegraph || 0.75,
        color: target.color || effectiveSkill.color || runtime.mechanics.auraColor || "#f4d778",
        effect: target.effect || null,
      });
    }
    addText(options.phaseBurst ? `阶段技：${effectiveSkill.name}` : effectiveSkill.name, boss.x, boss.y - boss.radius - 38, effectiveSkill.color || runtime.mechanics.auraColor || "#f4d778");
  }

  function expandBossSkillTargets(boss, skill, angleToPlayer, runtime) {
    const baseTarget = skill.shape === "line"
      ? {
          x: boss.x + Math.cos(angleToPlayer) * (skill.length || 300) * 0.42,
          y: boss.y + Math.sin(angleToPlayer) * (skill.length || 300) * 0.42,
          angle: angleToPlayer,
        }
      : { x: game.player.x, y: game.player.y, angle: angleToPlayer };
    const color = skill.color || runtime.mechanics.auraColor || "#f4d778";
    if (skill.pattern === "tripleCone") {
      const offsets = (skill.count || 3) >= 5 ? [-0.96, -0.48, 0, 0.48, 0.96] : [-0.72, 0, 0.72];
      return offsets.map((offset, index) => ({ x: boss.x, y: boss.y, angle: angleToPlayer + offset, delay: index * 0.08, color }));
    }
    if (skill.pattern === "scatterCircles") {
      const count = skill.count || 4;
      const spread = skill.id?.includes("thunder") ? 220 : 170;
      return Array.from({ length: count }, (_, index) => {
        const anchored = index === 0;
        return {
          x: anchored ? game.player.x : game.player.x + rand(-spread, spread),
          y: anchored ? game.player.y : game.player.y + rand(-spread * 0.75, spread * 0.75),
          angle: angleToPlayer,
          delay: index * 0.08,
          color,
        };
      });
    }
    if (skill.pattern === "crossLines") {
      const offsets = (skill.count || 4) >= 6 ? [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI / 8, -Math.PI / 8] : [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
      return offsets.map((offset, index) => ({
        x: game.player.x,
        y: game.player.y,
        angle: offset,
        delay: index * 0.06,
        color,
      }));
    }
    if (skill.pattern === "parallelLines") {
      const normal = angleToPlayer + Math.PI / 2;
      const offsets = (skill.count || 3) >= 5 ? [-128, -64, 0, 64, 128] : [-74, 0, 74];
      return offsets.map((offset, index) => ({
        x: baseTarget.x + Math.cos(normal) * offset,
        y: baseTarget.y + Math.sin(normal) * offset,
        angle: angleToPlayer,
        delay: index * 0.06,
        color,
      }));
    }
    if (skill.pattern === "chasePools") {
      const dir = normalize(game.player.x - boss.x, game.player.y - boss.y);
      return Array.from({ length: skill.count || 3 }, (_, index) => ({
        x: game.player.x + dir.x * index * 58 + rand(-34, 34),
        y: game.player.y + dir.y * index * 58 + rand(-34, 34),
        angle: angleToPlayer,
        delay: index * 0.14,
        color,
      }));
    }
    if (skill.pattern === "tripleClaw") {
      const normal = angleToPlayer + Math.PI / 2;
      const offsets = (skill.count || 3) >= 5 ? [-92, -46, 0, 46, 92] : [-46, 0, 46];
      return offsets.map((offset, index) => ({
        x: baseTarget.x + Math.cos(normal) * offset,
        y: baseTarget.y + Math.sin(normal) * offset,
        angle: angleToPlayer + (index - (offsets.length - 1) / 2) * 0.08,
        delay: index * 0.05,
        color,
      }));
    }
    if (skill.pattern === "prisonPlusStrikes") {
      const extraStrikes = Math.max(0, (skill.count || 3) - 3);
      return [
        { x: game.player.x, y: game.player.y, angle: angleToPlayer, color },
        { x: game.player.x + rand(-140, 140), y: game.player.y + rand(-110, 110), angle: angleToPlayer, delay: 0.18, effect: { shape: "circle", radius: 72 }, color: "#f4dd72" },
        { x: game.player.x + rand(-170, 170), y: game.player.y + rand(-130, 130), angle: angleToPlayer, delay: 0.3, effect: { shape: "circle", radius: 72 }, color: "#f4dd72" },
        ...Array.from({ length: extraStrikes }, (_, index) => ({
          x: game.player.x + rand(-190, 190),
          y: game.player.y + rand(-145, 145),
          angle: angleToPlayer,
          delay: 0.42 + index * 0.1,
          effect: { shape: "circle", radius: 72 },
          color: "#f4dd72",
        })),
      ];
    }
    return [baseTarget];
  }

  function damagePlayerFromBoss(amount, source) {
    if (game.player.invincible > 0 || game.state !== "playing") return 0;
    const damage = Math.max(1, Math.round(amount * (1 - (game.player.damageReduction || 0))));
    game.player.hp -= damage;
    game.runStats.damageTaken += damage;
    game.player.invincible = 0.35;
    game.camera.shake = Math.max(game.camera.shake, 8);
    addText(`-${damage}`, game.player.x, game.player.y - 24, source?.color || "#ff7676");
    addBurst(game.player.x, game.player.y, source?.color || "#ff7676", 8);
    if (game.player.hp <= 0) finishRun();
    return damage;
  }

  function effectiveBossSkill(item) {
    return item.effect ? { ...item.skill, ...item.effect } : item.skill;
  }

  function playerInTelegraph(item) {
    const skill = effectiveBossSkill(item);
    if (skill.shape === "circle" || skill.shape === "pool") return distance(game.player, item) <= (skill.radius || 80) + game.player.radius;
    if (skill.shape === "ring") {
      const d = distance(game.player, item);
      const radius = skill.radius || 130;
      const width = skill.width || 34;
      return d >= radius - width && d <= radius + width;
    }
    if (skill.shape === "line") {
      const dx = game.player.x - item.x;
      const dy = game.player.y - item.y;
      const cos = Math.cos(-item.angle);
      const sin = Math.sin(-item.angle);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      return Math.abs(lx) <= (skill.length || 320) / 2 && Math.abs(ly) <= (skill.width || 56) / 2 + game.player.radius;
    }
    if (skill.shape === "cone") {
      const boss = getBossEnemy();
      if (!boss) return false;
      const d = distance(game.player, boss);
      const angle = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
      const diff = Math.abs(Math.atan2(Math.sin(angle - item.angle), Math.cos(angle - item.angle)));
      return d <= (skill.radius || 170) && diff <= (skill.arc || 0.8);
    }
    return false;
  }

  function resolveBossTelegraph(item) {
    const skill = item.skill;
    if (skill.shape === "summon") {
      const count = skill.count || 3;
      const boss = getBossEnemy();
      const origin = boss || game.player;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + rand(-0.18, 0.18);
        const radius = rand(95, 165);
        spawnEnemyAt(skill.type || "manager", origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius, {
          bossSummon: true,
        });
      }
      if (skill.eliteCount && game.bossRuntime?.phase >= 2) {
        for (let i = 0; i < skill.eliteCount; i += 1) {
          const angle = rand(0, Math.PI * 2);
          spawnEnemyAt(skill.eliteType || "director", origin.x + Math.cos(angle) * 145, origin.y + Math.sin(angle) * 145, {
            bossSummon: true,
          });
        }
      }
      if (skill.lifesteal && boss) {
        boss.hp = Math.min(boss.maxHp, boss.hp + skill.lifesteal);
        addText(`+${skill.lifesteal}`, boss.x, boss.y - boss.radius - 42, skill.color || "#ff7a86");
      }
      addBurst(origin.x, origin.y, skill.color || "#f4d778", 18);
      return;
    }
    if (skill.shape === "pull") {
      const dir = normalize(item.x - game.player.x, item.y - game.player.y);
      game.player.x += dir.x * (skill.pull || 80);
      game.player.y += dir.y * (skill.pull || 80);
      if (skill.followup && game.bossRuntime) {
        const followup = (game.bossRuntime.mechanics.skills || []).find((entry) => entry.id === skill.followup);
        if (followup) scheduleBossSkill(getBossEnemy(), followup, game.bossRuntime, { phaseBurst: true });
      }
    }
    if (skill.shape === "pool" || skill.duration) {
      game.bossHazards.push({ ...item, age: 0, duration: skill.duration || 4.5, tick: 0 });
    }
    if (playerInTelegraph(item)) damagePlayerFromBoss(skill.damage || 16, item);
    if (skill.leap) {
      const boss = getBossEnemy();
      if (boss) {
        boss.x = item.x;
        boss.y = item.y;
      }
    }
    game.camera.shake = Math.max(game.camera.shake, skill.cameraShake || 7);
    addBurst(item.x, item.y, item.color, 14);
  }

  function updateBossTelegraphs(dt) {
    for (const item of game.bossTelegraphs) {
      item.age += dt;
      if (item.age >= item.telegraph) {
        resolveBossTelegraph(item);
        item.done = true;
      }
    }
    game.bossTelegraphs = game.bossTelegraphs.filter((item) => !item.done);
  }

  function updateBossHazards(dt) {
    for (const hazard of game.bossHazards) {
      hazard.age += dt;
      hazard.tick -= dt;
      if (hazard.tick <= 0) {
        hazard.tick = 0.55;
        if (playerInTelegraph(hazard)) damagePlayerFromBoss(hazard.skill.damage || 8, hazard);
      }
    }
    game.bossHazards = game.bossHazards.filter((hazard) => hazard.age < hazard.duration);
  }

  function updateEnemies(dt) {
    for (const enemy of game.enemies) {
      const dir = normalize(game.player.x - enemy.x, game.player.y - enemy.y);
      enemy.x += dir.x * enemy.speed * dt;
      enemy.y += dir.y * enemy.speed * dt;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

      if (distance(enemy, game.player) < enemy.radius + game.player.radius && game.player.invincible <= 0) {
        if (damagePlayerFromBoss(enemy.damage, { color: enemy.affix?.color || enemy.color }) && enemy.affix?.id === "leech") {
          const drain = Math.min(game.energy.value || 0, 16);
          game.energy.value = Math.max(0, (game.energy.value || 0) - drain);
          addText(`灵力 -${Math.round(drain)}`, game.player.x, game.player.y - 46, enemy.affix.color);
        }
      }
    }
  }

  function nearestEnemyInRange() {
    return nearestEnemyInRangeFor(game.weapons.keyboard.range);
  }

  function fireWeapon() {
    const target = nearestEnemyInRange();
    if (!target) return;
    const base = Math.atan2(target.y - game.player.y, target.x - game.player.x);
    const spread = 0.18;
    const weapon = game.weapons.keyboard;
    for (let i = 0; i < weapon.burst; i += 1) {
      const offset = (i - (weapon.burst - 1) / 2) * spread;
      const angle = base + offset;
      game.projectiles.push({
        id: game.nextEntityId++,
        type: "keyboard",
        x: game.player.x,
        y: game.player.y,
        vx: Math.cos(angle) * weapon.projectileSpeed,
        vy: Math.sin(angle) * weapon.projectileSpeed,
        radius: weapon.projectileRadius,
        damage: weapon.damage,
        source: "keyboard",
        color: weapon.color,
        life: weapon.range / weapon.projectileSpeed,
        rotation: angle,
      });
    }
  }

  function fireInvoice() {
    const weapon = game.weapons.invoice;
    if (!weapon.unlocked) return;
    const target = nearestEnemyInRangeFor(weapon.range);
    if (!target) return;
    const base = Math.atan2(target.y - game.player.y, target.x - game.player.x);
    const spread = 0.34;
    for (let i = 0; i < weapon.burst; i += 1) {
      const offset = (i - (weapon.burst - 1) / 2) * spread;
      const angle = base + offset;
      game.projectiles.push({
        id: game.nextEntityId++,
        type: "invoice",
        x: game.player.x,
        y: game.player.y,
        vx: Math.cos(angle) * weapon.projectileSpeed,
        vy: Math.sin(angle) * weapon.projectileSpeed,
        radius: weapon.projectileRadius,
        damage: weapon.damage,
        source: "invoice",
        color: weapon.color,
        life: weapon.range / weapon.projectileSpeed,
        rotation: angle,
      });
    }
  }

  function nearestEnemyInRangeFor(range) {
    let target = null;
    let best = Infinity;
    for (const enemy of game.enemies) {
      const d = distance(enemy, game.player);
      if (d < range && d < best) {
        target = enemy;
        best = d;
      }
    }
    return target;
  }

  function triggerFireThunderCombo(enemy) {
    const fire = game.weapons.coffee;
    const thunder = game.weapons.invoice;
    if (!fire?.unlocked || !thunder?.unlocked || !enemy || game.combos.fireThunderTimer > 0) return false;
    if (!game.enemies.some((item) => item.id === enemy.id)) return false;
    const damage = Math.max(1, Math.round((fire.damage * 0.55 + thunder.damage * 0.75) * (1 + game.spellPowerBonus)));
    game.combos.fireThunderTimer = 0.72;
    game.runStats.combos.fireThunder = (game.runStats.combos.fireThunder || 0) + 1;
    addText("火莲引雷", enemy.x, enemy.y - enemy.radius - 24, "#f3df78");
    addBurst(enemy.x, enemy.y, "#f3df78", 14);
    damageEnemy(enemy, damage, "fireThunder");
    game.camera.shake = Math.max(game.camera.shake, 7);
    return true;
  }

  function triggerSwordTalismanCombo(enemy) {
    const sword = game.weapons.keyboard;
    const thunder = game.weapons.invoice;
    if (!sword || (!sword.unlocked && sword.level <= 0)) return false;
    if (!thunder?.unlocked || !enemy || game.combos.swordTalismanTimer > 0) return false;
    if (!game.enemies.some((item) => item.id === enemy.id)) return false;
    const damage = Math.max(1, Math.round((sword.damage * 0.28 + thunder.damage * 0.48) * (1 + game.spellPowerBonus)));
    game.combos.swordTalismanTimer = 0.58;
    game.runStats.combos.swordTalisman = (game.runStats.combos.swordTalisman || 0) + 1;
    addText("飞剑附符", enemy.x, enemy.y - enemy.radius - 42, "#d6c2ff");
    addBurst(enemy.x, enemy.y, "#d6c2ff", 10);
    damageEnemy(enemy, damage, "swordTalisman");
    game.camera.shake = Math.max(game.camera.shake, 5);
    return true;
  }

  function pulseCoffee() {
    const weapon = game.weapons.coffee;
    if (!weapon.unlocked) return;
    let hit = 0;
    for (const enemy of [...game.enemies]) {
      if (distance(enemy, game.player) < weapon.radius + enemy.radius) {
        damageEnemy(enemy, scaledDamage(weapon.damage), "coffee");
        triggerFireThunderCombo(enemy);
        hit += 1;
      }
    }
    if (hit > 0) {
      addText(theme.weapons.coffee.name, game.player.x, game.player.y - 54, weapon.color);
      game.camera.shake = Math.max(game.camera.shake, 5);
    }
  }

  function updateWeapon(dt) {
    if (game.combos?.fireThunderTimer > 0) game.combos.fireThunderTimer = Math.max(0, game.combos.fireThunderTimer - dt);
    if (game.combos?.swordTalismanTimer > 0) game.combos.swordTalismanTimer = Math.max(0, game.combos.swordTalismanTimer - dt);
    const keyboard = game.weapons.keyboard;
    keyboard.timer = (keyboard.timer || 0) - dt;
    if (keyboard.timer <= 0) {
      fireWeapon();
      keyboard.timer = keyboard.cooldown;
    }

    const coffee = game.weapons.coffee;
    if (coffee.unlocked) {
      coffee.timer = (coffee.timer || 0) - dt;
      if (coffee.timer <= 0) {
        pulseCoffee();
        coffee.timer = coffee.cooldown;
      }
    }

    const invoice = game.weapons.invoice;
    if (invoice.unlocked) {
      invoice.timer = (invoice.timer || 0) - dt;
      if (invoice.timer <= 0) {
        fireInvoice();
        invoice.timer = invoice.cooldown;
      }
    }
  }

  function damageEnemy(enemy, amount, source = "unknown") {
    const damage = Math.max(0, Math.round(amount));
    if (damage <= 0) return;
    game.runStats.damageDealt += damage;
    game.runStats.damageBySource[source] = (game.runStats.damageBySource[source] || 0) + damage;
    enemy.hp -= damage;
    enemy.hitFlash = 0.1;
    addText(damage.toString(), enemy.x, enemy.y - enemy.radius, "#fff2a8");
    addBurst(enemy.x, enemy.y, "#ffd35a", 4);
    if (enemy.hp <= 0) {
      const defeatedBossText = enemy.type === "boss" ? game.chapter?.bossMechanics?.victoryText : "";
      game.killCount += 1;
      if (enemy.type === "director") game.runStats.eliteKills += 1;
      if (enemy.type === "boss") {
        game.runStats.bossKilled = true;
        recordBalanceMetric("bossKillTime", game.time);
        if (typeof game.runStats.balance.bossSpawnTime === "number") {
          recordBalanceMetric("bossTtk", game.time - game.runStats.balance.bossSpawnTime);
        }
      }
      if (enemy.eventChallengeId && game.activeEventChallenge?.id === enemy.eventChallengeId) {
        game.activeEventChallenge.defeated = Math.min(
          game.activeEventChallenge.targetCount,
          game.activeEventChallenge.defeated + 1,
        );
      }
      gainEnergy(enemy.type === "boss" ? 42 : enemy.type === "director" ? 12 : 6);
      spawnExperience(enemy.x, enemy.y, enemy.xp);
      const rewardPickups = rewardPickupsForEnemy(enemy);
      if (rewardPickups) {
        spawnRewardPickups(enemy.x, enemy.y, rewardPickups, {
          radius: enemy.type === "boss" ? 12 : 10,
          spread: enemy.type === "boss" ? 26 : 16,
        });
      }
      if (game.runMods.killHeal && game.killCount % 40 === 0) {
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.runMods.killHeal);
        addText(`+${game.runMods.killHeal}`, game.player.x, game.player.y - 36, "#8dffba");
      }
      if (Math.random() < (enemy.type === "boss" ? 1 : 0.06)) spawnHealth(enemy.x + rand(-18, 18), enemy.y + rand(-18, 18));
      addBurst(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 28 : 12);
      game.camera.shake = enemy.type === "boss" ? 16 : 4;
      game.enemies = game.enemies.filter((item) => item.id !== enemy.id);
      if (defeatedBossText) {
        addText(defeatedBossText, game.player.x, game.player.y - 104, game.chapter?.bossMechanics?.auraColor || "#f4d778");
        game.bossIntro = { age: 0, life: 1.8, title: "Boss 已镇压", subtitle: defeatedBossText };
      }
    }
  }

  function updateProjectiles(dt) {
    for (const projectile of game.projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      for (const enemy of game.enemies) {
        if (distance(projectile, enemy) < projectile.radius + enemy.radius) {
          damageEnemy(enemy, scaledDamage(projectile.damage), projectile.source || projectile.type);
          if (projectile.source === "keyboard" || projectile.type === "keyboard") triggerSwordTalismanCombo(enemy);
          projectile.life = 0;
          break;
        }
      }
    }
    game.projectiles = game.projectiles.filter((projectile) => projectile.life > 0);
  }

  function gainExperience(value) {
    const gained = Math.round(value * (1 + (game.runMods.xpMultiplier || 0)));
    game.runStats.xpCollected += gained;
    game.player.xp += gained;
    gainEnergy(gained * 0.22);
    while (game.player.xp >= game.player.nextXp) {
      game.player.xp -= game.player.nextXp;
      game.player.level += 1;
      game.runStats.breakthroughs += 1;
      if (game.runStats.breakthroughs === 1) recordBalanceMetric("firstUpgradeTime", game.time);
      game.player.nextXp = xpRequiredForLevel(game.player.level);
      game.breakthroughFx = { age: 0, life: 1.15, type: "realm", label: realmLabel(game.player.level) };
      openUpgradePanel();
      break;
    }
  }

  function scaledDamage(amount) {
    return Math.round(amount * (1 + game.spellPowerBonus));
  }

  function castUltimate() {
    if (!theme.spells?.ultimate || game.state !== "playing") return;
    game.ultimate.casting = true;
    game.energy.value = 0;
    const targets = [...game.enemies].sort((a, b) => distance(a, game.player) - distance(b, game.player)).slice(0, 14);
    addText("天劫雷瀑！", game.player.x, game.player.y - 92, "#f3df78");
    game.camera.shake = 18;
    for (const enemy of targets) {
      damageEnemy(enemy, scaledDamage(game.ultimate.damage), "ultimate");
      addBurst(enemy.x, enemy.y, "#f3df78", 14);
    }
    for (let i = 0; i < 18; i += 1) {
      addBurst(game.player.x + rand(-260, 260), game.player.y + rand(-190, 190), "#9ed8ff", 3);
    }
    game.ultimate.casting = false;
  }

  function updatePickups(dt) {
    for (const pickup of game.pickups) {
      pickup.age += dt;
      if (pickup.life && pickup.age > pickup.life) {
        pickup.collected = true;
        continue;
      }
      const d = distance(pickup, game.player);
      if (d < game.player.pickupRadius || (pickup.type !== "event" && pickup.age > 0.8)) pickup.magnet = true;
      if (pickup.magnet) {
        const dir = normalize(game.player.x - pickup.x, game.player.y - pickup.y);
        const speed = pickup.type === "event"
          ? clamp(420 - d * 0.8, 160, 420)
          : pickup.age > 0.8
            ? clamp(680 - d * 1.2, 220, 680)
            : clamp(520 - d * 2.2, 160, 520);
        pickup.x += dir.x * speed * dt;
        pickup.y += dir.y * speed * dt;
      }
      if (d < game.player.radius + pickup.radius) {
        if (pickup.type === "event") {
          collectRunEvent(pickup);
        } else if (pickup.type === "material") {
          addPickupReward({ [pickup.currencyKey]: pickup.value });
          addText(`${pickup.label || currencyName(pickup.currencyKey)} +${pickup.value}`, game.player.x, game.player.y - 40, pickup.color || "#f7f3e8");
          addBurst(pickup.x, pickup.y, pickup.color || "#f7f3e8", 12);
        } else if (pickup.type === "health") {
          game.player.hp = Math.min(game.player.maxHp, game.player.hp + pickup.value);
          addText(`+${pickup.value}`, game.player.x, game.player.y - 36, "#8dffba");
        } else {
          gainExperience(pickup.value);
        }
        pickup.collected = true;
      }
    }
    game.pickups = game.pickups.filter((pickup) => !pickup.collected);
  }

  function updateEffects(dt) {
    if (game.bossIntro) {
      game.bossIntro.age += dt;
      if (game.bossIntro.age >= game.bossIntro.life) game.bossIntro = null;
    }

    if (game.breakthroughFx) {
      game.breakthroughFx.age += dt;
      if (game.breakthroughFx.age >= game.breakthroughFx.life) game.breakthroughFx = null;
    }

    for (const item of game.texts) {
      item.age += dt;
      item.y -= 36 * dt;
    }
    game.texts = game.texts.filter((item) => item.age < item.life);

    for (const particle of game.particles) {
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 4.2 * dt;
      particle.vy *= 1 - 4.2 * dt;
    }
    game.particles = game.particles.filter((particle) => particle.age < particle.life);
  }

  function finishRun() {
    if (game.state === "ended") return;
    if (game.activeEventChallenge && !game.activeEventChallenge.resolved) resolveActiveEventChallenge(false);
    ui.eventChoicePanel?.classList.add("hidden");
    game.activeEventChoice = null;
    game.state = "ended";
    clearGoalToastTimer();
    ui.runGoals?.classList.add("hidden");
    ui.goalToast?.classList.add("hidden");
    const killLabel = theme.copy?.kills || "击退";
    const metaState = getMetaState();
    if (metaConfig && metaState) {
      const rewards = calculateRunRewards();
      addCurrencies(rewards);
      const unlocks = unlockProgressAfterRun();
      game.runStats.rewards = rewards;
      game.runStats.unlocks = unlocks;
      saveMetaState();
      homeController()?.updateQuestBadges?.();
      ui.rewardText.innerHTML = `
        ${renderRewardBreakdown(rewards)}
        ${renderRewardSourceBreakdown()}
        ${renderRunBlessingsSummary()}
        ${renderDamageBreakdown()}
        ${renderFirstClearRewardSummary()}
        ${renderQuestCompletionSummary()}
        ${!game.runStats.firstClearRewards && unlocks.length ? `<span>${unlocks.join(" / ")}</span>` : ""}
      `;
      renderResultNextSteps();
      ui.resultQuestBtn?.classList.toggle("hidden", claimableQuestCount() <= 0);
    } else if (ui.rewardText) {
      ui.rewardText.innerHTML = renderDamageBreakdown();
      ui.resultNextSteps?.classList.add("hidden");
      ui.resultQuestBtn?.classList.add("hidden");
    }
    ui.resultText.textContent = `闭关 ${formatTime(game.time)}，${killLabel} ${game.killCount}，最高境界 ${realmLabel(game.player.level)}。`;
    ui.resultPanel.classList.remove("hidden");
  }

  function pauseGame() {
    if (game.state !== "playing") return;
    game.state = "paused";
    if (ui.pauseBuildSummary) ui.pauseBuildSummary.innerHTML = renderPauseBuildSummary();
    ui.pausePanel.classList.remove("hidden");
  }

  function resumeGame() {
    if (game.state !== "paused") return;
    game.state = "playing";
    game.lastFrame = performance.now();
    ui.pausePanel.classList.add("hidden");
  }

  function formatTime(seconds) {
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60).toString().padStart(2, "0");
    const secs = (total % 60).toString().padStart(2, "0");
    return `${minutes}:${secs}`;
  }

  function runDebugComboTicks() {
    if (debugMetaMode !== "combos") return;
    for (let ticks = 0; ticks < 90 && game.state === "playing"; ticks += 1) update(1 / 30);
  }

  function runDebugEventTicks() {
    if (!debugResolveEventId) return;
    const eventPickup = game.pickups.find((pickup) => pickup.type === "event" && pickup.eventType === debugResolveEventId);
    if (!eventPickup) return;
    game.player.x = eventPickup.x;
    game.player.y = eventPickup.y;
    for (let ticks = 0; ticks < 8 && game.state === "playing"; ticks += 1) update(1 / 30);
  }

  function runDebugAffixTicks() {
    if (debugMetaMode !== "affixes") return;
    for (let ticks = 0; ticks < 90 && game.state === "playing"; ticks += 1) update(1 / 30);
  }

  function startRunFromHome() {
    resetGame();
    game.state = "playing";
    game.goalTrackingActive = true;
    updateUi();
    game.lastFrame = performance.now();
    runDebugComboTicks();
    runDebugEventTicks();
    runDebugAffixTicks();
    const metaState = getMetaState();
    if (debugResultMode === "first-clear" && metaConfig && metaState && game.chapter) {
      const record = ensureChapterRecord(game.chapter.id);
      const difficultyId = game.difficulty?.id || "mortal";
      const unlocks = game.chapter.firstClearUnlocks || {};
      record.clearedDifficulties = (record.clearedDifficulties || []).filter((id) => id !== difficultyId);
      metaState.unlocks.chapters = (metaState.unlocks.chapters || []).filter((id) => !(unlocks.chapters || []).includes(id));
      metaState.unlocks.artifacts = (metaState.unlocks.artifacts || []).filter((id) => !(unlocks.artifacts || []).includes(id));
      metaState.unlocks.startingTalents = (metaState.unlocks.startingTalents || []).filter((id) => !(unlocks.startingTalents || []).includes(id));
      metaState.unlocks.cultivations = (metaState.unlocks.cultivations || []).filter((id) => !(unlocks.cultivations || []).includes(id));
      for (const id of unlocks.artifacts || []) delete metaState.progression.artifacts[id];
      for (const id of unlocks.cultivations || []) delete metaState.progression.cultivations[id];
      if (!metaState.unlocks.difficulties[game.chapter.id]) metaState.unlocks.difficulties[game.chapter.id] = ["mortal"];
      if (difficultyId === "mortal") metaState.unlocks.difficulties[game.chapter.id] = ["mortal"];
      if (difficultyId === "mystic") metaState.unlocks.difficulties[game.chapter.id] = ["mortal", "mystic"];
      game.runStats.bossKilled = true;
      game.runStats.eliteKills = Math.max(game.runStats.eliteKills || 0, 3);
      game.runStats.breakthroughs = Math.max(game.runStats.breakthroughs || 0, 2);
      game.runStats.xpCollected = Math.max(game.runStats.xpCollected || 0, 180);
      game.killCount = Math.max(game.killCount, 64);
      game.time = Math.max(game.time, 118);
      game.player.level = Math.max(game.player.level, 7);
    }
    if (debugFinishOnStart) finishRun();
  }

  function resolveDebugEventChoiceId() {
    const pending = game.activeEventChoice;
    if (!pending?.options?.length) return "";
    const requested = pending.options.find((option) => option.id === debugResolveEventChoice || option.label === debugResolveEventChoice);
    return requested?.id || pending.options[0]?.id || "";
  }

  function runDebugResolvedEventScenario() {
    if (!metaConfig || !debugResolveEventId) return false;
    startRunFromHome();
    spawnRunEvent(debugResolveEventId);
    for (let step = 0; step <= debugResolveEventChain; step += 1) {
      for (const pickup of game.pickups) {
        pickup.x = game.player.x;
        pickup.y = game.player.y;
      }
      updatePickups(1 / 30);
      if (game.activeEventChoice) {
        const choiceId = resolveDebugEventChoiceId();
        if (choiceId) selectRunEventChoice(choiceId);
      }
    }
    if (debugOpenTab && metaConfig) homeController()?.open?.(debugOpenTab);
    else updateUi();
    return true;
  }

  function difficultyAllowed(chapterId, difficultyId) {
    const metaState = getMetaState();
    return (metaState?.unlocks?.difficulties?.[chapterId] || ["mortal"]).includes(difficultyId);
  }

  function unlockConditionText(unlock = {}) {
    if (!unlock || unlock.type === "default") return "默认解锁";
    if (unlock.type === "chapterClear") {
      const chapter = mapById(metaConfig?.chapters || [])[unlock.chapterId];
      return `通关 ${chapter?.name || unlock.chapterId}`;
    }
    return "待解锁";
  }

  function updateUi() {
    const mobileBossIntroActive = getUiMode() === "mobile"
      && Boolean(game.bossIntro)
      && (game.bossIntro.age || 0) < Math.max(0, (game.bossIntro.life || 0) - 0.12);
    if (ui.body) ui.body.dataset.bossIntro = mobileBossIntroActive ? "active" : "idle";
    setHudMetric(ui.timer, "timer", formatTime(game.time), `时间 ${formatTime(game.time)}`);
    setHudMetric(ui.mobileTimer, "timer", formatTime(game.time), `时间 ${formatTime(game.time)}`);
    const compactHud = isCompactHud();
    setHudMetric(ui.level, "realm", compactHud ? compactRealmLabel(game.player.level) : realmLabel(game.player.level), `境界 ${realmLabel(game.player.level)}`);
    setHudMetric(ui.kills, "kills", compactHud ? `斩${game.killCount}` : `${theme.copy?.kills || "击退"} ${game.killCount}`, `${theme.copy?.kills || "击退"} ${game.killCount}`);
    const activeWeapons = Object.values(game.weapons).filter((weapon) => weapon.level > 0 || weapon.unlocked);
    const weaponText = activeWeapons
      .map((weapon) => (theme.realms ? `${weapon.name} ${weapon.level}重` : `${weapon.name} Lv.${weapon.level}`))
      .join(" / ");
    const compactWeaponText = activeWeapons.length
      ? `${activeWeapons[0].name.slice(0, 2)}${activeWeapons[0].level}${activeWeapons.length > 1 ? `+${activeWeapons.length - 1}` : ""}`
      : weaponText;
    setHudMetric(ui.weapon, "weapon", compactHud ? compactWeaponText : weaponText, `功法 ${weaponText}`);
    setHudMetric(ui.mobileLevel, "realm", compactRealmLabel(game.player.level), `境界 ${realmLabel(game.player.level)}`);
    setHudMetric(ui.mobileKills, "kills", `斩${game.killCount}`, `${theme.copy?.kills || "击退"} ${game.killCount}`);
    setHudMetric(ui.mobileWeapon, "weapon", compactWeaponText || "未习功法", `功法 ${weaponText || "未习功法"}`);
    const dashReady = game.player.dashCooldown <= 0;
    const dashText = dashReady ? "闪避" : `${game.player.dashCooldown.toFixed(1)}s`;
    setHudMetric(ui.dashBtn, "movement", dashText, dashReady ? "闪避可用" : `闪避冷却 ${dashText}`);
    setHudMetric(ui.mobileDashBtn, "movement", dashText, dashReady ? "闪避可用" : `闪避冷却 ${dashText}`);
    setHudMetric(ui.mobileHomeBtn, "home", "洞府", "洞府");
    setHudMetric(ui.mobilePauseBtn, "pause", "暂停", "暂停");
    setHudMetric(ui.mobileGrowthBtn, "realm", "成长", "成长信息");
    ui.dashBtn?.classList.toggle("cooling", !dashReady);
    ui.mobileDashBtn?.classList.toggle("cooling", !dashReady);
    if (ui.dashBtn) ui.dashBtn.disabled = game.state !== "playing";
    if (ui.mobileDashBtn) ui.mobileDashBtn.disabled = game.state !== "playing";
    ui.hpBar.style.width = `${clamp((game.player.hp / game.player.maxHp) * 100, 0, 100)}%`;
    if (ui.energyBar) ui.energyBar.style.width = `${clamp(((game.energy.value || 0) / (game.energy.max || 100)) * 100, 0, 100)}%`;
    ui.xpBar.style.width = `${clamp((game.player.xp / game.player.nextXp) * 100, 0, 100)}%`;
    if (ui.mobileHpBar) ui.mobileHpBar.style.width = `${clamp((game.player.hp / game.player.maxHp) * 100, 0, 100)}%`;
    if (ui.mobileEnergyBar) ui.mobileEnergyBar.style.width = `${clamp(((game.energy.value || 0) / (game.energy.max || 100)) * 100, 0, 100)}%`;
    if (ui.mobileXpBar) ui.mobileXpBar.style.width = `${clamp((game.player.xp / game.player.nextXp) * 100, 0, 100)}%`;
    setHudMetric(ui.mobileHpLabel, "hp", `${Math.ceil(game.player.hp)}/${game.player.maxHp}`, `气血 ${Math.ceil(game.player.hp)}/${game.player.maxHp}`);
    setHudMetric(ui.mobileEnergyLabel, "energy", `${Math.floor(game.energy.value || 0)}/${game.energy.max || 100}`, `灵力 ${Math.floor(game.energy.value || 0)}/${game.energy.max || 100}`);
    setHudMetric(ui.mobileXpLabel, "xp", `${Math.floor((game.player.xp / game.player.nextXp) * 100)}%`, `修为 ${Math.floor((game.player.xp / game.player.nextXp) * 100)}%`);
    if (ui.equipmentSummary) {
      setHudMetric(ui.equipmentSummary, "artifact", equipmentSummaryText(), `法器 ${equipmentSummaryText()}`);
    }
    if (ui.mobileEquipmentSummary) {
      setHudMetric(ui.mobileEquipmentSummary, "artifact", equipmentSummaryText(), `法器 ${equipmentSummaryText()}`);
    }
    homeController()?.updateQuestBadges?.();
    renderRunGoals();
    updateRunGoalNotices();
    renderGoalToast();

    const boss = game.enemies.find((enemy) => enemy.type === "boss");
    ui.bossHud.classList.toggle("hidden", !boss);
    ui.mobileBossStrip?.classList.toggle("hidden", !boss || getUiMode() !== "mobile");
    if (boss) {
      ui.bossName.textContent = boss.name || game.chapter?.bossName || theme.enemies.boss.name;
      ui.bossBar.style.width = `${clamp((boss.hp / boss.maxHp) * 100, 0, 100)}%`;
      if (ui.mobileBossName) ui.mobileBossName.textContent = boss.name || game.chapter?.bossName || theme.enemies.boss.name;
      if (ui.mobileBossBar) ui.mobileBossBar.style.width = `${clamp((boss.hp / boss.maxHp) * 100, 0, 100)}%`;
    }
  }

  function update(dt) {
    if (game.state !== "playing") return;
    game.time += dt;
    if (game.runMods.energyRegen) gainEnergy(game.runMods.energyRegen * dt);
    updatePlayer(dt);
    updateCamera(dt);
    updateRunEvents(dt);
    updateWaves(dt);
    updateBossRuntime(dt);
    updateBossTelegraphs(dt);
    updateBossHazards(dt);
    updateWeapon(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateEventChallenge();
    updateEffects(dt);
    updateUi();
  }

  return {
    cloneWeapons,
    ensurePath,
    effectValue,
    applyEffects,
    bossSkillModsForDifficulty,
    effectiveBossSkillConfig,
    effectiveBossSkill,
    getBossEnemy,
    getBalanceSnapshot,
    damageSourceName,
    enemyAffixes,
    scaledDamage,
    spawnEnemy,
    spawnEnemyAt,
    updateBossRuntime,
    updatePickups,
    damagePlayerFromBoss,
    gainEnergy,
    addText,
    addBurst,
    startDash,
    resetGame,
    finishRun,
    pauseGame,
    resumeGame,
    startRunFromHome,
    runDebugResolvedEventScenario,
    difficultyAllowed,
    unlockConditionText,
    formatTime,
    updateUi,
    update,
  };
}
