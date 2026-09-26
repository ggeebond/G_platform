/**
 * Soul Lab — AgentBridge 工厂
 */
import { learnBuddyAdapter } from './LearnBuddyAdapter';
import { mockAdapter } from './MockAdapter';
import type { AdapterKind, AgentBridge } from './types';

let current: AdapterKind = 'learnbuddy';

export function setAdapter(kind: AdapterKind) {
  current = kind;
}

export function getAdapter(): AdapterKind {
  return current;
}

export function getBridge(kind: AdapterKind = current): AgentBridge {
  return kind === 'mock' ? mockAdapter : learnBuddyAdapter;
}

export * from './types';
