/**
 * index.ts —— 本地开发 / 自托管入口
 *
 * 只负责「启动」：加载 .env、建表、监听端口。应用本身在 app.ts 里装配，
 * Vercel 部署时由 api/index.ts 作为 Serverless 函数复用同一份 app。
 */
import { app, bootstrap } from "./app.js";

// 本地开发：存在 .env 就加载（Node 20.6+ 原生能力，无需额外依赖）。
// 安全约定：API Key 只存在于服务端进程环境变量里，绝不进前端打包产物。
try {
  process.loadEnvFile?.();
} catch {
  /* 没有 .env 文件时忽略，走 CLI 登录或外部注入的环境变量 */
}

const PORT = process.env.PORT || 3007;

await bootstrap();

app.listen(PORT, () => {
  const dbKind = process.env.TURSO_URL ? "Turso (libSQL)" : "SQLite (data/chat.db)";
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ API 服务器已启动                      ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库: ${dbKind}          ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});
