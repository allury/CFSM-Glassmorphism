# 高保真审计（第 9.5 轮）

> **最高原则：原 Komari Glassmorphism 当前默认分支的真实代码、组件、样式、布局、动画、路由行为与浏览器表现，是正式版 UI/UX 的唯一权威基准。当前 CFSM-Glassmorphism 的既有实现代表"已经实现的 CFSM 功能"，不代表最终视觉真相；与 Komari 不一致时默认向 Komari 对齐。**

目标是"把 Komari Glassmorphism 移植到 CFSM 后端"，而不是"参考 Komari 再设计一个类似主题"。用户从 Komari 切换到本主题后，应当明显感觉"这是同一个主题换了监控后端"。

## 审计基线

| 项目 | 分支 | 提交 | 用途 |
|---|---|---|---|
| sanrokamlan-prog/komari-theme-Glassmorphism | main | `bf83765`（v3.3.7） | UI/UX 唯一权威基准 |
| allury/CFSM-Glassmorphism | main | `d2915d4`（第 9 轮完成） | 本轮起点 |
| huilang-me/CF-Server-Monitor | main | `924e71d` | 第三方主题 API 权限与协议上限 |

上游克隆位于被 Git 忽略的 `work/upstreams/`，只读。本审计对照真实源码（`NodeEarthGlobe.vue`、`NodeEarthRealisticGlobe.vue`、`NodeEarthCobeGlobe.vue`、`NodeEarthTiledMap.vue`、`NodeCard.vue`、`NodeList.vue`、`NodeGeneralCards.vue`、`HomeView.vue`、`InstanceDetail.vue` 等），不依赖截图观察。

## 优先级定义

- **P0**：页面层级 / 导航路径 / renderer / 核心布局明显不一致。
- **P1**：重要视觉结构 / 尺寸 / 响应式 / 动画明显不一致。
- **P2**：轻微样式 / 文案 / 边距差异。

## 允许存在的 CFSM 必要差异

仅以下平台差异被允许，其余一律向 Komari 对齐：

1. Komari API → CFSM REST（`/api/config`、`/api/servers`、`/api/server`）。
2. Komari 实时数据 → CFSM `/api/ws`。
3. Komari 历史数据 → CFSM `/api/history/all`。
4. Komari Settings → CFSM `theme_options`（唯一写接口 `POST /api/theme_options`）。
5. CFSM multi-apiBase 的 source ownership。
6. CFSM JWT / Turnstile。
7. CFSM 第三方主题安装 / 构建 / `dist` 规则（根目录只允许 `index.html` 与 `assets/`）。
8. CFSM 确实没有的数据字段（真实 IP、ASN、ISP、Provider、精确城市与经纬度、访客 IP、Audit Log）。
9. 路由技术差异：详情使用 `/#/server/:id`。
10. 为保持数据真实性而做的字段隐藏或明确降级。

## 审计矩阵

| # | 区域 | Komari 原行为 | 当前 CFSM 行为（本轮前） | 一致性 | CFSM 必要差异 | 正式版修正方案 | 优先级 | 本轮状态 |
|---:|---|---|---|---|---|---|---|---|
| 1 | Earth renderer 分发 | `NodeEarthGlobe.vue` 用 `defineAsyncComponent` 分发到三套独立渲染器 | 单一 `EarthMap.vue` 手绘 SVG 世界地图 + 绝对定位标记 + 地区侧栏 | 不一致 | 否 | 重建分发器，恢复三套真实渲染器 | **P0** | ✅ 已修复 |
| 2 | realistic 渲染器 | `globe.gl` + `three` 真实 3D 地球：原主题贴图、bump、specular、atmosphere、点/环、四光源、自转、resize、可见性暂停 | 无（SVG 剪影 + CSS 渐变模拟） | 不一致 | 否 | 按原实现移植，仅替换数据源与纹理引用方式 | **P0** | ✅ 已修复 |
| 3 | cobe 渲染器 | 真实 `cobe` 点阵地球，RAF 驱动、指针拖拽、静态重绘窗口、标签球面投影 | 无（CSS 点阵背景模拟） | 不一致 | 否 | 按原实现移植真实 cobe | **P0** | ✅ 已修复 |
| 4 | tiled 渲染器 | 独立组件：真实地球贴图等距投影、图例密度四级、移动端横向滚动 | 无（同一 SVG 复用，仅改宽高比） | 不一致 | 否 | 按原实现移植为独立渲染器 | **P0** | ✅ 已修复 |
| 5 | Earth 定位数据 | 允许外部 IP Geo 查询得到城市级坐标，回退国家中心 | 只用 region → 国家中心 | 部分一致 | **是**（§4/§8：CFSM 无真实 IP/ASN/城市，`ip_v4`/`ip_v6` 仅为可达性标志） | 保持只用可靠 region，无法定位不打点 | — | 保留必要差异 |
| 6 | 旗帜资源 | `/images/flags/<code>.svg`（主题自带） | 无旗帜 | 不一致 | **是**（`theme-develop.md` 要求用默认皮肤静态文件且不打包） | 改用 CFSM 官方 `/flags/<code>.svg`（小写） | P1 | ✅ 已修复 |
| 7 | Earth 与总览的关系 | Earth 嵌在 `NodeGeneralCards` 同一栅格：桌面球体占右半、卡片占左半同一行；移动端卡片负边距上移叠加；tiled 则卡片在上、地图在下 | Earth 与总览是两个独立兄弟区块，各自带面板外壳 | 不一致 | 否 | 建立 `general-stage` 统一栅格复刻该契约 | **P0** | ✅ 已修复 |
| 8 | 节点卡片主点击路径 | `NodeCard` 点击直接进入 `InstanceDetail` | 卡片点击 → `ServerQuickView` 弹层 → 再点"打开完整详情与历史"才进详情 | 不一致 | 否 | 移除强制中间层，卡片点击直达 `/#/server/:id` | **P0** | ✅ 已修复 |
| 9 | 列表行主点击路径 | `NodeList` 行点击直接进入详情 | 同样先弹 QuickView | 不一致 | 否 | 行点击直达详情 | **P0** | ✅ 已修复 |
| 10 | 卡片内独立控件 | 收藏等独立按钮 `stopPropagation`，不触发导航 | 已有 `@click.stop` | 一致 | 否 | 保持并加回归测试锁定 | — | ✅ 已锁定 |
| 11 | 首页往返状态 | 返回首页保持滚动位置、分组、搜索、视图与筛选，无需刷新 | 搜索/分组/排序/快捷筛选是组件局部 ref，离开即丢失；路由无 `scrollBehavior` | 不一致 | 否 | 会话级 `dashboard-view` store + 路由 `savedPosition` 恢复 | **P0** | ✅ 已修复 |
| 12 | 总览卡片结构 | 无独立标题区，卡片本身是 12 栅格中的 `col-span-4` 单元，含图标与 hover 态；可点击卡片打开财务明细弹窗 | 带"节点总览"标题区的面板，卡片为自有网格；无财务明细弹窗 | 部分一致 | 否 | 去掉自创标题区、对齐卡片栅格与尺寸、补 `FinanceDetailsDialog` | P1 | ⏳ 未修复 |
| 13 | NodeCard 内部结构 | 544 行：状态点 + `animate-ping` 脉冲、收藏、tag chips、`grid-cols-[3fr_2fr]` 指标布局、`TrafficProgress`、`NodePingListCell` | 260 行，自有结构与指标排列 | 部分一致 | 否 | 逐项对齐 DOM 层次、指标排列、padding/gap/radius | P1 | ⏳ 未修复 |
| 14 | NodeList 结构 | 667 行，含 `NodePingListCell` 等独立单元 | 159 行表格 | 部分一致 | 否 | 对齐列结构与移动端网格行转换 | P1 | ⏳ 未修复 |
| 15 | 图表实现 | `echarts` + `vue-echarts`，`MetricSeriesChartCard` / `LoadChart` / `PingChart` 三个组件 | 手写轻量 SVG `HistoryChart.vue` | 不一致 | 否（CFSM 历史数据可满足） | 评估引入 echarts 并对齐图表卡片结构 | P1 | ⏳ 未修复 |
| 16 | 详情页结构 | `InstanceDetail.vue` 767 行 | `ServerDetailView.vue` 511 行 | 部分一致 | 部分（路由与字段可用性） | 逐项对齐信息层级与实时指标区 | P1 | ⏳ 未修复 |
| 17 | 图标体系 | `@iconify/vue` 图标 | 文本 / emoji 占位 | 不一致 | 否 | 评估引入同源图标集 | P1 | ⏳ 未修复 |
| 18 | UI 基元与弹层 | `reka-ui` 基元、`vue-sonner` 提示、Dialog/Drawer/Tooltip 组件族 | 自写弹层与提示 | 部分一致 | 否 | 对齐弹层结构与动效 | P1 | ⏳ 未修复 |
| 19 | 样式体系 | Tailwind 4 + `tw-animate-css` | 4700+ 行手写 CSS | 部分一致 | 否（属实现方式差异） | 保持等价视觉结果；逐项校准间距、圆角、阴影、玻璃层次 | P2 | ⏳ 未修复 |
| 20 | 公告 | `MarkdownRenderer` 受限 Markdown | 已实现受限 Markdown 渲染 | 一致 | 否 | — | — | 保持 |
| 21 | 分组 / 搜索 / 排序 / Quick Controls | 按真实字段过滤与排序 | 已实现且行为等价 | 一致 | 否 | — | — | 保持 |
| 22 | Ping / Loss 三态 | `number \| null \| false` 三态 | 已在 adapter 边界统一，旧四线路 + Node 1–4 全覆盖 | 一致 | 否 | — | — | 保持 |
| 23 | Footer | Komari 品牌页脚 | `Powered by CF-Server-Monitor vX.Y.Z` + Glassmorphism Theme | 不一致 | **是**（§82 要求指向 CFSM） | 保持 CFSM 页脚 | — | 保留必要差异 |
| 24 | 管理后台入口 | 主题内含登录/管理能力 | 外链 `/admin#admin` | 不一致 | **是**（第三方主题不得实现 CFSM 管理后台） | 保持外链 | — | 保留必要差异 |
| 25 | 访客信息 / 审计日志 | `VisitorInfo`、`AuditLogPanel` | 关闭并隐藏 | 不一致 | **是**（无对应公开主题 API，禁止私有接口与外部猜测） | 保持隐藏 | — | 保留必要差异 |
| 26 | 高级工具 | Komari 自有面板族 | 健康 / 性价比 / 快照 / 分类拓扑（登录态） | 部分一致 | 部分 | 本轮不扩大功能范围（§5.15） | P2 | ⏳ 未修复 |
| 27 | Light / Dark | `.dark` 类切换 | `:root[data-theme='dark']` | 一致（机制不同） | 否（等价实现） | 渲染器暗色样式已按此适配 | — | ✅ 已适配 |
| 28 | 响应式断点 | 375 / 430 / 768 / 1024 / 1440 / 1920 无横向溢出 | 已由 `responsive-contract` 锁定 | 一致 | 否 | Earth 新渲染器沿用 Komari 自身断点 | — | 保持 |
| 29 | 死代码残留 | — | 旧 SVG 地图 CSS 已清理；`.quick-view*` 样式仍残留（无组件引用，不可见） | — | 否 | 清除残余 `.quick-view*` 规则 | P2 | ⏳ 未修复 |

## 本轮已修复（P0 全部 + 部分 P1）

1. **Earth 三套真实渲染器恢复**（矩阵 1–4，P0）
   - `EarthMap.vue` 重写为与 Komari `NodeEarthGlobe.vue` 一致的懒加载分发器。
   - `NodeEarthRealisticGlobe.vue`：`globe.gl` + `three`，保留原贴图、bump/specular、atmosphere、点与环、四光源、自转与阻尼、resize、`visibilitychange` 与元素可见性暂停、`pointOfView` 复位。
   - `NodeEarthCobeGlobe.vue`：真实 `cobe`，保留 RAF 驱动、指针拖拽与 theta 钳制、静态重绘窗口、标签球面投影与可见性淡出。
   - `NodeEarthTiledMap.vue`：独立渲染器，真实地球贴图三层叠加、等距投影、图例四级密度、移动端横向滚动。
   - 三者互不退化，且由 `fidelity-contract` 测试锁定。
2. **Earth 与总览统一栅格**（矩阵 7，P0）：新增 `general-stage`，复刻 Komari 的球体右半 / 卡片左半、移动端负边距叠加、tiled 上下分区。
3. **卡片与列表直达详情**（矩阵 8–10，P0）：移除 `ServerQuickView` 强制中间层并删除组件；主点击直达 `/#/server/:id` 且携带 owning `source`；独立控件保持 `stopPropagation`。
4. **首页往返状态恢复**（矩阵 11，P0）：新增会话级 `dashboard-view` store 承载搜索 / 分组 / 排序 / 快捷筛选；路由新增 `scrollBehavior` 恢复 `savedPosition`。
5. **旗帜改用 CFSM 官方静态资源**（矩阵 6，P1）：`/flags/<code>.svg` 小写，缺失时静默隐藏，不打包进主题。
6. **发布护栏按真实构成重设**：`validate:dist` 体积预算改为 JS 2816 KiB / CSS 128 KiB / 总资源 6144 KiB；Komari RPC 残留扫描由裸 `common:` 收紧为字符串字面量正则，消除 three.js shader chunk 的误报。

## 仍未修复（留待后续轮次）

以下 P1 / P2 已确认存在，但超出本轮可安全收敛的范围，**不得**因此被当作"已对齐"：

- **P1**：总览卡片结构与财务明细弹窗（12）、NodeCard 内部 DOM 与指标排列（13）、NodeList 列结构（14）、图表改用 echarts 组件族（15）、详情页信息层级（16）、图标体系（17）、UI 基元与弹层族（18）。
- **P2**：间距 / 圆角 / 阴影 / 玻璃层次的逐项校准（19）、高级工具面板对齐（26）、`.quick-view*` 死 CSS 清理（29）。

## 数据真实性边界（不因保真而放宽）

无论视觉如何对齐，都不得伪造真实 IP、ASN、ISP、Provider、精确城市、精确经纬度、访客 IP 或 Audit Log。数据缺失时按"能隐藏则隐藏 → 能明确降级则降级 → 不能可靠实现则不显示"处理；但数据缺失只允许影响数据内容，不构成重新设计 UI 结构的理由。
