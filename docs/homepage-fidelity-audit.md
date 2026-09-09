# 首页 1:1 复刻审计（第 11 轮）

> **最高原则：原 Komari Glassmorphism 当前默认分支的首页代码、DOM、组件结构、CSS、图标、
> 动画、renderer、交互、布局与浏览器表现，是本轮首页 UI/UX 的唯一权威基准。**
>
> 当前 CFSM 首页只是功能基线，不是视觉真相。本轮从「先读 Komari，再检查 CFSM，逐项 diff」
> 出发，而不是从「当前已经做得不错」出发验证。

## 基线

| 项目 | 提交 | 用途 |
|---|---|---|
| sanrokamlan-prog/komari-theme-Glassmorphism | `bf83765`（v3.3.7） | 首页 UI/UX 唯一权威基准 |
| allury/CFSM-Glassmorphism | `b2d593f`（v1.0.0） | 本轮起点 |

对照的上游文件：`views/HomeView.vue`、`components/Header.vue`、`components/Footer.vue`、
`components/NodeGeneralCards.vue`、`components/NodeCard.vue`、`components/NodeList.vue`、
`composables/useNodePingDisplay.ts`、`styles/main.css`。

## 状态与优先级

状态只允许：`PASS` / `NECESSARY-CFSM-DIFFERENCE` / `P2-ACCEPTED` / `KNOWN-BUG` / `FAIL`。

- **P0**：页面层级、点击路径、renderer、核心组件结构明显不同。
- **P1**：重要 DOM、布局、交互、响应式、动画明显不同。
- **P2**：轻微尺寸、间距、shadow、blur、颜色差异。

`KNOWN-BUG` 表示确认存在但不阻塞本轮 UI 对标，**不等于 PASS**。

## 本轮方法论修正（重要）

前几轮的做法是「读上游源码 → 提取结构契约 → **用本主题既有令牌重新实现** → 源码断言锁定」。
这保住了 DOM 骨架，却在渲染结果上持续偏离，原因很直接：**等价映射本质上就是重新设计**。
源码契约测试只能证明「结构存在」，不能证明「看起来一样」，所以它们全绿的同时，
页面截图一对比仍然明显不像。

三个被实测截图暴露的典型例子：

1. **延迟/丢包柱**：上游 `useNodePingDisplay` 用 `signal-1..5` 五级色阶给**满高**柱着色；
   本主题此前自行发明了「按数值缩放柱高的单色柱」，导致丢包 0% 时面板几乎空白。
2. **卡片表面**：上游 `[data-slot='card']` 有一条 `!important` 规则把所有卡片统一成
   74% 不透明的浅色块加 1px 边框；本主题把 Tailwind 的 `bg-background/50` 直译成了
   `--glass` 的 50%，而 `--glass` 本身已是 72% 半透明，叠加后只剩约 36%，卡片边界消失。
3. **全局令牌**：`--radius` 上游是 10px、本主题是 18px；字体栈上游系统字体优先、
   本主题 Inter 优先；激活态上游用 `--selection`、本主题用 `--emerald`。

结论与后续要求：**凡是上游已有的设计令牌（色阶、圆角、字体、表面、强调色），
一律原样移植，不再映射到本主题既有变量**；只有 CFSM 平台差异才允许偏离。

## 审计矩阵

| 编号 | Komari 原实现 | 当前 CFSM（本轮前） | 差异 | 等级 | 处理 | 状态 |
|---|---|---|---|---|---|---|
| H01 | 延迟/丢包柱：满高柱 + `signal-1..5` 色阶（延迟 ≤60/100/160/200ms，丢包 ≤1/3/6/9%），色觉友好叠加 `ping-signal-pattern` 纹理 | 按数值缩放柱高的单色柱（延迟蓝、丢包橙） | 编码方式完全不同，丢包 0% 时几乎空白 | **P0** | 移植上游阈值、色阶与纹理，柱子改为满高 | PASS |
| H02 | 无采样时渲染 20 根中性占位柱（`EMPTY_PING_BAR_COUNT`） | 无数据时整块不渲染 | 空状态表现不同 | P1 | 按上游补 20 根 `muted/10` 占位柱 | PASS |
| H03 | `signal-1..5` 色阶含亮色、暗色与两套色觉友好变体 | 无 signal 色阶，用主题既有语义色 | 缺少整套设计令牌 | P1 | 四套色阶原样移植到 `:root` / `[data-theme]` / `[data-color-vision]` | PASS |
| H04 | 视图切换只有卡片与列表两个图标按钮（`tabler:layout-grid` / `tabler:table`） | 四个按钮，把卡片密度混进了视图模式 | 控件数量与语义不同 | **P0** | `DashboardViewMode` 收敛为 `card \| list`，密度回归主题设置 | PASS |
| H05 | 卡片密度 `nodeCardSize` 是主题设置，不出现在首页控制区 | 密度按钮出现在首页控制区 | 层级不同 | P1 | 移出控制区，网格类改由 `nodeCardSize` 驱动 | PASS |
| H06 | 首页控制区没有排序下拉（列表排序由表头承担） | 有排序 select 与结果计数 | 多出上游没有的控件 | P1 | 移除排序下拉与结果计数及其死样式 | PASS |
| H07 | 搜索框折叠：默认仅图标宽度，聚焦或有内容才展开，带清空按钮与 ESC | 常驻输入框 | 交互与占位不同 | P1 | 改为折叠式，补清空按钮与 ESC | PASS |
| H08 | 节点网格单列起步，`sm`(640px) 以上才 auto-fill；宽度 270/300/360/420，gap 12/12/16/20 | 宽度一致但 gap 与断点不同 | 间距与断点不同 | P1 | 按上游对齐 gap 与 640px 断点 | PASS |
| H09 | 分组 Tabs 与快捷控制同处一个横向滚动容器 | 分组与快捷控制分别布局 | 滚动行为不同 | P1 | 合并为 `dashboard-controls__scroll` | PASS |
| H10 | 快捷控制为 图标 + 文案 + 计数徽章 | 字符图标 + 文案 + 计数 | 图标体系不同 | P1 | 改用同名 Tabler 图标 | PASS |
| H11 | 高级工具开关位于控制区右侧的工具组 | 位于 Header | 位置不同 | P1 | 移到控制区，Header 只保留站点身份与全局动作 | PASS |
| H12 | 公告位于总览与节点区之前，是首页第一块内容 | 位于多条运行状态提示之后 | 顺序不同 | P1 | 提到 `main` 顶部 | PASS |
| H13 | 节点扁平渲染，不按分组包一层容器 | 已于第 10 轮对齐 | — | — | 保持并由契约锁定 | PASS |
| H14 | 卡片/列表主点击直达详情，独立控件 `stopPropagation` | 已对齐 | — | — | 保持并由契约锁定 | PASS |
| H15 | Earth 三 renderer：globe.gl+three / cobe / 独立 tiled | 已对齐 | — | — | 回归验证，未改动 | PASS |
| H16 | NodeList 十列栅格契约、64px 行高 | 已对齐 | — | — | 回归验证，未改动 | PASS |
| H17 | Overview 卡片 12 栅格 span-4、标签左上图标右上 | 已对齐 | — | — | 回归验证，未改动 | PASS |
| H18 | Header：`h-14`(56px)、32px logo、18px 图标、滚动后加 backdrop-blur | 57px 高度，其余一致 | 1px | P2 | 差异小于一个像素舍入，接受 | P2-ACCEPTED |
| H19 | Footer 双栏：左 Powered by、右 Theme by，1280px 居中 | 左 Powered by CF-Server-Monitor、右主题与实时状态 | 归因目标不同 | — | CFSM 必须归因到 CF-Server-Monitor | NECESSARY-CFSM-DIFFERENCE |
| H20 | 首页 Ping 面板点击打开 `PingMonitorDialog` | 无该弹窗 | 缺少弹窗 | — | CFSM 无对应公开端点，不伪造 | NECESSARY-CFSM-DIFFERENCE |
| H21 | 访客信息浮层 `VisitorInfo` | 关闭并隐藏 | 缺少组件 | — | 无公开访客 API，禁止伪造 | NECESSARY-CFSM-DIFFERENCE |
| H22 | 首页 Ping 柱来自逐节点 ping 记录接口，窗口更长 | 只能用 `/api/servers` 的稀疏窗口 | 样本条数少 | — | 见 `docs/known-bugs.md` BUG-001 | KNOWN-BUG |
| H23 | 丢包面板聚合值 | 三态在数据层保留，但面板数字看不出未配置/超时/真实 0 的区别 | 信息表达 | — | 见 `docs/known-bugs.md` BUG-002 | KNOWN-BUG |
| H24 | 节点入场 `TransitionGroup` + `DeferredRender` 延迟渲染 | 有入场动画与 dense 延迟绘制策略 | 实现机制不同，观感等价 | P2 | 保留现有性能策略 | P2-ACCEPTED |
| H25 | 所有卡片实际生效值为 `rgb(241 245 249 / .74)` + 1px 边框 + `blur(14px) saturate(145%)` + `0 8px 28px` 阴影（`[data-slot='card']` 的 `!important` 覆盖了 Tailwind 的 `bg-background/50`） | 总览卡片仅约 36% 不透明且无边框，在浅色背景上几乎没有卡片感 | 卡片表面完全不同 | **P0** | 移植上游卡片表面令牌，总览卡与节点卡统一使用 | PASS |
| H26 | `--radius: 0.625rem`（10px） | `--radius: 18px` | 全站圆角偏大 8px | P1 | 令牌改为 10px，`--radius-sm` 改为 6px | PASS |
| H27 | `--font-sans` 以 `system-ui` 优先 | 以 `Inter` 优先 | 字形与字重观感不同 | P1 | 字体栈按上游改为系统字体优先 | PASS |
| H28 | 激活态使用 `--selection`（亮 `oklch(.55 .15 155)` / 暗 `oklch(.74 .17 162)`） | 用本主题的 `--emerald` | 强调色不同 | P1 | 移植 `--selection` 并接到分组标签、视图切换与工具开关 | PASS |
| H29 | 隐藏 Earth 时总览区为 `p-4` 独立网格：移动端 3 列、`md` 起 6 列，每卡片 `span 1` | 单列父网格中子区仍跨 12 列，浏览器生成隐式列 | 总览卡片宽度与右侧留白失真 | P1 | 原样移植 3 / 6 列、`span 1`、72 / 112px 最小高度 | PASS |
| H30 | NodeCard 底部始终保持三列；每行图标与可截断文本独立，第三列显示简短剩余天数与金额 | 直接显示完整 ISO 日期，文本没有独立截断层；mini 窄屏还改为两列 | 手机窄屏文字被硬裁切 | P1 | 移植 `calendar-stats` / `coins`、剩余状态与文本层，恢复全密度三列 | PASS |

## 终态

**P0 = 0 ｜ P1 = 0 ｜ FAIL = 0 ｜ P2-ACCEPTED = 2 ｜ KNOWN-BUG = 2**

30 项分布：PASS 23、NECESSARY-CFSM-DIFFERENCE 3、P2-ACCEPTED 2、KNOWN-BUG 2。

两条 KNOWN-BUG 均不阻塞首页视觉与交互对标，且已在 `docs/known-bugs.md` 中单独记录，
不计入 PASS。

## 数据真实性边界（不因保真而放宽）

首页任何位置都不得伪造 IP、ASN、ISP、Provider、精确城市、精确经纬度、访客 IP 或 Audit Log。
Earth 只按明确 region 做国家/地区级定位。probe 的 `false` / `null` / 数值三态在
adapter、卡片、列表与详情全链路保持，不得把未配置或超时写成 0。
