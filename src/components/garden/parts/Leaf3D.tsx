/**
 * Leaf3D —— 削弱结论的实验，是研究边界而不是惩罚。
 *
 * 生长动画：小芽 → 展开 →（暂时绿色）→ 黄绿 → 枯黄 → 下垂。
 * 已解决的黄叶不会恢复成鲜绿，而是变成金绿色 —— 表示「已经理解了这个失败」。
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGardenStore } from '../../../stores/gardenStore';
import { clamp01, easeOutCubic, IDLE, phase, YELLOW_LEAF_BIRTH } from '../../../lib/garden/animation';
import { hashUnit, LEAF_BASE_Y } from '../../../lib/garden/layout';
import { LEAF_SEVERITY_META, type LeafSeverity } from '../../../lib/garden/garden';
import type { LeafStatus } from '../../../lib/types';

const GREEN = new THREE.Color('#65C98C');
const OLIVE = new THREE.Color('#A8A24E');
const GOLD_GREEN = new THREE.Color('#B9C46A'); // 已解决：理解了失败
const ARCHIVED = new THREE.Color('#6B6350');

/** 三种研究边界对应三种成熟色：条件限制 / 削弱结论 / 严重反证 */
const SEVERITY_COLOR: Record<LeafSeverity, THREE.Color> = {
  limitation: new THREE.Color('#65C98C'),
  weakening: new THREE.Color('#D8B652'),
  refutation: new THREE.Color('#9C7A58'),
};

/** 越重的反证，叶子垂得越低 */
const SEVERITY_DROOP: Record<LeafSeverity, number> = {
  limitation: 8,
  weakening: 11,
  refutation: 14,
};

let cachedLeafGeometry: THREE.ExtrudeGeometry | null = null;

function leafGeometry(): THREE.ExtrudeGeometry {
  if (cachedLeafGeometry) return cachedLeafGeometry;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.2, 0.16, 0.24, 0.5, 0, 0.72);
  shape.bezierCurveTo(-0.24, 0.5, -0.2, 0.16, 0, 0);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
    curveSegments: 10,
  });
  // 叶面轻微下弯
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(pos.getY(i), 0) / 0.72;
    pos.setZ(i, pos.getZ(i) - t * t * 0.1);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  cachedLeafGeometry = g;
  return g;
}

interface Leaf3DProps {
  soulId: string;
  leafId: string;
  index: number;
  status: LeafStatus;
  severity: LeafSeverity;
  side: 1 | -1;
  attachY: number;
  newborn: boolean;
  label: string;
  onFocus: () => void;
}

export function Leaf3D({
  leafId,
  index,
  status,
  severity,
  side,
  attachY,
  newborn,
  label,
  onFocus,
}: Leaf3DProps) {
  const outerRef = useRef<THREE.Group>(null);
  const droopRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const hovered = useGardenStore((s) => s.hoveredPetalId === leafId);
  const setHoveredPetal = useGardenStore((s) => s.hoverPetal);

  const geometry = useMemo(() => leafGeometry(), []);
  const seed = useMemo(() => hashUnit(leafId, 11) * Math.PI * 2, [leafId]);

  // attachY 来自 State Engine 的 leafLayout（像素量纲），这里换算到花茎上的高度
  const y = useMemo(() => {
    const raw = (attachY - 332) / 44; // 第几片叶
    return LEAF_BASE_Y + raw * 0.34;
  }, [attachY]);

  const birth = useRef({ t: -1, active: false });
  const baseDroop = useMemo(
    () => (SEVERITY_DROOP[severity] + hashUnit(leafId, 5) * 3) * (Math.PI / 180),
    [leafId, severity],
  );

  // 父组件在叶片已经渲染之后才标记 newborn，所以要响应 false → true 的变化。
  // t === -1 保证生长动画只播一次。
  useEffect(() => {
    if (newborn && birth.current.t === -1) birth.current.active = true;
  }, [newborn]);

  const targetColor = useMemo(() => {
    if (status === 'resolved') return GOLD_GREEN;
    if (status === 'archived') return ARCHIVED;
    return SEVERITY_COLOR[severity];
  }, [status, severity]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const b = birth.current;
    if (b.active && b.t === -1) b.t = t;

    let unfold = 1;
    let color = targetColor;
    let droop = status === 'archived' ? baseDroop * 1.4 : status === 'resolved' ? baseDroop * 0.45 : baseDroop;

    if (b.active && b.t > 0) {
      const e = (t - b.t) * 1000;
      if (e < YELLOW_LEAF_BIRTH.total) {
        unfold = 0.12 + 0.88 * easeOutCubic(phase(e, YELLOW_LEAF_BIRTH.unfoldStart, YELLOW_LEAF_BIRTH.unfoldEnd));
        // 绿 → 橄榄 → 赭黄
        if (e < YELLOW_LEAF_BIRTH.greenUntil) {
          color = GREEN;
        } else if (e < YELLOW_LEAF_BIRTH.transitionStart) {
          color = GREEN.clone().lerp(OLIVE, phase(e, YELLOW_LEAF_BIRTH.greenUntil, YELLOW_LEAF_BIRTH.transitionStart));
        } else {
          color = OLIVE.clone().lerp(targetColor, phase(e, YELLOW_LEAF_BIRTH.transitionStart, YELLOW_LEAF_BIRTH.ochreAt));
        }
        droop = baseDroop * phase(e, YELLOW_LEAF_BIRTH.transitionStart, YELLOW_LEAF_BIRTH.droopAt);
      } else {
        b.active = false;
      }
    }

    // 叶片独立摆动（每片不同相位）
    const period = THREE.MathUtils.lerp(IDLE.leafSwayPeriodMin, IDLE.leafSwayPeriodMax, hashUnit(leafId, 9));
    const sway = Math.sin((t / period) * Math.PI * 2 + seed) * IDLE.leafSwayAmplitude;

    if (droopRef.current) {
      droopRef.current.rotation.z = -(Math.PI / 2 + droop) - sway;
    }
    if (outerRef.current) {
      outerRef.current.scale.setScalar(unfold * (hovered ? 1.06 : 1));
    }
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.color.lerp(color, 0.08);
      mat.emissive.copy(color);
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, hovered ? 0.35 : 0.12, 0.1);
    }
  });

  return (
    <group position={[0, y, 0]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
      <group ref={outerRef}>
        <group ref={droopRef}>
          <mesh
            ref={meshRef}
            geometry={geometry}
            castShadow
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredPetal(leafId);
              useGardenStore.getState().setHoveredNode({ kind: 'boundary', id: leafId });
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHoveredPetal(null);
              useGardenStore.getState().setHoveredNode(null);
              document.body.style.cursor = 'default';
            }}
            onClick={(e) => {
              e.stopPropagation();
              useGardenStore.getState().selectNode({ kind: 'boundary', id: leafId });
              onFocus();
            }}
          >
            <meshStandardMaterial color="#D8B652" roughness={0.62} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* 左侧 3D 世界一律不放文字：hover 的信息全部走右侧 Research Inspector */}
    </group>
  );
}
