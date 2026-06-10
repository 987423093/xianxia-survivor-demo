# 11 image2 资产管线

## 目标形态

资产管线负责稳定生成、处理、检查和接入 AI 图片。它必须是项目本地流程，不能把 API key 或私有配置写进仓库。

## 当前实现

状态：已完成

当前目录：

| 路径 | 用途 |
| --- | --- |
| `assets/image2-prompts/xianxia/` | prompt 文件 |
| `assets/generated/xianxia/raw/` | image2 raw 候选 |
| `demo/assets/xianxia/` | Demo 接入资产 |
| `scripts/generate-xianxia-missing-assets.mjs` | 调用 image2 |
| `scripts/prepare-xianxia-assets.mjs` | 拷贝和抠白底 |
| `scripts/check-xianxia-assets.mjs` | 尺寸和 alpha 检查 |

当前命令：

```bash
npm run assets:generate -- --timeout 600 --quality high
npm run assets:prepare
npm run assets:check
```

当前已接入资产：

- 地图、Boss、主角境界、敌人、法术、装备、拾取物。
- 洞府背景、页签横幅、法宝图标、设施图标、方向图标。

## 处理规则

- 背景和横幅：保留 opaque。
- 图标和角色：纯白背景生成，本地边缘连通抠白底。
- 检查图标必须为 RGBA 且 alpha 范围 `0-255`。
- 检查背景必须尺寸正确且 alpha `255-255`。

## 当前缺口

- 没有候选图人工选择 manifest。
- 没有 contact sheet 自动生成常规流程。
- 没有失败项自动重试。
- 没有素材版本记录。

## 后续计划

- 增加 `assets/xianxia-manifest.json` 记录选中候选。
- 生成 contact sheet 方便批量审图。
- 失败项按清单自动补跑。
- 加入材料图标和章节奖励图标。

## 验收标准

- 新增资产能通过 generate/prepare/check 三步进入 Demo。
- image2 key 不进入项目文件。
- 运行时只读本地静态图片。
- 图片缺失时不显示破图。

