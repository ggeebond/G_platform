/**
 * Soul Lab — 本地持久化（Dexie / IndexedDB，失败回退 localStorage）
 *
 * 多 Soul：花园里每一株花都是一个独立 SoulDoc。
 */
import Dexie, { Table } from 'dexie';
import type { SoulDoc } from '../types';
import { emptyMemory } from '../frontier/memory';
import type { ResearchMemory } from '../frontier/types';

export interface SoulRecord {
  id: string;
  doc: SoulDoc;
  updatedAt: number;
}

/** Frontier 层的研究记忆（单条全局记录，key 固定） */
export interface MemoryRecord {
  key: string;
  memory: ResearchMemory;
  updatedAt: number;
}

class SoulLabDB extends Dexie {
  docs!: Table<SoulRecord, string>;
  memory!: Table<MemoryRecord, string>;
  constructor() {
    super('soullab');
    this.version(1).stores({ docs: 'id' });
    this.version(2).stores({ docs: 'id', memory: 'key' });
  }
}

let dbInstance: SoulLabDB | null = null;
function getDB(): SoulLabDB {
  if (!dbInstance) dbInstance = new SoulLabDB();
  return dbInstance;
}

const LS_KEY = 'soullab:garden';
const LS_MEM_KEY = 'soullab:research-memory';
const MEM_KEY = 'global';

export const soulDB = {
  /** 读取整个花园。空数组代表首次进入，需要播种。 */
  async loadAll(): Promise<SoulRecord[]> {
    try {
      const recs = await getDB().docs.toArray();
      if (recs.length > 0) return recs.sort((a, b) => a.updatedAt - b.updatedAt);
    } catch {
      /* IndexedDB 不可用时回退 */
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SoulRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async save(doc: SoulDoc): Promise<void> {
    const rec: SoulRecord = { id: doc.soul.id, doc, updatedAt: Date.now() };
    try {
      await getDB().docs.put(rec);
    } catch {
      /* ignore */
    }
    await this.writeMirror();
  },

  async saveMany(docs: SoulDoc[]): Promise<void> {
    const recs = docs.map((doc) => ({ id: doc.soul.id, doc, updatedAt: Date.now() }));
    try {
      await getDB().docs.bulkPut(recs);
    } catch {
      /* ignore */
    }
    await this.writeMirror();
  },

  async remove(id: string): Promise<void> {
    try {
      await getDB().docs.delete(id);
    } catch {
      /* ignore */
    }
    await this.writeMirror();
  },

  async clear(): Promise<void> {
    try {
      await getDB().docs.clear();
      await getDB().memory.clear();
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_MEM_KEY);
    } catch {
      /* ignore */
    }
  },

  /**
   * 读取 Research Memory —— 「不重复推送」的地基：
   * 刷新后依然记得你看过哪些论文、哪些机制已经出现过。
   */
  async loadMemory(): Promise<ResearchMemory> {
    try {
      const rec = await getDB().memory.get(MEM_KEY);
      if (rec?.memory) return rec.memory;
    } catch {
      /* IndexedDB 不可用时回退 */
    }
    try {
      const raw = localStorage.getItem(LS_MEM_KEY);
      if (raw) return JSON.parse(raw) as ResearchMemory;
    } catch {
      /* ignore */
    }
    return emptyMemory();
  },

  async saveMemory(memory: ResearchMemory): Promise<void> {
    try {
      await getDB().memory.put({ key: MEM_KEY, memory, updatedAt: Date.now() });
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(LS_MEM_KEY, JSON.stringify(memory));
    } catch {
      /* ignore */
    }
  },

  /** localStorage 只作为镜像备份，读路径永远优先 IndexedDB */
  async writeMirror(): Promise<void> {
    try {
      const recs = await getDB().docs.toArray();
      localStorage.setItem(LS_KEY, JSON.stringify(recs));
    } catch {
      /* ignore */
    }
  },
};
