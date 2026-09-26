# Soul Lab 简化设计稿（v1，待评审）

> 目标：花园 = 视觉索引（每朵花 = 一篇论文）；点花 → 2D 卡片工作区做科研；
> 坍缩植物隐喻本体；用单一视图栈取代多重状态机；保留数学仪器层（差异化价值）。
> 本稿只描述设计，不含代码改动。

## 0. 设计原则

1. **花园是索引，不是工作区**：花只形象表征一篇论文，不再承载 claim/experiment/evidence 子实体隐喻。
2. **点花进卡片**：点击花朵 → 进入 2D 卡片工作区（论文卡 / 主张卡 / 实验卡 / 证据卡，规律网格）。
3. **单一视图栈**：用一个 `viewStack` 取代 `cameraMode` + `WorkspaceFocus` + `hoveredNode` + `selectedNode` + `evidenceMode` + `journalOpen` + `keeperOpen`，消灭多源状态竞争（之前的"乱跳"根因）。
4. **保留数学仪器层**：Workshop + 证据流本就是卡片/面板形态，正好嵌入新界面。

## 1. 信息架构（设计层实体）

| 新实体 | 含义 | 关键字段 | 旧映射（删/降级） |
|---|---|---|---|
| `Paper` 论文 | 一朵花，视觉索引的单元 | id, title, authors, year, abstract, sourceUrl, tags, createdAt, relatedPaperIds | 旧 `Soul`/`Flower` |
| `Claim` 主张 | 一张卡 | id, paperId, text, confidence, status | 旧 `Petal` |
| `Experiment` 实验 | 一张卡 | id, paperId, claimId?, hypothesis, method, results, status | 旧 Flower 内部实验 |
| `Evidence` 证据 | 一张卡 | id, experimentId, type, source, payload | 旧 `Leaf` |

**删除的"一等实体"（不再进数据模型）**：
`Soul` `Petal` `Leaf` `Bud` `Stem` `Root` `Sunlight` `LineageVines` `PaperOrbit` `CameraMode` `WorkspaceFocus`。

- 花 = `Paper` 的**纯视觉渲染**；花瓣数/叶数等装饰不进模型，数量改用卡片 badge。
- `relatedPaperIds` 取代 `PaperOrbit`（静态关系，不画轨道）。
- 基线 = `Experiment` 的元数据字段；谱系不单独建模。

## 2. 导航：单一视图栈

```ts
type ViewEntry =
  | { scope: 'garden' }
  | { scope: 'paper'; id: string }
  | { scope: 'claim'; id: string }
  | { scope: 'experiment'; id: string }
  | { scope: 'evidence'; id: string }
  | { scope: 'workshop' };          // 数学仪器层

viewStack: ViewEntry[]              // 当前视图 = 栈顶
current = viewStack[viewStack.length - 1]
```

- 点花 → `push { paper, id }`（花园降权 + FocusVeil）
- 点卡 → `push` 对应 scope（下钻）
- ESC / 点空白 → `pop` 一层；空栈 = 花园
- `selectedId` 仅用于卡片内高亮，无多源竞争 → "乱跳"消失

## 3. 点花 → 卡片工作区（交互规格）

- **花园态**：花 = 论文图标（视觉索引）。hover：亮度 +15%、scale 1.03、柔边、指针（沿用已有 3 态规则，**3D 内不出现文字**）。
- **点花** → `viewStack.push({ paper, id })` → 渲染 `CardWorkspace`：
  - 顶部 `CardHeader`：论文标题 / 作者 / 年份 / 摘要（折叠）/ 相关论文（`relatedPaperIds` 链接）。
  - 主体：按类型分组的**规律卡片网格**（Claims / Experiments / Evidence），2D、可滚动。
  - 卡片操作：点击 → 下钻 `push`；"+" → 新建 Claim / Experiment / Evidence。
  - 数学入口：某 Experiment 有 Evidence 时，卡片上"运行仪器"→ 打开 `EvidenceFlow`（仪器账本，已是卡片形态）；顶栏 `Workshop` 按钮 → 仪器工坊。
- 数学仪器层**自然嵌入**卡片工作区，不再依赖 3D 场景。

## 4. 文件级改动清单（供评审范围）

**删除 / 降级**
- 3D：`Petal3D` `Leaf3D` `RootSystem3D` `Bud3D` `Stem3D` `PaperOrbit3D` `LineageVines` → 移除或仅作 Paper 花的纯装饰（去数据绑定）；`SoulFlower3D` → 只渲染 `Paper` 为花。
- HUD：`PetalFocusPanel` `LeafPanel` `BaselinePanel` `FrontierPulse` `MorningBrief`（折叠进 Paper 卡或删）`PlantIdeaDialog`（折叠为工作区"+"）`ResearchJournal`（折叠或删）`FlowerPanel` `PaperCardOverlay`（并入 CardWorkspace）。
- Focus：`FocusLayout` `FocusWorkspace`（三态 Inspector）`FocusHeader` → 替换为 `CardWorkspace` + `CardHeader`。
- lib：删 `lib/garden/sunlight` + `useSunlight`、`lib/balance`、`lib/state/soul-machine`、`lib/frontier/*`（frontier 降级为 `Paper.relatedPaperIds` 被动列表）。
- stores：`gardenStore` 的 `ResearchNode` 种类收窄为 `paper/claim/experiment/evidence`；移除 `cameraMode`/`WorkspaceFocus`/`hoveredNode`/`selectedNode`，改为 `viewStack` + `selectedId`。

**保留**
- `server/math/*`（沙箱 + 注册表 + 验证器 + 双智能体 + SSE）
- `shared/schemas`（增补 Paper/Claim/Experiment/Evidence）
- Dexie（客户端缓存）+ SQLite（服务端真源）
- Agent 适配层（LearnBuddyAdapter / MockAdapter）
- `lib/math/evidenceBrief`、`lib/stats/experiment`
- `WorkshopPanel` `EvidenceFlow` `GardenHUD`（极简顶栏）`SoulKeeper`（简化菜单）

## 5. 分阶段实施（评审通过后）

- **P1 数据模型**：`shared/schemas` 增 4 实体；`gardenStore` 改 `viewStack`；`soulStore` 数据迁移（Soul→Paper 等）。
- **P2 卡片工作区**：新增 `CardWorkspace` / `CardHeader`，替换 `Focus*`；点花 `push paper`。
- **P3 花园瘦身**：`SoulFlower3D` 只渲 `Paper`；移除子部件数据绑定。
- **P4 清尸**：删死面板 / 部件 / `frontier` / `sunlight` / `balance` / `soul-machine`。
- **P5 验证**：selftest + typecheck + build + 真人走查。

## 6. 待你拍板的小决策

1. **"今典"** 是否即"经典 / 简明的卡片界面"？（本稿按此设计）
2. 花是否保留任何子视觉（如花瓣数 = 主张数）？**建议纯图标 + 卡片 badge**。
3. `MorningBrief` / `ResearchJournal` 保留还是砍？**建议砍，信息进 Paper 卡**。
4. 新 Claim / Experiment / Evidence 的入口：工作区"+"按钮（推荐）还是别处？
