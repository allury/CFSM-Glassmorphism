# 视觉与响应式验证

## 第 11 轮补充回归：隐藏 Earth 与手机节点卡片

针对 `v1.1.0-test.1` 实机截图暴露的两个问题，本次重新在只读 Komari localhost 与
CFSM 生产 `dist` localhost 中读取计算样式和 DOM 几何，不以源码断言代替浏览器结果。

- **Earth 隐藏态**：Komari 实际使用带 16px 内边距的独立网格，移动端 3 列、
  768px 起 6 列，卡片均 `span 1`。CFSM 修复前的单列父网格因子区 `span 12`
  生成了 11 个隐式列；修复后 1440px 下 6 列计算宽度为
  201.33 / 201.34px，五张实际卡片宽度差仅 0.01px 舍入。
- **手机底部三列**：不再显示完整 ISO 日期，改为上游的「剩余 N 天 / 已过期 /
  长期 / —」和短金额行；速率、流量、金额都有独立的最小宽度与省略层。
  375px 下三列各 97px，430px 下各约 115.33px；截图场景中所有五条文本的
  `scrollWidth` 均不大于 `clientWidth`。
- **六档回归**：375 / 430 / 768 / 1024 / 1440 / 1920 全部保持三个底部信息框，
  页面 `scrollWidth <= clientWidth`；隐藏 Earth 的总览卡片宽度差为 0–0.01px。

本次仅修正两个截图已证实的首页偏差；Ping 柱、节点卡片主结构、点击路径、
Earth renderer 和数据/协议层均未改动。

## 第 10 轮：双版本 localhost 最终验证

第 10 轮补上了此前没有完成的真实双版本浏览器对照：只读 Komari v3.3.7（`bf83765`）运行在 localhost，当前 CFSM 主题以生产 `dist` 运行在另一个 localhost；两者使用等价的本地监控场景。测试 fixture 与服务脚本只在被 Git 忽略的 `work/` 中，不进入源码、测试包或发布 ZIP。审计不是只读源码：每档都实际打开两个页面，观察渲染结果，读取计算后 DOM 几何与列数，操作交互，并检查 console error 与页面级横向溢出。

### 首页六档矩阵

| 视口 | Komari / CFSM 共同终态 | 节点列数 | 控制区 | 结果 |
|---:|---|---:|---:|---|
| 375 × 812 | Header 57px；Earth/总览自 y=57 开始；内容左右 16px | 1 | 72px 高 | 无页面溢出、无 console error |
| 430 × 932 | Header 57px；移动端总览高度随宽度展开 | 1 | 72px 高 | 无页面溢出、无 console error |
| 768 × 1024 | Header 57px；总览 232px | 2 | 72px 高 | 无页面溢出、无 console error |
| 1024 × 768 | Header 57px；总览 232px；内容左右 16px | 3 | 72px 高 | 无页面溢出、无 console error |
| 1440 × 900 | 1280px 总宽居中；总览 232px | 4 | 32px 高 | 无页面溢出、无 console error |
| 1920 × 1080 | 1280px 总宽居中；总览 232px | 4 | 32px 高 | 无页面溢出、无 console error |

首页实测后收敛了 Header（57px 高、32px logo、桌面状态区和移动端隐藏策略）、1280px 外层与 16px 内容内边距、筛选/搜索/视图控制条、扁平节点层级，以及 mini/compact/comfortable/large 的 270/300/360/420px 最小列宽。四种卡片模式在相同数据下与 Komari 的单卡高度差为 0～3px；这一余量归入已有的细粒度 P2 shadow/blur/排版实现差异。高级工具能力保留，但默认不占首页层级，只有点击 Header 工具按钮后才出现。

列表模式另行在 375 与 1440 验证：行高均为 64px，十列计算宽度契约一致。窄屏横向滚动只发生在列表容器内，文档本身不溢出；桌面首行宽度与 1280px 内容容器对齐。

### 详情页与 History

| 视口 | 资源卡列数（Komari / CFSM） | 信息卡列数（Komari / CFSM） | 结果 |
|---:|---:|---:|---|
| 375 × 812 | 2 / 2 | 1 / 1 | 无页面溢出、无 console error |
| 430 × 932 | 2 / 2 | 1 / 1 | 无页面溢出、无 console error |
| 768 × 1024 | 3 / 3 | 1 / 1 | 无页面溢出、无 console error |
| 1024 × 768 | 3 / 3 | 2 / 2 | 无页面溢出、无 console error |
| 1440 × 900 | 4 / 4 | 2 / 2 | 无页面溢出、无 console error |
| 1920 × 1080 | 4 / 4 | 2 / 2 | 无页面溢出、无 console error |

详情页复用与首页一致的 Header，顶部仍保持返回 / 旗帜 + 名称 / 状态和标签 / 收藏与上下节点工具条；信息区顺序为硬件、系统、存储、网络。CFSM 真实提供且 Komari 对照场景没有同构位置的 probe、GPU、磁盘 IO 与 History 继续显示在后续区块，这属于真实数据内容扩展，不改变上述主层级。History 成功态实测 4 个 ECharts canvas；旧 CT/CU/CM/BD 和 Node 1～4 同时出现，`number` 显示数值，`null` 显示超时，`false` 隐藏或标记未配置，图表保持缺口。

### 状态与交互矩阵

| 场景 | 实际浏览器结果 |
|---|---|
| light / dark / beijing | 三种模式均可见且无 console error；北京时间模式按测试时刻解析到正确明暗主题 |
| realistic / cobe / tiled | 分别加载 `globe.gl`、cobe canvas 与 tiled SVG/贴图；移动 tiled 无页面级溢出 |
| advanced tools | 默认隐藏；点击 Header 工具按钮后显示 4 个标签页，按钮 `aria-pressed=true` |
| 0 / 10 / 64 节点 | 空状态真实；常规和 dense 集合列数稳定，无页面溢出或 console error |
| partial source / 503 / all offline | 保留可用来源或最后真实快照，并显示明确状态，不伪造成功数据 |
| 详情 401 / 403 / 503 | 分别显示登录授权、访问拒绝/Turnstile、服务不可用语义，不生成占位节点 |
| History 空 / 401 / 409 / 503 | 空状态明确不造趋势；鉴权、数据库升级与服务错误分类正确 |
| 首页 → 详情 → 返回 | 卡片和列表均直达详情；返回恢复会话筛选和浏览器滚动位置 |

最终浏览器审计没有发现需要改写第 4.5～9 轮数据/协议底座的问题。结构回归已同步到 `tests/fidelity-contract.test.ts` 和 `tests/responsive-contract.test.ts`；完整差异终态见 `docs/fidelity-audit.md`。

## 第 9.95 轮：详情页、History 与 UI 基元

第 9.95 轮当时以源码对照和契约测试清零 `docs/fidelity-audit.md` 中剩余的三个 P1，并未完成 Komari localhost 与 CFSM localhost 的并排浏览器复验。第 10 轮已补做真实浏览器对照，并据此继续修正 Header、详情信息卡和响应式断点；本节仅记录第 9.95 轮当时的验证范围。

- **History 图表**：改用上游同款 `echarts` + `vue-echarts`。契约测试断言使用 `VChart` + `autoresize`、只注册用到的 ECharts 组件、且旧手写 SVG 折线实现（`pathSegments`、固定 `viewBox`）不再存在。数据真实性由 `connectNulls: false` 与「只有真实数值进入 series」两条断言锁定：超时与缺失形成断点，不补 0、不插值；九种 `hours` 与 401 / 409 / 503 / 空 / 网络状态处理保持不变。
- **详情页层级**：顶部为 Komari 的导航条——返回、地区旗帜 + 名称、在线徽章、标签徽章、收藏与上一台 / 选择 / 下一台。契约测试断言 CFSM 自创的 `detail-hero` 与 "SERVER DETAIL" 文案已消失，且节点导航复用 `serverStore.servers` 并携带 owning `source`。
- **UI 基元与弹层**：Tooltip 走 `reka-ui` 的 `TooltipProvider / Portal`（真实 portal、碰撞翻转、ESC 与焦点行为），Tabs 走 `TabsRoot / List / Trigger`（roving focus 与方向键导航），Badge 走 `Primitive`；瞬时提示走 `vue-sonner`，`AppToaster` 在 `App.vue` 挂载一次。契约测试同时断言两处标签区不再手写 `role="tablist"`，设置页瞬时反馈不再常驻页面。
- **体积门槛**：引入 ECharts 与 UI 基元后 `validate:dist` 预算上调为 JS 3328 KiB / CSS 128 KiB / 总资源 6656 KiB，仍为硬门槛；ECharts 随详情页分块懒加载，未进入首页初始包。
- **死代码**：旧 SVG 折线样式、旧 tooltip 定位样式、`detail-hero*` 与 `.settings-save-alert.is-success` 均已删除。

## 第 9.9 轮：表现层深度收敛

第 9.9 轮继续以 Komari v3.3.7（`bf83765`）源码为权威基准，逐项终态见 `docs/fidelity-audit.md`。

- **总览卡片**：无独立标题区，12 栅格 `span 4`；`tests/fidelity-contract.test.ts` 锁定卡片解剖与栅格契约。
- **节点卡片**：状态点 + 名称 / 收藏 + OS + 旗帜 / 芯片 / 四项进度 / 三列指标盒 / 延迟丢包面板 / 标签 / 离线遮罩，区块顺序由契约测试锁定；mini / compact / comfortable / large 与 dense 集合渲染继续生效。
- **节点列表**：十列栅格契约（状态 / 系统 / 节点 / 信息 / 运行时间 / CPU / 内存 / 硬盘 / 流量 / 速率），行高 64px；窄屏保留列结构并允许容器横向滚动，不再拆成堆叠卡片。
- **图标**：全部字符占位替换为同名 Tabler / IconPark 图标；`AppIcon` 不含任何网络请求，契约测试断言不出现 `api.iconify.design`。
- **响应式**：第 9.9 轮仅由 `tests/responsive-contract.test.ts` 对 375 / 430 / 768 / 1024 / 1440 / 1920 六档做源码契约锁定，当时没有进行双版本浏览器并排实测；真实复验与随后修正的结论以本文件第 10 轮章节为准。契约同时确保 `.quick-view*` 与旧 SVG 地图样式不再进入产物。
- **视觉 token**：卡片 12px、列表行与指标盒 8px 圆角，指标网格 16/10px，芯片 11px——按 Komari 的 Tailwind 尺度校准。

第 9.95 轮已把历史图表、详情页信息层级与 UI 基元全部对齐上游，详见下节。

## 第 9.5 轮：1:1 高保真收敛

第 9.5 轮以原 Komari Glassmorphism（`bf83765`，v3.3.7）源码为唯一权威基准做表现层收敛，逐项差异见 `docs/fidelity-audit.md`。

已恢复并锁定的 Komari 真实行为：

- **Earth 三套渲染器互不退化**：realistic 走 `globe.gl` + `three`（原贴图、bump/specular、atmosphere、点与环、四光源、自转与阻尼、resize、可见性暂停），cobe 走真实 `cobe`（RAF、指针拖拽、theta 钳制、静态重绘窗口、标签球面投影），tiled 为独立渲染器（真实贴图三层叠加、等距投影、图例四级密度、移动端横向滚动）。`tests/fidelity-contract.test.ts` 断言三者不得含手绘 SVG 剪影、不得互相复用。
- **Earth 与总览同栅格**：桌面球体右半 / 卡片左半同一行，移动端卡片负边距上移叠加，tiled 改为卡片在上、地图在下；由 `general-stage` 样式与契约测试锁定。
- **主点击路径**：节点卡片与列表行点击直达 `/#/server/:id`（携带 owning `source`），`ServerQuickView` 强制中间层已删除；收藏等独立控件仍 `stopPropagation`，不触发导航。
- **首页往返**：`首页 → 详情 → 返回首页`保持搜索、分组、排序与快捷筛选，并由路由 `savedPosition` 恢复滚动位置，无需刷新。
- **旗帜**：使用 CFSM 默认皮肤的 `/flags/<code>.svg`（小写），缺失时静默隐藏，不打包进主题。

响应式与产物：六档断点结构仍由 `tests/responsive-contract.test.ts` 锁定；三个渲染器沿用 Komari 自身的断点与移动端行为（tiled 在 640px 以下保留 `min-width: 42rem` 的横向滚动容器，滚动被限制在地图容器内，不产生页面级横向溢出）。`bun run validate:dist` 实测 2281.6 KiB JS、78.8 KiB CSS、5275.8 KiB 总资源，dist 根仅 `index.html` 与 `assets/`。

未完成项（不得视为已对齐）：总览卡片结构与财务明细弹窗、NodeCard/NodeList 内部 DOM、echarts 图表族、详情页信息层级、图标体系与 UI 基元、间距/圆角/阴影逐项校准、`.quick-view*` 死 CSS 清理 —— 均记录在 `docs/fidelity-audit.md`。

## 第 9 轮复验

第 9 轮为性能、稳定性与异常收敛，未改动首页布局、Header/Footer、节点卡片结构、Card/List 点击路径、详情视觉结构、Earth/Map 渲染方式、弹窗/抽屉与主要动画；`shallowRef`、`createGlassServerMapper()` WeakMap 缓存、`v-memo` 与预计算动画延迟均只降低重算开销，不改变可见 DOM 结构或渲染输出，因此不存在需要更新的截图/像素基线。

- 375、430、768、1024、1440、1920 六档响应式结构由 `tests/responsive-contract.test.ts` 以源码断言锁定，本轮全部通过；无页面级横向溢出策略保持不变。
- 首页大规模节点行为由 `tests/performance-contract.test.ts` 锁定：视图与逐节点组件不得出现 `fetch`/`setInterval`/`setTimeout`，`HomeView` 不引用 `fetchHistory`，列表保留 `v-memo` 与 `.server-grid--dense` 的 `content-visibility: auto`，路由保持 3 处懒加载 `import()`，运行时依赖仅 `pinia`/`vue`/`vue-router`。
- 50+/64 节点首页加载经 `tests/api.test.ts`、`tests/dashboard.test.ts` 与 `tests/glassmorphism-adapter.test.ts` 核验：单次 `/api/servers`、无逐节点详情/历史请求，实时更新仅重算发生变化的节点视图模型。
- WebSocket 断连、503、重连风暴、可见性 hide/show 与历史陈旧响应/并发切换由 `tests/websocket.test.ts`、`tests/http.test.ts`、`tests/dashboard-realtime.test.ts`、`tests/detail-realtime.test.ts` 及详情 store 的控件禁用 + `revision`/AbortController 覆盖，行为稳定，无运行时异常。
- 本轮未发现由第 9 轮改动引入的视觉回归；与原 Komari Glassmorphism 的高保真差异（若有）仅记录、留待第 9.5 轮。

## 第 8 轮复验

第 8 轮继续以生产构建和只监听 `127.0.0.1` 的 CFSM 形状测试服务验证。本地场景覆盖 10 台节点、5 个明确 region、长名称、大量 tags、离线/高负载、两种付费币种和免费节点；测试数据只位于 Git 忽略的 `work/`，不进入产品源码或构建产物。

- realistic、cobe、tiled 三种渲染均逐一切换；国家/地区聚合标记、在线计数和“非精确位置”说明保持可见。
- 健康摘要展示当前指标与 `/api/servers` Ping/Loss 窗口覆盖；性价比将 CNY 与 USD 分组，免费节点明确排除；快照页只提供当前 JSON/CSV；拓扑只展示 region → group → tags 分类；Audit Log 明确隐藏。
- 375、430、768、1024、1440、1920 六个宽度均读取实际页面几何；`documentElement.scrollWidth` 与 `body.scrollWidth` 均不大于 `documentElement.clientWidth`，没有页面级横向溢出。
- 375px 下 Earth 地区列表、两列总览、高级工具标签和健康卡片按移动端规则收缩；768px 及以上恢复横向工具标签和紧凑数据表。设置页的 renderer、隐藏/停止 Earth、高级工具与导出口令控件均可即时预览。

## 第 7 轮复验

第 7 轮对生产构建启动本地 CFSM 形状测试服务，只访问 `127.0.0.1`。六档视口均读取实际 DOM 几何并检查 `documentElement.scrollWidth <= innerWidth`；结果全部无页面级横向溢出。浏览器控制台无 warning/error。

| 视口 | 总览列数 | 节点布局 | 快捷控制 | 结果 |
|---:|---:|---|---|---|
| 375 × 812 | 2 | card 单列 | 横向可滚动 | 长名称截断、大量 tags 有界，无页面溢出 |
| 430 × 932 | 2 | mini 两列 | 横向可滚动 | 底部抽屉左右贴边、底部贴合视口 |
| 768 × 900 | 3 | list 两列移动网格行 | 完整显示 | 表格转换正常，无页面溢出 |
| 1024 × 900 | 3 | card 两列 | 完整显示 | 无页面溢出 |
| 1440 × 1000 | 6 | card 三列 | 完整显示 | 内容受最大宽度约束 |
| 1920 × 1080 | 6 | card 三列 | 完整显示 | 内容受最大宽度约束 |

设置页另在 375px 与 1024px 复验：375px 的主布局、字段组和持久化面板均为单列；1024px 恢复双列 hero 与“设置 + 保存”布局。10 个 select、6 个 textarea 均在窄屏保持容器内宽度。`tests/responsive-contract.test.ts` 同步锁定 Header/Card/List/Detail/Chart/Settings/Modal 相关断点和 overflow 策略。

## 第 3 轮基线

## 方法与边界

验证对象为生产构建产物。测试服务器只存在于被 Git 忽略的 `work/` 目录，按 CFSM `/api/config` 与 `/api/servers` 的真实响应形状生成本地场景；生产源码、提交内容与构建包均不包含 mock 数据。所有数值、可达性、元数据和在线状态均经过正式 transport、adapter、store 与 UI 链路。

## 响应式矩阵

| 视口 | 节点数 | 视图 | 结果 |
|---:|---:|---|---|
| 375 × 812 | 30 | card | 单列卡片，无横向溢出；页头、总览、筛选和指标保持可用 |
| 430 × 932 | 30 | mini | 两列迷你卡片，无横向溢出 |
| 768 × 900 | 10 | list | 桌面表格转换为移动网格行，无横向溢出 |
| 1024 × 900 | 10 | compact | 三列紧凑卡片，无横向溢出 |
| 1440 × 1000 | 30 | card | 四列卡片、三组分区，无横向溢出 |
| 1920 × 1080 | 30 | card | 内容最大宽度 1280px、四列卡片，无横向溢出 |

另行检查了 0、1、10、30 台节点：0 台显示真实空状态和不可用汇总；1 台只生成一个节点与一个分组；10/30 台数量、分组及布局均与响应一致。长服务器名使用截断和 tooltip，14 个标签不会撑破卡片，30 台场景启用密集集合渲染优化。

## 交互检查

- card、compact、mini、list 四种布局可切换。
- 多词搜索只返回同时匹配所有词的真实节点。
- 收藏使用 source+id 稳定键；收藏数量、收藏筛选和刷新后持久化正常。
- 离线置底保留当前排序语义，刷新后持久化正常。
- system、light、dark 循环切换正常，刷新后保留显式主题选择。
- 点击节点打开当前 REST 快照；桌面模态框、移动端底部抽屉、背景关闭与 Escape 关闭正常。
- 明暗背景、玻璃层次、在线脉冲、离线警示、资源告警色与 reduced-motion 规则均保留非颜色信息。
- 浏览器控制台没有 warning 或 error。

375px 初验发现页头最右侧 tooltip 的隐藏气泡扩大了文档宽度；气泡改为右对齐后复验通过。
