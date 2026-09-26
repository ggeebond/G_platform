/**
 * ResearchPlot —— 每一株花长在自己的小型培养区里。
 *
 * 低矮玻璃培养皿 + 透明营养液 + 裸露根系，而不是一个巨大的药瓶把整株花封起来。
 * 只有这样多株花才能同时存在于 Garden。
 * 玻璃观察罩只在进入 Experiment / Petal Focus 时出现 —— 让「瓶子」从
 * 永远存在的容器变成一次实验状态。
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hashUnit } from '../../lib/garden/layout';

interface ResearchPlotProps {
  plotId: string;
  accent: string;
  /** 进入 Experiment Mode 时升起玻璃观察罩 */
  focused: boolean;
  hovered: boolean;
}

const DISH_RADIUS = 0.86;

export function ResearchPlot({ plotId, accent, focused, hovered }: ResearchPlotProps) {
  const liquidRef = useRef<THREE.Mesh>(null);
  const domeRef = useRef<THREE.Group>(null);
  const seed = useMemo(() => hashUnit(plotId, 51) * Math.PI * 2, [plotId]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (liquidRef.current) {
      const mat = liquidRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(
        mat.opacity,
        0.09 + (hovered ? 0.05 : 0) + Math.sin(t * 0.7 + seed) * 0.015,
        0.08,
      );
    }

    if (domeRef.current) {
      // 观察罩：进入实验状态才升起
      const target = focused ? 1 : 0;
      const s = THREE.MathUtils.lerp(domeRef.current.scale.y, target, 0.08);
      domeRef.current.scale.y = s;
      domeRef.current.visible = s > 0.01;
      const mat = (domeRef.current.children[0] as THREE.Mesh | undefined)?.material as
        | THREE.MeshPhysicalMaterial
        | undefined;
      if (mat) mat.opacity = s * 0.14;
    }
  });

  return (
    <group>
      {/* 培养皿底部 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[DISH_RADIUS, 40]} />
        <meshStandardMaterial color="#10312C" roughness={0.7} metalness={0.15} transparent opacity={0.85} />
      </mesh>

      {/* 透明营养液 */}
      <mesh ref={liquidRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]} raycast={() => null}>
        <circleGeometry args={[DISH_RADIUS * 0.94, 40]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.09}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 玻璃皿壁：极低的多边形圆柱，成本很低 */}
      <mesh position={[0, 0.075, 0]} raycast={() => null}>
        <cylinderGeometry args={[DISH_RADIUS, DISH_RADIUS * 0.96, 0.15, 40, 1, true]} />
        <meshPhysicalMaterial
          color="#BFEFF5"
          roughness={0.06}
          metalness={0}
          transparent
          opacity={0.13}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 皿口高光边 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.152, 0]} raycast={() => null}>
        <ringGeometry args={[DISH_RADIUS * 0.99, DISH_RADIUS * 1.02, 40]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 玻璃观察罩（只在 Experiment Mode 升起） */}
      <group ref={domeRef} position={[0, 0.15, 0]} visible={false}>
        <mesh position={[0, 0.95, 0]} raycast={() => null}>
          <cylinderGeometry args={[DISH_RADIUS * 1.15, DISH_RADIUS * 1.05, 1.9, 32, 1, true]} />
          <meshPhysicalMaterial
            color="#D6F6FF"
            roughness={0.04}
            metalness={0}
            transparent
            opacity={0.14}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
