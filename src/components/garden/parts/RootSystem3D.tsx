/**
 * RootSystem3D —— Baseline 根系。
 *
 * 每一个明确 baseline 对应一条根系分支。
 * 没有绑定论文/协议的 baseline：短、淡、断续；绑定后变粗并显示标签。
 * 根越清楚，说明对照关系越清楚。
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hashUnit } from '../../../lib/garden/layout';
import type { Baseline } from '../../../lib/types';

interface RootSystem3DProps {
  soulId: string;
  baselines: Baseline[];
  hoveredBaselineId: string | null;
  onHoverBaseline: (id: string | null) => void;
  onSelectBaseline: (id: string) => void;
}

export function RootSystem3D({
  soulId,
  baselines,
  hoveredBaselineId,
  onHoverBaseline,
  onSelectBaseline,
}: RootSystem3DProps) {
  if (baselines.length === 0) {
    // 没有 baseline：根部短、淡、断续
    return (
      <group>
        <mesh position={[0, 0.03, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.035, 0.06, 0.2, 8]} />
          <meshStandardMaterial color="#6B5843" roughness={0.95} transparent opacity={0.45} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      {/* 根基座 */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <sphereGeometry args={[0.17, 16, 12]} />
        <meshStandardMaterial color="#8A6B4A" roughness={0.95} />
      </mesh>

      {baselines.map((b, i) => (
        <RootBranch
          key={b.id}
          soulId={soulId}
          baseline={b}
          index={i}
          total={baselines.length}
          highlighted={hoveredBaselineId === b.id}
          onHover={onHoverBaseline}
          onSelect={onSelectBaseline}
        />
      ))}
    </group>
  );
}

function RootBranch({
  soulId,
  baseline,
  index,
  total,
  highlighted,
  onHover,
  onSelect,
}: {
  soulId: string;
  baseline: Baseline;
  index: number;
  total: number;
  highlighted: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);

  // 每条根从基座向外下方伸展，方位角按序号均分
  const curve = useMemo(() => {
    const a = (index / Math.max(total, 1)) * Math.PI * 2 + hashUnit(soulId, index + 60) * 0.6;
    const reach = baseline.bound ? 0.72 : 0.34;
    const depth = baseline.bound ? 0.5 : 0.2;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(Math.cos(a) * reach * 0.45, -depth * 0.35, Math.sin(a) * reach * 0.45),
      new THREE.Vector3(Math.cos(a) * reach, -depth, Math.sin(a) * reach),
      new THREE.Vector3(Math.cos(a) * reach * 1.35, -depth * 1.5, Math.sin(a) * reach * 1.35),
    ]);
  }, [soulId, index, total, baseline.bound]);

  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 16, baseline.bound ? 0.022 : 0.011, 6, false),
    [curve, baseline.bound],
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = (ref.current.children[0] as THREE.Mesh | undefined)?.material as
      | THREE.MeshStandardMaterial
      | undefined;
    if (!mat) return;
    const base = baseline.bound ? 0.95 : 0.4;
    const pulse = highlighted ? 0.35 + Math.sin(clock.getElapsedTime() * 4) * 0.15 : 0;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, base + pulse, 0.12);
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, highlighted ? 0.6 : 0.05, 0.12);
  });

  return (
    <group ref={ref}>
      <mesh
        geometry={geometry}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(baseline.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(baseline.id);
        }}
      >
        <meshStandardMaterial
          color={baseline.bound ? '#C9A47B' : '#9C7A58'}
          emissive="#C9A47B"
          emissiveIntensity={0.05}
          roughness={0.85}
          transparent
          opacity={baseline.bound ? 0.95 : 0.42}
        />
      </mesh>
    </group>
  );
}
