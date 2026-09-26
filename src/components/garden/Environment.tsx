/**
 * GardenEnvironment —— 阳光下的科研花园：天空 / 雾气 / 阳光 / 土壤 / 漂浮花粉。
 *
 * 所有光照数值都来自 lib/garden/sunlight.ts（阳光机制），
 * 而阳光机制又完全由研究状态推导：证据越多，花园越亮。
 * 这里不存在任何手写的光照常量。
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { hashUnit } from '../../lib/garden/layout';
import { useGardenSunlight } from '../../lib/garden/useSunlight';
import type { GardenSunlight } from '../../lib/garden/sunlight';

export function GardenEnvironment() {
  const sun = useGardenSunlight();
  return (
    <>
      <SkyAndFog sun={sun} />
      <Lights sun={sun} />
      <Ground sun={sun} />
      <LightPool sun={sun} />
      <Mist sun={sun} />
      <FloatingDust sun={sun} />
    </>
  );
}

/* ==================== 天空与雾 ==================== */

function SkyAndFog({ sun }: { sun: GardenSunlight }) {
  const { scene } = useThree();

  const background = useMemo(() => new THREE.Color(sun.skyColor), []);
  const fog = useMemo(() => new THREE.Fog(sun.fogColor, sun.fogNear, sun.fogFar), []);

  useEffect(() => {
    scene.background = background;
    scene.fog = fog;
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, background, fog]);

  const targetBg = useMemo(() => new THREE.Color(sun.skyColor), [sun.skyColor]);
  const targetFog = useMemo(() => new THREE.Color(sun.fogColor), [sun.fogColor]);

  useFrame(() => {
    // 光照变化是缓慢的：用插值让它像真的太阳在移动，而不是切换主题
    background.lerp(targetBg, 0.018);
    fog.color.lerp(targetFog, 0.018);
    fog.near += (sun.fogNear - fog.near) * 0.018;
    fog.far += (sun.fogFar - fog.far) * 0.018;
  });

  return null;
}

/* ==================== 光照 ==================== */

function Lights({ sun }: { sun: GardenSunlight }) {
  const mainRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const fillRef = useRef<THREE.PointLight>(null);

  const sunColor = useMemo(() => new THREE.Color(sun.sunColor), [sun.sunColor]);
  const hemiSky = useMemo(() => new THREE.Color(sun.hemisphereSky), [sun.hemisphereSky]);
  const hemiGround = useMemo(() => new THREE.Color(sun.hemisphereGround), [sun.hemisphereGround]);
  const ambientColor = useMemo(() => new THREE.Color(sun.ambientColor), [sun.ambientColor]);
  const fillColor = useMemo(() => new THREE.Color(sun.fillColor), [sun.fillColor]);

  useFrame(() => {
    const main = mainRef.current;
    if (main) {
      main.position.x += (sun.sunPosition[0] - main.position.x) * 0.02;
      main.position.y += (sun.sunPosition[1] - main.position.y) * 0.02;
      main.position.z += (sun.sunPosition[2] - main.position.z) * 0.02;
      main.intensity += (sun.sunIntensity - main.intensity) * 0.02;
      main.color.lerp(sunColor, 0.02);
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.intensity += (sun.hemisphereIntensity - hemi.intensity) * 0.02;
      hemi.color.lerp(hemiSky, 0.02);
      hemi.groundColor.lerp(hemiGround, 0.02);
    }
    const ambient = ambientRef.current;
    if (ambient) {
      ambient.intensity += (sun.ambientIntensity - ambient.intensity) * 0.02;
      ambient.color.lerp(ambientColor, 0.02);
    }
    const fill = fillRef.current;
    if (fill) {
      fill.intensity += (sun.fillIntensity - fill.intensity) * 0.02;
      fill.color.lerp(fillColor, 0.02);
    }
  });

  return (
    <>
      {/* 天空/地面双色环境光：让植物从上到下都有生命色 */}
      <hemisphereLight ref={hemiRef} args={['#FFD76A', '#1E6B3E', sun.hemisphereIntensity]} />
      <ambientLight ref={ambientRef} intensity={sun.ambientIntensity} color={sun.ambientColor} />

      {/* 主光 = 阳光：位置与颜色由阳光机制给出，阴影方向因此随研究进度缓慢变化 */}
      <directionalLight
        ref={mainRef}
        position={sun.sunPosition}
        intensity={sun.sunIntensity}
        color={sun.sunColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-far={48}
        shadow-bias={-0.0012}
      />

      {/* 补光：晨曦时偏暖橙（黄昏感），光照充足后退回紫罗兰，避免整场偏色 */}
      <pointLight ref={fillRef} position={[-7, 5, -5]} intensity={sun.fillIntensity} color={sun.fillColor} distance={24} decay={1.6} />
    </>
  );
}

/* ==================== 土壤 ==================== */

function Ground({ sun }: { sun: GardenSunlight }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const target = useMemo(() => new THREE.Color(sun.groundColor), [sun.groundColor]);

  useFrame(() => {
    matRef.current?.color.lerp(target, 0.018);
  });

  return (
    <group>
      {/* 主地面：被阳光晒过的园土 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 96]} />
        <meshStandardMaterial ref={matRef} color={sun.groundColor} roughness={0.9} metalness={0.04} />
      </mesh>

      {/* 中心柔光地毯：把视线引向花园中央 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0, 14, 96]} />
        <meshBasicMaterial color="#72D96B" transparent opacity={0.07} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** 阳光打在花圃上的光斑：随太阳方位缓慢移动，是「阳光机制」最直观的可见痕迹 */
function LightPool({ sun }: { sun: GardenSunlight }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const m = matRef.current;
    if (m) m.opacity += (sun.lightPoolOpacity - m.opacity) * 0.02;
    const mesh = ref.current;
    if (mesh) {
      mesh.position.x += (sun.sunPosition[0] * 0.42 - mesh.position.x) * 0.01;
      mesh.position.z += (sun.sunPosition[2] * 0.42 - mesh.position.z) * 0.01;
    }
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={() => null}>
      <circleGeometry args={[17, 80]} />
      <meshBasicMaterial
        ref={matRef}
        color={sun.lightPoolColor}
        transparent
        opacity={sun.lightPoolOpacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ==================== 雾气 ==================== */

function Mist({ sun }: { sun: GardenSunlight }) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const count = 140;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = hashUnit('mist', i) * Math.PI * 2;
      const r = 3 + hashUnit('mist', i + 500) * 20;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = 0.1 + hashUnit('mist', i + 900) * 0.75;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, []);

  const color = useMemo(() => new THREE.Color(sun.mistColor), [sun.mistColor]);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.006;
    const m = matRef.current;
    if (m) {
      m.opacity += (sun.mistOpacity - m.opacity) * 0.018;
      m.color.lerp(color, 0.018);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.9}
        color={sun.mistColor}
        transparent
        opacity={sun.mistOpacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ==================== 花粉 / 浮尘 ==================== */

function FloatingDust({ sun }: { sun: GardenSunlight }) {
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const count = 460;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (hashUnit('dust', i) - 0.5) * 30;
      arr[i * 3 + 1] = hashUnit('dust', i + 1000) * 9;
      arr[i * 3 + 2] = (hashUnit('dust', i + 2000) - 0.5) * 30;
    }
    return arr;
  }, []);

  const color = useMemo(() => new THREE.Color(sun.dustColor), [sun.dustColor]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      ref.current.rotation.y = t * 0.012;
      ref.current.position.y = Math.sin(t * 0.18) * 0.18;
    }
    const m = matRef.current;
    if (m) {
      m.opacity += (sun.dustOpacity - m.opacity) * 0.018;
      m.color.lerp(color, 0.018);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={sun.dustSize}
        color={sun.dustColor}
        transparent
        opacity={sun.dustOpacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
