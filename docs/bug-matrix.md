# 功能 Bug 审计矩阵（第 14 轮）

基线：`v1.1.0-test.4` / `8fec94b5c80c8a69374904d19e05e4496beb6e18`
数据契约来源：`docs/cfsm-source-audit.md`（CFSM Worker `2.8.5 Beta5` + Agent `1.3.8` + 真实部署响应）

状态取值：`PASS` / `BUG-CONFIRMED` / `UPSTREAM-LIMITATION` / `NECESSARY-CFSM-DIFFERENCE` /
`DEFERRED-UI-CONFLICT` / `NOT-A-BUG` / `NEEDS-EVIDENCE`。

## 已确认并修复的 Bug

| ID | 页面 / 链路 | 现象 | 证据 | 根因 | 分类 | 修复位置 | 测试 | UI 影响 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| BUG-001 | 首页 NodeCard 延迟 / 丢包柱 | 柱子数量随缺口变化、与标题标注的线路对不上、时间轴错位 | 真实契约下 20 桶 × 4 线路 → 浏览器实测渲染出 **68 根**柱子；上游 `useNodePingDisplay.buildPingBars` 是 `points.map`，一桶一柱 | `toGlassServer` 把 `20 × 4` 拍平成一维数组并过滤掉 `null`/`false`，产物既不是时间序列也丢失了空洞位置 | BUG-CONFIRMED | `glassmorphism-adapter.ts`（按目标分组）+ `ServerCard.vue`（逐桶渲染）+ `main.css`（`.is-gap`） | `tests/cfsm-data-contract.test.ts`「首页窗口按探测目标分组」 | 柱数由 68 → 20，空洞保留原位；柱高与色阶不变 | 已修复 |
| BUG-002 | 首页 NodeCard / NodeList 探测目标 | CFSM 2.8.5 起的 `node_1`～`node_4` 在首页从不显示（详情页正常） | `GlassServer.latency` 被限定为 `LatencyCarrier`（仅 4 项）；`latencyCarrierKeys()` 只返回旧四线路；而 CFSM `mergeMetricsIntoServer` 写入全部 8 项 | 类型与遍历都只覆盖旧四线路 | BUG-CONFIRMED | `types/glassmorphism.ts` + `glassmorphism-adapter.ts`（改用 `PROBE_TARGETS`） | 同上「首页保留 node_1～node_4」 | 只配置了 node 探测点的节点首页不再空白 | 已修复 |
| BUG-003 | 首页 + 详情页价格 / 到期 / 流量可见性 | 站点设置 `show_price=false` 等完全不生效 | 真实响应：`/api/servers` 顶层 `sysConfig` 有这三个开关，`/api/config` 与 `/api/server` 都没有；浏览器实测关掉后价格芯片、剩余天数、流量配额仍然显示 | 集合级 `systemConfig` 解析后**零消费者**；`toGlassServer` 读的是每台节点上的 `systemConfig`（列表里恒为 undefined） | BUG-CONFIRMED | `adapters.ts`（集合开关下发到每台节点）+ `stores/servers.ts`（`siteVisibility(base)`）+ `ServerDetailView.vue` | 同上「站点级展示开关下发到每台节点」 | 关掉后首页与详情页均正确隐藏；未设置时保持可见 | 已修复 |
| BUG-004 | 首页总览卡片 | 长数值被截断，如 `455.0` 显示成 `45…`，`GB / 1.56 TB` 也被截 | 768px 实测：CFSM 主数值 `w36/sw63`，同宽度 Komari `w38/sw63`；CFSM 单位 `flex:none` + `max-width:60%`，上游只有 `truncate` | 自创的 `flex: none` + `max-width: 60%` 把单位钉死并硬占六成宽度，主数值只能拿剩下的 | BUG-CONFIRMED | `main.css` `.overview-card__unit` | `tests/cfsm-data-contract.test.ts`「总览卡片单位不再抢占主数值的宽度」 | 390 / 768 实测空间分配与上游一致 | 已修复 |

## 复核后不构成 Bug

| ID | 现象 | 结论 | 依据 |
|---|---|---|---|
| N-01 | 详情页探针卡显示 `Loss 0.0%`，同页 24 小时丢包历史里却有丢包 | NOT-A-BUG | 两者口径不同：卡片标量来自 `getLatestMetrics()` = `ORDER BY id DESC LIMIT 1`（**最新一条上报**），历史来自 `/api/history/all` 的逐桶采样。用户真实节点实测：标量 `loss_ct = 0`，同节点 24 小时 180 行历史中 170 行为 0、10 行 >0、最大 16%、无 null。两者同时成立 |
| N-02 | WebSocket 增量可能清空只有列表接口才有的 `ping`/`loss` 窗口 | NOT-A-BUG | `mergeRealtimeSample` 从不写 `latencyWindow`/`packetLossWindow`；真实 `latestReportUpdates[].samples[].data` 里也确实没有 `ping`/`loss` 数组。已加回归测试锁定 |
| N-03 | 节点名、地区名被省略号截断 | NOT-A-BUG | 上游 `NodeCard` / `InstanceDetail` 同样使用 `truncate`；实测两版行为一致 |
| N-04 | 卡片旗帜 `<img>` 的 `scrollHeight` 大于 `clientHeight` | NOT-A-BUG | `object-fit: cover` 的正常表现，不是裁切缺陷；上游用 `size-5` 直接拉伸，本主题为 cover + 圆角，属第 11 轮已验收选择 |

## 上游限制与必要差异

| ID | 项 | 分类 | 说明 |
|---|---|---|---|
| U-01 | 首页 Ping / Loss 窗口只有 20 点 / 2 小时 | UPSTREAM-LIMITATION | 服务端常量 `DASHBOARD_LATENCY_WINDOW_POINTS = 20`、`DASHBOARD_LATENCY_WINDOW_HOURS = 2` 写死，且 `/api/config` 的 `latency_window` 只是把它们暴露出来。主题如实展示现有点数，不补点、不复制末点 |
| U-02 | 旧库未迁移时窗口只有 `ct/cu/cm/bd` 四个 key | UPSTREAM-LIMITATION | 服务端 `no such column` 时回退 `LEGACY_DASHBOARD_LATENCY_COLUMNS`。真实 Beta2 部署实测即为此形态。主题把缺席 key 当作「未配置」，不伪造 |
| U-03 | 探针尚未完成首轮探测时上报空串，服务端 `Number("")` → `0` | UPSTREAM-LIMITATION | 「尚未测量」在服务端就变成了真实的 `0 ms / 0%`，主题无法区分。见 `docs/cfsm-source-audit.md` 的未确认项 |
| U-04 | 详情端点在 `loss=null` 时连同 `ping` 一起删除字段 | NECESSARY-CFSM-DIFFERENCE | `omitNullLossProbeFields` 只作用于 `/api/server`。主题把字段缺席视为「未配置 / 无可用样本」，与服务端注释一致 |
| U-05 | 详情页深链接时拿不到站点级 `show_*` 开关 | UPSTREAM-LIMITATION | 这三个开关只在 `/api/servers` 顶层出现。从首页进入详情时开关正确生效（store 已有数据）；直接粘贴详情链接冷启动时无从得知，此时保持可见。要覆盖这种情况必须在详情页额外发一次 `/api/servers`，本轮不引入新的请求形态 |
| U-06 | 系统温度 | NECESSARY-CFSM-DIFFERENCE | `/api/server` 不返回温度（只有历史行有），第 13 轮已按此隐藏温度卡 |

## 待裁决的 UI 冲突

| ID | 项 | 数据事实 | Komari 表现 | 冲突位置 | 影响范围 | 候选方案 | 状态 |
|---|---|---|---|---|---|---|---|
| D-01 | 延迟 / 丢包面板主数值的口径 | CFSM 标量是**最新一条上报**（`ORDER BY id DESC LIMIT 1`），窗口是过去 2 小时 20 个桶 | Komari `useNodePingDisplay` 显示的是窗口**平均值**（`avgLatency` / `avgLoss`） | 首页 NodeCard 的延迟/丢包面板标题数值；详情页探针卡同理 | 用户已实际反馈：卡片 `Loss 0.0%` 与历史图有丢包看起来矛盾（实为口径不同，见 N-01）。改成平均值可消除这种反差并更贴近上游 | ① 改为窗口平均（更贴近 Komari，但改动第 11 / 13 轮已验收的显示数值）；② 保持当前值并在 tooltip 注明口径（不改数值，但 tooltip 内容上游没有）；③ 维持现状 | DEFERRED-UI-CONFLICT |
| D-02 | 总览卡片长数值在 768px 档仍会截断 | 6 列栅格下单卡内容宽度约 90px，`455.0` + `GB / 1.56 TB` 放不下 | 上游同宽度同样截断（实测 `258.6` → `w38/sw63`） | 首页总览卡片 | 修完 BUG-004 后两版空间分配已一致，残余截断属上游同等行为 | 要让长值完整可见必须改动已验收的 6 列几何或缩小字号，两者都会破坏 1:1 基线 | DEFERRED-UI-CONFLICT |

## 终态

- **P0 = 0 ｜ P1 = 0 ｜ FAIL = 0**
- BUG-CONFIRMED 4 项，全部已修复并有对应回归测试
- NOT-A-BUG 4 项，均给出真实数据或源码依据
- UPSTREAM-LIMITATION / NECESSARY-CFSM-DIFFERENCE 6 项
- DEFERRED-UI-CONFLICT 2 项，均写明数据事实、上游表现、影响范围与候选方案，留待下一版本裁决
- NEEDS-EVIDENCE 3 项，记录在 `docs/cfsm-source-audit.md` 的「仍未确认」一节
