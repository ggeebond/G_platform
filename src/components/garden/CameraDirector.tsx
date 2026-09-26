/**
 * CameraDirector —— 镜头是核心交互，不是附属功能。
 *
 * Garden → 一株花 → 一片花瓣 的三级推近由这里统一叙事。
 * 花园视图交给 OrbitControls（有角度限制），一旦进入花朵/花瓣，
 * 镜头接管，OrbitControls 关闭，避免两套控制器互相打架。
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGardenStore } from '../../stores/gardenStore';
import { useSoulStore } from '../../stores/soulStore';
import {
  CAMERA,
  easeInOutCubic,
  clamp01,
} from '../../lib/garden/animation';
import {
  flowerFocusPose,
  GARDEN_EYE,
  petalFocusPose,
} from '../../lib/garden/layout';
import { buildGarden } from '../../lib/garden/garden';

const GARDEN_TARGET: [number, number, number] = [0, 1.5, 0];

/** 只依赖 OrbitControls 中真正会被用到的三个成员，避免引入 three-stdlib 类型 */
export interface OrbitControlsHandle {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
}

export function CameraDirector({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsHandle | null> }) {
  const { camera } = useThree();

  const cameraMode = useGardenStore((s) => s.cameraMode);
  const soulId = useGardenStore((s) => s.soulId);
  const petalId = useGardenStore((s) => s.petalId);
  const celebrationAt = useGardenStore((s) => s.celebrationAt);

  const docs = useSoulStore((s) => s.docs);
  const order = useSoulStore((s) => s.order);

  const garden = useMemo(
    () => buildGarden(order.map((id) => docs[id]).filter(Boolean)),
    [docs, order],
  );

  // 阻尼目标：镜头位置与注视点各自平滑逼近
  const desiredPos = useRef(new THREE.Vector3(...GARDEN_EYE));
  const desiredLook = useRef(new THREE.Vector3(...GARDEN_TARGET));
  const currentLook = useRef(new THREE.Vector3(...GARDEN_TARGET));
  const transition = useRef({ from: new THREE.Vector3(...GARDEN_EYE), t: 1, dur: 0 });

  // 计算本帧应该看向哪里
  const pose = useMemo(() => {
    if (cameraMode === 'garden' || !soulId) {
      return { eye: GARDEN_EYE, lookAt: GARDEN_TARGET };
    }
    const plot = garden.plots.find((p) => p.id === soulId);
    if (!plot) return { eye: GARDEN_EYE, lookAt: GARDEN_TARGET };

    if (cameraMode === 'petal' && petalId) {
      const doc = docs[soulId];
      const index = doc?.petals.findIndex((p) => p.id === petalId) ?? -1;
      const total = doc?.petals.length ?? 0;
      if (index >= 0 && total > 0) {
        const p = petalFocusPose(plot.position, index, total);
        return { eye: p.eye, lookAt: p.lookAt };
      }
      // 花瓣已不存在（被撤回/删除）→ 退回整株花
      const f = flowerFocusPose(plot.position);
      return { eye: f.eye, lookAt: f.lookAt };
    }

    const f = flowerFocusPose(plot.position);
    return { eye: f.eye, lookAt: f.lookAt };
  }, [cameraMode, soulId, petalId, garden.plots, docs]);

  // 切换目标时记录过渡起点与时长 —— 让推近有明确的叙事节奏
  useEffect(() => {
    const dur =
      cameraMode === 'garden'
        ? CAMERA.dollyGardenToFlower
        : cameraMode === 'flower'
          ? CAMERA.dollyGardenToFlower
          : CAMERA.pushToPetal;

    transition.current = {
      from: currentLook.current.clone(),
      t: 0,
      dur: dur / 1000,
    };
  }, [cameraMode, soulId, petalId]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);

    // 花瓣实体化瞬间：镜头轻微拉远，给这个瞬间留出呼吸
    let distanceBoost = 0;
    if (celebrationAt > 0) {
      const elapsed = (performance.now() - celebrationAt) / 1000;
      if (elapsed < CAMERA.celebrationPullback / 1000) {
        const t = clamp01(elapsed / (CAMERA.celebrationPullback / 1000));
        // 快出慢回
        distanceBoost = Math.sin(t * Math.PI) * CAMERA.celebrationDistance;
      }
    }

    const eye = new THREE.Vector3(...pose.eye);
    const look = new THREE.Vector3(...pose.lookAt);

    if (distanceBoost > 0) {
      const dir = eye.clone().sub(look).normalize();
      eye.addScaledVector(dir, distanceBoost);
    }

    // Focus 态取景偏移：把整机位横向平移，让花落在左侧 Research Focus Space 的中心，
    // 右侧 38% 让给 Research Workspace。世界坐标不动，只是取景右移。
    if (cameraMode !== 'garden') {
      const viewDir = look.clone().sub(eye).normalize();
      const right = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
      const lateral = eye.distanceTo(look) * CAMERA.focusLateral;
      eye.addScaledVector(right, lateral);
      look.addScaledVector(right, lateral);
    }

    desiredPos.current.lerp(eye, 1 - Math.exp(-CAMERA.damping * delta));

    // 注视点的过渡用缓动曲线，避免视觉焦点「滑」过去
    const tr = transition.current;
    if (tr.t < 1) {
      tr.t = clamp01(tr.t + delta / Math.max(tr.dur, 0.001));
      desiredLook.current.copy(tr.from).lerp(look, easeInOutCubic(tr.t));
    } else {
      desiredLook.current.lerp(look, 1 - Math.exp(-CAMERA.damping * delta));
    }
    currentLook.current.copy(desiredLook.current);

    if (cameraMode === 'garden') {
      // 花园视图把控制权完全交给 OrbitControls
      const controls = controlsRef.current;
      if (controls) {
        const settled = camera.position.distanceTo(desiredPos.current) < 0.35;
        if (!controls.enabled && settled) {
          controls.target.copy(desiredLook.current);
          controls.update();
          controls.enabled = true;
        } else if (controls.enabled) {
          // 用户在自由观察：把阻尼状态同步到用户当前所在的位置，
          // 否则下一次推近一朵花时镜头会先「跳」回默认机位再飞过去。
          desiredPos.current.copy(camera.position);
          desiredLook.current.copy(controls.target);
          currentLook.current.copy(controls.target);
          return;
        }
      }
    } else {
      const controls = controlsRef.current;
      if (controls && controls.enabled) controls.enabled = false;
    }

    camera.position.copy(desiredPos.current);
    camera.lookAt(currentLook.current);
  });

  return null;
}
