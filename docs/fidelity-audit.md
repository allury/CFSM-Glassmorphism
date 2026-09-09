# 高保真审计

> **最高原则：原 Komari Glassmorphism 当前默认分支的真实代码、组件、样式、布局、动画、图标、弹层、页面层级与浏览器表现，是正式版 UI/UX 的唯一权威基准。当前 CFSM-Glassmorphism 的既有实现代表"已经实现的 CFSM 功能"，不代表最终视觉真相；与 Komari 不一致时默认向 Komari 对齐。**

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
| 1 | Earth renderer 分发 | `NodeEarthGlobe.vue` 用 `defineAsyncComponent` 分发到三套独立渲染器 | 单一 `EarthMap.vue` 手绘 SVG 世界地图 + 绝对定位标记 + 地区侧栏 | 不一致 | 否 | 重建分发器，恢复三套真实渲染器 | **P0** | PASS |
| 2 | realistic 渲染器 | `globe.gl` + `three` 真实 3D 地球：原主题贴图、bump、specular、atmosphere、点/环、四光源、自转、resize、可见性暂停 | 无（SVG 剪影 + CSS 渐变模拟） | 不一致 | 否 | 按原实现移植，仅替换数据源与纹理引用方式 | **P0** | PASS |
| 3 | cobe 渲染器 | 真实 `cobe` 点阵地球，RAF 驱动、指针拖拽、静态重绘窗口、标签球面投影 | 无（CSS 点阵背景模拟） | 不一致 | 否 | 按原实现移植真实 cobe | **P0** | PASS |
| 4 | tiled 渲染器 | 独立组件：真实地球贴图等距投影、图例密度四级、移动端横向滚动 | 无（同一 SVG 复用，仅改宽高比） | 不一致 | 否 | 按原实现移植为独立渲染器 | **P0** | PASS |
| 5 | Earth 定位数据 | 允许外部 IP Geo 查询得到城市级坐标，回退国家中心 | 只用 region → 国家中心 | 部分一致 | **是**（§4/§8：CFSM 无真实 IP/ASN/城市，`ip_v4`/`ip_v6` 仅为可达性标志） | 保持只用可靠 region，无法定位不打点 | — | NECESSARY-CFSM-DIFFERENCE |
| 6 | 旗帜资源 | `/images/flags/<code>.svg`（主题自带） | 无旗帜 | 不一致 | **是**（`theme-develop.md` 要求用默认皮肤静态文件且不打包） | 改用 CFSM 官方 `/flags/<code>.svg`（小写） | P1 | PASS |
| 7 | Earth 与总览的关系 | Earth 嵌在 `NodeGeneralCards` 同一栅格：桌面球体占右半、卡片占左半同一行；移动端卡片负边距上移叠加；tiled 则卡片在上、地图在下 | Earth 与总览是两个独立兄弟区块，各自带面板外壳 | 不一致 | 否 | 建立 `general-stage` 统一栅格复刻该契约 | **P0** | PASS |
| 8 | 节点卡片主点击路径 | `NodeCard` 点击直接进入 `InstanceDetail` | 卡片点击 → `ServerQuickView` 弹层 → 再点"打开完整详情与历史"才进详情 | 不一致 | 否 | 移除强制中间层，卡片点击直达 `/#/server/:id` | **P0** | PASS |
| 9 | 列表行主点击路径 | `NodeList` 行点击直接进入详情 | 同样先弹 QuickView | 不一致 | 否 | 行点击直达详情 | **P0** | PASS |
| 10 | 卡片内独立控件 | 收藏等独立按钮 `stopPropagation`，不触发导航 | 已有 `@click.stop` | 一致 | 否 | 保持并加回归测试锁定 | — | PASS |
| 11 | 首页往返状态 | 返回首页保持滚动位置、分组、搜索、视图与筛选，无需刷新 | 搜索/分组/排序/快捷筛选是组件局部 ref，离开即丢失；路由无 `scrollBehavior` | 不一致 | 否 | 会话级 `dashboard-view` store + 路由 `savedPosition` 恢复 | **P0** | PASS |
| 12 | 总览卡片结构 | 无独立标题区，卡片本身是 12 栅格中的 `col-span-4` 单元，含图标与 hover 态；可点击卡片打开财务明细弹窗 | 带"节点总览"标题区的面板，卡片为自有网格；无财务明细弹窗 | 部分一致 | 否 | 第 9.9 轮：删除自创标题区，卡片改为 12 栅格 `span 4`，标签左上 / 图标右上 / 数值与单位基线对齐。财务明细弹窗的核心是多币种汇率换算，CFSM 不提供汇率且禁止伪造，按分币种口径保留在高级工具中 | P1 | PASS（弹窗内容为 NECESSARY-CFSM-DIFFERENCE） |
| 13 | NodeCard 内部结构 | 544 行：状态点 + `animate-ping` 脉冲、收藏、tag chips、`grid-cols-[3fr_2fr]` 指标布局、`TrafficProgress`、`NodePingListCell` | 260 行，自有结构与指标排列 | 部分一致 | 否 | 第 9.9 轮：按 Komari 区块顺序重写为 状态点+名称 / 收藏+OS+旗帜 / 运行与价格芯片 / CPU·内存·硬盘·流量四项进度 / 网速·总流量·剩余或负载三列指标盒 / 延迟与丢包双面板 / 自定义标签 / 离线遮罩 | P1 | PASS |
| 14 | NodeList 结构 | 667 行，含 `NodePingListCell` 等独立单元 | 159 行表格 | 部分一致 | 否 | 第 9.9 轮：改为 Komari 的栅格行与十列契约（状态/系统/节点/信息/运行时间/CPU/内存/硬盘/流量/速率），「信息」列受 `nodeListMetadataEnabled` 控制，保留 `v-memo` | P1 | PASS |
| 15 | 图表实现 | `echarts` + `vue-echarts`，`MetricSeriesChartCard` / `LoadChart` / `PingChart` 三个组件 | 手写轻量 SVG `HistoryChart.vue` | 不一致 | 否（CFSM 历史数据可满足） | 第 9.95 轮：History 图表改用上游同款 `echarts` + `vue-echarts`，沿用 Komari 的 tooltip(axis) / legend / grid / time 轴 / `autoresize`，并按 `utils/echarts.ts` 只注册用到的组件。`connectNulls: false` 保证缺口保持缺口，超时与缺失不进入数值 series | P1 | PASS |
| 16 | 详情页结构 | `InstanceDetail.vue` 767 行 | `ServerDetailView.vue` 511 行 | 部分一致 | 部分（路由与字段可用性） | 第 9.95 轮：详情页顶部改为 Komari `InstanceDetail` 的导航条（返回 / 旗帜 + 名称 / 状态徽章 / 自定义标签 / 收藏与上一台·选择·下一台工具条），移除 CFSM 自创 hero 面板；原 hero 中的分组、数据源、运行时间与最后更新并入系统信息区，不丢失真实数据 | P1 | PASS |
| 17 | 图标体系 | `@iconify/vue` 图标 | 文本 / emoji 占位 | 不一致 | 否 | 第 9.9 轮：以同名 Tabler / IconPark 图标替换全部字符占位；图标路径在构建期内联，运行时不访问图标 CDN（自托管与严格 CSP 环境的必要交付方式差异） | P1 | PASS（交付方式为 NECESSARY-CFSM-DIFFERENCE） |
| 18 | UI 基元与弹层 | `reka-ui` 基元、`vue-sonner` 提示、Dialog/Drawer/Tooltip 组件族 | 自写弹层与提示 | 部分一致 | 否 | 第 9.95 轮：Tooltip / Tabs / Badge 改用上游同源的 `reka-ui` 基元（Portal、碰撞翻转、roving focus、`data-state` 与 aria 均由基元提供），瞬时提示改用 `vue-sonner`。Dialog / Drawer / Popover / Select / Switch / Slider 在上游仅服务于 CFSM 不具备的功能（汇率换算财务弹窗、Ping 监控弹窗）与已按规范移除的 QuickView，因此本主题没有对应弹层面，不制造空壳组件 | P1 | PASS（Dialog 等无对应面为 NECESSARY-CFSM-DIFFERENCE） |
| 19 | 样式体系 | Tailwind 4 + `tw-animate-css` | 4700+ 行手写 CSS | 部分一致 | 否（属实现方式差异） | 第 9.9 轮已按 Komari 尺度校准主要 token：卡片 `rounded-xl`(12px)、列表行与指标盒 `rounded-lg`(8px)、指标网格 16/10px、芯片 11px、行高 64px。余下细粒度差异（逐处 shadow / blur 强度）接受为 P2 | P2 | P2-ACCEPTED |
| 20 | 公告 | `MarkdownRenderer` 受限 Markdown | 已实现受限 Markdown 渲染 | 一致 | 否 | — | — | PASS |
| 21 | 分组 / 搜索 / 排序 / Quick Controls | 按真实字段过滤与排序 | 已实现且行为等价 | 一致 | 否 | — | — | PASS |
| 22 | Ping / Loss 三态 | `number \| null \| false` 三态 | 已在 adapter 边界统一，旧四线路 + Node 1–4 全覆盖 | 一致 | 否 | — | — | PASS |
| 23 | Footer | Komari 品牌页脚 | `Powered by CF-Server-Monitor vX.Y.Z` + Glassmorphism Theme | 不一致 | **是**（§82 要求指向 CFSM） | 保持 CFSM 页脚 | — | NECESSARY-CFSM-DIFFERENCE |
| 24 | 管理后台入口 | 主题内含登录/管理能力 | 外链 `/admin#admin` | 不一致 | **是**（第三方主题不得实现 CFSM 管理后台） | 保持外链 | — | NECESSARY-CFSM-DIFFERENCE |
| 25 | 访客信息 / 审计日志 | `VisitorInfo`、`AuditLogPanel` | 关闭并隐藏 | 不一致 | **是**（无对应公开主题 API，禁止私有接口与外部猜测） | 保持隐藏 | — | NECESSARY-CFSM-DIFFERENCE |
| 26 | 高级工具 | Komari 自有面板族 | 健康 / 性价比 / 快照 / 分类拓扑（登录态） | 部分一致 | 部分 | 高级工具是第 8 轮已落地且用户要求保留的 CFSM 能力，本轮只让其沿用统一视觉 token，不重新设计 Komari 首页结构 | P2 | P2-ACCEPTED |
| 27 | Light / Dark | `.dark` 类切换 | `:root[data-theme='dark']` | 一致（机制不同） | 否（等价实现） | 渲染器暗色样式已按此适配 | — | PASS |
| 28 | 响应式断点 | 375 / 430 / 768 / 1024 / 1440 / 1920 无横向溢出 | 已由 `responsive-contract` 锁定 | 一致 | 否 | Earth 新渲染器沿用 Komari 自身断点 | — | PASS |
| 29 | 死代码残留 | — | 旧 SVG 地图 CSS 已清理；`.quick-view*` 样式仍残留（无组件引用，不可见） | — | 否 | 第 9.9 轮：已清除全部 `.quick-view*` 与旧手绘 SVG 地图残留规则，并新增回归断言防止再次进入产物 | P2 | PASS |

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

## 第 9.9 轮已修复

1. **总览卡片结构**（矩阵 12，P1）：删除 CFSM 自创的"节点总览"标题区；卡片改为 12 栅格中的 `span 4` 单元，标签左上、图标右上（淡色、hover 变深）、数值与单位基线对齐在底部，与 `NodeGeneralCards` 的卡片解剖一致。
2. **NodeCard 内部结构**（矩阵 13，P1）：按 Komari 区块顺序重写——状态点 + 名称 / 收藏 + OS 图标 + 地区旗帜 / 运行与价格芯片 / CPU·内存·硬盘·流量四项进度 / 网速·总流量·剩余或负载三列指标盒 / 延迟与丢包双面板 / 自定义标签 / 离线遮罩。
3. **NodeList 结构**（矩阵 14，P1）：由语义化表格改为 Komari 的栅格行与十列契约（状态 / 系统 / 节点 / 信息 / 运行时间 / CPU / 内存 / 硬盘 / 流量 / 速率）；「信息」列受 `nodeListMetadataEnabled` 控制；`v-memo` 等性能优化保留。
4. **图标体系**（矩阵 17，P1）：`★ ☆ ↑ ↓ ◷ ◉` 等字符占位全部替换为与 Komari 同名的 Tabler / IconPark 图标，由 `AppIcon` 渲染。图标路径在构建期内联到 `src/constants/icons.ts`，运行时不访问 `api.iconify.design`。
5. **视觉 token 校准**（矩阵 19，P2）：卡片 `rounded-xl`(12px)、列表行与指标盒 `rounded-lg`(8px)、指标网格 16/10px、芯片 11px、列表行高 64px。
6. **死代码清理**（矩阵 29，P2）：清除全部 `.quick-view*` 与旧手绘 SVG 地图残留规则（含媒体查询内的残留），并新增回归断言。
7. **价格隐私修正**：新增 `GlassServer.showPrice`，卡片与列表的价格同时受主题级 `hidePriceWhenLoggedOut` 与每台节点的 `showPrice` 控制，与详情页口径一致；节点关闭 `showTraffic` 时不展示流量配额。

## 第 9.95 轮已修复（剩余 P1 清零）

1. **History 图表体系**（矩阵 15，P1 → PASS）：`HistoryChart.vue` 改用上游同款 `echarts` + `vue-echarts`。`src/utils/echarts.ts` 对齐 Komari `utils/echarts.ts`，只注册 `LineChart` 与 Grid / Tooltip / Legend / Title / DataZoom / CanvasRenderer，走 tree-shaking 入口。图表沿用上游的 `tooltip(trigger:'axis', confine)`、滚动 legend、`grid`、time 轴与 `autoresize`。
   数据真实性未因换图表而放宽：`connectNulls: false` 使缺口保持缺口；probe 的 `false`（未配置/缺失）与 `null`（超时）都不进入数值 series，绝不写成 0，也不插值；稀疏历史点按真实时间戳落点。九种 `hours`、401 / 409 / 503 / 空 / 网络状态与第 9 轮的 revision + AbortController 并发保护全部保持不变。
2. **详情页信息层级**（矩阵 16，P1 → PASS）：顶部改为 Komari `InstanceDetail` 的导航条——返回按钮、地区旗帜 + 节点名、在线状态徽章、自定义标签徽章、以及收藏 / 上一台 / 节点选择 / 下一台工具条，替换掉 CFSM 自创的 hero 面板。上一台与下一台复用首页已加载的轻量索引（CODEX_SPEC §79），详情页本身仍只订阅当前单节点，不会为导航而订阅全量 WebSocket；跨源导航继续携带 owning `source`。原 hero 承载的分组、数据源、运行时间与最后更新并入系统信息区，真实数据零丢失。
3. **UI 基元与弹层体系**（矩阵 18，P1 → PASS）：Tooltip、Tabs、Badge 改用与上游同源的 `reka-ui` 基元——Portal 渲染、碰撞翻转、roving focus、方向键导航、`data-state` 与 aria 属性均由基元提供，不再自写 absolute 气泡与 `role="tablist"`。瞬时反馈改用 `vue-sonner`（`AppToaster` 在应用根挂载一次，`utils/message.ts` 对齐上游同名模块），设置页的保存成功 / 失败 / 回读警告 / 复制结果都走 toast；需要持续可见的草稿校验问题仍留在页面内。
   Dialog / Drawer / Popover / Select / Switch / Slider 在上游只服务于 CFSM 不具备的功能（依赖汇率换算的财务弹窗、Ping 监控弹窗）与已按规范移除的 `ServerQuickView`，本主题没有对应弹层面，因此不制造空壳组件——这一项属于 NECESSARY-CFSM-DIFFERENCE，而不是缺口。
4. **依赖与体积**：新增 `echarts`、`vue-echarts`、`reka-ui`、`vue-sonner`，版本与上游一致，全部经 Bun 安装并写入 `bun.lock`，运行时不引入任何外部 CDN。`validate:dist` 预算相应上调为 JS 3328 KiB / CSS 128 KiB / 总资源 6656 KiB，并在脚本内注明构成理由；预算仍是硬门槛，超出即失败。
5. **死代码清理**（§12）：移除旧的手写 SVG 折线实现与其 `history-chart__grid / __line / __time` 样式、旧的 `app-tooltip__bubble--*` 定位样式、`detail-hero*` 全部样式与已无引用的 `.settings-save-alert.is-success`。

## 保留的 P2

- **矩阵 19（P2-ACCEPTED）**：主要 token 已按 Komari 尺度校准，余下逐处 shadow / blur 强度的细粒度差异源于 Tailwind 与手写 CSS 的实现方式不同，视觉影响极小，接受保留。
- **矩阵 26（P2-ACCEPTED）**：高级工具是第 8 轮已落地、用户明确要求保留的 CFSM 能力，只让其沿用统一视觉 token，不重新设计 Komari 首页结构。

## 当前终态

**P0 = 0 ｜ P1 = 0 ｜ FAIL = 0 ｜ P2-ACCEPTED = 2。**
29 项审计的终态分布：PASS 23、NECESSARY-CFSM-DIFFERENCE 4、P2-ACCEPTED 2。

## 数据真实性边界（不因保真而放宽）

无论视觉如何对齐，都不得伪造真实 IP、ASN、ISP、Provider、精确城市、精确经纬度、访客 IP 或 Audit Log。数据缺失时按"能隐藏则隐藏 → 能明确降级则降级 → 不能可靠实现则不显示"处理；但数据缺失只允许影响数据内容，不构成重新设计 UI 结构的理由。
