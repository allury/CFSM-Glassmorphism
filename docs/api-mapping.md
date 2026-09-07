# CFSM API 映射

## 唯一运行时协议

本主题只调用 CF-Server-Monitor 官方第三方主题接口。Komari 的 `/api/public`、`/api/nodes`、`/api/clients`、`/rpc2` 以及 `common:*`、`public:*`、`admin:*` RPC 命名空间不得进入生产包。

apiBase 的来源是 HTML 中可选的 `<meta name="apiBase" content="https://a.example,https://b.example">`；未配置时使用当前页面 origin。每个值只保留 HTTP(S) origin，去重后独立请求。不存在额外的 `config.json`。

## 端点与代码责任

| 能力 | theme-develop.md | CFSM 官方 frontend 参考 | 本主题实现 | 当前状态 |
|---|---|---|---|---|
| Config | `GET /api/config` | `src/frontend/main.js`、`utils/api.js`、`utils/turnstile.js` | `fetchSiteConfig` → `normalizeSiteConfig` | 已用于真实首页并测试 |
| Servers | `GET /api/servers` | `src/frontend/utils/server.js`、`views/dashboard` | `fetchServers` / `fetchAllServerSources` → `normalizeServerCollection` → `toGlassServer` | 已用于真实首页并测试，支持多来源部分失败 |
| Detail | `GET /api/server?id=<id>` | `src/frontend/utils/server.js`、`views/ServerDetail.vue` | `fetchServer` → `normalizeServer` | 已实现 service，UI 后续实现 |
| History | `GET /api/history/all?id=<id>&hours=<hours>` | `src/frontend/utils/api.js`、`views/ServerDetail.vue` | `fetchHistory` → `normalizeHistory` | 已实现 service，图表后续实现 |
| WebSocket | `GET /api/ws?subscribe=<all\|id>` | Dashboard 与 `utils/api.js` 的订阅逻辑 | `createCfsmSocket` → `normalizeSocketBatch` → `mergeRealtimeSample` | 首页已实现；详情订阅留待详情阶段 |
| Theme Save | `POST /api/theme_options` | 第三方主题规范；LuminaPlus `services/api.ts` | `saveThemeOptions` → `normalizeThemeOptionsSave` | 已实现并测试 |

Transport 位于 `src/services/cfsm/http.ts`，endpoint orchestration 位于 `src/services/cfsm/api.ts`，所有 wire payload 都在 `src/services/cfsm/adapters.ts` 从 `unknown` 转为领域类型。Vue 组件不直接调用 `fetch`。

## 请求契约

### GET /api/config

- 可带 `Authorization: Bearer <jwt>`。
- 该端点在不带 Turnstile header 时可直接读取验证配置；带 `X-Turnstile-Token` 或 `X-Turnstile-Verified` 时会执行验证。
- 读取 `theme_options`、站点标题、外观/语言偏好、Turnstile 状态、WebSocket 超时、长历史点数及 latency window。
- 响应体中的 `turnstile_verified` 写入同名本地键，并清除已经消费的一次性 token。
- 此端点不使用外部静态配置文件作为替代。

### GET /api/servers

- 返回 `servers`、`stats`，每个服务器可能带 `sysConfig`。
- 多 apiBase 时，每个响应单独适配，并把 `source.base` 固化在每个服务器对象上。
- 列表响应中的 `ping` / `loss` 是最多约 20 个真实稀疏点；关闭三网详情时数组为空。
- `disk` 缺失、无效或六项全零时不展示磁盘 IO。
- `gpu_info` 兼容数组与 JSON 字符串，只使用新版字段，不读取废弃的 `gpu`。
- 公共 REST 中的 `ip_v4` / `ip_v6` 只是 `0` / `1` 可达性，不是 IP 地址。

### GET /api/server?id=<id>

- 仅拉取指定节点；详情页不得先拉 `/api/servers` 再前端过滤。
- 请求必须发往该节点的 `source.base`。
- 404 原样表现为节点不存在；不创建演示节点。
- 详情响应不提供列表页的 ping/loss 窗口数组。

### GET /api/history/all?id=<id>&hours=<hours>

- hours 只能是 `0.167`、`0.5`、`1`、`6`、`12`、`24`、`48`、`96` 或 `168`。
- 未登录查询超过 24 小时可返回 401；数据库需要升级可返回 409 `databaseUpgradeRequired`。
- 长历史点数由后端配置决定，不在前端填点。
- 历史 `disk` 优先读取对象；兼容旧的六个 `disk_*` 平铺字段，但缺失时不绘制。
- 503 是后端额度/暂不可用状态，只能显示真实降级提示，不能用 mock 历史替代。

### GET /api/ws

首页实时链路已经实现并遵守以下契约：

1. 首页先按 base 读取列表，再为每个有节点的 base 建立独立 `subscribe=all` 连接。
2. 连接成功后发送 `{ type: "subscribe", scope: "all", ids }`，ids 去重、校验且只属于当前 base；不发送订阅消息不会收到更新。
3. `batchUpdate.updates[].samples[]` 从第一个有效的 `data || payload || metrics` 增量对象读取，按 sample、update、message 的真实时间戳顺序回退，再按字段合并到现有 REST 实体。缺失字段不会被覆盖为 null、0 或空值。
4. 页面隐藏时主动关闭全部连接；重新可见时先执行 REST revalidate，再按最新节点集合恢复订阅。
5. `frontend_ws_timeout_minutes` 只接受 0–1440 的整数。正数时限到达后停止连接，由用户明确选择继续新连接或保持暂停。
6. 网络或策略失败采用 1–30 秒有界指数退避，并确保每条连接只有一个待执行重试；不可用期间启用单个 60 秒 REST 补偿循环。REST 503 保留已有来源快照并显示来源错误，不生成替代数据。
7. 同源非公开站点依赖 CFSM cookie；跨源才把 JWT 放入 `token` 查询参数。Turnstile 不参与 WebSocket 验证。
8. 详情仍应使用 `subscribe=<id>`，不订阅全量；该能力不属于本轮。

### POST /api/theme_options

- 这是主题唯一允许的写接口，必须携带 JWT；启用全局 Turnstile 时还需要 Token 或 Verified。
- body 只能是 `{ "theme_options": { ...完整快照 } }`。数组、字符串和 null 会得到 400 `invalidThemeOptionsFormat`。
- 保存只修改后端 `appearance_options.theme_options`，不写 `site_options`，也不覆盖标题、背景、CSP 或自定义脚本等其他外观设置。
- 401 清除无效 JWT；403 清除 Turnstile token/verified 并要求重新验证。任何失败都留在当前主题界面，不自动跳转。
- LuminaPlus 的真实调用链已经使用此接口；其“read-only/local-only”旧注释不是协议依据。

## 鉴权与错误策略

| 状态 | 含义 | 客户端动作 |
|---|---|---|
| 400 | 参数或 theme_options 格式错误 | 展示服务端 code/message，保留用户草稿 |
| 401 | JWT 缺失、过期或权限不足 | 清除 `jwt_token`，显示需要登录；不自动重定向 |
| 403 | Turnstile 验证失败 | 清除 `turnstile_token` 与 `turnstile_verified`，要求重新验证 |
| 404 | 节点不存在 | 显示真实空/不存在状态 |
| 409 | 数据库需要升级 | 显示 `databaseUpgradeRequired` 引导 |
| 503 | 暂不可用或额度限制 | 明示服务端状态，可提供用户触发的重试 |

存储键与 CFSM 官方前端保持一致：

| 键 | 用途 |
|---|---|
| `jwt_token` | Bearer JWT |
| `turnstile_token` | Turnstile 一次性 token |
| `turnstile_verified` | 可复用约一小时的验证凭证 |

## 数据真实性边界

公开 API 不提供实际服务器 IP、ASN、城市、精确坐标或管理端 note。本主题不会从可达性标志推断地址，不会在生产代码中填假数据，也不会为填满组件而生成历史点、价格、厂商或地理位置。
