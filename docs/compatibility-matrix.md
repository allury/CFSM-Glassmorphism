# 功能兼容矩阵

> 本文记录 2026-09-06 的上游能力审计结论。状态表示在 CFSM 官方公开主题接口上的最终可行性，不等同于当前实现进度。

## 审计基线

| 项目 | 分支 | 审计提交 | 审计重点 |
|---|---|---|---|
| 目标仓库 allury/CFSM-Glassmorphism | main | 2e26bc1c0825745f37726bf7ceafb54ac6414b9b | 第 2 轮真实 REST 首页；第 3 轮在其上开发 |
| huilang-me/CF-Server-Monitor | main | 90d0d217015ce294a0826146d83a80e558a5055e | theme-develop.md 与 src/frontend 第三方主题链路 |
| sanrokamlan-prog/komari-theme-Glassmorphism | main | bf8376587c720de915ac48789a8a180357c762d6 | v3.3.7 manifest、services、stores、router、views、组件与样式 |
| volcano-1025/CFSM-Theme-LuminaPlus | main | 6ae19289c3788a55fbc18cec9b3c1b2a62ecce34 | CFSM transport、adapter、JWT、Turnstile 与 theme_options |

权限边界采用：CFSM `theme-develop.md` 高于 CFSM 内部前端实现；LuminaPlus 只作为成熟适配参考；Komari 只提供视觉与交互基线。上游克隆位于忽略目录 `work/upstreams/`，保持只读。

状态统计：**✅ 1:1 31 项、🟢 等价实现 20 项、🟡 降级实现 5 项、🔴 CFSM API 暂不支持 4 项，共 60 项。**

## 第 3 轮实现进度

真实 REST 首页已在第 2 轮能力上完成 Glassmorphism 视觉与交互还原：粘性页头、总览玻璃卡、CSS 动态背景、card/compact/mini/list 四种响应式布局、tooltip、当前快照模态框/底部抽屉、source+id 收藏、离线置底、多词搜索与 system/light/dark 本地偏好。核心资源、网络、运行信息、当前延迟/丢包、GPU、IPv4/IPv6 可达性和系统元数据仍只使用 adapter 提供的真实字段。页面对零节点、全离线、缺失字段、旧 Agent 数据和请求错误使用明确空态或不可用状态。

0/1/10/30 节点、长名称、14 标签，以及 375/430/768/1024/1440/1920px 视口已经过本地构建验证。WebSocket、正式节点详情、历史图、完整主题设置界面与后端保存、Earth/Map 和高级工具仍未进入实现；下表中的兼容状态仍表示最终设计结论。

## 矩阵

| 功能 | 原 Komari 实现 | CFSM 数据/API | 处理方式 | 状态 |
|---|---|---|---|---|
| 首页路由 | `/` HomeView | hash 首页 `/#/` | 保留首页入口 | ✅ 1:1 |
| 节点详情路由 | `/instance/:uuid` | `/#/server/:id` | 路由参数改为 CFSM id | 🟢 等价实现 |
| 管理入口 | 主题内登录/管理能力 | `/admin#admin` | 外链官方管理端，不复制私有 API | 🟢 等价实现 |
| 卡片视图 | NodeCard 网格 | `/api/servers` | 数据经 adapter 注入原布局 | ✅ 1:1 |
| 列表视图 | NodeList | `/api/servers` | 保留响应式列表 | ✅ 1:1 |
| 卡片尺寸 | mini/compact/comfortable/large | 前端设置 | 原样保留视觉密度 | ✅ 1:1 |
| 节点分组 | group 聚合 | `server_group` | 按真实分组聚合 | ✅ 1:1 |
| 搜索 | 名称、标签、元数据 | name、tags、group、region | 只检索实际存在字段 | ✅ 1:1 |
| 收藏 | 浏览器本地收藏 | localStorage | 以 source+id 避免多源冲突 | ✅ 1:1 |
| 离线置底 | 客户端排序 | 在线状态 | 保留排序规则 | ✅ 1:1 |
| 首页快捷筛选 | 收藏、流量、峰值、离线等 | 列表真实指标 | 有数据的筛选保持原交互 | ✅ 1:1 |
| 总览卡片 | Komari 节点聚合 | `/api/servers` stats 与本地聚合 | 指标名映射并隐藏缺失项 | 🟢 等价实现 |
| 自定义公告 | manifest 文本设置 | `theme_options` | 配置驱动显示 | ✅ 1:1 |
| 主题模式 | beijing/light/dark | preferred_theme + theme_options | 保留北京时间模式，兼容 auto/light/dark | 🟢 等价实现 |
| 毛玻璃配色 | 预设与自定义 JSON | `theme_options` | CSS 变量保留 | ✅ 1:1 |
| 色觉辅助 | 调色板、线型和标签 | 前端渲染 | 保留非颜色区分 | ✅ 1:1 |
| 自定义背景 | 图片/视频、明暗双 URL | `theme_options` 与静态资源 URL | 统一 URL 安全解析 | 🟢 等价实现 |
| 响应式布局 | 桌面/平板/移动 | 前端渲染 | 保留断点体验 | ✅ 1:1 |
| 减少动画 | 手动开关和系统偏好 | 前端渲染 | 同时尊重 prefers-reduced-motion | ✅ 1:1 |
| CPU/RAM/Swap/Disk/Load | 节点实时指标 | 同名 CFSM 指标 | 直接字段映射 | ✅ 1:1 |
| 实时网速与累计流量 | 网络指标 | net_in/out_speed、net_rx/tx | 单位在 adapter 后统一 | ✅ 1:1 |
| 进程与连接 | processes、connections | processes、tcp_conn、udp_conn | 直接字段映射 | ✅ 1:1 |
| 运行时长 | uptime | boot_time | 使用当前时间减真实启动时间 | 🟢 等价实现 |
| OS/架构/内核/地区 | 节点元数据 | os、arch、kernel_version、region | 直接映射 | ✅ 1:1 |
| 服务器真实 IP | ipv4/ipv6 字符串 | 仅 ip_v4/ip_v6 可达性标志 | 不把标志伪装成地址，不显示地址 | 🔴 CFSM API 暂不支持 |
| ASN/城市/IP 地理信息 | IP Geo 查询 | 公开主题 API 不返回地址、ASN、城市 | 不发外部猜测请求，不造数据 | 🔴 CFSM API 暂不支持 |
| 厂商识别 | 元数据、IP Geo、别名字典 | name、group、tags、region | 仅对已有文本做可解释匹配，无证据则不显示 | 🟡 降级实现 |
| 价格与到期 | 财务卡片 | price、billing_cycle、currency、expire_date | 直接映射并遵守 show_price/show_expire | ✅ 1:1 |
| 流量配额 | 配额数值与使用率 | traffic_limit 为格式化字符串 | 能可靠解析时计算，否则只展示原值 | 🟡 降级实现 |
| GPU 利用率 | GPU 指标卡 | gpu_info id/name/info | 兼容数组和 JSON 字符串 | ✅ 1:1 |
| 磁盘 IO | 吞吐、IOPS、await、util | disk 对象 | 缺失或全零时隐藏 | ✅ 1:1 |
| 四线路即时延迟/丢包 | Ping 指标 | ping/loss 的 CT/CU/CM/BD 字段 | 直接映射自定义线路名 | ✅ 1:1 |
| 延迟窗口小图 | 历史延迟序列 | `/api/servers` ping/loss 窗口 | 使用真实稀疏时间戳，不补点 | ✅ 1:1 |
| 在线状态 | Komari online 字段 | is_online 或 last_updated/timestamp | 遵循五分钟在线阈值 | 🟢 等价实现 |
| 多 API Base | 原主题单后端 | apiBase meta 可配置多个 origin | 每个节点保存 source ownership | 🟢 等价实现 |
| 定时刷新间隔 | dataUpdateInterval/RPC | REST + 服务端五秒 WS 批次 | 设置只控制 REST 补偿/前端刷新，不改变服务端节奏 | 🟡 降级实现 |
| 实时订阅 | `/api/clients` | `/api/ws` | 每个 base 独立连接、订阅其自身 IDs、增量合并 | 🟢 等价实现 |
| 单节点详情初始数据 | Komari node RPC | `/api/server?id=` | 详情只拉一台，不拉全量后过滤 | 🟢 等价实现 |
| 历史指标 | load/ping records | `/api/history/all?id=&hours=` | 映射支持周期与稀疏点 | 🟢 等价实现 |
| 超过 24 小时历史 | Komari 鉴权历史 | hours 48/96/168 需 JWT | 保留登录门槛并显示 401 | ✅ 1:1 |
| 磁盘耗尽预测 | 历史回归 | history disk_used/disk_total | 只在足够真实样本时计算 | 🟢 等价实现 |
| 详情指标面板 | 预设与自定义 keys | 详情/历史公开字段 | 建立指标注册表并按可用性隐藏 | 🟢 等价实现 |
| GPU 历史图 | GPU 序列 | history gpu_info | 有真实 GPU 序列时展示 | ✅ 1:1 |
| Ping 历史图 | Ping/丢包序列 | history 行相关字段 | 使用真实数据绘图 | ✅ 1:1 |
| 快照导出 | 客户端导出 | 已加载真实数据 | 保留格式并标注来源/时间 | 🟢 等价实现 |
| 健康工具 | 多指标规则 | CFSM 公开指标 | 规则映射到可用指标 | 🟢 等价实现 |
| 性价比工具 | 价格/资源计算 | CFSM 财务与资源字段 | 使用可解析真实字段计算 | 🟢 等价实现 |
| 拓扑工具 | 节点关系视图 | 无真实网络拓扑关系 | 仅按分组/地区可视化，不声称链路关系 | 🟡 降级实现 |
| 访客信息与审计 | 访客 IP、指纹与审计 API | 无对应公开主题接口 | 整体关闭，不调用私有或外部接口 | 🔴 CFSM API 暂不支持 |
| 主题设置读取 | Komari managed config | `/api/config.theme_options` | defaults 与后端快照合并 | 🟢 等价实现 |
| 主题设置跨设备保存 | Komari 管理配置 | `POST /api/theme_options` | JWT + Turnstile，提交完整快照 | 🟢 等价实现 |
| 本地覆盖 | localStorage 设置 | 本地层 | 与后端层分离并可清除 | ✅ 1:1 |
| JWT 鉴权 | Komari session | Authorization Bearer jwt_token | 沿用 CFSM 官方存储键和失效规则 | ✅ 1:1 |
| Turnstile | Komari 无同构流程 | config + Token/Verified headers | 按 CFSM 验证凭证复用流程实现 | 🟢 等价实现 |
| Komari RPC transport | `/rpc2` common/public/admin namespace | CFSM 无兼容 RPC | 完全移除，不移植 runtime | 🔴 CFSM API 暂不支持 |
| 隐藏节点与权限过滤 | Komari 权限过滤 | `/api/servers` 服务端按身份过滤 | 信任服务端边界，不探测隐藏节点 | ✅ 1:1 |
| 缓存与延迟加载 | service cache、worker、deferred UI | 浏览器缓存与 store | 按 CFSM 请求语义重建缓存 | 🟢 等价实现 |
| 三种地球渲染器 | realistic/cobe/tiled | 前端视觉能力 | 保留渲染器与交互 | ✅ 1:1 |
| 地球节点定位 | IP Geo/region 坐标 | 只有 region，且可能不精确 | 仅可可靠归一化时定位，否则不放点 | 🟡 降级实现 |
| Powered by 页脚 | Komari 品牌页脚 | CFSM 开源项目链接 | 更新为 CF-Server-Monitor | ✅ 1:1 |

## 关键审计结论

- CFSM 的 dashboard 公共接口不返回管理端 `note`，也不返回服务器实际 IP、ASN 或城市；这些能力不得由占位值补齐。
- `gpu` 已废弃，适配只读取 `gpu_info`。REST 可能返回 JSON 字符串，WebSocket 新数据返回数组。
- `disk` 只有六个指标中至少一个非零时才有意义；缺失、格式错误或全零都视为不可用。
- `/api/servers` 才包含 ping/loss 窗口；`/api/server` 不包含。窗口点稀疏且保留真实时间戳。
- LuminaPlus 最新实现确实通过 `POST /api/theme_options` 保存完整配置。其仍存在“只读/本地保存”的旧注释和一个拒绝保存的兼容 stub；本项目以实际调用链与最新 CFSM 文档为准，不复制陈旧注释。
