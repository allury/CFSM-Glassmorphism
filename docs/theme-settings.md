# 主题设置审计

> 基线：Komari Glassmorphism v3.3.7 的 `komari-theme.json`，提交 bf8376587c720de915ac48789a8a180357c762d6。状态描述在 CFSM 上的最终适配可行性，不等同于当前实现进度。

共审计 **48** 个设置：**✅ 1:1 28 个、🟢 等价 11 个、🟡 降级 7 个、🔴 不支持 2 个**。

## 第 6 轮落地范围

第 6 轮已在 `src/theme/settings.ts` 建立全部 48 项的版本化默认值、逐字段归一化、旧格式迁移、完整快照序列化和安全背景 / 自定义颜色校验。`src/stores/theme-settings.ts` 是 backend、local、draft 与 runtime 的唯一所有者；首页、详情、动态背景和 `/#/settings` 不再各自读取 `theme_options` 或浏览器外观键。

设置页提供即时预览、保存到当前浏览器、清除本地覆盖并使用后端、保存到 CFSM、完整 JSON 复制/查看。后端保存只调用 `POST /api/theme_options`，发送 48 个已知项加保留的未知后端项；JWT、Turnstile 和收藏等本地专属键会被剔除。成功时先采用响应中的 `theme_options`，清除 local，重建 runtime/draft，再回读 `/api/config`；400、401、403 与网络错误都保留草稿。

本轮可编辑项仅覆盖现有 UI 能真实兑现的外观、布局、公告、首页控制、隐私显示、GPU 图表和自定义背景。Earth/Map、磁盘预测、可配置指标面板与高级工具的值仍按 schema 迁移和往返保存，但在对应开发轮次前不显示伪开关。`rpcTransportMode` 固定为 `http`（语义为官方 REST + WebSocket），`visitorInfoEnabled` 强制为 `false`。

原 `cfsm-glassmorphism.dashboard.v1` 中的主题、视图和离线排序会一次性迁移到 `cfsm-glassmorphism.theme-options.v1`；旧 key 此后只保留 source+id 收藏。本地覆盖使用带 `version: 1` 的独立快照，即使清空也保留空层标记，避免再次迁移旧外观值。

## 状态定义

- ✅ 1:1：配置含义和用户体验可以原样保留。
- 🟢 等价：数据结构或底层机制改变，但可达到等价体验。
- 🟡 降级：只对 CFSM 确实提供的字段生效；不可用子项必须隐藏或说明。
- 🔴 不支持：缺少 CFSM 公开主题能力，禁用并说明，不能接入私有 API 或 mock。

## 逐项矩阵

| # | key | 类型 / 原默认值 | CFSM 处理 | 状态 |
|---:|---|---|---|---|
| 1 | `themeMode` | select / `beijing` | 保留 beijing 定时明暗；同时映射 config 的 auto/light/dark 偏好 | 🟢 等价 |
| 2 | `dataUpdateInterval` | number / `3` | 只控制 REST 补偿刷新与前端派生节流；服务端 WS 批次仍约 5 秒 | 🟡 降级 |
| 3 | `rpcTransportMode` | select / `http` | CFSM 无 Komari HTTP/WebSocket RPC 二选一；固定使用官方 REST + WS | 🔴 不支持 |
| 4 | `defaultViewMode` | select / `card` | 保留 card/list | ✅ 1:1 |
| 5 | `nodeCardSize` | select / `compact` | 保留 mini/compact/comfortable/large | ✅ 1:1 |
| 6 | `alertEnabled` | switch / `false` | 存于 theme_options，控制首页公告 | ✅ 1:1 |
| 7 | `alertTitle` | string / 空 | 存于 theme_options | ✅ 1:1 |
| 8 | `alertContent` | richtext / 空 | 支持受限 Markdown 渲染并做 XSS 清理 | ✅ 1:1 |
| 9 | `stopEarth` | switch / `false` | 控制前端地球动画 | ✅ 1:1 |
| 10 | `earthRenderer` | select / `realistic` | 保留 realistic/cobe/tiled | ✅ 1:1 |
| 11 | `hideEarth` | switch / `false` | 控制首页视觉区 | ✅ 1:1 |
| 12 | `hideGeneralCard` | switch / `false` | 控制头部/总览区 | ✅ 1:1 |
| 13 | `visitorInfoEnabled` | switch / `true` | CFSM 公开主题 API 不提供访客 IP 或审计能力；强制关闭 | 🔴 不支持 |
| 14 | `glassColorPreset` | select / `翡翠` | 保留翡翠/柔和/高对比/午夜/自定义 | ✅ 1:1 |
| 15 | `colorVisionMode` | select / `标准` | 保留标准/色觉友好及非颜色编码 | ✅ 1:1 |
| 16 | `glassCustomColors` | richtext / 10 个颜色键 JSON | 校验颜色 schema 后映射 CSS 变量 | ✅ 1:1 |
| 17 | `generalCardPreset` | select / `基础` | 指标注册表改为 CFSM 领域字段，保留预设交互 | 🟢 等价 |
| 18 | `generalCardKeys` | richtext / memory、disk、remainingValue、totalTraffic、uploadSpeed、downloadSpeed | 可用 keys 保留；虚拟化、精确配额等缺失项不展示 | 🟡 降级 |
| 19 | `homeToolsEnabled` | switch / `true` | 只显示可由真实 CFSM 数据支持的健康、价值、导出等工具 | 🟡 降级 |
| 20 | `hideAdminEntryWhenLoggedOut` | switch / `false` | 根据 authorization 控制 `/admin#admin` 链接 | ✅ 1:1 |
| 21 | `hidePriceWhenLoggedOut` | switch / `false` | 根据 authorization 隐藏财务字段 | ✅ 1:1 |
| 22 | `providerAliases` | string / 空 | 仅匹配 name/group/tags/region 中真实文本，不做 IP Geo 猜测 | 🟢 等价 |
| 23 | `exportSecondaryPassword` | string / 空 | 保留客户端导出二次确认；不宣称后端安全边界 | ✅ 1:1 |
| 24 | `disablePageAnimation` | switch / `false` | 保留并叠加系统 reduced-motion 偏好 | ✅ 1:1 |
| 25 | `homeQuickControlsEnabled` | switch / `true` | 保留快捷控制区 | ✅ 1:1 |
| 26 | `homeQuickControlPreset` | select / `完整` | 保留基础/流量/运维/完整/自定义 | ✅ 1:1 |
| 27 | `homeQuickControlKeys` | richtext / favorite、totalTraffic、peak、offline | 保留八个原 keys，按数据可用性禁用无结果项 | ✅ 1:1 |
| 28 | `nodeListMetadataEnabled` | switch / `true` | 信息栏保留，但 CFSM 不提供 ASN/城市/实际 IP | 🟡 降级 |
| 29 | `nodeListMetadataFields` | richtext / provider、region、asn | region/tags/group 可用；provider 仅文本匹配；city/asn 不可用 | 🟡 降级 |
| 30 | `nodeListCustomTagsVisible` | switch / `true` | 映射 CFSM 逗号分隔 tags | ✅ 1:1 |
| 31 | `offlineNodesLast` | switch / `false` | 使用统一五分钟在线判定排序 | ✅ 1:1 |
| 32 | `homeHighLoadThreshold` | number / `80` | 对 CPU、内存、磁盘真实百分比生效，限制 1–100 | ✅ 1:1 |
| 33 | `homeTrafficWarningThreshold` | number / `80` | 只在 traffic_limit 可可靠解析时生效，限制 1–100 | ✅ 1:1 |
| 34 | `homeExpiringDays` | number / `30` | 使用 expire_date，限制 1–3650 | ✅ 1:1 |
| 35 | `diskPredictionEnabled` | switch / `false` | 改用 CFSM history 的 disk_used/disk_total 序列 | 🟢 等价 |
| 36 | `diskPredictionThresholdDays` | number / `30` | 保留阈值，样本不足两天或未增长时不显示 | ✅ 1:1 |
| 37 | `nodeDetailSectionTabsEnabled` | switch / `false` | 保留连续布局/分区标签页切换 | ✅ 1:1 |
| 38 | `detailMetricCardPreset` | select / `财务` | 预设映射到 CFSM 详情领域模型，保持响应式卡片数量 | 🟢 等价 |
| 39 | `detailMetricCardKeys` | richtext / nodePrice、monthlyCost、remainingTime、remainingValue、totalTraffic、trafficQuota、uptime、connections | 支持有真实字段的 keys；系统温度、精确配额等按可用性隐藏 | 🟡 降级 |
| 40 | `gpuChartEnabled` | switch / `false` | 使用 gpu_info 的 id/name/info；无序列自动隐藏 | 🟢 等价 |
| 41 | `chartDashboardPreset` | select / `默认` | 将预设映射到 CFSM history 可用指标族 | 🟢 等价 |
| 42 | `chartDashboardTemplate` | richtext / cpu、memory、disk、network、gpu、connections、process | GPU 显存、GPU 温度和缺失指标不生成假序列；旧 JSON 可迁移 | 🟡 降级 |
| 43 | `backgroundEnabled` | switch / `false` | 存入 theme_options，控制统一背景组件 | 🟢 等价 |
| 44 | `backgroundType` | select / `image` | 保留 image/video，采用浏览器安全加载策略 | 🟢 等价 |
| 45 | `lightBackgroundUrl` | string / 空 | 支持 http(s) 与站内路径；local: 迁移为主题可访问静态路径 | 🟢 等价 |
| 46 | `darkBackgroundUrl` | string / 空 | 与亮色 URL 同一规则 | 🟢 等价 |
| 47 | `backgroundBlur` | number / `0` | 映射 CSS blur，非负校验 | ✅ 1:1 |
| 48 | `backgroundOverlay` | number / `0` | 保留 -100–100 的明暗遮罩语义 | ✅ 1:1 |

## 配置分层与保存

配置中心必须保留三个互不混淆的层：

1. **Defaults**：上述 48 项的版本化 schema 和默认值。
2. **Backend**：`GET /api/config` 返回的 `theme_options`，用于跨设备共享。
3. **Local**：当前浏览器覆盖；清除本地后回落到 backend，再回落到 defaults。

有效值按 `defaults <- backend <- local` 合并。设置界面的“保存到 CFSM”必须把当前允许后端持久化的完整有效配置作为单个非数组对象发送到 `POST /api/theme_options`，而不是只发本次改动字段。保存成功以后端返回的完整 `theme_options` 重建 backend 层；400、401、403 时保留未保存草稿并给出可操作错误。

`jwt_token`、`turnstile_token`、`turnstile_verified`、临时对话框状态和一次性选择不得进入 theme_options。

## 迁移规则

- 未知 key 要保留在后端快照中，避免新旧版本往返保存时破坏前向兼容。
- 已知 key 在读取时做类型、枚举与范围校验；无效值回落而非强制写回。
- 原多行 keys 支持逗号、空格或换行分隔，保存时规范化并去重但保持顺序。
- `glassCustomColors` 和旧的 `chartDashboardTemplate` JSON 必须先安全解析，失败时显示错误，不执行字符串。
- 红色设置保留迁移说明，但不向用户展示一个看似可用、实际依赖 mock 的开关。
- 后端保存前会从当前有效草稿生成全部 48 个已知键；未知后端键原样往返，但鉴权凭证和本地专属键永不进入 payload。
