# 云栖修真录 Demo

这是一个先行可玩的 HTML5 Canvas 修仙割草 Demo，用来验证 Cocos Creator 版本前的核心玩法闭环。

## 启动

在仓库根目录运行：

```bash
npm run demo
```

然后打开：

```text
http://127.0.0.1:6273/
```

也可以切换主题验证配置化：

```text
http://127.0.0.1:6273/?theme=office
http://127.0.0.1:6273/?theme=cat
```

Boss 调试入口：

```text
http://127.0.0.1:6273/?debugBoss=1
http://127.0.0.1:6273/?debugBoss=1&chapter=stone-array
http://127.0.0.1:6273/?debugBoss=1&chapter=blood-wasteland
http://127.0.0.1:6273/?debugBoss=1&chapter=thunder-gate&difficulty=heaven
```

这个入口会跳过洞府并直接刷出指定章节 Boss，只用于调试 Boss HUD、技能预警和阶段表现。

## 操作

- 桌面端：`WASD` 或方向键移动。
- `P` 或 `Esc`：暂停/继续。
- 移动端：按住左下方区域拖动，使用虚拟摇杆移动。

## 当前玩法

- 默认主题为 Q版国风修仙。
- 默认打开先进入 `云栖洞府`，可以选择章节、难度、开局法宝、初始天赋、功法、天赋树和洞府设施。
- 局外存档使用 `localStorage`，key 为 `xianxia-survivor-meta-v1`。
- 局外资源包含灵石、道行、玄铁、灵蕴、雷纹，死亡或击败 Boss 后都会结算资源。
- 章节包含云栖竹谷、玄石古阵、血煞荒原、雷劫天门；每章有凡境、玄境、天境三档难度。
- 开局构筑包含 1 件本命法宝、1-3 个初始天赋、1 本起手功法。
- 开局页包含系统构筑预设、本章推荐、入局预览和输出/生存/成长战备评估。
- 章节卡和 Boss 图鉴会展示主要掉落、首通奖励、Boss 技能和推荐流派。
- 成长拆成法术和装备两条线，突破时至少出现一个法术选项和一个装备选项。
- 法术包含御剑成阵、业火莲华、雷符万钧和满灵力自动释放的天劫雷瀑。
- 装备包含法袍、法冠、靴子、护符、法器五件套，装备升阶后会叠加显示在人物身上。
- 主角会按炼气到飞升的境界切换基础形象，装备外观继续保留在角色身上。
- 敌人按时间刷出并追踪玩家。
- 击败敌人掉落灵气珠。
- 敌人有概率掉落回血丹。
- 修为自动吸附，突破后三选一强化。
- Boss 出现时显示 Boss 血条；不同章节 Boss 已接入不同程序化技能预警和阶段提示。
- 左下角包含气血、灵力、修为状态条，顶部保留计时、境界、斩妖数和法术摘要。
- 包含死亡结算、局外奖励、回洞府和重新开局。
- 结算页会拆分材料来源，展示击杀、闭关、Boss、倍率、奇遇、战场拾取等贡献。
- `demo/assets/xianxia/` 下已接入首批 image2 PNG。`assets/generated/xianxia/raw/` 保留了生成原图和备选图。

## 当前源码架构

当前源码已经按职责拆成入口壳和领域模块：

- `demo/src/main.js`：入口装配，只负责参数、DOM、依赖注入、事件绑定、主循环启动。
- `demo/src/run-runtime.js`：战斗运行时，包含玩家、敌人、Boss、拾取、结算和调试场景。
- `demo/src/run-events.js`：奇遇、伏击、试炼、连锁奇遇。
- `demo/src/build-planner.js`：局外构筑、章节推荐、材料路线、组合图鉴。
- `demo/src/quests-goals.js`：悬赏、局内目标、结果页下一步建议。
- `demo/src/rewards-summary.js`：局后奖励、来源拆解、暂停摘要。
- `demo/src/meta-store.js`：局外存档、导入导出、解锁与调试 meta。
- `demo/src/home/*`：洞府状态、渲染、动作分发。
- `demo/src/renderer.js`：Canvas 绘制。
- `demo/src/assets.js`：资源加载和图片 helper。

详细约束见：

- `docs/modules/00-当前架构与开发约束.md`
- `docs/modules/15-移动端浏览器验收方案.md`

## image2 资源生成

缺失的新章节地图和 Boss 专属图可以用脚本串行生成：

```bash
node scripts/generate-xianxia-missing-assets.mjs --force
node scripts/prepare-xianxia-assets.mjs
```

如果 image2 远端连接不稳定，可以只重试单张：

```bash
node scripts/generate-xianxia-missing-assets.mjs --only boss-mountain-yao-king --force --timeout 600
```

常用参数：

- `--only <name>`：只生成单张，例如 `map-stone-array`。
- `--force`：覆盖已有 raw 图。
- `--timeout 600`：单张等待 600 秒。
- `--quality medium`：降低质量尝试减少耗时。
- `--transport urllib`：不用 SDK，改走 urllib 请求。
- `--map-size 1024x1024` / `--boss-size 1024x1024`：临时覆盖尺寸。

检查缺失项：

```bash
npm run assets:check
```

Boss 图使用白底生成，再由 `prepare-xianxia-assets.mjs` 做边缘连通白底透明处理；地图图直接复制到 `demo/assets/xianxia/`。

## Boss 机制

第一版 Boss 机制先用 Canvas 程序化特效验证玩法，不依赖新图片：

- 山魈妖王：跃崖扑击、竹影震荡、啸聚群妖。
- 黑袍阵主：符文裂爆、魂幡牵引、石阵封锁。
- 血煞魔君：血池腐蚀、血爪裂地、血影分身。
- 天劫雷主：九霄雷落、九霄雷线、雷狱囚笼。

Boss 血量低于 70% 和 35% 会进入新阶段，技能频率和组合会增强。

## 存档清理

调试局外成长时，可以在浏览器控制台执行：

```js
localStorage.removeItem("xianxia-survivor-meta-v1");
location.reload();
```

## Cocos 迁移说明

当前本机没有检测到 Cocos Creator.app，所以先交付浏览器可玩 Demo。后续迁移到 Cocos Creator 时，优先迁移：

- `demo/src/theme.js` 的修仙主题配置。
- `demo/src/run-runtime.js` 中的实体循环：玩家、敌人、投射物、拾取物、升级、波次。
- `demo/src/run-events.js`、`demo/src/build-planner.js`、`demo/src/meta-store.js` 中的局内外系统逻辑。
- Canvas 绘制替换为 Cocos Sprite、Prefab、Particle、Tween 和 Camera。
