# Soul Lab — 会生长的科研花园

> 用户进入的不是「一个科研状态可视化组件 + 一个聊天后台」，而是一座 **3D Research Garden**。
> AI、实验、论文检索全部藏在花园的交互之中；聊天框只是一个工具。

**Grow ideas with evidence.** / 让科研想法，用证据慢慢开花。

基于 **CodeBuddy Agent SDK**（`init-cbc-sdk-web` 模板）构建：Express + SSE 后端调用 LearnBuddy 元 Agent，
前端用 **React Three Fiber** 渲染程序化生成的 Soul Flower 花园。

---

## 1. 快速开始

```bash
cd soul-lab
npm install
npm run dev
```

- 前端：http://localhost:5176
- 后端（Agent 服务）：http://localhost:3007

```bash
npm run verify      # 无浏览器自检花园数据层（17 项断言：布局 / Lineage / 光球吸附 / 状态机 / 黄叶分级）
npm run typecheck   # tsc --noEmit
```

> 这台开发机没有 Chrome，也没有 playwright/puppeteer，因此 3D 渲染无法在会话内做视觉确认。
> 上面两条 + `vite build` + 对 dev server 逐个模块做 transform 检查，是目前可用的全部验证手段。

### 接入 LearnBuddy

智能判断只来自 LearnBuddy（不接外部商业 LLM）。两种鉴权方式任选其一：

```bash
# 方式一：环境变量
set CODEBUDDY_API_KEY=xxxx        # PowerShell: $env:CODEBUDDY_API_KEY="xxxx"

# 方式二：CLI 登录
codebuddy login
```

未配置时界面会提示 Agent 不可用（花、实验、记忆仍可浏览）。可在顶栏一键切到
**Mock Adapter（仅演示）**，用于 UI 演示与自动化测试；Mock 不进入比赛智能来源。

---

## 2. 一级交互结构

```
Garden（首页 · 3D 花园）──「种下新想法」直接在这里发生
   ├─ 点击某一株花 ──▶ Camera Focus ──▶ Soul Detail（整株花）
   │                                      ├─ 点击花瓣 ──▶ Petal Focus ──▶ Experiment / Evidence
   │                                      ├─ 点击黄叶 ──▶ Leaf Panel
   │                                      └─ 点击根系 ──▶ Baseline Inspector（原位弹出，不推镜头）
   └─ 点击知识球 ──▶ 悬浮 Paper Card（Discuss / Attach / Ignore）
```

**Garden 是产品本体，不是导航壳。** 一株植物 = 一篇正在形成的 Paper：

| 阶段 | 含义 |
|---|---|
| 🌱 `bud` | Idea stage，还没有实验证据 |
| 🌷 `growing` | 证据正在积累 |
| 🌸 `mature` | 论证结构基本成型 |
| 🌺 `bloomed` | 可以写成论文了 |

**Research Plot（花圃）**：同一技术路线上的工作会自然聚成一块花圃
（Temporal Adaptation / Uncertainty & Robustness / 3D Perception & Control / New Explorations），
花圃之间由 **Research Lineage 藤蔓** 相连 —— 不是普通 Graph Edge，而是带流动粒子的细发光藤。

---

## 3. 核心概念映射

| 研究对象 | 花的部位 | 状态与动效 |
|---|---|---|
| Idea | 花蕾 Bud | 核心假设；Idea 阶段更大更闭合 |
| Baseline | 根 Root | 绑定论文/协议后变粗变亮；点击打开 **Baseline Inspector**（来源 / 配置 / 选择原因 / 关联论文 / 关联实验） |
| 技术主线 | 花茎 Stem | 内部荧光表示 Mechanism Chain；有 ±1.5° 自主摆动；hover 时花心朝镜头轻倾 |
| 实验设计成立、结果未确认 | Ghost Petal | 半透明玻璃态、2.8s 呼吸（opacity 0.20 ↔ 0.32） |
| 结果被审议通过并被保留 | Solid Petal | 叶脉 + 花粉粒子；实体材质 |
| 削弱 / 限制结论的实验 | Yellow Leaf | 绿 → 橄榄 → 赭黄 → 下垂；**分三档：条件限制 / 削弱结论 / 严重反证** |
| 已理解的失败 | Resolved Leaf | 变成**金绿色**，不会恢复鲜绿 |
| 外部论文 | Paper Orb | d3-force 求解球壳位置；**与某片花瓣相关的论文被吸附到那片花瓣的方位角上**，飞入时带尾迹 |
| 用户撤回 | Withdrawn Petal | 低透明度 + 转灰 + 向花心回折；历史保留 |

**三种 hover 状态牌**：花瓣（显示状态与实验标签）、黄叶（显示属哪一档研究边界）、知识球（显示 title / year / 关系）。
这是「花在告诉你它现在处于什么状态」的主要方式 —— 只靠材质变化传达不够。

### 黄叶严重程度（确定性判定，不经过 AI）

由实验数据里最不利的指标 `|deltaPercent|` 决定，阈值写在 `lib/garden/garden.ts` 里可被 review：

| 档位 | 阈值 | 颜色 | 下垂 |
|---|---|---|---|
| `limitation` 条件限制 | < 5% | `#65C98C` 绿 | 8° |
| `weakening` 削弱结论 | 5–15% | `#D8B652` 赭 | 11° |
| `refutation` 严重反证 | ≥ 15% | `#9C7A58` 褐 | 14° |

### 关键动画（全部代表科研状态变化）

```text
Ghost Petal Birth   0ms 花心变亮 → 120ms 流光沿茎上行 → 350ms 花瓣出现 → 750ms 展开 → 900ms 呼吸
Solidification      0ms 停止呼吸 → 150ms 中心亮点 → 350ms opacity .26→.72 → 650ms 叶脉
                    → 900ms stroke 变亮 → 1200ms 稳定；同期花粉粒子飞出、花朵抬头、镜头轻微拉远
Yellow Leaf Birth   0ms 小芽 → 300ms 展开 → 500ms 暂时绿色 → 900ms 转黄绿 → 1200ms 下垂
Withdraw            0ms 关光 → 200ms 降透明度 → 500ms 转灰 → 700ms 回折 4°
```

---

## 4. 架构：谁负责什么

```
UI 组件 ──事件──▶ State Engine ──▶ AgentBridge ──▶ LearnBuddyAdapter ──▶ 后端 SDK ──▶ LearnBuddy
                                          └─(dev)─▶ MockAdapter

State Engine ──语义状态──▶ lib/garden/*（确定性映射）──▶ React Three Fiber 场景
```

**铁律**

- AI **只输出语义**（Zod 校验的 JSON），绝不输出 `petalOpacity` 之类的视觉数值；
- 所有坐标 / 角度 / 半径 / 颜色一律由 `src/lib/garden/` 确定性推导，随机数来自稳定 hash（刷新后花园不变）；
- 网页**不解析自由文本**更新状态；
- 所有持久化状态变更必须由**用户确认**：AI 不能自动实体化花瓣、自动撤回、自动把论文纳入记忆、自动宣布研究成功。

### 目录

```
shared/schemas.ts              Agent 输出契约（Zod，前后端共用）
scripts/verify-garden.ts       数据层自检（无需浏览器）
server/
  index.ts                     模板服务 + 挂载 Soul Agent 路由
  soul-agent.ts                Lab Keeper 元 Agent 路由（Idea / Design / Evidence / Paper）
src/
  lib/types.ts                 领域实体 + State Engine 事件
  lib/state/soul-machine.ts    事件 → 状态（纯函数）+ Timeline
  lib/state/visual.ts          状态 → 视觉（供 DOM 卡片使用）
  lib/garden/
    types.ts                   Garden 领域模型
    layout.ts                  确定性布局：花圃站位 / 花瓣环 / Petal Focus 位姿 / d3-force 球壳
    garden.ts                  SoulDoc[] → GardenModel；stage 推导；Research Lineage 推导
    animation.ts               动画时序规范与缓动（产品规范，不是随手调的参数）
    journal.ts                 Timeline 事件 → 人话 Research Journal
  lib/agent/                   AgentBridge / LearnBuddyAdapter / MockAdapter
  lib/stats/experiment.ts      mean / std / delta / n（确定性，不经过 AI）
  lib/data/                    Dexie(IndexedDB) 多 Soul 持久化 + Seed 花园
  stores/soulStore.ts          领域状态（多 Soul）+ Agent 动作
  stores/gardenStore.ts        镜头叙事 / 聚焦层级 / HUD 状态
  components/garden/           3D 场景
    GardenScene.tsx            Canvas + 光环境 + 花 + 藤蔓 + 标牌
    CameraDirector.tsx         Garden → Flower → Petal 三级镜头叙事
    SoulFlower3D.tsx           程序化植株组装 + 生长动画识别
    CameraDirector / Environment / LineageVines / PaperOrbit3D / ResearchPlot
    parts/                     Stem3D / Bud3D / Petal3D / Leaf3D / RootSystem3D
  components/hud/
    GardenHUD.tsx              顶栏 + 种下新想法 / Scan Frontier / Reset
    SoulKeeper.tsx             浮动球 → 抽屉（不再是半屏聊天）
    ResearchJournal.tsx        人话版研究日志（取代 Timeline 调试条）
    PetalFocusPanel.tsx        花瓣聚焦：证据面板 / 上传 / 撤回
    FlowerPanel.tsx            整株花：假设 / 根系 / 花瓣 / 黄叶 / 轨道
    BaselinePanel.tsx          Baseline Inspector（来源 / 配置 / 原因 / 关联论文 / 关联实验）
    LeafPanel.tsx              黄叶：失败条件 / AI 判断 / 标记为已理解
    PaperCardOverlay.tsx       知识球悬浮卡（Discuss / Attach / Ignore）
    PlantIdeaDialog.tsx        种下一个新的研究想法
  components/chat/             Research Companion + 结构化卡片
  components/experiment/       Excel 上传 / 列映射 / ECharts / Evidence Review
```

### AgentBridge

```ts
interface AgentBridge {
  structureIdea(input: IdeaInput): Promise<IdeaResult>;            // Idea Analyst
  reviewExperimentDesign(input: ExperimentDesignInput): Promise<DesignVerdict>; // Experiment Designer
  reviewEvidence(input: EvidenceInput): Promise<EvidenceVerdict>;  // Evidence Reviewer
  searchPapers(input: PaperSearchInput): Promise<PaperMatch[]>;    // Paper Scout / Gatekeeper
}
```

业务组件永远不直接调用 LearnBuddy。

---

## 5. 花园的技术实现要点

### 程序化花，不建复杂模型

每朵花 = `Stem + Bud + Petal[] + Leaf[] + RootSystem` 动态组合，花瓣数直接由 State Engine 状态驱动
（实验越多，花真的越开）。Petal 用 `Shape` + `ExtrudeGeometry` 加顶点位移生成兜状曲面，叶脉用
`THREE.Line`，全部走一份模块级共享几何。

### 镜头是核心交互

`CameraDirector` 用**解析求解**而非场景图查询来计算 Petal Focus 位姿：
Three.js 中把局部 `(x,0,z)` 绕 Y 旋转 `φ` 后向量角度由 `θ` 变为 `θ − φ`，
所以让角度为 `θ` 的花瓣朝向方位角 `α` 只需 `φ = θ − α`。
这样避免了「相机追花瓣、花瓣追相机」的反馈抖动，取景点落在花瓣中段而非根部。

花园视图把控制权完全交给 `OrbitControls`（限位）；一旦推近，控制器关闭，
且阻尼状态会同步到用户当前所在机位，避免下一次推近时镜头「跳」回默认机位。

### 没有 postprocessing 的 Bloom

项目未引入 `@react-three/postprocessing`。Bloom 用加法混合的壳层网格（halo）实现，
只给 **Ghost Petal / Soul Core / New Paper Orb / 证据通过瞬间** 使用，不做全场景发光。

### 知识球吸附到花瓣

`computeOrbTargets` 在 d3-force 里加了一条自定义 force：有关联花瓣的论文会被拉向那片花瓣的方位角，
落点比主壳层稍靠外，高度带也收窄到与花瓣同高。d3-force 仍在负责排开重叠，
所以吸附不会让球叠在一起（`npm run verify` 里有断言守着）。

### 性能

`dpr={[1, 1.5]}`；只有被聚焦的那株花才渲染 Paper Orbit；
黄叶与花瓣各用一份共享几何；花园规模按 ≤20 株设计。

---

## 6. 主流程（3 分钟 Demo）

1. **0:00–0:25** 打开花园：6 株花、3 块花圃、藤蔓、知识球。说明「花 = 当前研究论证状态」。
2. **0:25–0:55** 镜头推近 `Adaptive Action Horizon` → 告诉 Soul Keeper 新实验 → 设计成立 → **Ghost Petal 长出**。
3. **0:55–1:35** 点击候选花瓣 → 镜头推到花瓣前 → 上传预置 `.xlsx` → 确定性计算 → ECharts → **先填 Human View**。
4. **1:35–1:55** Evidence Reviewer 给出 `accepted` → 用户点 **Solidify Petal** →
   花瓣实体化（1.6s 高潮动画：叶脉生长、花粉飞出、花朵抬头、镜头拉远）。
5. **1:55–2:20** 展示历史黄叶；Paper Scout 找到解释失败的论文，知识球飞入轨道。
6. **2:20–2:45** 点击知识球 → 悬浮 Paper Card → **Add to Soul Memory**。
7. **2:45–3:00** 拉远看整座花园与 Research Journal。

Seed 花园默认包含 6 个 Soul：`Adaptive Action Horizon`（主花，2 baseline / 3 实验 / 3 篇论文）、
`Temporal Policy Adaptation`（bloomed，3 片实体花瓣）、`Efficient VLA Pruning`（2 片候选）、
`Noise-Robust Chunk Selection`（共享主花的知识，形成 Lineage）、`3D Gaussian Splatting for RL`、
`Uncertainty-Aware VLA`（Idea stage）。打开即可直接演示。

### Verdict → 状态

| verdict | 结果 |
|---|---|
| `accepted` | 可实体化（用户点 Solidify） |
| `insufficient` | 保持虚幻（Ghost） |
| `contradictory` | 生成黄叶（研究边界） |
| `invalid` | 仅保留实验记录 |

---

## 7. 故障降级

| 编号 | 故障 | 恢复动作 |
|---|---|---|
| F1 | Agent 输出 schema 校验失败 | 不改花状态；显示错误卡；允许重试 |
| F2 | Paper Search 失败 | 已有 Paper Memory 继续可用；提示手动 Scan |
| F3 | Excel 解析失败 | ColumnMapper 切手工输入（粘贴 CSV） |
| F4 | LearnBuddy 不可用 | 进入离线浏览态，花/实验/记忆可读，AI 区禁用并提示 |
| F5 | 统计计算错误 | 阻断 Evidence Review，请修正列映射 |
| F6 | 用户误确认列映射 | 提交前二次确认，可回退重映射 |

---

## 8. 视觉规范

主题：**Sunlit Research Garden**（被阳光照亮的科研花园）。

不是赛博朋克，不要高饱和霓虹，也不是儿童卡通。深绿园土 + 明亮植物 + 落在花圃上的暖光：

| 用途 | 色值 |
|---|---|
| 花园背景 | `#0B3B2E` / `#14532D` |
| 植物主体 | `#22C55E` / `#4ADE80` / `#86EFAC` |
| 花蕾 · Soul | `#A3E635` → `#FDE047` |
| 实体花瓣（熟成） | `#FDE047` → `#FBBF24` |
| 环境暖光 | `#FFD166` / `#FB923C` |
| 柔和泛光 | `#FEF3C7` |

语义化配色的铁律：**未熟是青柠，熟成是金**。
candidate / insufficient 花瓣是半透明的青柠色（实验设计成立、证据未完成），
被审议通过的 solid 花瓣才变成金色实体；withdrawn 褪成灰绿；黄叶用焦糖橙，刻意不与金色花瓣混淆。
色值定义在 `src/index.css` 的 CSS 变量与 `src/lib/garden/*` 中，3D 材质不写死颜色。

光照用 `HemisphereLight + DirectionalLight + PointLight` 与 `MeshPhysicalMaterial`，而不是 CSS glow。

### 阳光机制（Sunlight Engine）

阳光不是氛围参数，而是**「这座花园里现在有多少条论证被证据照亮」的确定性函数**——
与 `lib/state/visual.ts`、`lib/garden/layout.ts` 同权：把语义状态映射为视觉数值，AI 不参与。

```
阳光 = 0.34
     + 0.12 × 实体花瓣          （证据被研究者保留）
     + 0.05 × 等待结果的实验     （正在推进）
     + 0.06 × Soul Memory 论文   （知识沉淀）
     + 0.04 × 已解决黄叶         （研究边界被消化）
     − 0.06 × 未解决黄叶         （悬而未决的失败边界会遮光）
     − 0.10 × 撤回花瓣           （被研究者收回的结论）
```

实现分三层，全部从**同一份**光推导，不允许各画各的：

| 层 | 文件 | 阳光带来的变化 |
|---|---|---|
| 引擎（纯函数） | `lib/garden/sunlight.ts` | `level` → 天空 / 雾 / 地表 / 主光颜色与强度 / 光斑 / 花粉 |
| 场景（3D） | `components/garden/Environment.tsx` | 主光位置随阶段移动（阴影方向变化）、天空与雾变亮、地面光斑漂移、花粉变亮 |
| HUD | `components/hud/SunlightMeter.tsx` | 顶栏显示 `Sunlight 68% · 上午`，hover 摊开每一条加减项与公式 |

阶段：`晨曦 < 0.45 ≤ 上午 < 0.65 ≤ 正午 < 0.85 ≤ 金色时刻`。

所有光照变化都用插值过渡（而不是切换主题），所以它读起来像太阳在缓慢移动。
阳光机制的可见入口在顶栏，用户能读懂它、也能 argue 它——这是刻意的：
一条路线越被证据支撑，它生长的花园就越亮。

---

## 9. 范围

**P0（初赛）** 多 Soul 花园、程序化 3D 花、Baseline 根、Ghost / Solid Petal、Yellow Leaf、
Petal Focus、Excel 上传、Evidence Review、Paper Orbit、Research Lineage 藤蔓、
用户撤回、Research Journal。

**P1** Paper Memory Search、黄叶修复工作流、自动 Frontier Scan、更多花圃主题。

**P2（决赛）** 真实账号、跨设备数据库、Paper publication verification、ORCID、多用户协作。
