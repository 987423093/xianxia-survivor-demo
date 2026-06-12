import { xianxiaContent } from "../web-runtime/src/content-registry/index.js";

const meta = xianxiaContent.metaProgression;
const balance = xianxiaContent.debug.rawTheme.balance || {};
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function byId(items = []) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

const currencies = meta.currencies || {};
const currencyKeys = Object.keys(currencies);
const chapters = meta.chapters || [];
const difficulties = meta.difficulties || [];
const facilities = meta.facilities || [];
const styleTags = new Set(Object.keys(meta.styleTags || {}));
const enemyTypes = new Set(["manager", "director", "boss"]);

function assertKnownCost(owner, cost = {}) {
  assert(Object.keys(cost).length > 0, `${owner} should have a cost`);
  for (const [currency, amount] of Object.entries(cost)) {
    assert(currencyKeys.includes(currency), `${owner} uses unknown currency ${currency}`);
    assert(Number.isFinite(amount) && amount > 0, `${owner} has invalid ${currency} cost ${amount}`);
  }
}

function upgradeCost(kind, id, level) {
  const costs = balance.upgradeCosts || {};
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

function chapterDropEstimate(chapter, difficulty) {
  const formula = balance.rewardFormula || {};
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

function assertKnownRewards(owner, rewards = {}) {
  for (const [currency, amount] of Object.entries(rewards)) {
    assert(currencyKeys.includes(currency), `${owner} uses unknown currency ${currency}`);
    assert(Number.isFinite(amount) && amount >= 0, `${owner} has invalid ${currency} reward ${amount}`);
  }
}

function assertKnownChallenge(owner, challenge = {}) {
  assert(Number.isFinite(challenge.duration) && challenge.duration > 0, `${owner} should define a positive duration`);
  if (challenge.targetCount != null) {
    assert(Number.isFinite(challenge.targetCount) && challenge.targetCount > 0, `${owner} has invalid targetCount ${challenge.targetCount}`);
  }
  assertKnownRewards(`${owner} successRewards`, challenge.successRewards || {});
  assertKnownRewards(`${owner} successPickupRewards`, challenge.successPickupRewards || {});
  assertKnownRewards(`${owner} failRewards`, challenge.failRewards || {});
  assertKnownRewards(`${owner} failPickupRewards`, challenge.failPickupRewards || {});
}

function assertKnownEffects(owner, effects = []) {
  assert(Array.isArray(effects) && effects.length > 0, `${owner} should define at least one effect`);
  for (const effect of effects) {
    assert(typeof effect.target === "string" && effect.target.length > 0, `${owner} has invalid effect target`);
    assert(["add", "set", "multiply", undefined].includes(effect.op), `${owner} has invalid effect op ${effect.op}`);
    if (effect.op !== "set") {
      const numericValue = effect.value ?? effect.base;
      assert(Number.isFinite(numericValue), `${owner} has non-numeric effect value`);
    }
  }
}

assert(meta, "xianxia meta config is missing");
assert(currencyKeys.length >= 5, "xianxia meta should define at least five currencies");
for (const [key, currency] of Object.entries(currencies)) {
  assert(currency.name, `currency ${key} is missing name`);
  assert(/^#[0-9a-f]{6}$/i.test(currency.color || ""), `currency ${key} is missing hex color`);
  assert(currency.desc, `currency ${key} is missing description`);
  assert(currency.source, `currency ${key} is missing source copy`);
  assert(currency.usage, `currency ${key} is missing usage copy`);
  assert(currency.iconText, `currency ${key} is missing icon text`);
}

for (let index = 1; index < difficulties.length; index += 1) {
  assert(
    difficulties[index].rewardMultiplier > difficulties[index - 1].rewardMultiplier,
    `difficulty ${difficulties[index].id} reward multiplier should be higher than ${difficulties[index - 1].id}`,
  );
}

const difficultyById = byId(difficulties);
const mortal = difficultyById.mortal || difficulties[0];
const heaven = difficultyById.heaven || difficulties[difficulties.length - 1];
const materialCoverage = Object.fromEntries(currencyKeys.map((key) => [key, 0]));
const rows = [];

for (const chapter of chapters) {
  assert(chapter.rewardMultiplier > 0, `chapter ${chapter.id} should have positive reward multiplier`);
  for (const [currency, amount] of Object.entries(chapter.drops || {})) {
    assert(currencyKeys.includes(currency), `chapter ${chapter.id} drops unknown currency ${currency}`);
    assert(Number.isFinite(amount) && amount >= 0, `chapter ${chapter.id} has invalid ${currency} drop ${amount}`);
  }
  assert((chapter.runEvents || []).length >= 2, `chapter ${chapter.id} should define at least two run events`);
  for (const event of chapter.runEvents || []) {
    assert(event.id && event.label, `chapter ${chapter.id} has invalid run event identity`);
    assert(["spring", "chest"].includes(event.kind), `chapter ${chapter.id} run event ${event.id} has unsupported kind ${event.kind}`);
    assert(Number.isFinite(event.radius) && event.radius > 0, `chapter ${chapter.id} run event ${event.id} has invalid radius`);
    for (const tag of event.tags || []) assert(styleTags.has(tag), `chapter ${chapter.id} run event ${event.id} uses unknown style tag ${tag}`);
    assert(!event.damage || event.damage > 0, `chapter ${chapter.id} run event ${event.id} has invalid damage`);
    for (const [difficultyId, amount] of Object.entries(event.damageByDifficulty || {})) {
      assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} uses unknown damage difficulty ${difficultyId}`);
      assert(Number.isFinite(amount) && amount > 0, `chapter ${chapter.id} run event ${event.id} has invalid damageByDifficulty.${difficultyId}`);
    }
    for (const [enemyType, count] of Object.entries(event.ambush || {})) {
      assert(enemyTypes.has(enemyType), `chapter ${chapter.id} run event ${event.id} uses unknown ambush enemy ${enemyType}`);
      assert(Number.isFinite(count) && count > 0, `chapter ${chapter.id} run event ${event.id} has invalid ambush count for ${enemyType}`);
    }
    for (const [difficultyId, ambush] of Object.entries(event.ambushByDifficulty || {})) {
      assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} uses unknown ambush difficulty ${difficultyId}`);
      for (const [enemyType, count] of Object.entries(ambush || {})) {
        assert(enemyTypes.has(enemyType), `chapter ${chapter.id} run event ${event.id} uses unknown ambushByDifficulty enemy ${enemyType}`);
        assert(Number.isFinite(count) && count > 0, `chapter ${chapter.id} run event ${event.id} has invalid ambushByDifficulty.${difficultyId}.${enemyType}`);
      }
    }
    if (event.challenge) assertKnownChallenge(`chapter ${chapter.id} run event ${event.id} challenge`, event.challenge);
    for (const [difficultyId, challenge] of Object.entries(event.challengeByDifficulty || {})) {
      assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} uses unknown challenge difficulty ${difficultyId}`);
      assertKnownChallenge(`chapter ${chapter.id} run event ${event.id} challengeByDifficulty.${difficultyId}`, challenge || {});
    }
    if (event.secretFollowup?.eventId) {
      assert((chapter.runEvents || []).some((item) => item.id === event.secretFollowup.eventId), `chapter ${chapter.id} run event ${event.id} secretFollowup must target an event in the same chapter`);
      assert(event.secretFollowup.eventId !== event.id, `chapter ${chapter.id} run event ${event.id} secretFollowup cannot target itself`);
      const chance = event.secretFollowup.chance;
      if (chance != null) assert(chance >= 0 && chance <= 1, `chapter ${chapter.id} run event ${event.id} secretFollowup has invalid chance ${chance}`);
      for (const [difficultyId, chanceByDifficulty] of Object.entries(event.secretFollowup.chanceByDifficulty || {})) {
        assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} secretFollowup uses unknown difficulty ${difficultyId}`);
        assert(chanceByDifficulty >= 0 && chanceByDifficulty <= 1, `chapter ${chapter.id} run event ${event.id} secretFollowup has invalid chanceByDifficulty.${difficultyId}`);
      }
    }
    assertKnownRewards(`chapter ${chapter.id} run event ${event.id} rewards`, event.rewards || {});
    assertKnownRewards(`chapter ${chapter.id} run event ${event.id} pickupRewards`, event.pickupRewards || {});
    if (event.blessing) {
      assert(event.blessing.id && event.blessing.label, `chapter ${chapter.id} run event ${event.id} has invalid blessing identity`);
      assertKnownEffects(`chapter ${chapter.id} run event ${event.id} blessing`, event.blessing.effects || []);
    }
    for (const [difficultyId, rewards] of Object.entries(event.rewardsByDifficulty || {})) {
      assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} uses unknown difficulty ${difficultyId}`);
      assertKnownRewards(`chapter ${chapter.id} run event ${event.id} rewardsByDifficulty.${difficultyId}`, rewards || {});
    }
    for (const [difficultyId, rewards] of Object.entries(event.pickupRewardsByDifficulty || {})) {
      assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} uses unknown pickup difficulty ${difficultyId}`);
      assertKnownRewards(`chapter ${chapter.id} run event ${event.id} pickupRewardsByDifficulty.${difficultyId}`, rewards || {});
    }
    const choices = event.choices || [];
    if (choices.length) {
      assert(choices.length >= 2, `chapter ${chapter.id} run event ${event.id} should provide at least two choices`);
    }
    for (const choice of choices) {
      assert(choice.id && choice.label, `chapter ${chapter.id} run event ${event.id} has invalid choice identity`);
      assertKnownRewards(`chapter ${chapter.id} run event ${event.id} choice ${choice.id} rewards`, choice.rewards || {});
      assertKnownRewards(`chapter ${chapter.id} run event ${event.id} choice ${choice.id} pickupRewards`, choice.pickupRewards || {});
      for (const [difficultyId, rewards] of Object.entries(choice.rewardsByDifficulty || {})) {
        assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} choice ${choice.id} uses unknown reward difficulty ${difficultyId}`);
        assertKnownRewards(`chapter ${chapter.id} run event ${event.id} choice ${choice.id} rewardsByDifficulty.${difficultyId}`, rewards || {});
      }
    for (const [difficultyId, rewards] of Object.entries(choice.pickupRewardsByDifficulty || {})) {
      assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} choice ${choice.id} uses unknown pickup difficulty ${difficultyId}`);
      assertKnownRewards(`chapter ${chapter.id} run event ${event.id} choice ${choice.id} pickupRewardsByDifficulty.${difficultyId}`, rewards || {});
    }
      if (choice.followupEventId) {
        assert((chapter.runEvents || []).some((item) => item.id === choice.followupEventId), `chapter ${chapter.id} run event ${event.id} choice ${choice.id} followupEventId must target an event in the same chapter`);
        assert(choice.followupEventId !== event.id, `chapter ${chapter.id} run event ${event.id} choice ${choice.id} followupEventId cannot target itself`);
      }
      if (choice.blessing) {
        assert(choice.blessing.id && choice.blessing.label, `chapter ${chapter.id} run event ${event.id} choice ${choice.id} has invalid blessing identity`);
        assertKnownEffects(`chapter ${chapter.id} run event ${event.id} choice ${choice.id} blessing`, choice.blessing.effects || []);
      }
    }
    for (const [difficultyId, choicesByDifficulty] of Object.entries(event.choicesByDifficulty || {})) {
      assert(difficultyById[difficultyId], `chapter ${chapter.id} run event ${event.id} uses unknown choice difficulty ${difficultyId}`);
      assert(Array.isArray(choicesByDifficulty) && choicesByDifficulty.length >= 2, `chapter ${chapter.id} run event ${event.id} choicesByDifficulty.${difficultyId} should provide at least two choices`);
      for (const choice of choicesByDifficulty || []) {
        assert(choice.id && choice.label, `chapter ${chapter.id} run event ${event.id} has invalid ${difficultyId} choice identity`);
        assertKnownRewards(`chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} rewards`, choice.rewards || {});
        assertKnownRewards(`chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} pickupRewards`, choice.pickupRewards || {});
        for (const [nestedDifficultyId, rewards] of Object.entries(choice.rewardsByDifficulty || {})) {
          assert(difficultyById[nestedDifficultyId], `chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} uses unknown reward difficulty ${nestedDifficultyId}`);
          assertKnownRewards(`chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} rewardsByDifficulty.${nestedDifficultyId}`, rewards || {});
        }
        for (const [nestedDifficultyId, rewards] of Object.entries(choice.pickupRewardsByDifficulty || {})) {
          assert(difficultyById[nestedDifficultyId], `chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} uses unknown pickup difficulty ${nestedDifficultyId}`);
          assertKnownRewards(`chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} pickupRewardsByDifficulty.${nestedDifficultyId}`, rewards || {});
        }
        if (choice.followupEventId) {
          assert((chapter.runEvents || []).some((item) => item.id === choice.followupEventId), `chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} followupEventId must target an event in the same chapter`);
          assert(choice.followupEventId !== event.id, `chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} followupEventId cannot target itself`);
        }
        if (choice.blessing) {
          assert(choice.blessing.id && choice.blessing.label, `chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} has invalid blessing identity`);
          assertKnownEffects(`chapter ${chapter.id} run event ${event.id} ${difficultyId} choice ${choice.id} blessing`, choice.blessing.effects || []);
        }
      }
    }
  }
  const estimate = chapterDropEstimate(chapter, mortal);
  for (const [currency, amount] of Object.entries(estimate)) {
    if (amount > 0) materialCoverage[currency] += 1;
  }
  rows.push({ chapter: chapter.id, difficulty: mortal.id, ...estimate });
}

for (const [currency, count] of Object.entries(materialCoverage)) {
  assert(count > 0, `currency ${currency} should have at least one positive chapter route`);
}

if (chapters[0] && mortal && heaven) {
  const low = chapterDropEstimate(chapters[0], mortal);
  const high = chapterDropEstimate(chapters[0], heaven);
  assert(high.spiritStone > low.spiritStone, "heaven spiritStone estimate should be higher than mortal");
  assert(high.dao > low.dao, "heaven dao estimate should be higher than mortal");
}

for (const tree of meta.talentTrees || []) assertKnownCost(`talent ${tree.id}`, upgradeCost("talent", tree.id, 0));
for (const artifact of meta.artifacts || []) assertKnownCost(`artifact ${artifact.id}`, upgradeCost("artifact", artifact.id, 0));
for (const cultivation of meta.cultivations || []) assertKnownCost(`cultivation ${cultivation.id}`, upgradeCost("cultivation", cultivation.id, 0));
for (const facility of facilities) assertKnownCost(`facility ${facility.id}`, upgradeCost("facility", facility.id, 0));

for (const [key, target] of Object.entries(balance.rewardTargets || {})) {
  assert(Array.isArray(target) && target.length === 2, `reward target ${key} should be a range`);
  assert(target[0] > 0 && target[1] >= target[0], `reward target ${key} has invalid range`);
}

console.table(rows);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("xianxia meta tests ok");
}
