/**
 * GardenScene —— 3D Research Garden。
 *
 * Garden 是产品本体：用户进入的是一座会生长的科研花园，
 * AI、实验、论文检索全部藏在花园的交互之中。
 */
import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GardenEnvironment } from './Environment';
import { CameraDirector, type OrbitControlsHandle } from './CameraDirector';
import { SoulFlower3D } from './SoulFlower3D';
import { LineageVines } from './LineageVines';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import { buildGarden, plotAlert, STAGE_HINT, STAGE_LABEL } from '../../lib/garden/garden';
import { CLUSTER_ANCHORS, CLUSTER_LABELS, CORE_Y } from '../../lib/garden/layout';

export function GardenScene() {
  const controlsRef = useRef<OrbitControlsHandle | null>(null);

  const docs = useSoulStore((s) => s.docs);
  const order = useSoulStore((s) => s.order);
  const setActive = useSoulStore((s) => s.setActive);

  const cameraMode = useGardenStore((s) => s.cameraMode);
  const soulId = useGardenStore((s) => s.soulId);
  const hoveredSoulId = useGardenStore((s) => s.hoveredSoulId);
  const hoveredPetalId = useGardenStore((s) => s.hoveredPetalId);
  const hoveredOrbId = useGardenStore((s) => s.hoveredOrbId);
  const enterSoul = useGardenStore((s) => s.enterSoul);
  const focusPetal = useGardenStore((s) => s.focusPetal);
  const focusLeaf = useGardenStore((s) => s.focusLeaf);
  const focusBaseline = useGardenStore((s) => s.focusBaseline);
  const backToGarden = useGardenStore((s) => s.backToGarden);
  const setFocus = useSoulStore((s) => s.setFocus);

  const garden = useMemo(
    () => buildGarden(order.map((id) => docs[id]).filter(Boolean)),
    [docs, order],
  );

  /** 点击花朵：切上下文 + 镜头推近 */
  const selectSoul = (id: string) => {
    setActive(id);
    enterSoul(id);
    setFocus({ type: 'bud', id, label: docs[id]?.soul.title ?? '' });
  };

  const hoveredPlot = hoveredSoulId ? garden.plots.find((p) => p.id === hoveredSoulId) : null;
  const hoveredDoc = hoveredSoulId ? docs[hoveredSoulId] : null;

  return (
    <Canvas
      camera={{ position: [0, 7.6, 13.6], fov: 42 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => {
        if (cameraMode === 'garden') return;
        backToGarden();
      }}
    >
      <GardenEnvironment />

      {garden.plots.map((plot) => {
        const doc = docs[plot.id];
        if (!doc) return null;
        const isFocused = soulId === plot.id;
        return (
          <SoulFlower3D
            key={plot.id}
            plot={plot}
            doc={doc}
            focused={isFocused && cameraMode !== 'garden'}
            receded={cameraMode !== 'garden' && !isFocused}
            onSelect={() => selectSoul(plot.id)}
            onFocusPetal={(petalId) => {
              setActive(plot.id);
              focusPetal(plot.id, petalId);
              const petal = doc.petals.find((p) => p.id === petalId);
              setFocus({ type: 'petal', id: petalId, label: petal?.label ?? '' });
            }}
            onFocusLeaf={(leafId) => {
              setActive(plot.id);
              focusLeaf(plot.id, leafId);
              const leaf = doc.leaves.find((l) => l.id === leafId);
              setFocus({ type: 'leaf', id: leafId, label: leaf?.label ?? '' });
            }}
            onFocusBaseline={(baselineId) => {
              setActive(plot.id);
              const b = doc.baselines.find((x) => x.id === baselineId);
              setFocus({ type: 'root', id: baselineId, label: b?.name ?? '' });
              focusBaseline(plot.id, baselineId);
            }}
            onFocusBud={() => {
              setActive(plot.id);
              enterSoul(plot.id);
              setFocus({ type: 'bud', id: plot.id, label: doc.soul.title });
            }}
          />
        );
      })}

      {/* Research Lineage：花与花之间的关系 */}
      <LineageVines
        lineages={garden.lineages}
        plots={garden.plots}
        visible={cameraMode !== 'petal'}
      />

      {/* 花圃标牌 */}
      {garden.clusters.map((c) => {
        const anchor = CLUSTER_ANCHORS[c.id] ?? [0, 0, 0];
        return (
          <Html
            key={c.id}
            position={[anchor[0], 0.02, anchor[2] - 0.1]}
            center
            distanceFactor={16}
            // 3D 世界的文字必须待在 HUD 面板之下：drei 默认 z-index 高达 16777271，
            // 不限制的话花圃标牌会盖住 Workshop / Frontier 等浮层的文字。
            zIndexRange={[8, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="cluster-plaque">{CLUSTER_LABELS[c.id] ?? c.label}</div>
          </Html>
        );
      })}

      {/* Hover 标签：不放大整朵花，而是给它一个状态牌 */}
      {hoveredPlot && hoveredDoc && cameraMode === 'garden' && (
        <Html
          position={[
            hoveredPlot.position[0],
            CORE_Y + 1.05,
            hoveredPlot.position[2],
          ]}
          center
          distanceFactor={11}
          zIndexRange={[9, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="garden-label">
            <div className="garden-label-title">{hoveredPlot.title}</div>
            <div className="garden-label-meta">
              {STAGE_LABEL[hoveredPlot.stage]} · {hoveredPlot.solid} solid · {hoveredPlot.candidate} candidate
              {hoveredPlot.leaves > 0 ? ` · ${hoveredPlot.leaves} leaf` : ''}
            </div>
            <div className="garden-label-hint">
              {plotAlert(hoveredPlot) ?? STAGE_HINT[hoveredPlot.stage]}
            </div>
          </div>
        </Html>
      )}

      <CameraDirector controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef as never}
        enabled={false}
        enablePan
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={22}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.1}
        target={[0, 1.5, 0]}
      />
    </Canvas>
  );
}

/** 供 HUD 复用的花园模型 */
export function useGardenModel() {
  const docs = useSoulStore((s) => s.docs);
  const order = useSoulStore((s) => s.order);
  return useMemo(() => buildGarden(order.map((id) => docs[id]).filter(Boolean)), [docs, order]);
}
