import { getDb } from './db';

export interface PromptRecord {
  id: string;
  module: string;
  name: string;
  description: string;
  content: string;
  is_default: number;
  updated_at: string;
}

export interface PromptMeta {
  id: string;
  module: string;
  name: string;
  description: string;
}

export const PROMPT_META: PromptMeta[] = [
  { id: 'sentiment',     module: '舆情分析', name: '情感分析',   description: '对采集到的舆情内容进行正面/中性/负面情感分类' },
  { id: 'topic',         module: '舆情分析', name: '主题聚类',   description: '对舆情内容进行主题聚类，识别核心话题和情感倾向' },
  { id: 'negative',      module: '舆情分析', name: '负面深挖',   description: '从负面舆情中识别高频痛点并判断严重性' },
  { id: 'opportunity',   module: '舆情分析', name: '舆情研判',   description: '将舆情信号提炼为关键研判点与应对建议' },
  { id: 'brand_suggest', module: '舆情分析', name: '关键词生成', description: '根据监测主题生成多维度舆情监测关键词' },
  { id: 'assistant',     module: '全局',     name: 'AI 助手',   description: '跨页面的综合问答助手' },
];

export function getPrompt(id: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT content FROM prompts WHERE id = ?').get(id) as { content: string } | undefined;
  return row?.content || null;
}

export function getAllPrompts(): PromptRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM prompts ORDER BY module, id').all() as PromptRecord[];
}

export function upsertPrompt(id: string, content: string, meta?: PromptMeta): void {
  const db = getDb();
  const m = meta || PROMPT_META.find(p => p.id === id);
  if (!m) return;
  db.prepare(
    `INSERT INTO prompts (id, module, name, description, content, is_default, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET content = ?, is_default = 0, updated_at = CURRENT_TIMESTAMP`
  ).run(m.id, m.module, m.name, m.description, content, content);
}

export function seedPrompt(id: string, defaultContent: string): void {
  const db = getDb();
  const m = PROMPT_META.find(p => p.id === id);
  if (!m) return;
  db.prepare(
    `INSERT OR IGNORE INTO prompts (id, module, name, description, content, is_default) VALUES (?, ?, ?, ?, ?, 1)`
  ).run(m.id, m.module, m.name, m.description, defaultContent);
}

export function resetPrompt(id: string, defaultContent: string): void {
  const db = getDb();
  db.prepare('UPDATE prompts SET content = ?, is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(defaultContent, id);
}
