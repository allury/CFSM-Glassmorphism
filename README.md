# CFSM-Glassmorphism

CFSM-Glassmorphism 是 Komari Glassmorphism 面向 CF-Server-Monitor 公开第三方主题 API 的移植版本，使用 Vue 3 + TypeScript + Vite 构建。

当前稳定版本：**v1.0.0**。

## 安装主题

两种方式产物完全相同，都必须先通过 CI 的全部质量门才会发布。

### 一、主题商店「自定义主题 URL」（推荐）

在 CFSM 管理端 **主题商店 → 自定义主题 URL** 中填入下面任一地址，然后点「应用自定义」：

~~~text
https://github.com/allury/CFSM-Glassmorphism/tree/theme-v1.0.0   # 固定版本，推荐
https://github.com/allury/CFSM-Glassmorphism/tree/theme-dist     # 始终跟随最新发布
~~~

`theme-v1.0.0` 是**不可变标签**，指向本版本已验证的构建产物，符合官方「建议使用固定版本」的提示；`theme-dist` 是滚动分支，内容会随新版本更新。

> 主题商店会把 `https://github.com/<owner>/<repo>/tree/<ref>` 解析为 `raw.githubusercontent.com/<owner>/<repo>/<ref>/`，并直接读取 `index.html` 与 `assets/`，因此构建产物必须能通过 git 访问。为此本仓库有一个专用的 `theme-dist` 分支只存放构建产物；`main` 分支仍然只保留源码，不提交 `dist/`。

### 二、下载 ZIP 手动安装

从 [GitHub Releases](https://github.com/allury/CFSM-Glassmorphism/releases/latest) 下载 `CFSM-Glassmorphism-1.0.0.zip`，走 CFSM 官方主题安装流程。压缩包根目录只包含 `index.html` 与 `assets/`，解压后不需要再进入子目录。

## 功能概览

项目包含完整的工程基座、还原后的首页仪表盘、真实的 `/#/server/:id` 详情页、集中式 `/#/settings` 主题设置、三套 Earth/Map 渲染器，以及登录态下的高级工具。

- 首页读取 `/api/config` 与 `/api/servers`；详情页使用节点所属来源的 `/api/server`、`/api/history/all` 和单节点 `/api/ws?subscribe=<id>` 连接。
- `batchUpdate` 的增量样本按字段合并，不会覆盖已有 REST 状态；重连采用有界退避，并在不可用时降级为低频 REST 补偿。
- 主题设置在同一个严格 store 中解析 defaults、后端 `theme_options` 与浏览器本地覆盖；登录态保存只使用 `POST /api/theme_options`，发送完整快照并回读 config，无需刷新页面。
- Earth 只按明确的国家/地区中心定位；健康、性价比、快照与分类拓扑工具消费同一份归一化的真实数据模型。

## 来源与署名

- CFSM 主题权限与协议：CF-Server-Monitor 的 `theme-develop.md`。
- 运行时行为参考：CFSM 当前 `src/frontend` 实现。
- CFSM 接入工程化参考：CFSM-Theme-LuminaPlus。
- 视觉与交互来源：sanrokamlan-prog/komari-theme-Glassmorphism。

本项目基于 Komari Glassmorphism 并将其适配到 CF-Server-Monitor，**不主张原主题的视觉设计为本项目原创**。详见 LICENSE 与 `docs/compatibility-matrix.md`。

## 开发

在仓库根目录使用 Bun：

~~~bash
bun install
bun run dev
bun run lint
bun run typecheck
bun run test
bun run build
bun run validate:dist
~~~

生产代码必须使用真实 CFSM 数据，或呈现真实的空/错误状态。测试夹具只能存在于 `tests/` 或明确的开发期 mock 边界内。

## 正式构建

推送 main、推送版本标签、Pull Request 和手动触发都会执行：

~~~text
frozen install
-> lint
-> typecheck
-> 单元测试
-> build
-> dist 校验
-> ZIP 打包
-> artifact 上传
~~~

workflow 上传 `CFSM-Glassmorphism-build-<short-sha>.zip`，其根目录只包含 `index.html` 与 `assets/`。`bun run validate:dist` 同时扫描禁止出现的 Komari 运行时标记，并执行发布体积预算（JavaScript 3328 KiB、CSS 128 KiB、总资源 6656 KiB——按上游 Earth 渲染器、其贴图与 echarts 图表族的真实构成设定），超出即让构建失败。生成的 dist 目录与 ZIP 不进入版本控制。

当对应提交在 `main` 上通过同一组质量门后，推送带注释的 `v<package 版本>` 标签会把**已验证的同一份产物**以稳定名 `CFSM-Glassmorphism-<version>.zip` 发布，同时把该产物发布到 `theme-dist` 分支并打上不可变的 `theme-v<version>` 标签。标签与 `package.json` 版本不一致时 release 作业会直接失败。

## 文档

- `docs/CODEX_SPEC.md`：项目主提供的完整规格书，保持原样不改。
- `AGENTS.md`：长期有效的实现规则。
- `docs/compatibility-matrix.md`：功能可行性审计。
- `docs/api-mapping.md`：公开端点归属与来源参考。
- `docs/architecture.md`：分层与数据流。
- `docs/theme-settings.md`：上游 48 项设置及其 CFSM 处理方式。
- `docs/visual-validation.md`：断点、渲染器与交互验证记录。
- `docs/fidelity-audit.md`：与上游 Komari Glassmorphism 的逐项对比及 P0/P1/P2 终态。
- `docs/releases/v1.0.0.md`：首个稳定版发布说明与必要平台差异。

## UI 权威基准

**原 Komari Glassmorphism 是正式版 UI/UX 的唯一权威基准。** 本仓库既有实现只代表「已经实现的 CFSM 功能」，不代表视觉真相；除 CFSM 平台必要差异外，一律向 Komari 对齐，每一项差异都记录在 `docs/fidelity-audit.md`。

- 三套 Earth 渲染器是上游真实实现（globe.gl + three、cobe、真实贴图等距地图），不是仿制；three 与 globe.gl 懒加载且只在 realistic 渲染器下加载。
- 图标使用与上游同名的 Tabler / IconPark 图标，路径在构建期内联，运行时不访问任何图标 CDN。
- 旗帜与 OS 图标取自 CFSM 默认皮肤（`/flags/<code>.svg`、`/os-icons/<filename>`），不打包进主题。
- History 图表使用与上游相同的 echarts + vue-echarts，并保持 `connectNulls: false`，超时与缺失样本保持为断点而不是 0。
- UI 基元（tooltip、tabs、badge、toast）建立在 reka-ui 与 vue-sonner 之上。
