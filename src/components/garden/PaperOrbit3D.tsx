/**
 * PaperOrbit3D —— Research Orbit。
 *
 * 外部论文不变成花，而是围绕当前 Soul Flower 漂浮的知识球（Knowledge Pollen）。
 * 位置由 d3-force 在球壳上求解（见 lib/garden/layout.ts），渲染层只负责
 * 让每个球「缓慢漂移着靠近它的目标」——不是标准圆轨道，也不会乱飞。
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGardenStore } from '../../stores/gardenStore';
import { clamp01, easeOutCubic } from '../../lib/garden/animation';
import { computeOrbTargets, CORE_Y, hashUnit, petalRingAngle } from '../../lib/garden/layout';
import { ORB_IDENTITY_META, orbIdentityOf } from '../../lib/garden/orbIdentity';
import type { PaperInsight } from '../../lib/types';

/* Orb 身份（PRD FR-M4）由 lib/garden/orbIdentity.ts 确定性派生，不再按 relationType 直接取色 */

interface PaperOrbit3DProps {
  soulId: string;
  papers: PaperInsight[];
  accent: string;
  /** 只有被聚焦的那株花才渲染轨道，保证性能 */
  active: boolean;
  /** 这株花的花瓣 id 顺序，用于把论文吸附到对应花瓣上 */
  petalIds: string[];
  onSelect: (paperId: string) => void;
}

export function PaperOrbit3D({ soulId, papers, accent, active, petalIds, onSelect }: PaperOrbit3DProps) {
  // 与某片花瓣相关的论文会被吸附到那片花瓣的方位角上
  const petalAzimuth = useMemo(() => {
    const m: Record<string, number> = {};
    papers.forEach((p) => {
      if (!p.relatedPetalId) return;
      const idx = petalIds.indexOf(p.relatedPetalId);
      if (idx >= 0) m[p.paperId] = petalRingAngle(idx, petalIds.length);
    });
    return m;
  }, [papers, petalIds]);

  // 论文集合变化时用 d3-force 重新求解目标位置（确定性）
  const targets = useMemo(
    () =>
      computeOrbTargets(
        papers,
        [0, CORE_Y, 0],
        hashUnit(soulId, 77) * Math.PI * 2,
        petalAzimuth,
      ),
    [papers, soulId, petalAzimuth],
  );

  const targetMap = useMemo(() => {
    const m: Record<string, [number, number, number]> = {};
    targets.forEach((t) => {
      m[t.paperId] = t.position;
    });
    return m;
  }, [targets]);

  // 本轮新检索到的论文 → 从画布边缘飞入
  const known = useRef<Set<string> | null>(null);
  if (known.current === null) known.current = new Set(papers.map((p) => p.paperId));
  const newborn = useMemo(() => {
    const fresh = new Set<string>();
    papers.forEach((p) => {
      if (!known.current!.has(p.paperId)) fresh.add(p.paperId);
    });
    return fresh;
  }, [papers]);

  useEffect(() => {
    papers.forEach((p) => known.current!.add(p.paperId));
  }, [papers]);

  if (!active || papers.length === 0) return null;

  return (
    <group>
      {papers.map((p) => {
        const target = targetMap[p.paperId];
        if (!target) return null;
        return (
          <PaperOrb
            key={p.paperId}
            soulId={soulId}
            paper={p}
            target={target}
            accent={accent}
            newborn={newborn.has(p.paperId)}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

function PaperOrb({
  soulId,
  paper,
  target,
  accent,
  newborn,
  onSelect,
}: {
  soulId: string;
  paper: PaperInsight;
  target: [number, number, number];
  accent: string;
  newborn: boolean;
  onSelect: (paperId: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const setHoverOrb = useGardenStore((s) => s.hoverOrb);
  const hovered = useGardenStore((s) => s.hoveredOrbId === paper.paperId);

  const identity = orbIdentityOf(paper);
  const meta = ORB_IDENTITY_META[identity];
  const color = meta.color;
  const seed = useMemo(() => hashUnit(paper.paperId, 13) * Math.PI * 2, [paper.paperId]);
  const drift = useMemo(
    () =>
      new THREE.Vector3(
        (hashUnit(paper.paperId, 14) - 0.5) * 0.24,
        (hashUnit(paper.paperId, 15) - 0.5) * 0.2,
        (hashUnit(paper.paperId, 16) - 0.5) * 0.24,
      ),
    [paper.paperId],
  );

  // 飞入动画的起始时刻
  const flyIn = useRef({ t: newborn ? -1 : 0, from: new THREE.Vector3() });
  const current = useRef(new THREE.Vector3(...target));

  /* ---------- 尾迹：记录最近若干帧的位置，画一条快速淡出的轨迹 ---------- */
  const TRAIL = 10;
  const trailLine = useMemo(() => {
    const positions = new Float32Array(TRAIL * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.raycast = () => {};
    line.frustumCulled = false;
    return line;
  }, [color]);
  const trailBuf = useRef<THREE.Vector3[]>([]);

  useMemo(() => {
    if (newborn) {
      // 从画布边缘进入
      const a = hashUnit(paper.paperId, 17) * Math.PI * 2;
      flyIn.current.from.set(Math.cos(a) * 14, 5 + hashUnit(paper.paperId, 18) * 3, Math.sin(a) * 14);
      current.current.copy(flyIn.current.from);
    }
  }, [newborn, paper.paperId]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const g = groupRef.current;
    if (!g) return;

    const targetVec = new THREE.Vector3(...target).addScaledVector(
      drift,
      Math.sin(t * 0.35 + seed),
    );

    const f = flyIn.current;
    if (f.t === -1) f.t = performance.now();

    if (f.t > 0) {
      const e = performance.now() - f.t;
      const dur = 1200 + hashUnit(paper.paperId, 19) * 600; // 1.2 ~ 1.8s
      const p = clamp01(e / dur);
      if (p < 1) {
        const from = f.from.clone().lerp(targetVec, easeOutCubic(p * 0.35));
        current.current.lerpVectors(from, targetVec, easeOutCubic(p));
      } else {
        f.t = 0;
      }
    } else {
      // 缓慢漂移靠近目标（不是硬跟随，所以有「活着」的感觉）
      current.current.lerp(targetVec, 1 - Math.exp(-1.6 * Math.min(delta, 0.05)));
    }

    g.position.copy(current.current);
    const bob = Math.sin(t * 0.6 + seed) * 0.05;
    g.position.y += bob;

    /* ---------- 尾迹：只在飞入过程中可见 ---------- */
    if (f.t > 0) {
      const buf = trailBuf.current;
      buf.unshift(g.position.clone());
      if (buf.length > TRAIL) buf.pop();

      const attr = trailLine.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < TRAIL; i++) {
        const v = buf[Math.min(i, buf.length - 1)];
        attr.setXYZ(i, v.x, v.y, v.z);
      }
      attr.needsUpdate = true;
      (trailLine.material as THREE.LineBasicMaterial).opacity = 0.55;
    } else if ((trailLine.material as THREE.LineBasicMaterial).opacity > 0) {
      const m = trailLine.material as THREE.LineBasicMaterial;
      m.opacity = Math.max(0, m.opacity - delta * 2.5);
    }

    // 刚被检索到：脉冲
    const fresh = paper.discoveredAt > Date.now() - 60_000;
    const pulse = fresh ? 0.5 + Math.sin(t * 3.2 + seed) * 0.5 : 0;

    if (coreRef.current) {
      const s = (paper.inMemory ? 0.105 : 0.085) * (hovered ? 1.35 : 1) * (1 + pulse * 0.18);
      coreRef.current.scale.setScalar(THREE.MathUtils.lerp(coreRef.current.scale.x, s / 0.09, 0.14));
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        (paper.inMemory ? 0.85 : 0.5) + pulse * 0.9 + (hovered ? 0.6 : 0),
        0.14,
      );
    }

    if (haloRef.current) {
      const hm = haloRef.current.material as THREE.MeshBasicMaterial;
      const base = identity === 'challenge' ? 0.3 : identity === 'signal' ? 0.26 : 0.2;
      hm.opacity = THREE.MathUtils.lerp(hm.opacity, base + pulse * 0.35 + (hovered ? 0.3 : 0), 0.12);
      haloRef.current.scale.setScalar(2.4 + Math.sin(t * 1.3 + seed) * 0.12);
    }
  });

  return (
    <>
      {/* 尾迹的顶点记录的是轨道坐标系下的位置，所以必须放在 orb 的变换 group 之外 */}
      <primitive object={trailLine} />

      <group ref={groupRef} position={target}>
      <mesh
        ref={coreRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoverOrb(paper.paperId);
          useGardenStore.getState().setHoveredNode({ kind: 'paper', id: paper.paperId });
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHoverOrb(null);
          useGardenStore.getState().setHoveredNode(null);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          // 聚焦态：右侧 Inspector 锁定这篇论文（花园态仍走 PaperCardOverlay）
          useGardenStore.getState().selectNode({ kind: 'paper', id: paper.paperId });
          onSelect(paper.paperId);
        }}
      >
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* 光晕：只给知识球和 Soul Core 做 Bloom */}
      <mesh ref={haloRef} raycast={() => null}>
        <sphereGeometry args={[0.09, 14, 10]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Challenge：琥珀色外环 */}
      {meta.ring && (
        <mesh rotation={[Math.PI / 2.6, 0.4, 0]} raycast={() => null}>
          <torusGeometry args={[0.155, 0.008, 8, 32]} />
          <meshBasicMaterial
            color={meta.ring}
            transparent
            opacity={0.75}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 已进入 Soul Memory：一圈实心轨道 */}
      {paper.inMemory && (
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <torusGeometry args={[0.145, 0.006, 6, 28]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 左侧 3D 世界不放文字：hover 信息全部走右侧 Research Inspector */}
      </group>
    </>
  );
}
