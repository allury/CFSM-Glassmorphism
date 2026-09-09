# 架构

## 目标

CFSM-Glassmorphism 是 CF-Server-Monitor 的静态第三方主题。运行包只包含 `index.html` 与 `assets/`；它保留 Komari Glassmorphism 的视觉与交互语言，但所有数据、鉴权、实时协议和配置持久化都服从 CFSM 官方主题协议。

优先级固定为：数据真实性 > API 兼容性 > 功能完整度 > 视觉相似度 > 开发便利性。

## 分层数据流

~~~text
CFSM public API
      |
      v
Transport (URL, JWT, Turnstile, timeout, errors)
      |
      v
Service (endpoint intent and source ownership)
      |
      v
Adapter (unknown wire data -> strict CFSM and Glass UI models)
      |
      v
Store (state, lifecycle, selection, derived values)
      |
      v
UI (render and user intent only)
~~~

响应严格向下经过 adapter；写操作按相反方向由 UI 意图进入 store/service。组件不得跨层直接调用 `fetch`、读取 wire snake_case 字段或解释错误码。

## 各层职责

### Transport

位置：`src/services/cfsm/http.ts`。

- 只处理 URL、method、JSON、credentials、15 秒默认超时和可取消 signal。
- 从 CFSM 兼容存储键附加 JWT 与 Turnstile header。
- 把非 2xx 统一转换为带 status、path、code、details 的 `CfsmRequestError`。
- 401 清 JWT，403 清 Turnstile；不自动导航，不吞掉 409/503。
- 不了解服务器、历史或主题设置的领域含义。

### Service

位置：`src/services/cfsm/api.ts`、`src/services/cfsm/websocket.ts`、`src/services/cfsm/dashboard-realtime.ts` 与 `src/services/cfsm/detail-realtime.ts`。

- 用语义方法封装 `/api/config`、`/api/servers`、`/api/server`、`/api/history/all` 和 `/api/theme_options`。
- 在发出请求前确定 base、id 和受支持的 history hours。
- 多源请求保留数组边界；详情和历史明确接收 owning base。
- `websocket.ts` 只负责单一 base 的 URL、订阅帧、消息适配、连接时限、keepalive 和有界退避。
- `dashboard-realtime.ts` 负责首页多 base 协调、visibility 生命周期、REST 补偿与用户超时决策；不会跨来源拼接订阅 ID。
- `detail-realtime.ts` 只建立 owning base 的 `subscribe=<serverId>` 连接；页面恢复可见时先刷新单节点 REST，失败时以单个低频 REST 循环补偿。
- `errors.ts` 把 400/401/403/404/409/5xx（含 503）、网络错误与未知错误转换为稳定 issue（含 `forbidden` 与 `server-error`）；UI 只选择对应文案，不解析响应体。
- `identifiers.ts` 提供统一的 `normalizeServerId` 白名单校验，`api.ts` 详情/历史请求与 `websocket.ts` 订阅 ID 清洗共用；非法 id 在发请求前即被拒绝（400 `invalidServerId`）。

### Adapter

位置：`src/services/cfsm/adapters.ts`。

- 唯一允许理解 CFSM wire 字段名的层。
- 输入总是 `unknown`；先验证对象/数组和关键 id，再做有限的字符串、数值、布尔归一化。
- 把 snake_case 映射到 `src/types/cfsm.ts` 的稳定领域模型。
- Ping/Loss 在边界统一映射为 `ProbeValue = number | null | false`。`CfsmServer` 与 `HistoryPoint` 都持有旧四线路加 Node 1–4 的八目标完整映射：缺字段为 `false`，显式 `null` 和有效 `0` 均原样保留。
- `/api/config` 的八个 probe 显示名进入 `SiteConfig.probeLabels`；`src/constants/probes.ts` 是旧版本与 config 不可用场景的唯一默认名来源，避免 adapter 和 UI 各自定义 fallback。
- 兼容 `gpu_info` 的数组/JSON 字符串和历史磁盘 IO 两种形状。
- Server 与 History 都在 adapter 边界解析 `gpu_info`；History 图表模型只读取归一化后的 `HistoryPoint.gpus`。
- 不补历史点，不伪造 IP/ASN/城市/厂商，不把错误格式变成看似真实的数据。
- `src/services/cfsm/glassmorphism-adapter.ts` 再把稳定 CFSM 模型映射为首页展示模型；可达性仍是状态，不成为地址字符串。

### Store

位置：`src/stores/`。

- `app.ts` 管理 apiBases、站点 config、加载状态与官方管理端地址。
- `servers.ts` 管理按来源分开的集合，以 `base::id` 作为稳定键，避免不同站点 UUID 冲突。
- `servers.ts` 也按来源合并实时 partial sample，未知节点不会由 WebSocket 凭空创建；REST 暂时失败时保留该来源上一份真实快照。
- `realtime.ts` 管理首页实时协调器的生命周期、每个来源的连接状态、五分钟离线过期、降级提示和超时后的继续/暂停动作。
- `dashboard-preferences.ts` 只保存以 source+id 标识的收藏。旧快照中的主题、视图与离线排序由 theme settings 层一次性迁移，避免同一外观状态有两个写入者。
- `theme-settings.ts` 管理 48 项 schema 的 defaults、原始 backend 快照、版本化 local override、未保存 draft 与实际 runtime。它集中完成规范化、即时预览、本地保存/清除、完整后端保存和 `/api/config` 回读；组件不读取 localStorage 或 wire `theme_options`。
- `server-detail.ts` 管理单节点 REST、所属 source config、History、single-server WebSocket、错误/空状态和页面生命周期。首页传入 owning base；刷新直达链接时可在已配置 bases 上用 `/api/server` 解析归属，但绝不拉取全量列表。
- store 对异步过程提供 idle/loading/ready/partial/error，而不是让 UI 猜测；多来源之一失败时保留其他来源的真实结果与失败原因。

### UI

位置：`src/App.vue`、`src/views/`、`src/components/dashboard/` 与 `src/components/detail/`。

- 只渲染领域模型和显式状态。
- 缺数据时隐藏依赖组件或显示“不可用”，不展示 0 值占位来冒充采样。
- 用户动作调用 store/service，鉴权失败保留当前页面和编辑内容。
- 原 Glassmorphism 的组件、布局、动效和响应式策略优先复用；Komari transport 代码不能随组件一起移植。
- 首页筛选、排序、分组和汇总位于 `src/domain/dashboard.ts`，不会在组件内重新解释 wire payload。
- 第 7 轮的配置驱动展示注册表位于 `src/domain/theme-presentation.ts`：它从统一 runtime 和 normalized `GlassServer` / `CfsmServer` 生成总览卡片、快捷控制、provider alias、阈值、详情卡片及 History 图表族。预设只决定 key 和顺序，不拥有网络请求或 wire 解析。
- 第 8 轮的 Earth 与高级工具领域模型位于 `src/domain/advanced-tools.ts`：`EarthMap` 和 `AdvancedTools` 只接收已经归一化的 `GlassServer`，不新增请求、不读取 wire payload。国家/地区中心、健康规则、月价折算、快照序列化和分类拓扑均为可单测的纯函数。
- 节点卡片与列表行的主点击直达 `/#/server/:id`（与 Komari 一致），中间不再插入任何快速查看或二次确认层。
- `ServerDetailView` 只消费 `CfsmServer`、`HistoryPoint` 与纯 domain 图表模型。ECharts 折线图按真实时间戳绘制，`connectNulls: false` 使缺失/超时形成断点，不补点；probe 图例额外保留有效/超时/缺失计数。

## Theme Options

最终主题设置由三个明确层组成：

~~~text
schema defaults
    <- backend /api/config.theme_options
        <- local browser overrides
~~~

- **Defaults** 是版本控制中的完整 schema 默认值。
- **Backend** 是跨设备共享的完整配置快照。
- **Local** 只覆盖当前浏览器，必须可单独清除，不能显示成“已经保存到后端”。
- 保存后端时先把 defaults、当前 backend 和允许持久化的用户编辑合并为完整对象，再调用 `POST /api/theme_options`。
- 本地专属状态（例如一次性 UI 展开状态、JWT、Turnstile 凭证）绝不混入后端快照。
- 保存成功后以后端响应替换 backend 层；401/403/400 时保留草稿并显示准确动作。
- backend 快照中的未知 key 会保留以支持前向兼容；已知 key 按类型、枚举和范围校验。JWT、Turnstile、收藏及一次性 UI 状态在序列化边界排除。
- 第 6 轮已落地完整 48 项 schema 和 `/#/settings`：即时预览、本地覆盖、回落后端、完整 JSON、JWT + Turnstile 后端保存与成功后 config 回读。第 7、8 轮没有改造该架构，只把配置驱动展示、Earth/Map 与高级工具接到同一 runtime。

## WebSocket

首页实时层位于 `src/services/cfsm/websocket.ts`、`dashboard-realtime.ts` 与 `src/stores/realtime.ts`，当前实现如下：

- 一条首页连接只对应一个 apiBase；它的订阅 IDs 只来自同一 base。
- 首页连接 URL 固定为 `/api/ws?subscribe=all`，open 后发送包含本 base 真实节点 IDs 的 all-scope subscription。
- 收到 `batchUpdate` 后提取 sample 的 `data`、`payload` 或 `metrics`，按字段合并进已有实体。
- 高频增量缺失字段是正常情况，不得覆盖已有值；显式存在的 probe `false`、`null`、`0` 与普通数字则必须更新对应单一字段。
- 列表 ping/loss 窗口由 REST 补齐，详情实时字段与历史序列分别管理。
- document 隐藏时主动关闭，可见时先 REST revalidate 再连接；unmount 时释放连接与计时器。
- 配置的连接时限到达后由用户选择继续或暂停；网络恢复采用单计时器指数退避，不会并发重连。
- 连接不可用时以单个低频 REST 循环补偿；任何失败都继续展示最后一份真实快照及来源错误。
- 五分钟在线阈值在 adapter/domain 层保持一致。
- 详情连接使用 `/api/ws?subscribe=<id>` 且不发送 all-scope frame；只合并同 ID sample。隐藏时关闭、可见时先请求 `/api/server` 再建立新连接，连接时限仍要求用户明确选择。

## Multi API Base

apiBase 解析位于 `src/services/cfsm/config.ts`。

~~~text
meta content
  +-- base A -> config/list/ws A -> server { source: A }
  +-- base B -> config/list/ws B -> server { source: B }

server click -> its source -> detail/history/ws
~~~

每个 base 是独立的鉴权与错误域。一个来源失败不能使另一个来源的数据改换归属。汇总 UI 可以合并显示，但数据结构始终保留 collection 与 `server.source`。跨源 Turnstile 若 site key 不一致，后续 UI 必须明确阻断共享验证流程，而不是静默选择其中一个。

## 路由与管理边界

正式路由采用 hash 模式，与 CFSM 保持一致：

- 首页 `/#/`
- 详情 `/#/server/:id`
- 主题设置 `/#/settings`
- 管理 `/admin#admin`，由 CFSM 官方前端负责

`vue-router` 使用 Hash History，详情刷新可恢复。主题不实现管理员私有接口、不复制登录管理逻辑、不调用 `save_settings`。

## 质量与发布

- Bun 锁定依赖；TypeScript strict、ESLint、Vitest 和 Vite 是同一质量门。
- 单元测试覆盖 apiBase、wire adapter、JWT/Turnstile transport、错误语义和完整 theme_options body。
- `bun run build` 先 typecheck 再构建。
- `bun run validate:dist` 验证根目录只有 `index.html` 与 `assets/`、assets 非空，并扫描禁止的 Komari runtime 标记。
- GitHub Actions 对 push main、pull request 和手动触发执行 frozen install、lint、typecheck、test、build、dist validation，并上传根结构正确的 ZIP。
- `dist/` 是生成物，不进入版本控制。

## 第 7 轮完成边界

第 7 轮在既有主题 store 和 normalized data model 上完成配置驱动展示：总览和快捷控制不再是固定结构，列表 provider 只匹配用户声明的真实元数据文本，流量/到期/负载阈值有统一谓词，详情概览和 History 由预设或自定义 key 选择。响应式继续采用 CSS 网格与移动端抽屉，375/430/768/1024/1440/1920 六档均验证无页面横向溢出；长名称使用截断/换行策略，大量 tags 受有界容器保护。Earth/Map、磁盘预测与高级工具不属于本轮，没有显示无效开关。

## 第 8 轮完成边界

第 8 轮只在当前首页数据流上增加 Earth/Map 和高级工具。`EarthMap.vue` 提供 realistic、cobe、tiled 三种纯前端视觉，并以真实 `region` 聚合、选择节点；`AdvancedTools.vue` 提供健康摘要、分币种性价比、当前快照 JSON/CSV 和分类拓扑。健康历史只使用列表端已加载的真实 Ping/Loss 窗口，不调用逐节点 History；快照不包含 JWT、Turnstile 或管理数据；客户端导出二次口令是确认步骤而非安全边界；Audit Log 没有公开端点，保持隐藏。设置层仍为原 48 项三层架构，没有引入新的持久化协议。

## 第 9 轮完成边界

第 9 轮只做性能、稳定性、异常与测试收敛，不改动首页布局、Header/Footer、节点卡片结构、Card/List 点击路径、详情视觉结构、Earth/Map 渲染方式、弹窗/抽屉与主要交互动画；渲染输出保持不变。

- **稳定性 / 异常**：`errors.ts` 新增 `forbidden`(403) 与 `server-error`(5xx) 两类稳定 issue，详情视图给出专属可操作文案并保留真实快照；`identifiers.ts` 集中 server ID 白名单校验，详情、历史与 WebSocket 订阅共用，非法 id 在请求前即被拒绝（400 `invalidServerId`）。
- **WebSocket 重连稳定性**：`websocket.ts` 的重连退避仅在连接稳定保持 10 秒（`STABLE_CONNECTION_MS`）后才把 `reconnectAttempt` 归零，避免 open→立即断开的抖动风暴反复重置退避；退避区间与"单条连接仅一个待执行重试"约束不变。
- **渲染性能**：`stores/servers.ts` 与 `stores/server-detail.ts` 对大体积归一化集合改用 `shallowRef`；`glassmorphism-adapter.ts` 新增 `createGlassServerMapper()`，以 `CfsmServer` 引用 + `config` 身份的 WeakMap 缓存复用未变化的 `GlassServer`，50+ 节点实时更新时仅重算发生变化的节点；`ServerList.vue` 行级 `v-memo`；`HomeView.vue` 用预计算的节点动画延迟数组替代每次渲染新建样式对象。这些优化只减少重算与响应式开销，不改变可见结构或数据语义。
- **发布体积门槛**：`scripts/validate-dist.mjs` 增加 JS 512 KiB、CSS 128 KiB、总资源 768 KiB 的硬性预算，超出即让 dist 校验失败。
- **历史陈旧响应 / 并发切换**：详情 hours 切换控件在 `historyState === 'loading'` 时禁用，配合 store 内 `revision` 版本号与 AbortController，保证同一节点上不会并发触发历史请求、详情切换会取消在途请求，乱序陈旧响应不会写回。本轮经核验此前已妥善处理，未改动相关代码。

与原 Komari Glassmorphism 的高保真视觉差异如在本轮发现，仅记录、留待第 9.5 轮，不在第 9 轮修改。

## 第 9.95 轮完成边界

第 9.95 轮清零剩余三个 P1，仍然只动表现层，数据与协议底座（REST、WebSocket partial merge、10 秒稳定后重置退避、History revision 与 AbortController、probe 三态、旧四线路 + Node 1–4、`theme_options`、JWT / Turnstile、多 apiBase 归属、server ID 校验、403 / 5xx 分类、50+ 节点性能优化）保持不变，UI 继续只消费 normalized model。

- **History 图表**：`src/utils/echarts.ts` 对齐 Komari 同名模块，只注册 `LineChart` 与 Grid / Tooltip / Legend / Title / DataZoom / CanvasRenderer；`HistoryChart.vue` 改用 `vue-echarts` 的 `VChart`（`autoresize`），沿用上游的 axis tooltip、滚动 legend、grid 与 time 轴。`connectNulls: false` 保证缺口保持缺口，probe 的 `false` / `null` 不进入数值 series，不补点、不插值。
- **详情页**：顶部改为 Komari `InstanceDetail` 的导航条（返回 / 旗帜 + 名称 / 状态徽章 / 标签 / 收藏与上一台·选择·下一台）。节点导航复用首页已加载的轻量索引，详情页仍只订阅单节点并携带 owning `source`；原 hero 的分组、数据源、运行时间与最后更新并入系统信息区。
- **UI 基元**：`src/components/ui/` 下的 `AppTooltip`、`AppTabs`、`AppBadge` 建立在 `reka-ui` 上（Portal、碰撞翻转、roving focus、`data-state`/aria 由基元提供），`AppToaster` + `src/utils/message.ts` 建立在 `vue-sonner` 上并在 `App.vue` 挂载一次。上游的 Dialog / Drawer / Popover / Select / Switch / Slider 只服务于 CFSM 不具备的功能与已移除的 QuickView，本主题没有对应弹层面，因此不创建空壳组件。
- **发布护栏**：`validate:dist` 预算上调为 JS 3328 KiB / CSS 128 KiB / 总资源 6656 KiB，脚本内注明构成理由；预算仍是硬门槛。

## 第 9.9 轮完成边界

第 9.9 轮继续把表现层向 Komari 收敛，不新增功能，也不触碰数据 / 协议底座（REST、WebSocket partial merge、10 秒稳定后重置退避、History revision 与 AbortController、probe 三态、`theme_options`、JWT / Turnstile、多 apiBase 归属、server ID 校验、403 / 5xx 分类、50+ 节点性能优化）。

- **总览卡片**：去掉 CFSM 自创标题区，`OverviewCards` 的根即 `general-stage__cards` 所在的 12 栅格；卡片为 `span 4` 单元，标签左上 / 图标右上 / 数值与单位基线对齐。
- **节点卡片与列表**：`ServerCard` 按 Komari 区块顺序重建；`ServerList` 由语义化表格改为栅格行与十列契约，「信息」列受 `nodeListMetadataEnabled` 控制。两者继续只消费 `GlassServer`，不解析 wire payload。
- **图标体系**：新增 `src/constants/icons.ts`（构建期内联的 Tabler / IconPark 路径）与 `src/components/ui/AppIcon.vue`。`PresentationCard.icon` 由字符占位改为 `IconName`。运行时不访问外部图标 CDN——这是自托管与严格 CSP 环境下必要的交付方式差异。
- **静态资源约定**：`src/utils/os-icon.ts` 对照 CFSM 官方 `osIcon.js` 的关键字映射，OS 图标使用默认皮肤的 `/os-icons/<filename>`；旗帜沿用 `/flags/<code>.svg`。两者都不打包进主题。
- **价格与流量可见性**：`GlassServer` 新增 `showPrice`；卡片与列表同时遵守主题级 `hidePriceWhenLoggedOut` 与每台节点的 `showPrice` / `showTraffic`，与详情页口径一致。

仍未对齐的 P1（历史图表 echarts 组件族、详情页信息层级、UI 基元与弹层族）在 `docs/fidelity-audit.md` 中标记为 FAIL，不得被当作已对齐。

## 第 9.5 轮完成边界

第 9.5 轮把表现层向原 Komari Glassmorphism 收敛，不推翻既有 CFSM 数据层、适配层、实时层、History、Theme Settings、多 API Base 与构建体系；UI 继续只消费 normalized model，不重新解析 wire payload。Komari 是正式版 UI/UX 唯一权威基准，逐项差异见 `docs/fidelity-audit.md`。

- **Earth 恢复三套真实渲染器**：`EarthMap.vue` 变为与 Komari `NodeEarthGlobe.vue` 等价的懒加载分发器，分发到 `NodeEarthRealisticGlobe.vue`（globe.gl + three）、`NodeEarthCobeGlobe.vue`（cobe）与 `NodeEarthTiledMap.vue`（真实贴图等距地图）。三者互不退化为 SVG 仿制。`three` 与 `globe.gl` 只在选用 realistic 时动态 import，不进首屏包。
- **定位来源仍受数据真实性约束**：新增 `src/composables/useServerGeoClusters.ts` 复用 `buildEarthPoints`，只接受可可靠归一化的 `region` 并聚合到国家/地区中心；不做外部 IP Geo 查询，无法定位的节点不打点。旗帜按 `theme-develop.md` 使用 CFSM 默认皮肤的 `/flags/<code>.svg`，不打包进主题。
- **Earth 与总览合为一个栅格**：`general-stage` 复刻 Komari `NodeGeneralCards` 的布局契约——球体渲染器在桌面端占右半、总览卡片占左半同一行，移动端卡片负边距上移叠加；tiled 改为卡片在上、整幅地图在下。
- **主点击路径直达详情**：移除 `ServerQuickView` 强制中间层（组件已删除），节点卡片与列表行点击直接进入 `/#/server/:id` 并携带 owning `source`；收藏等独立控件保持 `stopPropagation`，多 apiBase 归属不变。
- **首页往返状态**：新增会话级 `src/stores/dashboard-view.ts` 承载搜索、分组、排序与快捷筛选，`首页 → 详情 → 返回首页`不再重置；路由新增 `scrollBehavior` 以 `savedPosition` 恢复滚动位置。视图模式仍由主题设置层单独拥有，避免同一外观状态有两个写入者。
- **发布护栏按真实构成重设**：`validate:dist` 体积预算改为 JS 2816 KiB / CSS 128 KiB / 总资源 6144 KiB；Komari RPC 残留扫描由裸 `common:` 收紧为字符串字面量正则，避免误判 three.js shader chunk 等第三方内部结构。

本轮未完成的 P1/P2（总览卡片结构、NodeCard/NodeList 内部结构、echarts 图表族、详情页层级、图标与 UI 基元、间距校准、死 CSS 清理）在 `docs/fidelity-audit.md` 中逐条列出，不得视为已对齐。
