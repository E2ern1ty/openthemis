import { getDb } from '@/lib/db';
import { processAnalysis } from '@/lib/analysis';
import type { Analysis } from '@/lib/types';

export async function GET() {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, brands, date_range, status, progress, total_items, created_at, completed_at FROM analyses ORDER BY created_at DESC LIMIT 20',
  ).all() as Analysis[];

  const list = rows.map(r => ({
    id: r.id,
    brands: JSON.parse(r.brands),
    ownBrand: (r as Record<string, unknown>).own_brand || '',
    researchQuestion: (r as Record<string, unknown>).research_question || '',
    dateRange: JSON.parse(r.date_range),
    status: r.status,
    progress: r.progress,
    totalItems: r.total_items,
    createdAt: r.created_at ? r.created_at.replace(' ', 'T') + 'Z' : '',
    completedAt: r.completed_at ? r.completed_at.replace(' ', 'T') + 'Z' : '',
  }));

  return Response.json(list);
}

export async function POST(request: Request) {
  const { brands, ownBrand, dateRange, sourceIds, researchQuestion } = await request.json();

  if (!brands || !Array.isArray(brands) || brands.length === 0) {
    return Response.json({ error: '请至少选择一个品牌' }, { status: 400 });
  }

  const range = dateRange || {
    start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  };

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO analyses (brands, own_brand, date_range, status, progress, research_question) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(JSON.stringify(brands), ownBrand || '', JSON.stringify(range), 'processing', 0, researchQuestion || '');

  const analysisId = Number(result.lastInsertRowid);

  processAnalysis(analysisId, brands, range, sourceIds, ownBrand || '').catch(err => {
    console.error('Analysis failed:', err);
    db.prepare('UPDATE analyses SET status = ? WHERE id = ?').run('error', analysisId);
  });

  return Response.json({ id: analysisId, status: 'processing' });
}
