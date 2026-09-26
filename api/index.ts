/**
 * api/index.ts —— Vercel Serverless 函数入口
 *
 * Vercel 会把 api/ 目录下的文件编译成函数。本文件复用 server/app.ts 装配好的
 * Express 应用（含全部 /api/* 路由），导出为默认处理函数。所有 /api/* 请求都会
 * 进入这个单一函数，再由 Express 内部的路由分发。
 *
 * 注意：
 * - 不要在这里调用 app.listen（Serverless 环境里没有常驻端口）。
 * - DB 建表由 app.ts 内的就绪中间件保证（首个请求前执行）。
 * - 数学层在 Vercel 上通过 Pyodide 在进程内运行 Python 仪器（见 server/math/sandbox.ts）；
 *   设置 MATH_EXECUTOR=pyodide 可强制启用，默认会自动探测。
 */
import { app } from "../server/app.js";

// Vercel Node 函数配置
// - 不指定 runtime：文件级 config.runtime 只认 "nodejs"/"edge"/"experimental-edge"，
//   vercel.json 的 functions.runtime 只认 "name@version" 格式 —— 两处都塞不下 "nodejs20.x"。
//   api/*.ts 由 Vercel 自动按 Node 函数构建，用平台默认 Node 版本即可（本项目不挑小版本）。
// - maxDuration：流式 SSE（聊天 / 数学调查）可能需要较长时间，建议 Pro 计划；
//   若在 Hobby 计划上部署，请改为 10（但数学调查与长对话可能被提前截断）。
export const config = {
  maxDuration: 60,
};

export default app;
