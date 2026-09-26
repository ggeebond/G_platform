/**
 * Evidence Package → 确定性文本摘要（给 Evidence Reviewer 的 Data Brief）
 *
 * 关键变化：LLM（Evidence Reviewer）看到的不再是 mean/std/delta 的裸统计，
 * 而是仪器层的结构化证据 + Mathematical Scientist 的解读；原始数据不进 prompt。
 */
import type { EvidencePackage } from '../../../shared/schemas';

export function evidencePackageToBrief(pkg: EvidencePackage): string {
  const lines: string[] = [];

  lines.push('[Evidence Package · 由 Mathematical Instrument Layer 生成]');
  if (pkg.fallback) {
    lines.push('（注意：LLM 不可用，本包由 Core Instruments 确定性计算，未经 Mathematical Scientist 解读）');
  }

  lines.push('');
  lines.push(`结论：${pkg.finding}`);

  if (pkg.rounds.length > 0) {
    lines.push('');
    lines.push('测量记录：');
    for (const r of pkg.rounds) {
      lines.push(`- ${r.tool_id} v${r.tool_version}（${r.question}）`);
      lines.push(`  输出：${JSON.stringify(r.outputs).slice(0, 400)}`);
      if (r.code_hash) lines.push(`  溯源：code_hash=${r.code_hash}`);
    }
  }

  if (pkg.hypothesesVerdicts.length > 0) {
    lines.push('');
    lines.push('假设判定：');
    for (const h of pkg.hypothesesVerdicts) {
      lines.push(`- ${h.id} [${h.status}] ${h.statement}${h.evidence ? `（证据：${h.evidence}）` : ''}`);
    }
  }

  if (pkg.interpretation) {
    lines.push('');
    lines.push(`解读：${pkg.interpretation}`);
  }

  lines.push('');
  lines.push(`confidence：${pkg.confidence}`);

  return lines.join('\n');
}
