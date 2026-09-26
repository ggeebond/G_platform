/**
 * Bud3D —— 花蕾 / 花心。
 *
 * Idea 阶段花蕾更大更闭合；证据越多，花心越收紧、越亮。
 * 点击后 AI 上下文切换到「核心假设」。
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { IDLE, GHOST_BIRTH, phase } from '../../../lib/garden/animation';
import { CORE_Y, hashUnit } from '../../../lib/garden/layout';
import type { SoulStage } from '../../../lib/garden/types';

interface Bud3DProps {
  soulId: string;
  stage: SoulStage;
  accent: string;
  hovered: boolean;
  focused: boolean;
  /** 流光抵达花心的时刻，用于「花心变亮」 */
  streamAt: number;
  onFocus: () => void;
}

export function Bud3D({ soulId, stage, accent, hovered, focused, streamAt, onFocus }: Bud3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => hashUnit(soulId, 41) * Math.PI * 2, [soulId]);

  // 花蕾：Icosahedron 顶点轻微形变，不用复杂建模
  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.24, 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = hashUnit(`${soulId}-${i}`, 3);
      const k = 1 + (n - 0.5) * 0.16;
      pos.setXYZ(i, x * k, y * k * 1.12, z * k);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [soulId]);

  const baseScale = stage === 'bud' ? 1.25 : stage === 'bloomed' ? 0.86 : 1;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    let brightness = stage === 'bud' ? 0.9 : stage === 'bloomed' ? 0.5 : 0.62;
    brightness += hovered ? 0.35 : 0;
    brightness += focused ? 0.25 : 0;

    // Ghost Petal Birth：flower core 在 0ms 变亮
    if (streamAt > 0) {
      const e = performance.now() - streamAt;
      if (e < GHOST_BIRTH.total) {
        brightness += (1 - phase(e, 0, GHOST_BIRTH.streamEnd)) * 1.4;
      }
    }

    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, brightness, 0.14);

      const breathe = 1 + Math.sin((t / 4.2) * Math.PI * 2 + seed) * IDLE.petalBreathAmplitude;
      const s = baseScale * breathe * (hovered ? 1.06 : 1) * (focused ? 1.1 : 1);
      meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, s, 0.12));
    }

    if (glowRef.current) {
      const gm = glowRef.current.material as THREE.MeshBasicMaterial;
      const target = 0.12 + (hovered ? 0.16 : 0) + (focused ? 0.14 : 0);
      gm.opacity = THREE.MathUtils.lerp(gm.opacity, target, 0.12);
      glowRef.current.scale.setScalar(baseScale * (1.9 + Math.sin(t * 1.1 + seed) * 0.08));
    }
  });

  return (
    <group position={[0, CORE_Y, 0]}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        scale={baseScale}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onFocus();
        }}
      >
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.7}
          roughness={0.28}
          metalness={0.1}
        />
      </mesh>

      {/* 花心光晕：Bloom 替代品，只给 Soul Core */}
      <mesh ref={glowRef} raycast={() => null}>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
