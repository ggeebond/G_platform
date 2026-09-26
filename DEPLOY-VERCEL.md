# Soul Lab · Vercel 部署指南

> 本文档对应「全量 Vercel Serverless 改造」：后端已重构成可在 Vercel 上以 Serverless
> 函数运行的形态，前端照常构建成静态产物。你只需按下面的步骤准备仓库与一个
> Vercel 账号即可一键部署。

---

## 0. 这份改造做了什么（架构变化）

| 维度 | 本地开发 | Vercel Serverless |
| --- | --- | --- |
| 进程模型 | `npm run dev:server` 常驻监听 3007 | 单一函数 `api/index.ts`，按需冷启动，无长驻端口 |
| 数据库 | `better-sqlite3` → `./data/chat.db`（动态 import，**不会被打包进函数**） | `@libsql/client` → Turso / 任意 libSQL 端点（检测到 `TURSO_URL` 自动切换） |
| 数学沙箱 | 系统 / `.venv` 的 CPython 子进程 | Pyodide（Python→WASM，进程内运行），自动探测 `VERCEL` 环境变量启用 |
| 前端 | Vite dev server（5176），代理 `/api` → 3007 | `vite build` → `dist/`，`/api/*` 由 rewrite 指向函数，其余走 SPA |

代码层面改动（均已落盘，可 `git diff` 核对）：

- `server/db.ts` —— 统一异步接口 `Queryable`；双后端（libSQL / better-sqlite3），运行时按环境变量选择。
- `server/app.ts` —— **只装配** Express（中间件 + 路由 + SSE），不监听端口；`api/index.ts` 与本地 `index.ts` 共用。首个请求前由就绪中间件幂等建表。
- `server/index.ts` —— 本地入口：加载 `.env` → `bootstrap()` → `app.listen(3007)`。
- `api/index.ts` —— Vercel 函数入口：`export default app` + `config = { runtime: nodejs20.x, maxDuration: 60 }`。
- `server/math/{store,registry,routes,mathagent}.ts` —— 全部 async 化（`await db.*` / `await initRegistry()` 等）。
- `server/math/sandbox.ts` + `server/math/pyodide.ts` —— 执行器选择：本地 CPython / Vercel Pyodide。
- `server/math/py/{runner,guard}.py` —— 兼容 Pyodide 的 stdin/stdout 回退（`sys.stdin.buffer` 缺失时退化为字符串读取）。
- `vercel.json` / `.env.example` —— 本指南的配套配置。

**前端零改动**：它一直用同源的 `/api/...` 相对路径，Vercel 上由 rewrite 统一导流到函数。

---

## 1. 前置条件

1. 一个 [Vercel](https://vercel.com) 账号（Hobby 计划即可起步；数学调查 / 长对话建议 Pro，因为 Hobby 函数上限 ~10s，SSE 可能被截断）。
2. 本地 git 仓库（本项目已是 git 仓库，直接 `git push` 到一个 GitHub / GitLab / Bitbucket 仓库即可用 Vercel 的 Git 集成部署）。
3. 一个 **Turso** 数据库账号（免费层足够）：<https://turso.tech>。或用任意 libSQL 兼容端点（Neon 的 Postgres 不行，必须是 libSQL 协议）。
4. 你的 `CODEBUDDY_API_KEY`（与本地开发相同，必填）。

---

## 2. 创建 Turso 数据库（30 秒）

```bash
# 安装 Turso CLI（一次）
curl -sSfL https://get.tur.so | bash

# 登录（浏览器授权）
turso auth login

# 建库（区域选离你用户近的，如 ap-southeast-1）
turso db create soul-lab --location ap-southeast-1

# 拿到连接串 + 令牌
turso db show soul-lab --url      # 形如 libsql://soul-lab-xxx.turso.io
turso db tokens create soul-lab   # 一长串令牌
```

> 也可在 Vercel 控制台用「Storage → Turso」一站式创建，结果等价。

---

## 3. 在 Vercel 配置环境变量

项目导入后，到 **Settings → Environment Variables** 添加：

| Key | 值 | 作用域 |
| --- | --- | --- |
| `CODEBUDDY_API_KEY` | `ck_xxx.xxx` | Production / Preview / Development |
| `TURSO_URL` | `libsql://soul-lab-xxx.turso.io` | 同上 |
| `TURSO_AUTH_TOKEN` | 上一步的令牌 | 同上 |
| `MATH_EXECUTOR` | `pyodide` | 同上（可选，Vercel 上会自动探测，显式写更稳） |

> 不需要设置 `VERCEL`（Vercel 平台会自动注入 `VERCEL=1`，`sandbox.ts` 据此启用 Pyodide）。
> 不需要设置 `PORT`（函数不监听端口）。

---

## 4. 部署

### 方式 A：Git 集成（推荐，最省心）

1. 把本仓库 push 到 GitHub / GitLab / Bitbucket。
2. Vercel 仪表盘 → **Add New → Project** → 选择该仓库 → **Import**。
3. Framework Preset 选 **Other**（我们已在 `vercel.json` 里写了 `buildCommand` 和 `outputDirectory`，无需预设）。
4. **Deploy**。

### 方式 B：Vercel CLI（本地一条命令）

```bash
npm i -g vercel
vercel login
vercel                      # 首次：按提示关联/新建项目
vercel --prod              # 推生产
```

部署成功后，Vercel 会给出一个 `https://soul-lab-xxx.vercel.app` 域名。打开即前端；所有 `/api/*` 自动走函数。

---

## 5. 部署后验证清单

```bash
BASE=https://soul-lab-xxx.vercel.app

# 1) 健康检查
curl $BASE/api/health

# 2) 数学沙箱自检（应显示 python=pyodide）
curl $BASE/api/math/health

# 3) 工具库（应列出 5 个 Core Instruments）
curl $BASE/api/math/tools

# 4) 会话 CRUD
curl $BASE/api/sessions
```

功能面：
- 聊天页（`/api/chat` SSE）需要 `CODEBUDDY_API_KEY` 命中 CodeBuddy 网关 → 确认该 Key 在你的 Vercel 区域网络可达（见下方「已知限制 ①」）。
- Instrument Workshop 的「调查」走 `/api/math/investigate` SSE，首次会触发 Pyodide 冷启动（见「已知限制 ②」）。

---

## 6. 已知限制 / 必须知道的事

1. **Agent SDK 出口网络**：`/api/chat`、`/api/soul/*` 依赖 `@tencent-ai/agent-sdk` 访问 CodeBuddy 网关。
   请在部署区域确认该网关域名在你的 Vercel 函数网络环境**可达**。若网关仅限中国大陆出口，
   Vercel（默认海外节点）可能超时 —— 这种情况更建议用「本地 / 自有服务器」部署，或把网关走一个你可控的反向代理。
   前端本身、数据库、数学沙箱都不受此限制。

2. **Pyodide 冷启动**：函数冷启动时需从 CDN（jsdelivr）下载 Python wasm 运行时 + 科学计算包
   （numpy / scipy / scikit-learn）。**首次**数学调查可能耗时 5–15s，之后函数实例保温期间很快。
   scipy / sklearn 很重，建议把 `api/index.ts` 的 `maxDuration` 提到 60（已配）并使用 **Pro** 计划。
   如冷启动不可接受，可改为：把 Pyodide 依赖预置到函数目录（设 `indexURL` 指向本地拷贝），代价是函数包更大。

3. **`/tmp` 短暂性**：Vercel 文件系统只读，仅 `/tmp` 可写且**实例级、不跨请求持久**。
   所以聊天历史 / 工具库必须放在外部 DB（Turso）——本改造已强制如此；切勿再依赖本地 `./data`。

4. **`better-sqlite3` 不会被用于 Vercel**：它是动态 `import()`，仅在 `TURSO_URL` 未设置时（本地）加载。
   只要 Vercel 上设了 `TURSO_URL`，该原生模块不会被实例化，也不会拖慢函数。
   Vercel 构建时会尝试追踪该动态 import；若构建报原生模块相关错误，可忽略（运行时不会走到该分支），
   或明确 `vercel.json` 的 `functions[api/index.ts]` 不打包它（进阶，按需）。

5. **最长执行时间**：Hobby 计划函数默认上限约 10s，Pro 可在 `vercel.json` 把 `maxDuration` 提到 60/300。
   长对话与数学调查容易触顶，请用 Pro 或将 `maxDuration` 调大。

---

## 7. 本地开发与 Vercel 互不影响

- 本地：`cp .env.example .env` 填 `CODEBUDDY_API_KEY`，`npm install` 后 `npm run dev`（server 走 SQLite，sandbox 走本地 Python）。
- Vercel：靠环境变量切换后端与执行器，**同一份代码两个世界**。

回滚：本改造向后兼容，未部署前 `npm run dev` 行为与改造前一致（仍是 SQLite + 本地 Python）。

---

## 8. 故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| `/api/health` 200 但其他 500 | Turso 连接失败 | 检查 `TURSO_URL`/`TURSO_AUTH_TOKEN` 是否漏配或拼写错 |
| `/api/math/health` ok=false | Pyodide 加包失败（CDN 不可达） | 检查函数区域到 jsdelivr 的出口；或预置 Pyodide 到本地 |
| `/api/chat` 长时间无响应 | CodeBuddy 网关在 Vercel 区域不可达 | 见限制 ①，考虑改用自有部署或代理 |
| 部署构建失败（better-sqlite3） | 构建追踪到原生模块 | 确认 Vercel 上设了 `TURSO_URL`；必要时排除该模块 |
| 数学调查被截断 | 函数超时（Hobby 上限） | 升级 Pro 并调大 `maxDuration` |
