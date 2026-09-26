/**
 * Stem3D —— 技术主线（机制链）。
 *
 * 轻微弯曲的管状茎，带 ±1.5° 的自主摆动（周期与相位每株不同，绝不同步）。
 * Ghost Petal 诞生时，一道流光沿茎从根部移动到花心 —— 这是「想法长成实验」的动画语言。
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp01, GHOST_BIRTH, IDLE, phase } from '../../../lib/garden/animation';
import { hashUnit, STEM_HEIGHT } from '../../../lib/garden/layout';

export function useStemCurve(soulId: string) {
  return useMemo(() => {
    const lean = (hashUnit(soulId, 21) - 0.5) * 0.16;
    const midLean = (hashUnit(soulId, 22) - 0.5) * 0.3;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(midLean * 0.4, STEM_HEIGHT * 0.34, midLean * 0.25),
      new THREE.Vector3(midLean, STEM_HEIGHT * 0.7, lean * 0.5),
      new THREE.Vector3(lean, STEM_HEIGHT, 0),
    ]);
  }, [soulId]);
}

interface Stem3DProps {
  soulId: string;
  accent: string;
  /** 流光开始时间（performance.now），0 表示没有 */
  streamAt: number;
  /** 聚焦时茎的摆动收敛，避免镜头对不准 */
  damped: boolean;
}

export function Stem3D({ soulId, accent, streamAt, damped }: Stem3DProps) {
  const curve = useStemCurve(soulId);
  const groupRef = useRef<THREE.Group>(null);
  const streamRef = useRef<THREE.Mesh>(null);
  const period = useMemo(
    () => THREE.MathUtils.lerp(IDLE.stemPeriodMin, IDLE.stemPeriodMax, hashUnit(soulId, 31)),
    [soulId],
  );
  const seed = useMemo(() => hashUnit(soulId, 32) * Math.PI * 2, [soulId]);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      const amp = damped ? IDLE.stemAmplitude * 0.12 : IDLE.stemAmplitude;
      groupRef.current.rotation.z = Math.sin((t / period) * Math.PI * 2 + seed) * amp;
      groupRef.current.rotation.x = Math.cos((t / (period * 1.3)) * Math.PI * 2 + seed) * amp * 0.6;

      // hover / 聚焦时花心朝镜头方向轻微倾斜 ——「它注意到我了」
      if (damped) {
        const w = new THREE.Vector3();
        camera.getWorldPosition(w);
        const local = groupRef.current.parent?.worldToLocal(w.clone()) ?? w;
        const leanX = THREE.MathUtils.clamp(local.z * 0.02, -IDLE.attentionTilt, IDLE.attentionTilt);
        const leanZ = THREE.MathUtils.clamp(-local.x * 0.02, -IDLE.attentionTilt, IDLE.attentionTilt);
        groupRef.current.rotation.x += leanX;
        groupRef.current.rotation.z += leanZ;
      }
    }

    // 流光：从根部沿茎上行到花心
    const s = streamRef.current;
    if (s) {
      if (streamAt > 0) {
        const e = performance.now() - streamAt;
        const p = phase(e, GHOST_BIRTH.streamStart, GHOST_BIRTH.streamEnd);
        if (p > 0 && p < 1) {
          const pt = curve.getPointAt(clamp01(p));
          s.position.copy(pt);
          s.visible = true;
          const mat = s.material as THREE.MeshBasicMaterial;
          // 两端淡出，中段最亮
          mat.opacity = Math.sin(p * Math.PI) * 1.1;
          s.scale.setScalar(0.9 + Math.sin(p * Math.PI) * 1.4);
        } else if (p >= 1) {
          s.visible = false;
        } else {
          s.visible = false;
        }
      } else {
        s.visible = false;
      }
    }
  });

  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 28, 0.036, 8, false), [curve]);

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color="#3FA08A" roughness={0.5} metalness={0.08} />
      </mesh>

      {/* 茎内部的微弱荧光，暗示「技术主线」是活的 */}
      <mesh geometry={geometry} scale={0.55} raycast={() => null}>
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 流光 */}
      <mesh ref={streamRef} visible={false} raycast={() => null}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshBasicMaterial
          color="#EAFDFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
