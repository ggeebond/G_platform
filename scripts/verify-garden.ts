/**
 * Soul Lab — 花园数据层自检
 *
 * 这些是纯函数，可以在没有浏览器的环境下验证：
 * 花园结构、Lineage 推导、d3-force 光球布局、Petal Focus 位姿、Journal 翻译、状态机。
 *
 *   npm run verify
 */
import { createSeedGarden } from '../src/lib/data/seed';
import { buildGarden, leafSeverity, plotAlert, stageOf } from '../src/lib/garden/garden';
import { computeOrbTargets, petalFocusPose, petalRingAngle, CORE_Y, PETAL_RADIUS } from '../src/lib/garden/layout';
import { groupByDay, toJournal } from '../src/lib/garden/journal';
import { applyEvent } from '../src/lib/state/soul-machine';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
}

const docs = createSeedGarden();
const garden = buildGarden(docs);

console.log('\n=== PLOTS ===');
for (const p of garden.plots) {
  console.log(
    `  ${p.stage.padEnd(8)} ${p.id.padEnd(24)} pos=[${p.position.map((n) => n.toFixed(2)).join(', ')}] ` +
      `solid=${p.solid} cand=${p.candidate} leaf=${p.leaves} :: ${plotAlert(p) ?? '-'}`,
  );
}

console.log('\n=== CLUSTERS ===');
for (const c of garden.clusters) {
  console.log(`  ${c.id.padEnd(12)} "${c.label}" -> ${c.soulIds.length} souls`);
}

console.log('\n=== LINEAGE ===');
for (const l of garden.lineages) {
  console.log(
    `  ${l.strength.toFixed(2)} ${l.relation.padEnd(9)} ` +
      `${l.from.replace('soul_', '')} <-> ${l.to.replace('soul_', '')} :: ${l.reason}`,
  );
}

console.log('\n=== ORB TARGETS (d3-force) ===');
const orbs = computeOrbTargets(docs[0].papers, [0, CORE_Y, 0]);
for (const o of orbs) {
  console.log(`  ${o.paperId.padEnd(32)} ${o.position.map((n) => n.toFixed(2)).join(', ')}`);
}

console.log('\n=== PETAL FOCUS ===');
const plot0 = garden.plots[0];
const poses = [0, 1, 2].map((i) => petalFocusPose(plot0.position, i, 3));
poses.forEach((p, i) => {
  console.log(
    `  petal ${i}: rotY=${p.targetRotY.toFixed(2)} eye=[${p.eye.map((n) => n.toFixed(2)).join(', ')}] ` +
      `look=[${p.lookAt.map((n) => n.toFixed(2)).join(', ')}]`,
  );
});

console.log('\n=== JOURNAL ===');
for (const grp of groupByDay(toJournal(docs[0].timeline))) {
  console.log(`  -- ${grp.label}`);
  for (const e of grp.items) console.log(`     ${e.glyph} ${e.text}`);
}

console.log('\n=== LEAF SEVERITY ===');
for (const doc of docs) {
  for (const leaf of doc.leaves) {
    console.log(`  ${leafSeverity(doc, leaf).padEnd(12)} ${doc.soul.id.replace('soul_', '')} :: ${leaf.label}`);
  }
}

console.log('\n=== ORB ANCHORING（与花瓣相关的论文应被吸附）===');
const anchorDoc = docs.find((d) => d.papers.some((p) => p.relatedPetalId))!;
const azimuthMap: Record<string, number> = {};
anchorDoc.papers.forEach((p) => {
  if (!p.relatedPetalId) return;
  const idx = anchorDoc.petals.findIndex((x) => x.id === p.relatedPetalId);
  if (idx >= 0) azimuthMap[p.paperId] = petalRingAngle(idx, anchorDoc.petals.length);
});
const anchored = computeOrbTargets(anchorDoc.papers, [0, CORE_Y, 0], 0.7, azimuthMap);
for (const o of anchored) {
  const az = azimuthMap[o.paperId];
  const orbAz = Math.atan2(o.position[2], o.position[0]);
  const diff = az === undefined ? null : Math.abs(Math.atan2(Math.sin(orbAz - az), Math.cos(orbAz - az)));
  console.log(
    `  ${o.paperId.padEnd(32)} anchored=${String(o.anchoredToPetal).padEnd(5)}` +
      (diff === null ? '' : ` 与花瓣方位角偏差 ${((diff * 180) / Math.PI).toFixed(1)}°`),
  );
}

console.log('\n=== ASSERTIONS ===');
check('花园包含全部 6 个 Soul', garden.plots.length === 6, `got ${garden.plots.length}`);
check('每个 Soul 都落在某个花圃里', garden.plots.every((p) => garden.clusters.some((c) => c.id === p.clusterId)));
check('同一花圃内花朵不重叠', garden.clusters.every((c) => {
  const ps = garden.plots.filter((p) => p.clusterId === c.id);
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const dx = ps[i].position[0] - ps[j].position[0];
      const dz = ps[i].position[2] - ps[j].position[2];
      if (Math.hypot(dx, dz) < 1.2) return false;
    }
  return true;
}));
check('Lineage 数量受控（<= 8）', garden.lineages.length <= 8, `got ${garden.lineages.length}`);
check('Lineage 两端都是真实存在的 Soul', garden.lineages.every((l) => garden.byId[l.from] && garden.byId[l.to]));
check('知识球互相不重叠', orbs.every((a, i) =>
  orbs.every((b, j) => i === j || Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]) > 0.5)));
check('知识球都在花心周围的球壳上', orbs.every((o) =>
  Math.hypot(o.position[0], o.position[2]) > PETAL_RADIUS && Math.hypot(o.position[0], o.position[2]) < o.shell * 1.6));
check('每片花瓣的取景位姿互不相同', new Set(poses.map((p) => p.targetRotY.toFixed(3))).size === 3);
check('取景点在花心之外（对准花瓣本体）', poses.every((p) =>
  Math.hypot(p.lookAt[0] - plot0.position[0], p.lookAt[2] - plot0.position[2]) > PETAL_RADIUS));

let doc = docs[0];
const candidate = doc.petals.find((p) => p.status === 'candidate')!;
const accepted = applyEvent(doc, {
  type: 'EVIDENCE_ACCEPTED', actor: 'user', experimentId: candidate.experimentId,
  review: { verdict: 'accepted', rationale: 'r', dataBrief: 'd', aiView: 'a', humanView: 'h', conditions: [], confidence: 0.9, suggestedNext: 's' },
});
check('EVIDENCE_ACCEPTED 把 candidate 变成 solid',
  accepted.petals.find((p) => p.id === candidate.id)!.status === 'solid');
check('状态变更写入 Timeline', accepted.timeline.length === doc.timeline.length + 1);
check('非法事件不改变状态（F1）', applyEvent(accepted, { type: 'NOPE' } as never) === accepted);
check('重复内容的事件不产生副作用',
  applyEvent(accepted, { type: 'PAPER_ADDED_TO_MEMORY', actor: 'user', paperId: 'W_adaptive_chunk_2024' })
    .papers.filter((p) => p.paperId === 'W_adaptive_chunk_2024' && p.inMemory).length === 1);

check('每片黄叶都有确定性的严重程度',
  docs.every((d) => d.leaves.every((l) => ['limitation', 'weakening', 'refutation'].includes(leafSeverity(d, l)))));
check('同一株花在两处推导出同一个 stage（FlowerPanel 与花园一致）',
  docs.every((d) => garden.plots.find((p) => p.id === d.soul.id)!.stage === stageOf(d)));
check('与花瓣相关的知识球确实被吸附（方位角偏差 < 35°）',
  anchored.every((o) => {
    const az = azimuthMap[o.paperId];
    if (az === undefined) return !o.anchoredToPetal;
    const orbAz = Math.atan2(o.position[2], o.position[0]);
    const diff = Math.abs(Math.atan2(Math.sin(orbAz - az), Math.cos(orbAz - az)));
    return o.anchoredToPetal && diff < (35 * Math.PI) / 180;
  }));
check('未被吸附的知识球保持 shell 半径（不会被误拉走）',
  anchored.filter((o) => !o.anchoredToPetal).every((o) =>
    Math.abs(Math.hypot(o.position[0], o.position[2]) - o.shell) < o.shell * 0.55));

console.log(`\n${failures === 0 ? '全部通过' : `${failures} 项失败`}\n`);
process.exit(failures === 0 ? 0 : 1);
