/**
 * LineageVines —— Research Lineage。
 *
 * 这是 Garden 最大的价值：花与花之间长出的不是普通 Graph Edge，而是一根极细的发光藤蔓，
 * 靠近时能看到细微的粒子沿着它在两株花之间移动。
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGardenStore } from '../../stores/gardenStore';
import { CORE_Y, hashUnit } from '../../lib/garden/layout';
import type { GardenPlot, LineageEdge } from '../../lib/garden/types';

const RELATION_COLOR: Record<LineageEdge['relation'], string> = {
  extends: '#71E6AA',
  related: '#7DD7FF',
  contradicts: '#FFB865',
};

interface LineageVinesProps {
  lineages: LineageEdge[];
  plots: GardenPlot[];
  /** 只有花园视图与花朵视图需要藤蔓 */
  visible: boolean;
}

export function LineageVines({ lineages, plots, visible }: LineageVinesProps) {
  const byId = useMemo(() => {
    const m: Record<string, GardenPlot> = {};
    plots.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [plots]);

  if (!visible) return null;

  return (
    <group>
      {lineages.map((edge) => {
        const a = byId[edge.from];
        const b = byId[edge.to];
        if (!a || !b) return null;
        return <Vine key={edge.id} edge={edge} a={a} b={b} />;
      })}
    </group>
  );
}

function Vine({ edge, a, b }: { edge: LineageEdge; a: GardenPlot; b: GardenPlot }) {
  const particlesRef = useRef<THREE.Points>(null);
  const flashId = useGardenStore((s) => s.lineageFlashId);
  const tubeRef = useRef<THREE.Mesh>(null);

  const attachY = CORE_Y * 0.72;

  const curve = useMemo(() => {
    const pa = new THREE.Vector3(a.position[0], attachY, a.position[2]);
    const pb = new THREE.Vector3(b.position[0], attachY, b.position[2]);
    const mid = pa.clone().lerp(pb, 0.5);
    // 藤蔓下垂，而不是直线连接
    mid.y -= 0.55 + pa.distanceTo(pb) * 0.07;
    const c1 = pa.clone().lerp(mid, 0.55);
    c1.y -= 0.12;
    const c2 = pb.clone().lerp(mid, 0.55);
    c2.y -= 0.12;
    return new THREE.CatmullRomCurve3([pa, c1, mid, c2, pb]);
  }, [a.position, b.position, attachY]);

  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 40, 0.012, 6, false), [curve]);

  const particleCount = Math.round(4 + edge.strength * 8);
  const particlePositions = useMemo(() => new Float32Array(particleCount * 3), [particleCount]);
  const phases = useMemo(
    () => Array.from({ length: particleCount }, (_, i) => hashUnit(edge.id, i)),
    [edge.id, particleCount],
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flashing = flashId === edge.id;

    if (tubeRef.current) {
      const mat = tubeRef.current.material as THREE.MeshBasicMaterial;
      const base = 0.16 + edge.strength * 0.22;
      const flash = flashing ? 0.45 + Math.sin(t * 5) * 0.2 : 0;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, base + flash, 0.1);
    }

    const pts = particlesRef.current;
    if (pts) {
      const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const p = (phases[i] + t * 0.09 * (0.6 + edge.strength)) % 1;
        const v = curve.getPointAt(p);
        attr.setXYZ(i, v.x, v.y, v.z);
      }
      attr.needsUpdate = true;
      const pm = pts.material as THREE.PointsMaterial;
      pm.opacity = 0.35 + edge.strength * 0.35 + (flashing ? 0.3 : 0);
    }
  });

  const color = RELATION_COLOR[edge.relation];

  return (
    <group>
      <mesh ref={tubeRef} geometry={geometry} raycast={() => null}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <points ref={particlesRef} raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          color={color}
          transparent
          opacity={0.5}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
