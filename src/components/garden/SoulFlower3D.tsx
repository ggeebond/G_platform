/**
 * SoulFlower3D —— 一株程序化的 Soul Flower。
 *
 * 不建复杂模型：Stem + Bud + Petal[] + Leaf[] + RootSystem 动态组合，
 * 花瓣数与黄叶数直接由 State Engine 的状态驱动 —— 实验越多，花真的越开。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Stem3D } from './parts/Stem3D';
import { Bud3D } from './parts/Bud3D';
import { Petal3D } from './parts/Petal3D';
import { Leaf3D } from './parts/Leaf3D';
import { RootSystem3D } from './parts/RootSystem3D';
import { ResearchPlot } from './ResearchPlot';
import { PaperOrbit3D } from './PaperOrbit3D';
import { useGardenStore } from '../../stores/gardenStore';
import { leafSeverity } from '../../lib/garden/garden';
import { clamp01 } from '../../lib/garden/animation';
import { hashUnit, petalFocusPose } from '../../lib/garden/layout';
import type { GardenPlot } from '../../lib/garden/types';
import type { SoulDoc } from '../../lib/types';

/** 稳定的空集合：避免每次渲染都新建 Set 触发子组件更新 */
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

interface SoulFlower3DProps {
  plot: GardenPlot;
  doc: SoulDoc;
  /** 是否处于被聚焦状态（Garden / Flower / Petal） */
  focused: boolean;
  /** 花园里是否已经有别的花被聚焦 —— 其余植株退到背景 */
  receded: boolean;
  onSelect: () => void;
  onFocusPetal: (petalId: string) => void;
  onFocusLeaf: (leafId: string) => void;
  onFocusBaseline: (baselineId: string) => void;
  onFocusBud: () => void;
}

export function SoulFlower3D({
  plot,
  doc,
  focused,
  receded,
  onSelect,
  onFocusPetal,
  onFocusLeaf,
  onFocusBaseline,
  onFocusBud,
}: SoulFlower3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);

  const [hovered, setHovered] = useState(false);
  const [hoveredBaselineId, setHoveredBaselineId] = useState<string | null>(null);

  const cameraMode = useGardenStore((s) => s.cameraMode);
  const focusedPetalId = useGardenStore((s) => s.petalId);
  const celebrationAt = useGardenStore((s) => s.celebrationAt);
  const setHoverSoul = useGardenStore((s) => s.hoverSoul);

  const seed = useMemo(() => hashUnit(plot.id, 81) * Math.PI * 2, [plot.id]);

  /* ---------- 新花瓣 / 新黄叶的识别：只有本轮新长的才播生长动画 ----------
   * 已见过的 id 放在 ref 里（不参与渲染），本轮新增的 id 放进 state，
   * 这样生长动画只会播一次，刷新恢复的历史花瓣不会重播。
   */
  const knownPetals = useRef<Set<string> | null>(null);
  const knownLeaves = useRef<Set<string> | null>(null);
  if (knownPetals.current === null) knownPetals.current = new Set(doc.petals.map((p) => p.id));
  if (knownLeaves.current === null) knownLeaves.current = new Set(doc.leaves.map((l) => l.id));

  const [newbornPetals, setNewbornPetals] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [newbornLeaves, setNewbornLeaves] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [streamAt, setStreamAt] = useState(0);

  useEffect(() => {
    const fresh = doc.petals.filter((p) => !knownPetals.current!.has(p.id));
    if (fresh.length === 0) return;
    fresh.forEach((p) => knownPetals.current!.add(p.id));
    setNewbornPetals(new Set(fresh.map((p) => p.id)));
    // 流光时刻：花心变亮 + 一道光沿茎上行
    setStreamAt(performance.now());
  }, [doc.petals]);

  useEffect(() => {
    const fresh = doc.leaves.filter((l) => !knownLeaves.current!.has(l.id));
    if (fresh.length === 0) return;
    fresh.forEach((l) => knownLeaves.current!.add(l.id));
    setNewbornLeaves(new Set(fresh.map((l) => l.id)));
  }, [doc.leaves]);

  /* ---------- Petal Focus：花心转到让该花瓣正对镜头 ---------- */
  const focusTarget = useMemo(() => {
    if (cameraMode !== 'petal' || !focusedPetalId) return null;
    const index = doc.petals.findIndex((p) => p.id === focusedPetalId);
    if (index < 0) return null;
    return petalFocusPose(plot.position, index, doc.petals.length);
  }, [cameraMode, focusedPetalId, doc.petals, plot.position]);

  const damped = focused;

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const g = groupRef.current;
    if (!g) return;

    /* ---------- 自主摆动（每株不同相位，绝不同步） ---------- */
    const swayAmp = damped ? 0.012 : 0.07;
    const idleY = Math.sin(t * 0.24 + seed) * swayAmp;

    if (focusTarget) {
      // Petal Focus：花心转向花瓣，同时收敛摆动
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, focusTarget.targetRotY, 1 - Math.exp(-4.2 * delta));
    } else {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, idleY, 1 - Math.exp(-2.4 * delta));
    }

    g.rotation.x = Math.sin(t * 0.31 + seed * 1.4) * (damped ? 0.004 : 0.022);

    /* ---------- 花瓣实体化：花朵轻微抬头 ---------- */
    if (celebrationAt > 0) {
      const e = performance.now() - celebrationAt;
      if (e < 1800) {
        g.rotation.x -= Math.sin(clamp01(e / 1800) * Math.PI) * 0.055;
      }
    }

    /* ---------- Hover：它注意到我了 ---------- */
    const hoverScale = hovered && !receded ? 1.035 : 1;
    const recedeScale = receded ? 0.93 : 1;
    const targetScale = hoverScale * recedeScale;
    const s = THREE.MathUtils.lerp(g.scale.x, targetScale, 1 - Math.exp(-6 * delta));
    g.scale.setScalar(s);

    // 退到背景的植株稍微下沉，配合雾效形成纵深
    const targetY = receded ? -0.12 : 0;
    g.position.y = THREE.MathUtils.lerp(g.position.y, targetY, 1 - Math.exp(-4 * delta));
  });

  const openness = Math.min(plot.solid / 4, 1);
  const waitingExperimentIds = useMemo(
    () => new Set(doc.experiments.filter((e) => e.status === 'designAccepted').map((e) => e.id)),
    [doc.experiments],
  );

  return (
    <group ref={groupRef} position={plot.position}>
      <group
        ref={innerRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          setHoverSoul(plot.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          setHoverSoul(null);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <ResearchPlot
          plotId={plot.id}
          accent={plot.accent}
          focused={cameraMode === 'petal' && focused}
          hovered={hovered}
        />

        <RootSystem3D
          soulId={plot.id}
          baselines={doc.baselines}
          hoveredBaselineId={hoveredBaselineId}
          onHoverBaseline={setHoveredBaselineId}
          onSelectBaseline={onFocusBaseline}
        />

        {/* hover 时花心也朝镜头轻微倾斜 ——「它注意到我了」 */}
        {/* 花茎 = 植物主体绿；花蕾 = Soul 的青柠 → 金（全园统一语义，个体差异保留在候选花瓣上） */}
        <Stem3D soulId={plot.id} accent="#22C55E" streamAt={streamAt} damped={focused || hovered} />

        <Bud3D
          soulId={plot.id}
          stage={plot.stage}
          accent="#A3E635"
          hovered={hovered}
          focused={focused && cameraMode === 'petal'}
          streamAt={streamAt}
          onFocus={onFocusBud}
        />

        {doc.petals.map((p, i) => (
          <Petal3D
            key={p.id}
            soulId={plot.id}
            petalId={p.id}
            index={i}
            total={doc.petals.length}
            status={p.status}
            accent={plot.accent}
            stage={plot.stage}
            openness={openness}
            newborn={newbornPetals.has(p.id)}
            waiting={waitingExperimentIds.has(p.experimentId)}
            label={p.label}
            onFocus={() => onFocusPetal(p.id)}
          />
        ))}

        {doc.leaves.map((l, i) => (
          <Leaf3D
            key={l.id}
            soulId={plot.id}
            leafId={l.id}
            index={i}
            status={l.status}
            severity={leafSeverity(doc, l)}
            side={l.side}
            attachY={l.attachY}
            newborn={newbornLeaves.has(l.id)}
            label={l.label}
            onFocus={() => onFocusLeaf(l.id)}
          />
        ))}
      </group>

      {/* Research Orbit 只给被聚焦的花渲染 —— 性能与叙事都更干净 */}
      <PaperOrbit3D
        soulId={plot.id}
        papers={doc.papers}
        accent={plot.accent}
        active={focused}
        petalIds={doc.petals.map((p) => p.id)}
        onSelect={(paperId) => {
          useGardenStore.getState().focusPaper(plot.id, paperId);
        }}
      />
    </group>
  );
}
