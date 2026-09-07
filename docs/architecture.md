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

位置：`src/services/cfsm/api.ts`、`src/services/cfsm/websocket.ts` 与 `src/services/cfsm/dashboard-realtime.ts`。

- 用语义方法封装 `/api/config`、`/api/servers`、`/api/server`、`/api/history/all` 和 `/api/theme_options`。
- 在发出请求前确定 base、id 和受支持的 history hours。
- 多源请求保留数组边界；详情和历史明确接收 owning base。
- `websocket.ts` 只负责单一 base 的 URL、订阅帧、消息适配、连接时限、keepalive 和有界退避。
- `dashboard-realtime.ts` 负责首页多 base 协调、visibility 生命周期、REST 补偿与用户超时决策；不会跨来源拼接订阅 ID。

### Adapter

位置：`src/services/cfsm/adapters.ts`。

- 唯一允许理解 CFSM wire 字段名的层。
- 输入总是 `unknown`；先验证对象/数组和关键 id，再做有限的字符串、数值、布尔归一化。
- 把 snake_case 映射到 `src/types/cfsm.ts` 的稳定领域模型。
- 兼容 `gpu_info` 的数组/JSON 字符串和历史磁盘 IO 两种形状。
- 不补历史点，不伪造 IP/ASN/城市/厂商，不把错误格式变成看似真实的数据。
- `src/services/cfsm/glassmorphism-adapter.ts` 再把稳定 CFSM 模型映射为首页展示模型；可达性仍是状态，不成为地址字符串。

### Store

位置：`src/stores/`。

- `app.ts` 管理 apiBases、站点 config、加载状态与官方管理端地址。
- `servers.ts` 管理按来源分开的集合，以 `base::id` 作为稳定键，避免不同站点 UUID 冲突。
- `servers.ts` 也按来源合并实时 partial sample，未知节点不会由 WebSocket 凭空创建；REST 暂时失败时保留该来源上一份真实快照。
- `realtime.ts` 管理首页实时协调器的生命周期、每个来源的连接状态、五分钟离线过期、降级提示和超时后的继续/暂停动作。
- `dashboard-preferences.ts` 只保存首页本地偏好：system/light/dark、card/compact/mini/list、离线置底与以 source+id 标识的收藏；读取时严格校验版本化快照，浏览器存储不可用时仍保持当前会话可用。
- store 对异步过程提供 idle/loading/ready/partial/error，而不是让 UI 猜测；多来源之一失败时保留其他来源的真实结果与失败原因。
- 详情、历史和 theme settings 后续仍各自建立职责清晰的 store 或 composable，不堆入单一全局对象。

### UI

位置：`src/App.vue`、`src/views/HomeView.vue` 与 `src/components/dashboard/`。

- 只渲染领域模型和显式状态。
- 缺数据时隐藏依赖组件或显示“不可用”，不展示 0 值占位来冒充采样。
- 用户动作调用 store/service，鉴权失败保留当前页面和编辑内容。
- 原 Glassmorphism 的组件、布局、动效和响应式策略优先复用；Komari transport 代码不能随组件一起移植。
- 首页筛选、排序、分组和汇总位于 `src/domain/dashboard.ts`，不会在组件内重新解释 wire payload。
- 节点快速查看只展开当前 REST 快照，不触发详情、历史或 WebSocket 请求；桌面为模态框，移动端为底部抽屉。

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
- 第 3 轮只落地首页所需的轻量本地偏好；完整 48 项 schema、设置界面、backend/local 分层编辑与后端保存仍属于后续阶段。

## WebSocket

首页实时层位于 `src/services/cfsm/websocket.ts`、`dashboard-realtime.ts` 与 `src/stores/realtime.ts`，当前实现如下：

- 一条首页连接只对应一个 apiBase；它的订阅 IDs 只来自同一 base。
- 首页连接 URL 固定为 `/api/ws?subscribe=all`，open 后发送包含本 base 真实节点 IDs 的 all-scope subscription。
- 收到 `batchUpdate` 后提取 sample 的 `data`、`payload` 或 `metrics`，按字段合并进已有实体。
- 高频增量缺失字段是正常情况，不得覆盖为 null/0。
- 列表 ping/loss 窗口由 REST 补齐，详情实时字段与历史序列分别管理。
- document 隐藏时主动关闭，可见时先 REST revalidate 再连接；unmount 时释放连接与计时器。
- 配置的连接时限到达后由用户选择继续或暂停；网络恢复采用单计时器指数退避，不会并发重连。
- 连接不可用时以单个低频 REST 循环补偿；任何失败都继续展示最后一份真实快照及来源错误。
- 五分钟在线阈值在 adapter/domain 层保持一致。
- 详情连接仍须使用 `subscribe=<id>`；不拉/订阅全量后过滤，该能力属于后续详情阶段。

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
- 管理 `/admin#admin`，由 CFSM 官方前端负责

本轮只有最小入口，没有抢先建立详情占位页。主题不实现管理员私有接口、不复制登录管理逻辑、不调用 `save_settings`。

## 质量与发布

- Bun 锁定依赖；TypeScript strict、ESLint、Vitest 和 Vite 是同一质量门。
- 单元测试覆盖 apiBase、wire adapter、JWT/Turnstile transport、错误语义和完整 theme_options body。
- `bun run build` 先 typecheck 再构建。
- `bun run validate:dist` 验证根目录只有 `index.html` 与 `assets/`、assets 非空，并扫描禁止的 Komari runtime 标记。
- GitHub Actions 对 push main、pull request 和手动触发执行 frozen install、lint、typecheck、test、build、dist validation，并上传根结构正确的 ZIP。
- `dist/` 是生成物，不进入版本控制。

## 第 4 轮完成边界

本轮在第 3 轮首页上完成真实 WebSocket 更新与多 API Base 协调：每个 backend 独立连接和订阅、`batchUpdate` 多 envelope 适配、partial merge、visibility REST-first 恢复、`frontend_ws_timeout_minutes` 用户决策、有界退避、60 秒 REST fallback 与五分钟离线过期。测试覆盖跨来源同 ID 隔离、订阅 IDs、批次适配、增量保留、重连防风暴、503/网络降级、页面可见性和连接时限。以下仍是后续阶段：正式详情路由、详情 WebSocket、历史图、完整主题设置及后端保存、Earth/Map 和高级工具。
