# 修仙局外成长与章节难度 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在当前 HTML5 Canvas 修仙割草 Demo 上，补齐“局外养成 + 开局构筑 + 多地图章节 + 难度推进”的长期循环，让每局失败或通关后都有明确成长目标。

**Architecture:** 第一版继续以浏览器 Demo 为交付目标，所有局外数据使用 `localStorage` 存档，所有配置集中在 `demo/src/theme.js` 的 `xianxiaTheme` 下。`demo/src/main.js` 负责存档读写、洞府 UI 状态、章节参数套用、开局携带法宝/天赋转化为战斗初始状态。旧 `office` / `cat` 主题保持可运行，但不显示修仙局外成长。

**Tech Stack:** HTML5 Canvas、原生 JavaScript module、CSS、`localStorage`、image2 生成 2K 地图 PNG、Playwright 浏览器验证。

---

## 1. 玩法目标与循环

当前 Demo 已经有局内成长：击杀、修为、突破三选一、法术、装备、灵力大招。下一阶段要补的是局外“再来一局”的理由。

目标循环：

```text
进入洞府
  -> 选择章节/难度
  -> 配置开局法宝和初始天赋
  -> 开始本局
  -> 局内突破、装备、法术成长
  -> 死亡或通关结算
  -> 获得灵石/道行/材料/法宝熟练度
  -> 升级洞府、天赋、法宝、功法、解锁章节
  -> 再开一局
```

第一版不做账号、联网、付费、抽卡、背包拖拽，也不做复杂装备随机词条。要做的是单机 Demo 能看出长期深度。

---

## 2. 功能模块总览

### 2.1 洞府首页

洞府是局外主界面，入口来自：

- 首次打开默认先显示洞府，而不是直接开局。
- 战斗 HUD 顶部增加 `洞府` 按钮，点击时暂停并打开洞府。
- 结算页按钮 `再入洞府` 回到洞府；另有 `再战本章` 快速重开。

洞府首页显示：

- 当前称号：例如 `炼气散修`、`筑基内门`、`金丹真人`。
- 资源：`灵石`、`道行`、`玄铁`、`灵蕴`、`雷纹残片`。
- 当前章节、当前难度、最高通关记录。
- 五个页签：`章节`、`开局`、`天赋`、`法宝`、`功法`。

### 2.2 章节系统

章节是地图和难度的外层骨架。

第一版 4 个章节：

| 章节 | 地图 | 主题 | 解锁条件 | Boss |
| --- | --- | --- | --- | --- |
| 云栖竹谷 | `battle-map.png` | 入门修炼场，竹林灵泉 | 默认解锁 | 山魈妖王 |
| 玄石古阵 | `map-stone-array.png` | 古阵、石碑、符文裂隙 | 通关云栖竹谷凡境 | 黑袍阵主 |
| 血煞荒原 | `map-blood-wasteland.png` | 赤黑荒地、妖气裂谷 | 通关玄石古阵凡境 | 血煞魔君 |
| 雷劫天门 | `map-thunder-gate.png` | 天门平台、雷云、金紫雷纹 | 通关血煞荒原凡境 | 天劫雷主 |

每章 3 个难度：

| 难度 | 敌人血量 | 敌人速度 | 刷怪强度 | 奖励倍率 |
| --- | ---: | ---: | ---: | ---: |
| 凡境 | 1.0 | 1.0 | 1.0 | 1.0 |
| 玄境 | 1.45 | 1.12 | 1.25 | 1.6 |
| 天境 | 2.1 | 1.22 | 1.55 | 2.5 |

章节目标：

- 存活 6 分钟并击败 Boss 视为通关。
- 未击败 Boss 也能获得部分资源。
- 通关更高难度只影响奖励和记录，不作为第一版主线解锁门槛，避免玩家卡死。

### 2.3 章节 Boss 特色设计

Boss 不能只做成“血更厚、伤害更高”的大怪。每章 Boss 要承担三个作用：给章节留下记忆点、检验玩家当前 build、投放关键局外材料。第一版每个 Boss 至少有 1 个清晰外形、2 个专属技能、2 段阶段变化、1 个可读预警方式、1 个对应奖励。

Boss 设计原则：

- **一眼可读**：Boss 体型、轮廓光、名字牌、出场文案必须和普通怪/精英怪拉开差距。
- **技能有预警**：范围、冲锋、雷击都要先画地面提示或方向线，给玩家 0.5-1.2 秒反应。
- **阶段有变化**：70% 和 35% 血量触发阶段变化，改变技能组合或战场压力。
- **有克制关系**：不同功法、法宝、初始天赋对不同 Boss 有明显优势，但不能完全锁死。
- **掉落有主题**：Boss 首通和重复击杀掉落不同资源，推动法宝、设施、章节解锁。

第一版 4 个章节 Boss：

| 章节 | Boss | 核心体验 | 专属技能 | 阶段变化 | 推荐克制 | 掉落重点 |
| --- | --- | --- | --- | --- | --- | --- |
| 云栖竹谷 | 山魈妖王 | 新手压迫感，召唤妖群但技能范围不复杂 | 跃崖扑击、竹影震荡、山魈小妖召唤 | 70% 开始连续跳扑；35% 召唤精英山魈护卫 | 御剑成阵、镇妖铃、身轻如燕 | 灵石、玄铁、赤莲灯解锁 |
| 玄石古阵 | 黑袍阵主 | 阵法控场，逼玩家移动路线 | 石阵封锁、魂幡牵引、符文裂爆 | 70% 激活两座石碑；35% 四象阵短暂封边 | 雷符万钧、雷符印、见微知著 | 道行、灵蕴、雷符印解锁 |
| 血煞荒原 | 血煞魔君 | 持续掉血和吸血，考验爆发与续航 | 血池腐蚀、血影分身、噬血回潮 | 70% 场地生成血池；35% 分身复制一次大招 | 业火莲华、玄龟甲、血气回转 | 玄铁、灵蕴、玄龟甲解锁 |
| 雷劫天门 | 天劫雷主 | 终章压迫，多段雷劫和大范围预警 | 九霄雷线、雷狱囚笼、天门雷瀑 | 70% 雷线变双排；35% 九重雷劫连续轰击 | 太虚引雷诀、聚灵葫芦、雷感 | 雷纹残片、镇妖铃、高阶雷池材料 |

#### 山魈妖王

定位是第一章教学 Boss，强度要明显，但不能把新玩家直接秒掉。

- 登场文案：`妖王出山！竹谷震荡。`
- 视觉：巨型青灰山魈，背后竹影妖气，脚下淡绿妖纹圈。
- 技能 1 `跃崖扑击`：先在玩家当前位置画红色落点圈，0.7 秒后跳扑，造成范围伤害和短暂击退。
- 技能 2 `竹影震荡`：向 3 个方向打出扇形冲击波，地面先显示竹叶方向线。
- 技能 3 `啸聚群妖`：召唤一圈山魈小妖，35% 血后额外召唤 1 只精英护卫。
- 失败容错：凡境下扑击最多吃掉玩家 25%-35% 气血，不做连控秒杀。

#### 黑袍阵主

定位是第二章机制 Boss，让玩家开始注意走位和场地。

- 登场文案：`古阵复苏，黑袍阵主现身。`
- 视觉：黑袍魔修悬在阵眼上方，魂幡和石碑符文同步发光。
- 技能 1 `石阵封锁`：随机生成 2-4 段短时石墙，阻挡移动路线但不完全封死。
- 技能 2 `魂幡牵引`：对玩家施加弱牵引 1.5 秒，牵引结束位置爆出紫黑魂火。
- 技能 3 `符文裂爆`：场地出现 3-5 个符文圆，1 秒后爆炸。
- 阶段变化：70% 激活石碑，提高裂爆数量；35% 开启四象阵，屏幕边缘出现短时伤害带，逼玩家向内移动。

#### 血煞魔君

定位是第三章续航 Boss，给回血、火焰、护盾流派价值。

- 登场文案：`血煞翻涌，魔君踏荒而来。`
- 视觉：赤黑巨型魔修，披血色披风，脚下血池会随阶段扩大。
- 技能 1 `血池腐蚀`：在玩家路径附近留下持续 5 秒的血池，站上去持续掉血。
- 技能 2 `血影分身`：生成 2 个低血分身，分身只会冲刺和释放弱版血池。
- 技能 3 `噬血回潮`：Boss 吸收附近小怪回血，玩家可以通过清怪打断收益。
- 阶段变化：70% 血池数量增加；35% 分身会模仿一次玩家大招方向的血煞冲击。

#### 天劫雷主

定位是当前 Demo 的终章 Boss，必须像“渡劫”而不是普通 Boss。

- 登场文案：`天劫降临！雷主镇守天门。`
- 视觉：雷云法相占据上方，主体悬浮，金紫雷纹、雷环、屏幕闪白特效。
- 技能 1 `九霄雷线`：横/竖雷线扫过战场，先画细线预警，0.8 秒后落雷。
- 技能 2 `雷狱囚笼`：在玩家周围形成 6-8 个雷柱，短时限制路线但留出口。
- 技能 3 `天门雷瀑`：随机锁定敌群和玩家附近区域多段落雷，适合制造割草高潮。
- 阶段变化：70% 雷线变双排；35% 进入 `九重雷劫`，连续 9 次落雷，每次都有明确预警。
- 胜利反馈：击败后屏幕短暂放亮，显示 `渡劫破境`，奖励雷纹残片并解锁镇妖铃或高阶雷池。

Boss 和章节难度的关系：

- 凡境：保留完整机制，但技能数量和频率较低。
- 玄境：技能冷却缩短，阶段技能提前少量出现，奖励倍率提高。
- 天境：新增组合技，例如黑袍阵主先牵引再裂爆，雷主雷线和雷狱叠加，但仍必须保留预警。

Boss 不能在第一版做复杂 AI 状态机。建议先用声明式技能配置驱动：`cooldown`、`telegraphSeconds`、`duration`、`shape`、`damageMultiplier`、`phaseMinHpRatio`、`difficultyMinId`。这样后续可以继续往 Cocos 迁移。

#### 当前 Demo 已落地的 Boss 表现

当前 HTML5 Demo 已经先按声明式配置接入 Boss 特色，不依赖新 image2 图也能玩出区别：

- Boss 出场会显示章节专属横幅、字幕和屏幕震动，`debugBoss=1` 可直接进入 Boss 验证。
- Boss 本体有独立裁切放大、章节色轮廓光、脚下旋转法阵、名字牌和阶段标识，和普通怪/精英怪拉开视觉层级。
- 70% / 35% 血量触发阶段文本和阶段技，阶段越高技能冷却越短。
- `pattern` 字段已支持多段预警：三向扇形、散点圆阵、十字阵线、平行雷线、追踪血池、三道血爪、雷狱附带落雷。
- `followup` 已支持组合技：黑袍阵主的 `魂幡牵引` 会接 `符文裂爆`。
- `duration` 已支持持续危险区：血池、雷线、石阵封锁会短时间留场造成持续压力。
- `summon / eliteCount / lifesteal` 已支持召唤、精英护卫和血煞回血。
- 击败 Boss 会显示章节专属胜利文案，并进入局外资源/解锁结算。

### 2.3 局外资源

第一版资源分 5 类，避免只有“灵石”太单薄。

| 资源 | 来源 | 用途 |
| --- | --- | --- |
| 灵石 | 每局基础结算 | 升级通用天赋、洞府设施 |
| 道行 | 存活时间、最高境界、Boss 击杀 | 解锁功法层数、章节门槛 |
| 玄铁 | 精英怪、章节奖励 | 升级可携带法宝 |
| 灵蕴 | 修为拾取、突破次数 | 升级开局天赋槽、功法 |
| 雷纹残片 | Boss、雷劫天门 | 强化大招、解锁高阶法宝 |

结算公式第一版：

```js
spiritStone = floor((kills * 2 + survivalSeconds * 0.6 + bossKilled ? 120 : 0) * chapterRewardMultiplier)
dao = floor((playerLevel * 4 + survivalSeconds / 20 + bossKilled ? 30 : 0) * difficultyDaoMultiplier)
mysticIron = eliteKills + (bossKilled ? chapterIndex + 2 : 0)
spiritEssence = breakthroughs * 3 + floor(xpCollected / 80)
thunderShard = bossKilled && chapterId === "thunder-gate" ? difficultyTier : 0
```

实现时注意 `bossKilled` 的三元表达式要加括号，避免优先级错误：

```js
const bossBonus = bossKilled ? 120 : 0;
```

### 2.4 开局构筑

用户特别提到“可以自带一件法宝，可以初始几个天赋”，所以开局构筑是核心模块。

开局可配置三类东西：

1. 本命法宝：每局最多携带 1 件。
2. 初始天赋：默认 1 个槽，后续最多 3 个槽。
3. 起手功法：默认 `御剑诀`，后续可解锁其他起手流派。

开局构筑在洞府的 `开局` 页配置，进入战斗时一次性转化为局内初始状态。

#### 本命法宝

本命法宝不是局内装备五件套，而是局外长期升级的“开局携带神器”。它可以影响开局玩法路线。

第一版 6 件：

| 法宝 | 类型 | 初始效果 | 升级方向 | 解锁 |
| --- | --- | --- | --- | --- |
| 青冥剑匣 | 攻击 | 开局御剑成阵额外 +1 剑光 | 飞剑数量、穿透、冷却 | 默认 |
| 赤莲灯 | 范围 | 开局解锁业火莲华 1 重 | 火莲半径、灼烧、旋转速度 | 云栖竹谷通关 |
| 雷符印 | 爆发 | 灵力初始 +25，雷符伤害提升 | 雷爆范围、灵力恢复 | 玄石古阵通关 |
| 聚灵葫芦 | 成长 | 修为拾取 +15%，突破时额外刷新一次选项 | 经验、拾取、回血 | 默认 |
| 玄龟甲 | 生存 | 气血 +35，受伤后短暂无敌略增 | 减伤、回血、护盾 | 血煞荒原通关 |
| 镇妖铃 | 控场 | 每 12 秒震退近身敌人 | 范围、冷却、减速 | 雷劫天门通关 |

法宝升级：

- 每件 10 级。
- 消耗 `玄铁 + 灵石`。
- 3/6/10 级解锁质变节点。
- 洞府中只能选择 1 件作为本命法宝。
- 进入战斗后不显示为局内装备槽，但角色旁边可显示一个小型悬浮法宝图标，后续实现可复用已有法器渲染逻辑。

#### 初始天赋

初始天赋是每局开局自带的小型被动，不需要局内升级选择。

第一版默认 1 个槽：

- 洞府设施 `悟道蒲团` 3 级解锁第 2 个槽。
- 洞府设施 `悟道蒲团` 7 级解锁第 3 个槽。

第一版 12 个初始天赋：

| 天赋 | 效果 |
| --- | --- |
| 剑心通明 | 飞剑伤害 +8% |
| 灵脉充盈 | 灵力获取 +10% |
| 身轻如燕 | 移速 +8% |
| 丹田稳固 | 气血上限 +18 |
| 聚气成珠 | 修为珠价值 +10% |
| 见微知著 | 拾取范围 +18 |
| 血气回转 | 每击杀 40 个敌人回复 8 气血 |
| 小周天 | 每 15 秒回复 4 灵力 |
| 破邪 | 对精英怪伤害 +12% |
| 雷感 | 天劫雷瀑伤害 +10% |
| 符缘 | 雷符万钧更早出现在升级池 |
| 火种 | 业火莲华更早出现在升级池 |

初始天赋解锁：

- 初始给 4 个：`剑心通明`、`灵脉充盈`、`身轻如燕`、`丹田稳固`。
- 其他通过章节通关或洞府等级解锁。
- 第一版不做随机洗词条，只做选择已解锁天赋。

### 2.5 局外天赋树

局外天赋树解决“永久成长太少”的问题。

设计成 5 条主脉，每条 12 级，共 60 个小等级，但第一版 UI 可以用列表而不是复杂大树图。

| 主脉 | 主题 | 属性 |
| --- | --- | --- |
| 剑修 | 输出 | 飞剑伤害、飞剑冷却、穿透概率 |
| 灵修 | 成长 | 修为获取、灵力获取、突破刷新 |
| 体修 | 生存 | 气血、减伤、受击无敌 |
| 遁法 | 手感 | 移速、拾取范围、冲刺冷却预留 |
| 炼器 | 法宝 | 本命法宝效果、法宝升级折扣、开局装备概率 |

天赋树节点节奏：

- 每条 1-4 级是线性数值。
- 5 级是小质变。
- 8 级是跨系统增益。
- 12 级是核心质变。

示例：剑修

| 等级 | 效果 |
| --- | --- |
| 1 | 飞剑伤害 +4% |
| 2 | 飞剑伤害 +4% |
| 3 | 飞剑冷却 -3% |
| 4 | 飞剑伤害 +5% |
| 5 | 开局御剑成阵等级 +1 |
| 6 | 飞剑射程 +8% |
| 7 | 飞剑伤害 +6% |
| 8 | 本命法宝为青冥剑匣时额外 +1 剑光 |
| 9 | 飞剑冷却 -4% |
| 10 | 飞剑伤害 +8% |
| 11 | 飞剑暴击概率 +5% |
| 12 | 万剑归宗：每 8 次飞剑攻击触发一次小剑阵 |

资源消耗：

```js
cost(level) = floor(60 * Math.pow(1.38, level))
```

每条主脉独立升级，不做重置功能。

### 2.6 洞府设施

洞府设施是更有修仙感的局外成长层，区别于纯数值天赋。

第一版 6 个设施：

| 设施 | 等级 | 消耗 | 作用 |
| --- | ---: | --- | --- |
| 灵田 | 10 | 灵石 | 每局结算灵石 +2%/级 |
| 丹房 | 10 | 灵石 + 灵蕴 | 回血丹效果、掉率提升 |
| 炼器炉 | 10 | 灵石 + 玄铁 | 法宝升级折扣、法器伤害 |
| 藏经阁 | 10 | 灵石 + 道行 | 功法解锁和升级 |
| 悟道蒲团 | 10 | 灵蕴 + 道行 | 初始天赋槽、突破刷新 |
| 雷池 | 10 | 雷纹残片 + 灵石 | 天劫雷瀑伤害和充能 |

设施不是必须第一轮全部实现 UI 细节，但计划中应保留数据结构和第一批 3 个设施：

- `悟道蒲团`：必须做，因为关联初始天赋槽。
- `炼器炉`：必须做，因为关联本命法宝。
- `藏经阁`：必须做，因为关联起手功法。

其他 3 个可在第二批实现。

### 2.7 功法系统

功法决定开局武器倾向，比“天赋”更像流派选择。

第一版 4 本：

| 功法 | 开局法术 | 局内升级偏向 |
| --- | --- | --- |
| 御剑诀 | 御剑成阵 | 飞剑数量、穿透、回旋 |
| 赤莲经 | 业火莲华 | 火环、灼烧、范围 |
| 雷符录 | 雷符万钧 | 符箓散射、雷爆 |
| 太虚引雷诀 | 天劫雷瀑 | 灵力、雷击、大招 |

功法等级：

- 每本 5 级。
- 消耗 `道行 + 灵蕴`。
- 功法只影响开局和升级池权重，不直接替代局内升级。
- 默认解锁 `御剑诀`。

升级池权重规则：

- 当前功法相关法术的升级权重 x1.7。
- 其他法术仍可出现，避免单一路线无聊。
- 如果携带的本命法宝和功法同系，再额外 x1.2。

### 2.8 局内装备与局外法宝的关系

必须区分两个概念：

```text
局外本命法宝：开局选择 1 件，长期升级，改变流派
局内装备五件套：每局突破时获得，局内临时成长
```

关系规则：

- 本命法宝不占用局内五件套槽位。
- 本命法宝可以给某个局内装备槽加成。
- 例如 `青冥剑匣` 强化局内 `法器`；`玄龟甲` 强化局内 `法袍`；`聚灵葫芦` 强化局内 `护符`。
- UI 上本命法宝显示在洞府和开局确认区；战斗中只显示小图标，不加入装备摘要。

---

## 3. 数据结构设计

### 3.1 存档 key

```js
const SAVE_KEY = "xianxia-survivor-meta-v1";
```

### 3.2 存档结构

```js
{
  version: 1,
  currencies: {
    spiritStone: 0,
    dao: 0,
    mysticIron: 0,
    spiritEssence: 0,
    thunderShard: 0
  },
  selected: {
    chapterId: "cloud-bamboo-valley",
    difficultyId: "mortal",
    artifactId: "qingming-sword-case",
    cultivationId: "sword-scripture",
    startingTalentIds: ["sword-heart"]
  },
  unlocks: {
    chapters: ["cloud-bamboo-valley"],
    difficulties: {
      "cloud-bamboo-valley": ["mortal"]
    },
    artifacts: ["qingming-sword-case", "spirit-gourd"],
    startingTalents: ["sword-heart", "full-meridian", "swift-body", "stable-dantian"],
    cultivations: ["sword-scripture"]
  },
  progression: {
    talentTree: {
      sword: 0,
      spirit: 0,
      body: 0,
      movement: 0,
      forge: 0
    },
    facilities: {
      cushion: 0,
      forge: 0,
      library: 0,
      field: 0,
      alchemy: 0,
      thunderPool: 0
    },
    artifacts: {
      "qingming-sword-case": 1,
      "spirit-gourd": 1
    },
    cultivations: {
      "sword-scripture": 1
    }
  },
  records: {
    runs: 0,
    totalKills: 0,
    bestSurvivalSeconds: 0,
    highestRealmLevel: 1,
    chapters: {
      "cloud-bamboo-valley": {
        bestDifficulty: "mortal",
        clearedDifficulties: [],
        bestTime: 0,
        bestKills: 0
      }
    }
  }
}
```

### 3.3 章节配置

放在 `xianxiaTheme.meta.chapters`。

```js
{
  id: "cloud-bamboo-valley",
  name: "云栖竹谷",
  desc: "灵泉竹影间的入门试炼。",
  background: "battle-map.png",
  fallbackBackground: "cover-background.png",
  unlock: { type: "default" },
  rewardMultiplier: 1,
  enemyMods: { hp: 1, speed: 1, damage: 1 },
  spawnMods: { rate: 1, cap: 1 },
  boss: { at: 360, hp: 1, damage: 1 },
  bossMechanics: {
    id: "mountain-yao-king",
    name: "山魈妖王",
    introText: "妖王出山！竹谷震荡。",
    asset: "boss-mountain-yao-king.png",
    auraColor: "#6ee7a2",
    phaseHpRatios: [0.7, 0.35],
    skills: [
      {
        id: "cliff-leap",
        name: "跃崖扑击",
        cooldown: 7,
        telegraphSeconds: 0.7,
        shape: "circle",
        radius: 86,
        damageMultiplier: 1.2,
        phaseMin: 1
      }
    ]
  },
  drops: { mysticIron: 1, spiritEssence: 1, thunderShard: 0 }
}
```

Boss 技能配置第一版建议保持声明式，避免把每个 Boss 写成大段分支逻辑。`shape` 第一批只支持 `circle`、`cone`、`line`、`ring`、`summon`、`pull`、`pool`，Canvas 里统一按 telegraph -> resolve 两段处理。

### 3.4 难度配置

放在 `xianxiaTheme.meta.difficulties`。

```js
{
  id: "mortal",
  name: "凡境",
  enemyMods: { hp: 1, speed: 1, damage: 1 },
  spawnMods: { rate: 1, cap: 1 },
  rewardMultiplier: 1
}
```

### 3.5 法宝配置

放在 `xianxiaTheme.meta.artifacts`。

```js
{
  id: "qingming-sword-case",
  name: "青冥剑匣",
  icon: "artifact-qingming-sword-case.png",
  unlock: { type: "default" },
  maxLevel: 10,
  cost: { spiritStone: 120, mysticIron: 2 },
  applyStart(metaLevel, game) {
    game.weapons.keyboard.burst += 1;
    game.weapons.keyboard.damage += 2 * metaLevel;
  }
}
```

实际实现时，为了避免函数配置难以序列化，可改成声明式 effect：

```js
effects: [
  { target: "weapon.keyboard.burst", op: "add", base: 1, perLevel: 0 },
  { target: "weapon.keyboard.damage", op: "add", base: 0, perLevel: 2 }
]
```

第一版建议使用声明式 effect，便于测试和展示。

### 3.6 初始天赋配置

放在 `xianxiaTheme.meta.startingTalents`。

```js
{
  id: "sword-heart",
  name: "剑心通明",
  desc: "飞剑伤害 +8%",
  icon: "talent-sword-heart.png",
  unlock: { type: "default" },
  effects: [
    { target: "weapon.keyboard.damageMultiplier", op: "add", value: 0.08 }
  ]
}
```

### 3.7 局外天赋树配置

放在 `xianxiaTheme.meta.talentTrees`。

每条主脉声明：

```js
{
  id: "sword",
  name: "剑修",
  maxLevel: 12,
  costCurrency: "spiritStone",
  nodes: [
    { level: 1, desc: "飞剑伤害 +4%", effects: [...] },
    { level: 5, desc: "开局御剑成阵等级 +1", effects: [...] },
    { level: 12, desc: "万剑归宗：每 8 次飞剑攻击触发小剑阵", effects: [...] }
  ]
}
```

### 3.8 洞府设施配置

放在 `xianxiaTheme.meta.facilities`。

```js
{
  id: "cushion",
  name: "悟道蒲团",
  maxLevel: 10,
  desc: "提高开局天赋槽与突破刷新能力。",
  milestones: [
    { level: 3, unlockStartingTalentSlot: 2 },
    { level: 7, unlockStartingTalentSlot: 3 }
  ]
}
```

---

## 4. UI / UX 设计

### 4.1 洞府布局

HTML 结构新增：

```html
<div id="homePanel" class="overlay home hidden">
  <div class="home-shell">
    <header class="home-header">
      <h1>云栖洞府</h1>
      <div id="metaCurrencies"></div>
    </header>
    <nav class="home-tabs">
      <button data-tab="chapters">章节</button>
      <button data-tab="start">开局</button>
      <button data-tab="talents">天赋</button>
      <button data-tab="artifacts">法宝</button>
      <button data-tab="cultivation">功法</button>
      <button data-tab="facilities">洞府</button>
    </nav>
    <section id="homeContent"></section>
    <footer>
      <button id="startRunBtn">入世斩妖</button>
      <button id="closeHomeBtn">返回战斗</button>
    </footer>
  </div>
</div>
```

### 4.2 章节页

显示章节卡片：

- 地图缩略图。
- 章节名称和描述。
- 解锁状态。
- 难度切换按钮。
- 首通奖励和普通奖励倍率。
- Boss 名称。

选择已解锁章节后，`metaState.selected.chapterId` 更新并保存。

### 4.3 开局页

显示三块：

1. 本命法宝选择：横向卡片，一次只能选 1 件。
2. 初始天赋槽：1-3 个槽，每个槽选择一个已解锁天赋，不允许重复。
3. 起手功法：选择一本已解锁功法。

必须有“开局摘要”：

```text
本命法宝：青冥剑匣 Lv.3
初始天赋：剑心通明 / 灵脉充盈
起手功法：御剑诀 Lv.2
进入战斗加成：飞剑 +1、飞剑伤害 +14%、灵力获取 +10%
```

### 4.4 天赋页

第一版不用复杂节点图，使用 5 张主脉卡：

```text
剑修 Lv.4/12
当前：飞剑伤害 +13%，冷却 -3%
下级：开局御剑成阵等级 +1
消耗：灵石 238
[升级]
```

### 4.5 法宝页

每件法宝卡展示：

- 图标。
- 等级。
- 当前效果。
- 下一级效果。
- 3/6/10 级质变标记。
- 升级消耗。
- 是否设为本命。

### 4.6 功法页

每本功法卡展示：

- 功法名。
- 等级。
- 流派标签：飞剑 / 灵火 / 雷符 / 天劫。
- 当前升级池权重影响。
- 升级消耗。

### 4.7 洞府设施页

设施卡展示：

- 等级。
- 当前效果。
- 里程碑。
- 升级消耗。

第一版重点把 `悟道蒲团`、`炼器炉`、`藏经阁` 做完整；其他显示为可升级但效果简单。

---

## 5. 代码集成点

### 5.1 文件清单

修改：

- `demo/index.html`
  - 添加洞府 overlay、按钮、容器。
- `demo/styles.css`
  - 添加洞府布局、资源条、卡片、页签、禁用态。
- `demo/src/theme.js`
  - 添加 `xianxiaTheme.meta`：章节、难度、资源、法宝、初始天赋、天赋树、功法、洞府设施。
- `demo/src/main.js`
  - 添加存档、局外状态、洞府渲染、章节套用、奖励结算。
- `demo/README.md`
  - 更新局外成长说明。

新增：

- `assets/image2-prompts/xianxia/map-stone-array.txt`
- `assets/image2-prompts/xianxia/map-blood-wasteland.txt`
- `assets/image2-prompts/xianxia/map-thunder-gate.txt`
- 可选：`assets/image2-prompts/xianxia/artifact-*.txt`

### 5.2 main.js 新增核心函数

```js
function createDefaultMetaState()
function loadMetaState()
function saveMetaState()
function sanitizeMetaState(raw)
function getSelectedChapter()
function getSelectedDifficulty()
function getStartingTalentSlots()
function applyMetaProgressionToRun()
function applyChapterDifficultyToEnemy(config)
function applyChapterDifficultyToWave(wave)
function calculateRunRewards(runSummary)
function applyRunRewards(rewards)
function unlockProgressAfterRun(runSummary)
function openHomePanel(defaultTab = "chapters")
function closeHomePanel()
function renderHomePanel()
function renderChapterTab()
function renderStartBuildTab()
function renderTalentTreeTab()
function renderArtifactsTab()
function renderCultivationTab()
function renderFacilitiesTab()
```

### 5.3 运行时状态新增字段

`game` 增加：

```js
chapter: null,
difficulty: null,
runStats: {
  eliteKills: 0,
  bossKilled: false,
  xpCollected: 0,
  breakthroughs: 0,
  damageDealt: 0,
  damageTaken: 0
}
```

现有逻辑接入：

- `resetGame()`：
  - 从 `metaState.selected` 读取章节/难度。
  - 套用永久天赋、本命法宝、初始天赋、功法。
  - 设置当前背景。
- `spawnEnemy(type)`：
  - 对敌人 hp/speed/damage 套章节和难度倍率。
- `updateWaves(dt)`：
  - 读取章节 Boss 时间。
  - 波次 rate/cap 套倍率。
- `damageEnemy(enemy, amount)`：
  - 累计 `damageDealt`。
  - 精英/Boss 击杀计数。
- `gainExperience(value)`：
  - 累计 `xpCollected`。
  - 每次突破累计 `breakthroughs`。
- `finishRun()`：
  - 生成结算 summary。
  - 计算并保存局外奖励。
  - 解锁章节/难度/天赋/法宝。

---

## 6. 数值基准

### 6.1 每局收益目标

希望一局 3-6 分钟有明显收益。

第一章凡境预期：

| 表现 | 灵石 | 道行 | 其他 |
| --- | ---: | ---: | --- |
| 1 分钟死亡 | 40-80 | 3-8 | 少量灵蕴 |
| 3 分钟死亡 | 160-260 | 12-22 | 1-3 玄铁 |
| 6 分钟通关 | 450-650 | 35-55 | 4-8 玄铁，10-18 灵蕴 |

### 6.2 升级成本节奏

天赋树：

```js
cost = Math.floor(80 * Math.pow(1.32, currentLevel))
```

法宝：

```js
spiritStoneCost = Math.floor(120 * Math.pow(1.4, currentLevel))
mysticIronCost = Math.max(1, Math.floor(currentLevel / 2))
```

设施：

```js
cost = Math.floor(160 * Math.pow(1.45, currentLevel))
```

功法：

```js
daoCost = 20 + currentLevel * 18
spiritEssenceCost = 8 + currentLevel * 6
```

### 6.3 初始强度边界

局外加成必须明显，但不能让第一章凡境无脑碾压。

第一版上限：

- 永久气血加成不超过 +120。
- 永久飞剑伤害乘区不超过 +80%。
- 永久灵力获取不超过 +70%。
- 永久移速不超过 +35%。
- 永久拾取范围不超过 +90。
- 开局法术等级最多 +2。
- 初始天赋最多 3 个。
- 本命法宝只能 1 件。

---

## 7. image2 素材计划

### 7.1 地图

使用优化后的 image2，默认生成 2048x1152。

生成命令模板：

```bash
/Users/zhoutao/miniconda3/bin/python3 /Users/zhoutao/.codex/skills/image2/scripts/generate_image2.py \
  --prompt-file assets/image2-prompts/xianxia/<name>.txt \
  --size 2048x1152 \
  --quality high \
  --output-format png \
  --out assets/generated/xianxia/raw/<name>.png \
  --timeout 240 \
  --force
```

地图 prompt 方向：

- `map-stone-array`：俯视青黑石阵，符文裂隙，中央开阔，适合战斗。
- `map-blood-wasteland`：赤黑妖气荒原，骨石、血雾、裂谷，中央开阔。
- `map-thunder-gate`：天门平台，雷云，高空石台，金紫雷纹，中央开阔。

### 7.2 法宝图标

第一版可以先复用已有装备/法术图标；如果要更好看，再补生成：

- `artifact-qingming-sword-case.png`
- `artifact-red-lotus-lamp.png`
- `artifact-thunder-seal.png`
- `artifact-spirit-gourd.png`
- `artifact-black-turtle-armor.png`
- `artifact-demon-bell.png`

法宝图标建议 1024x1024、透明背景，生成后做白底透明处理。

### 7.3 Boss 素材

Boss 建议单独生成，不复用普通怪放大图。每个 Boss 需要“战斗 sprite + 半身/图标可选”。第一版先生成战斗 sprite，统一 1024x1024 透明背景，主体占画面 75%-85%，轮廓要比小怪粗，方便 Canvas 小尺寸渲染。

生成文件：

- `boss-mountain-yao-king.png`：山魈妖王，青灰巨型山魈，竹影妖气，俯视角，魁梧但 Q 版。
- `boss-black-array-master.png`：黑袍阵主，黑袍魔修悬浮阵眼，魂幡、石碑符文、紫黑魔气。
- `boss-blood-demon-lord.png`：血煞魔君，赤黑魔修，血色披风，脚下血池，双爪血焰。
- `boss-thunder-tribulation-lord.png`：天劫雷主，雷云法相，金紫雷环，天门压迫感。

Boss prompt 统一前缀：

```text
Q版国风修仙割草手游 Boss sprite，top-down 俯视角，粗轮廓，高对比，透明背景，居中单体，无文字，无 UI，主体占画面 80%，小尺寸战斗中清晰可读，适合 Cocos Creator / HTML5 Canvas 2D sprite
```

Boss 技能特效素材第一版不强制 image2 生成，优先用 Canvas 程序化绘制预警圈、雷线、血池、石阵。原因是这些效果需要可缩放、可旋转、可控透明度，程序化更适合玩法验证。后续如果要提升美术，再补：`fx-leap-impact.png`、`fx-stone-rune.png`、`fx-blood-pool.png`、`fx-thunder-line.png`。

---

## 8. 详细开发任务

### Task 1: 添加局外配置

**Files:**

- Modify: `demo/src/theme.js`

**Steps:**

1. 在 `xianxiaTheme` 增加 `meta` 对象。
2. 添加 `currencies` 展示名和颜色。
3. 添加 4 个 `chapters`。
4. 添加 3 个 `difficulties`。
5. 添加 6 件 `artifacts`。
6. 添加 12 个 `startingTalents`。
7. 添加 5 条 `talentTrees`。
8. 添加 6 个 `facilities`。
9. 添加 4 本 `cultivations`。
10. 运行 `node --check demo/src/theme.js`。

**Acceptance:**

- `theme.js` 语法通过。
- 旧主题不需要 `meta` 字段也不报错。

### Task 2: 添加存档层

**Files:**

- Modify: `demo/src/main.js`

**Steps:**

1. 添加 `SAVE_KEY = "xianxia-survivor-meta-v1"`。
2. 添加 `createDefaultMetaState()`。
3. 添加 `loadMetaState()`。
4. 添加 `sanitizeMetaState(raw)`，缺字段时合并默认值。
5. 添加 `saveMetaState()`。
6. 在启动时初始化 `metaState`。
7. 在 `window.demoGame.snapshot()` 暴露 `metaState` 简要信息。
8. 添加 `window.demoGame.resetMetaState()` 仅用于测试。
9. 运行 `node --check demo/src/main.js`。

**Acceptance:**

- 首次打开生成默认存档。
- 刷新后存档保留。
- 手动 reset 后恢复默认。

### Task 3: 洞府 UI 骨架

**Files:**

- Modify: `demo/index.html`
- Modify: `demo/styles.css`
- Modify: `demo/src/main.js`

**Steps:**

1. HTML 添加 `homePanel` overlay。
2. 顶部 HUD 增加 `洞府` 按钮。
3. CSS 添加洞府面板、资源条、页签、卡片样式。
4. JS 添加 `openHomePanel()`、`closeHomePanel()`。
5. JS 添加 `renderHomePanel()` 和 tab 切换。
6. 修仙主题首次打开默认展示洞府。
7. 旧主题不显示洞府按钮。
8. 运行静态检查。

**Acceptance:**

- 默认修仙主题打开能看到洞府。
- 点击 `入世斩妖` 开始战斗。
- 战斗中点击洞府能暂停并打开。
- `office/cat` 不显示洞府功能。

### Task 4: 章节与难度

**Files:**

- Modify: `demo/src/main.js`
- Modify: `demo/src/theme.js`

**Steps:**

1. 添加 `getSelectedChapter()`。
2. 添加 `getSelectedDifficulty()`。
3. 章节页渲染章节卡和难度按钮。
4. 选择章节/难度后保存。
5. `resetGame()` 设置 `game.chapter` 和 `game.difficulty`。
6. 背景按章节切换。
7. 敌人属性套用章节和难度倍率。
8. 波次 rate/cap 套用章节和难度倍率。
9. Boss 出场时间和血量套用章节配置。
10. 运行浏览器验证。

**Acceptance:**

- 切换章节后背景变化。
- 切换难度后敌人强度明显变化。
- 未解锁章节不可选。
- Boss 基础出场仍可用，但专属机制在 Task 10 单独完成。

### Task 5: 开局构筑

**Files:**

- Modify: `demo/src/main.js`
- Modify: `demo/styles.css`

**Steps:**

1. 渲染本命法宝选择卡。
2. 渲染初始天赋槽。
3. 渲染功法选择。
4. 添加选择合法性校验：法宝 1 件、天赋不重复、槽位数量受悟道蒲团影响。
5. 添加 `applyMetaProgressionToRun()`。
6. 在 `resetGame()` 调用局外加成。
7. 在战斗 HUD 或 snapshot 中显示当前开局构筑摘要。
8. 运行浏览器验证。

**Acceptance:**

- 可以选择一件本命法宝。
- 初始天赋槽数量按设施等级变化。
- 进入战斗后属性生效。

### Task 6: 天赋树

**Files:**

- Modify: `demo/src/main.js`
- Modify: `demo/styles.css`

**Steps:**

1. 渲染 5 条主脉卡。
2. 显示当前等级、当前效果、下级效果、升级消耗。
3. 灵石足够时允许升级。
4. 灵石不足时按钮禁用。
5. 升级后保存并刷新 UI。
6. `applyMetaProgressionToRun()` 读取天赋树效果。

**Acceptance:**

- 天赋升级扣资源。
- 刷新页面等级保留。
- 进入战斗后对应属性生效。

### Task 7: 法宝升级

**Files:**

- Modify: `demo/src/main.js`
- Modify: `demo/styles.css`

**Steps:**

1. 渲染 6 件法宝卡。
2. 显示当前等级、下级效果、质变节点。
3. 升级消耗灵石和玄铁。
4. 支持设为本命。
5. 未解锁法宝显示解锁条件。
6. 进入战斗后套用本命法宝效果。

**Acceptance:**

- 法宝可升级、可设为本命。
- 法宝效果进入战斗生效。
- 未解锁法宝不可设为本命。

### Task 8: 功法与设施

**Files:**

- Modify: `demo/src/main.js`
- Modify: `demo/styles.css`

**Steps:**

1. 渲染功法页。
2. 支持功法升级和选择。
3. 功法影响局内升级池权重。
4. 渲染洞府设施页。
5. 实现 `悟道蒲团`、`炼器炉`、`藏经阁` 的实际效果。
6. 其他设施先实现基础数值效果。

**Acceptance:**

- 功法选择影响升级卡倾向。
- 悟道蒲团等级能解锁更多初始天赋槽。
- 设施升级保存并生效。

### Task 9: 结算奖励与解锁

**Files:**

- Modify: `demo/src/main.js`
- Modify: `demo/index.html`
- Modify: `demo/styles.css`

**Steps:**

1. 扩展 `runStats`。
2. 击杀、精英、Boss、突破、拾取时累计统计。
3. `finishRun()` 计算奖励。
4. 结算页展示资源获得和解锁内容。
5. 通关章节后解锁下一章。
6. 刷新后解锁状态保留。

**Acceptance:**

- 死亡也有奖励。
- 通关解锁下一章。
- 结算展示清晰。

### Task 10: Boss 特色机制

**Files:**

- Modify: `demo/src/theme.js`
- Modify: `demo/src/main.js`
- Modify: `demo/styles.css`
- Optional Create: `assets/image2-prompts/xianxia/boss-*.txt`

**Steps:**

1. 在章节配置里添加 `bossMechanics`，包含 Boss id、名字、登场文案、素材、光效、阶段阈值、技能列表。
2. 添加 Boss 技能运行时状态：冷却、预警、持续时间、阶段、召唤计数。
3. 实现统一技能流程：`scheduleBossSkill()` -> `drawBossTelegraph()` -> `resolveBossSkill()`。
4. 第一批支持 7 类技能 shape：`circle`、`cone`、`line`、`ring`、`summon`、`pull`、`pool`。
5. 实现山魈妖王：跃崖扑击、竹影震荡、啸聚群妖。
6. 实现黑袍阵主：石阵封锁、魂幡牵引、符文裂爆。
7. 实现血煞魔君：血池腐蚀、血影分身、噬血回潮。
8. 实现天劫雷主：九霄雷线、雷狱囚笼、天门雷瀑。
9. Boss 血量到 70% / 35% 时触发阶段提示、轮廓光强化、技能组合变化。
10. 结算中记录 Boss 击杀、首通、重复击杀奖励，并显示 Boss 专属掉落。
11. 在 `window.demoGame.snapshot()` 暴露当前 Boss id、hpRatio、phase、activeTelegraphs。
12. 用浏览器验证四章 Boss 都能出场且无运行时错误。

**Acceptance:**

- 每章 Boss 的外形、名字、登场文案不同。
- 每章 Boss 至少有 2 个专属技能实际生效。
- Boss 技能有明确地面预警，不做无提示秒杀。
- Boss 70% 和 35% 血量阶段变化肉眼可见。
- 击败 Boss 后结算展示对应章节掉落和解锁。
- 凡境 Boss 对新手有压迫但不应连续控制秒杀。

### Task 11: image2 新地图与 Boss 图

**Files:**

- Create: `assets/image2-prompts/xianxia/map-stone-array.txt`
- Create: `assets/image2-prompts/xianxia/map-blood-wasteland.txt`
- Create: `assets/image2-prompts/xianxia/map-thunder-gate.txt`
- Create: `assets/image2-prompts/xianxia/boss-mountain-yao-king.txt`
- Create: `assets/image2-prompts/xianxia/boss-black-array-master.txt`
- Create: `assets/image2-prompts/xianxia/boss-blood-demon-lord.txt`
- Create: `assets/image2-prompts/xianxia/boss-thunder-tribulation-lord.txt`
- Modify: `demo/src/theme.js`

**Steps:**

1. 写 3 个地图 prompt。
2. 写 4 个 Boss prompt。
3. 用 image2 生成地图 2048x1152 PNG。
4. 用 image2 生成 Boss 1024x1024 PNG。
5. 原图保存到 `assets/generated/xianxia/raw/`。
6. 选定图复制到 `demo/assets/xianxia/`。
7. 接入章节配置。
8. 用浏览器截图验证地图切换和 Boss 可读性。

**Acceptance:**

- 3 张地图均能加载。
- 4 张 Boss 图均能加载，且明显区别于普通怪。
- Boss 图透明背景处理为 RGBA，战斗中无白底。
- 地图缺失时 fallback 不报错。
- 不使用占位图顶替 image2 失败项。

### Task 12: 自动化验证与文档

**Files:**

- Modify: `demo/README.md`
- Optional Create: `scripts/verify-demo.mjs`

**Steps:**

1. README 增加局外成长说明。
2. README 增加存档清理方法。
3. README 增加章节/难度说明。
4. README 增加 Boss 机制和章节掉落说明。
5. 可选添加 Playwright 验证脚本。
6. 运行完整测试。

**Acceptance:**

- 文档能说明怎么玩局外成长。
- 文档能说明每章 Boss 的机制重点。
- 验证脚本能检查基本 UI、存档、章节和 Boss 出场。

---

## 9. 测试计划

### 9.1 静态检查

```bash
node --check demo/src/main.js
node --check demo/src/theme.js
node --check scripts/serve-demo.mjs
```

### 9.2 浏览器测试

用 Playwright 验证：

1. 首次打开默认显示洞府。
2. 点击 `入世斩妖` 进入战斗。
3. 结算后资源增加。
4. 升级天赋后刷新页面仍保留。
5. 选择本命法宝后进入战斗属性变化。
6. 选择初始天赋后进入战斗属性变化。
7. 通关第一章解锁第二章。
8. 切换难度后敌人属性变化。
9. `?theme=office` 和 `?theme=cat` 不报错。

### 9.3 手动体验测试

重点看：

- 洞府 UI 是否信息过载。
- 资源增长是否太慢。
- 第一局是否就能升级至少 1 次。
- 开局构筑是否有明显差异。
- 高难度是否只是数值膨胀，是否需要额外机制。

---

## 10. 分批交付建议

### Batch A：最小闭环

必须先做：

- 存档层。
- 洞府 UI 骨架。
- 灵石/道行结算。
- 章节选择。
- 天赋树 5 主脉。

完成后已经有“每局结算 -> 升级 -> 再开局”的闭环。

### Batch B：开局构筑

继续做：

- 本命法宝。
- 初始天赋槽。
- 功法选择。
- 悟道蒲团、炼器炉、藏经阁。

完成后有“开局 build”。

### Batch C：章节扩展

最后做：

- 3 张新地图。
- 章节解锁。
- 难度奖励倍率。
- Boss 差异。

完成后有“长线推进”。

---

## 11. 风险与取舍

| 风险 | 处理 |
| --- | --- |
| 局外系统过多导致第一版做不完 | 按 Batch A/B/C 分批实现，先闭环后扩展 |
| 数值永久成长过强，局内失去挑战 | 设置上限，章节难度倍率抵消成长 |
| UI 信息太多 | 使用页签，不在一个页面塞完 |
| localStorage 存档结构变化 | 加 `version` 和 `sanitizeMetaState` |
| image2 地图失败 | 不用占位，章节背景 fallback 到已有地图 |
| 法宝和局内装备概念混淆 | UI 文案明确：本命法宝是局外携带，五件套是局内临时装备 |

---

## 12. 明确不做

第一版不做：

- 后端账号。
- 付费、抽卡、商店。
- 随机装备词条。
- 背包拖拽。
- 每件法宝独立复杂技能树。
- 每章独立敌人素材大批量生成。
- Cocos 原生工程迁移。

---

## 13. 最终验收标准

实现完成后，应满足：

- 玩家首次进入看到洞府，并能选择章节进入战斗。
- 每局结束能获得至少两种局外资源。
- 玩家可以升级局外天赋，并在下一局感受到属性变化。
- 玩家可以携带一件本命法宝进入战斗。
- 玩家可以配置 1-3 个初始天赋进入战斗。
- 玩家可以升级洞府设施解锁更多开局能力。
- 玩家可以通关章节并解锁下一章。
- 至少 4 章、3 难度的数据结构完整。
- 第一章使用当前 `battle-map.png`，其他地图支持 image2 接入和 fallback。
- 旧 `office` / `cat` 主题仍能运行。
