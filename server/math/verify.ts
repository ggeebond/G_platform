/**
 * Instrument Workshop · verify.ts —— Tool Verifier（确定性关卡，不是 Agent）
 *
 * 为什么必须有它：Mathematical Scientist 与 Toolsmith 都是 LLM，
 * 两个 LLM 之间容易"相互相信"。这一层没有 LLM——
 *   1. static_guard   —— AST 白名单（禁网络/文件/子进程/动态执行）
 *   2. unit_tests     —— 工具自带的全部测试必须通过（且至少有一条）
 *   3. determinism    —— 同输入跑两遍测试，结果集必须一致
 *   4. runtime        —— 沙箱超时上限（30s，由 sandbox.ts 保证）
 *
 * 任何一关不过 → 工具不能进入 Registry。
 */
import type { ToolVerificationReport } from '../../shared/schemas.js';
import { guardCode, runTests } from './sandbox.js';

function report(passed: boolean, checks: ToolVerificationReport['checks'], testsPassed: number, testsTotal: number): ToolVerificationReport {
  return { passed, checks, testsPassed, testsTotal };
}

export async function verifyTool(code: string, testsCode: string): Promise<ToolVerificationReport> {
  const checks: ToolVerificationReport['checks'] = [];

  // ---- 1. 静态守卫 ----
  const guard = await guardCode(code, testsCode);
  checks.push({
    name: 'static_guard',
    passed: guard.ok,
    detail: guard.ok ? 'AST 白名单通过（无网络/文件/子进程/动态执行）'
      : JSON.stringify(guard.violations.slice(0, 5)),
  });
  if (!guard.ok) return report(false, checks, 0, 0);

  // ---- 2. 单元测试（必须存在且全部通过）----
  const t1 = await runTests(code, testsCode);
  const total = t1.tests.length;
  const passedN = t1.tests.filter((x) => x.passed).length;
  const failed = t1.tests.filter((x) => !x.passed);
  checks.push({
    name: 'unit_tests',
    passed: total > 0 && passedN === total,
    detail: total === 0
      ? '没有任何 test_* —— 拒绝（不可验证的工具不存在）'
      : `${passedN}/${total}${failed.length ? '；失败: ' + failed.map((f) => `${f.name}(${f.error})`).join('; ') : ''}`,
  });
  if (total === 0 || passedN < total) return report(false, checks, passedN, total);

  // ---- 3. 确定性（同输入两次运行，通过集一致）----
  const t2 = await runTests(code, testsCode);
  const sig = (ts: typeof t1) => ts.tests.map((x) => `${x.name}:${x.passed}`).join('|');
  const deterministic = sig(t1) === sig(t2);
  checks.push({
    name: 'determinism',
    passed: deterministic,
    detail: deterministic ? '两次运行测试结果一致' : '两次运行结果不一致（可能存在隐藏随机性）',
  });

  return report(deterministic, checks, passedN, total);
}
