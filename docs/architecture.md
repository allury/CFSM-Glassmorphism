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
- `errors.ts` 把 400/401/404/409/503、网络错误与未知错误转换为稳定 issue；UI 只选择对应文案，不解析响应体。

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
- 节点快速查看只展开当前 REST 快照，不触发详情、历史或 WebSocket 请求；桌面为模态框，移动端为底部抽屉。
- `ServerDetailView` 只消费 `CfsmServer`、`HistoryPoint` 与纯 domain 图表模型。轻量 SVG 图表按真实时间戳绘制，缺失/超时形成断点，不补点；probe 图例额外保留有效/超时/缺失计数。

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
