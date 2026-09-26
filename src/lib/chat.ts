/**
 * Soul Lab — Research Companion 消息与结构化卡片
 */
import type { DesignVerdict, EvidenceVerdict, IdeaResult, PaperMatch } from '../../shared/schemas';

export type ChatCard =
  | { kind: 'idea'; data: IdeaResult }
  | { kind: 'design'; data: DesignVerdict; proposal: string; experimentId?: string }
  | { kind: 'verdict'; data: EvidenceVerdict; experimentId: string }
  | { kind: 'papers'; data: PaperMatch[] }
  | { kind: 'error'; data: { code: string; message: string; detail?: string } }
  | { kind: 'note'; data: { text: string } };

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text?: string;
  card?: ChatCard;
  at: number;
}

export type AgentMode =
  | 'Idea Structuring'
  | 'Experiment Design'
  | 'Evidence Review'
  | 'Research Scout';

export type Focus =
  | { type: 'bud'; id: string; label: string }
  | { type: 'root'; id: string; label: string }
  | { type: 'petal'; id: string; label: string }
  | { type: 'leaf'; id: string; label: string }
  | { type: 'paper'; id: string; label: string }
  | { type: 'stem'; id: string; label: string }
  | null;
