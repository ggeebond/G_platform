/**
 * Soul Lab — 音频线索（Sound Cues）
 *
 * 状态变化 → 音效线索。目的：让「实体化」这一最高成就时刻有完整的反馈，
 * 而不是只有一段动画。无音频素材依赖 —— 用 WebAudio 合成极短的质感音作为占位，
 * 真机音色就绪后替换 CUE_TABLE 的参数即可，调用点不变。
 *
 * 注意：浏览器要求用户手势后才能出声；进入花园后第一次点击会调用 unlockAudio()。
 */
export interface CueSpec {
  freq: number;
  duration: number;
  type: OscillatorType;
  gain: number;
}

export const CUE_TABLE = {
  /** 设计通过：轻、短、上行 */
  design_accepted: { freq: 520, duration: 0.16, type: 'sine', gain: 0.05 },
  /** 实体化：最重的一击（成就时刻） */
  solidify: { freq: 784, duration: 0.5, type: 'triangle', gain: 0.09 },
  /** 黄叶：低沉，代表边界而非惩罚 */
  yellow_leaf: { freq: 196, duration: 0.42, type: 'sawtooth', gain: 0.05 },
  /** 撤回：退场 */
  withdraw: { freq: 300, duration: 0.3, type: 'sine', gain: 0.04 },
  /** 前沿信号：明亮的提示音 */
  frontier_signal: { freq: 660, duration: 0.22, type: 'sine', gain: 0.05 },
} as const;

export type CueName = keyof typeof CUE_TABLE;

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 用户手势后调用一次，解锁音频上下文（浏览器自动播放策略） */
export function unlockAudio(): void {
  ensureCtx();
}

export function playCue(name: CueName): void {
  const spec = CUE_TABLE[name];
  const ac = ensureCtx();
  if (!ac || !spec) return;

  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(spec.gain, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + spec.duration + 0.02);
}
