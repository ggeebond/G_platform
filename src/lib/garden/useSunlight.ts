/**
 * 阳光机制的 React 入口：花园里任何地方（3D 场景 / HUD）都从这里读同一份光照。
 */
import { useMemo } from 'react';
import { useSoulStore } from '../../stores/soulStore';
import { computeGardenSunlight, type GardenSunlight } from './sunlight';

export function useGardenSunlight(): GardenSunlight {
  const docs = useSoulStore((s) => s.docs);
  const order = useSoulStore((s) => s.order);
  return useMemo(
    () => computeGardenSunlight(order.map((id) => docs[id]).filter(Boolean)),
    [docs, order],
  );
}
