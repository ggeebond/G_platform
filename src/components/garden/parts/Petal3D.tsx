/**
 * Petal3D —— 灵魂花瓣。
 *
 * candidate（Ghost）：半透明、2.8s 呼吸、真玻璃材质感
 * solid（实体）    ：停止呼吸、叶脉出现、花粉粒子
 *
 * 动画全部由状态迁移驱动：
 *   newborn（本轮新长出）→ Ghost Petal Birth
 *   candidate → solid    → Solidification（Demo 高潮，1.6s）
 *   candidate → withdrawn→ Withdraw
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGardenStore } from '../../../stores/gardenStore';
import {
  clamp01,
  easeOutCubic,
  GHOST_BIRTH,
  IDLE,
  phase,
  SOLIDIFY,
  WITHDRAW,
} from '../../../lib/garden/animation';
import {
  hashUnit,
  PETAL_LENGTH,
  PETAL_WIDTH,
  petalLocalPosition,
  petalRingAngle,
  petalTilt,
} from '../../../lib/garden/layout';
import type { PetalStatus } from '../../../lib/types';
import type { SoulStage } from '../../../lib/garden/types';

/* ---------- 花瓣几何：模块级共享，所有花瓣复用同一份 ---------- */
let cachedGeometry: THREE.ExtrudeGeometry | null = null;

function petalGeometry(): THREE.ExtrudeGeometry {
  if (cachedGeometry) return cachedGeometry;

  const w = PETAL_WIDTH;
  const len = PETAL_LENGTH;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(w * 0.95, len * 0.16, w * 1.3, len * 0.6, 0, len);
  shape.bezierCurveTo(-w * 1.3, len * 0.6, -w * 0.95, len * 0.16, 0, 0);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.011,
    bevelSize: 0.011,
    bevelSegments: 2,
    curveSegments: 14,
  });

  // 让花瓣沿长度方向微微上翘（天然的兜状），比平板有生命力
  const pos = geom.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(y, 0) / len;
    pos.setZ(i, pos.getZ(i) + t * t * 0.14);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();

  cachedGeometry = geom;
  return geom;
}

/* ---------- 叶脉：实体化后才出现 ----------
 * 用真正的 THREE.Line 对象而非 JSX <line>，后者会与 SVG 的 line 元素冲突。
 */
function useVeinLine() {
  return useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 1; i <= 6; i++) {
      const t = i / 7;
      pts.push(new THREE.Vector3(0, t * PETAL_LENGTH * 0.86, 0.03 + t * t * 0.1));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const material = new THREE.LineBasicMaterial({
      color: '#FEF3C7',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.raycast = () => {};
    return line;
  }, []);
}

/* ---------- 花瓣配色：由状态决定，而不是由花色决定 ----------
 * 未熟（candidate / insufficient）：青柠 / 嫩绿 —— 实验设计成立但证据未完成
 * 熟成（solid）                   ：金 → 琥珀 —— 结果已被审议并保留
 * 撤回（withdrawn）               ：褪成灰绿 —— 历史保留，但不再参与论证
 * accent 只用于保留每一株花自己的青柠/新绿色相差异。
 */
const SOLID_BASE = '#FDE047';
const SOLID_EMISSIVE = '#FBBF24';
const WITHDRAWN_BASE = '#7E9C8A';
const INSUFFICIENT_BASE = '#86EFAC';
const GLOW_SOLID = '#FDE047';
const GLOW_GHOST = '#A3E635';

function petalColor(status: PetalStatus, accent: string): string {
  if (status === 'solid') return SOLID_BASE;
  if (status === 'withdrawn') return WITHDRAWN_BASE;
  if (status === 'insufficient') return INSUFFICIENT_BASE;
  return accent;
}

function petalEmissive(status: PetalStatus, accent: string): string {
  if (status === 'solid') return SOLID_EMISSIVE;
  if (status === 'withdrawn') return '#4A5A50';
  if (status === 'insufficient') return INSUFFICIENT_BASE;
  return accent;
}

function petalGlow(status: PetalStatus): string {
  if (status === 'solid') return GLOW_SOLID;
  if (status === 'withdrawn') return WITHDRAWN_BASE;
  return GLOW_GHOST;
}

interface Petal3DProps {
  soulId: string;
  petalId: string;
  index: number;
  total: number;
  status: PetalStatus;
  accent: string;
  stage: SoulStage;
  openness: number;
  newborn: boolean;
  /** 该花瓣所属实验是否正在等待结果 */
  waiting: boolean;
  /** 花瓣标签，hover 状态牌上显示 */
  label: string;
  onFocus: () => void;
}

export function Petal3D({
  soulId,
  petalId,
  index,
  total,
  status,
  accent,
  stage,
  openness,
  newborn,
  waiting,
  label,
  onFocus,
}: Petal3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const pollenRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);

  const setHoveredPetal = useGardenStore((s) => s.hoverPetal);
  const hovered = useGardenStore((s) => s.hoveredPetalId === petalId);

  const geometry = useMemo(() => petalGeometry(), []);
  const veinLine = useVeinLine();

  // 各条动画的起始时刻（秒，r3f clock）。0 = 未启动，-1 = 待首帧打时间戳
  const anim = useRef({ birth: 0, solidify: 0, withdraw: 0 });
  const prevStatus = useRef<PetalStatus>(status);

  // 父组件是在「新花瓣已经渲染出来之后」才把它标记为 newborn 的，
  // 所以这里必须响应 false → true 的变化，而不能只看挂载时的初值。
  useEffect(() => {
    if (newborn && status === 'candidate' && anim.current.birth === 0) {
      anim.current.birth = -1;
    }
  }, [newborn, status]);

  useEffect(() => {
    const prev = prevStatus.current;
    if (prev === status) return;
    prevStatus.current = status;
    if (prev === 'candidate' && status === 'solid') anim.current.solidify = -1;
    if (prev !== 'withdrawn' && status === 'withdrawn') anim.current.withdraw = -1;
  }, [status]);

  const theta = petalRingAngle(index, total);
  const tilt = petalTilt(openness, stage);
  const phaseSeed = useMemo(() => hashUnit(petalId, 7) * Math.PI * 2, [petalId]);

  // 花粉粒子（实体化瞬间飞出）
  const pollenPositions = useMemo(() => new Float32Array(10 * 3), []);
  const pollenDirs = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = hashUnit(petalId, i) * Math.PI * 2;
        return new THREE.Vector3(
          Math.cos(a) * (0.3 + hashUnit(petalId, i + 40) * 0.7),
          0.4 + hashUnit(petalId, i + 80) * 0.8,
          Math.sin(a) * (0.3 + hashUnit(petalId, i + 120) * 0.7),
        );
      }),
    [petalId],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const a = anim.current;
    if (a.birth === -1) a.birth = t;
    if (a.solidify === -1) a.solidify = t;
    if (a.withdraw === -1) a.withdraw = t;

    const mesh = meshRef.current;
    const mat = mesh?.material as THREE.MeshPhysicalMaterial | undefined;
    if (!mesh || !mat) return;

    /* ---------- 基础形态 ---------- */
    let scale = 1;
    const breathing = status === 'candidate' || status === 'insufficient';

    /* ---------- Ghost Petal Birth ---------- */
    if (a.birth > 0) {
      const e = (t - a.birth) * 1000;
      if (e < GHOST_BIRTH.total) {
        scale = 0.25 + 0.75 * easeOutCubic(phase(e, GHOST_BIRTH.petalScaleStart, GHOST_BIRTH.petalScaleEnd));
      }
    }

    /* ---------- 呼吸（出现后进入） ---------- */
    if (breathing) {
      const period = THREE.MathUtils.lerp(
        IDLE.petalBreathPeriodMin,
        IDLE.petalBreathPeriodMax,
        hashUnit(petalId, 3),
      );
      // Ghost: opacity 0.20 ↔ 0.32；insufficient 更弱
      const lo = status === 'candidate' ? 0.2 : 0.16;
      const hi = status === 'candidate' ? 0.32 : 0.24;
      const b = (Math.sin((t / period) * Math.PI * 2 + phaseSeed) + 1) / 2;
      mat.opacity = THREE.MathUtils.lerp(lo, hi, b);
      scale *= 1 + Math.sin((t / period) * Math.PI * 2 + phaseSeed) * IDLE.petalBreathAmplitude;
    }

    /* ---------- Solidification：Demo 高潮 ---------- */
    let veinsOpacity = status === 'solid' ? 0.5 : 0;
    let glow = 0;
    let pollenT = -1;

    if (a.solidify > 0) {
      const e = (t - a.solidify) * 1000;
      if (e < SOLIDIFY.total) {
        const p = phase(e, SOLIDIFY.opacityStart, SOLIDIFY.opacityEnd);
        mat.opacity = THREE.MathUtils.lerp(0.26, 0.92, easeOutCubic(p));
        glow = Math.sin(clamp01(e / SOLIDIFY.total) * Math.PI) * 1.6 + 0.4;
        veinsOpacity = phase(e, SOLIDIFY.veinsStart, SOLIDIFY.total) * 0.55;
        pollenT = e;
      } else {
        mat.opacity = 0.92;
        glow = 0.4;
        veinsOpacity = 0.55;
      }
    } else if (status === 'solid') {
      mat.opacity = 0.92;
      glow = 0.4;
    }

    if (status === 'withdrawn') {
      if (a.withdraw > 0) {
        const e = (t - a.withdraw) * 1000;
        mat.opacity = THREE.MathUtils.lerp(0.92, 0.14, phase(e, WITHDRAW.glowOff, WITHDRAW.opacityDrop + 300));
      } else {
        mat.opacity = 0.14;
      }
      veinsOpacity = 0;
      glow = 0;
    }

    // Hover 只做视觉反馈：亮度 +15%（发光强度按同一比例抬升）
    let targetEmissive =
      status === 'candidate' || status === 'insufficient'
        ? 0.34 + (hovered ? 0.3 : 0)
        : status === 'solid'
          ? 0.18 + glow * 0.5 + (hovered ? 0.22 : 0)
          : 0.02;
    if (hovered) targetEmissive *= 1.15;
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetEmissive, 0.12);

    mesh.scale.setScalar(scale * (hovered ? 1.03 : 1));

    /* ---------- 光晕（替代 Bloom，用加法混合的壳层实现） ---------- */
    if (haloRef.current) {
      const haloMat = haloRef.current.material as THREE.MeshBasicMaterial;
      const target =
        status === 'withdrawn'
          ? 0
          : (status === 'solid' ? 0.1 : 0.16) + glow * 0.28 + (hovered ? 0.2 : 0);
      haloMat.opacity = THREE.MathUtils.lerp(haloMat.opacity, target, 0.12);
      haloRef.current.scale.setScalar(scale * 1.08);
    }

    /* ---------- 叶脉 ---------- */
    const vm = veinLine.material as THREE.LineBasicMaterial;
    vm.opacity = THREE.MathUtils.lerp(vm.opacity, veinsOpacity, 0.1);

    /* ---------- 花粉粒子 ---------- */
    if (pollenRef.current) {
      const pm = pollenRef.current.material as THREE.PointsMaterial;
      if (pollenT >= 0 && pollenT < SOLIDIFY.pollenEnd) {
        const p = clamp01((pollenT - SOLIDIFY.pollenStart) / (SOLIDIFY.pollenEnd - SOLIDIFY.pollenStart));
        const attr = pollenRef.current.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pollenDirs.length; i++) {
          const d = pollenDirs[i];
          const spread = easeOutCubic(p) * 1.15;
          attr.setXYZ(i, d.x * spread, PETAL_LENGTH * 0.45 + d.y * spread, d.z * spread);
        }
        attr.needsUpdate = true;
        pm.opacity = (1 - p) * 0.9;
      } else {
        pm.opacity = 0;
      }
    }

    /* ---------- 撤回：向花心回折 ---------- */
    if (groupRef.current) {
      const fold = status === 'withdrawn' ? 0.07 : 0;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, fold, 0.06);
    }
  });

  const canFocus = status === 'candidate' || status === 'solid';

  return (
    <group
      position={petalLocalPosition(index, total)}
      rotation={[0, Math.PI / 2 - theta, 0]}
    >
      <group ref={groupRef} rotation={[Math.PI / 2 - tilt, 0, 0]}>
        <mesh
          ref={meshRef}
          geometry={geometry}
          castShadow
          onPointerOver={() => {
            // 不 stopPropagation：悬停花瓣时整株花也应该亮起来
            setHoveredPetal(petalId);
            // 只有真正代表结论的花瓣（candidate / solid）才把信息送进右侧 Inspector
            if (canFocus) useGardenStore.getState().setHoveredNode({ kind: 'claim', id: petalId });
            document.body.style.cursor = canFocus ? 'pointer' : 'default';
          }}
          onPointerOut={() => {
            setHoveredPetal(null);
            useGardenStore.getState().setHoveredNode(null);
            document.body.style.cursor = 'default';
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (canFocus) onFocus();
          }}
        >
          <meshPhysicalMaterial
            color={petalColor(status, accent)}
            emissive={petalEmissive(status, accent)}
            emissiveIntensity={0.34}
            roughness={status === 'solid' ? 0.35 : 0.18}
            metalness={0}
            clearcoat={status === 'solid' ? 0.2 : 0.6}
            clearcoatRoughness={0.4}
            transparent
            opacity={status === 'solid' ? 0.92 : 0.26}
            side={THREE.DoubleSide}
            depthWrite={status === 'solid'}
          />
        </mesh>

        {/* 光晕壳层：Ghost Petal / Soul Core 的 Bloom 替代品 */}
        <mesh ref={haloRef} geometry={geometry} scale={1.08} raycast={() => null}>
          <meshBasicMaterial
            color={petalGlow(status)}
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* 叶脉 */}
        <primitive object={veinLine} />

        {/* 花粉 */}
        <points ref={pollenRef} raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pollenPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.045}
            color="#FEF3C7"
            transparent
            opacity={0}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>

      {/* Ghost Petal 等待结果时，在花瓣尖端挂一个极小的脉动点 */}
      {waiting && status === 'candidate' && <WaitingPip accent={accent} seed={phaseSeed} />}

      {/* 左侧 3D 世界一律不放文字：hover 的信息全部走右侧 Research Inspector */}
    </group>
  );
}

function WaitingPip({ accent, seed }: { accent: string; seed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.6 + seed) * 0.4;
    ref.current.scale.setScalar(s);
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.45 + Math.sin(t * 1.6 + seed) * 0.35;
  });
  return (
    <mesh ref={ref} position={[0, PETAL_LENGTH * 1.02, 0.06]} raycast={() => null}>
      <sphereGeometry args={[0.035, 10, 8]} />
      <meshBasicMaterial color={accent} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}
