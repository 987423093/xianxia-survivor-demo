# 云栖修真录仓库入口

## 1. 当前骨架

这个仓库已经按「Cocos 迁移优先」重排为单一骨架：

- `web-runtime/`：当前可运行的 HTML5 Canvas 过渡内核，也是移动端回归基线。
- `web-runtime/src/bootstrap/runtime/`：启动参数、移动端壳层、入口公共层。
- `web-runtime/src/content-registry/`：主题目录、内容 registry、UI contract。
- `web-runtime/src/gameplay/`：战斗运行时、渲染、奇遇。
- `web-runtime/src/meta/progression/`：局外成长、构筑、悬赏、奖励总结。
- `web-runtime/src/ui/home/`：洞府 UI。
- `web-runtime/src/resources/`：资源加载、预热、资源契约。
- `scripts/`：测试、资源管线、部署。
- `docs/architecture/` 与 `docs/runbooks/`：当前真相源。
- `docs/modules/`：功能模块真相源。
- `docs/plans/00-当前进度.md`：当前状态面板。
- `docs/archive/`、`openspec/`：归档层与记录层，不作为当前接口说明。

## 2. 文档真相源

- 入口：本文件。
- 架构：`docs/architecture/`。
- 运行与验收：`docs/runbooks/`。
- 功能模块：`docs/modules/`。
- 当前进度：`docs/plans/00-当前进度.md`。
- 记录层：`docs/archive/`、`openspec/`。

## 3. 当前开发原则

- HTML5 Canvas 继续保留为可运行内核，但不再作为最终目录骨架中心。
- 当前交付口径只支持竖屏移动端，不再维护 PC/桌面交互分支。
- 新增逻辑优先落到领域目录，不再把 `main.js`、`theme.js` 当主要扩展面。
- 多 worktree 并发默认按 `gameplay / meta / ui / resources / docs` 这些 seam 分工。

## 4. 快速开始

```bash
npm run web-runtime
npm run demo
npm run config:check
npm run test:meta
npm run test:ui-assets
npm run test:mobile
npm run smoke
```

详细启动、验收和调试看 [01-运行、验收与调试手册](/Users/zhoutao/Documents/小游戏/docs/runbooks/01-运行、验收与调试手册.md)。`npm run demo` 目前只保留为启动别名。
