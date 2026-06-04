import { getDb } from '@/lib/db';
import type { Analysis, Opportunity, AnalysisResult, RawDataItem } from '@/lib/types';

function normalizeSource(raw: string): string {
  if (raw === '小红书') return '小红书';
  if (raw === '导入数据') return '导入数据';
  return '微博';
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id) as Analysis | undefined;
  if (!analysis) {
    return Response.json({ error: '分析任务不存在' }, { status: 404 });
  }

  const opportunities = db.prepare('SELECT * FROM opportunities WHERE analysis_id = ?').all(id) as Opportunity[];

  const rawRows = db.prepare(
    'SELECT source, brand, content, likes, date, url, sentiment FROM raw_data WHERE analysis_id = ? ORDER BY date DESC, likes DESC LIMIT 500',
  ).all(id) as RawDataItem[];

  const normalizedSources = [...new Set(rawRows.map(r => normalizeSource(r.source)))];

  const createdAtRaw = analysis.created_at || '';
  const createdAt = createdAtRaw ? createdAtRaw.replace(' ', 'T') + 'Z' : '';

  const result: AnalysisResult & { researchQuestion?: string; createdAt?: string } = {
    id: analysis.id,
    status: analysis.status,
    progress: analysis.progress,
    brands: JSON.parse(analysis.brands),
    ownBrand: analysis.own_brand || undefined,
    researchQuestion: (analysis as Record<string, unknown>).research_question as string || '',
    createdAt,
    dateRange: JSON.parse(analysis.date_range),
    totalItems: analysis.total_items,
    sentiment: analysis.sentiment_result ? JSON.parse(analysis.sentiment_result) : null,
    topics: analysis.topic_result ? JSON.parse(analysis.topic_result) : null,
    topNegative: analysis.top_negative ? JSON.parse(analysis.top_negative) : null,
    opportunities: opportunities.map(o => ({
      title: o.title,
      description: o.description,
      confidence: o.confidence,
      evidence: JSON.parse(o.evidence || '[]'),
      brand: o.brand,
      topic: o.topic,
    })),
    sources: normalizedSources,
    rawItems: rawRows.map(r => ({
      source: normalizeSource(r.source),
      brand: r.brand,
      content: r.content,
      likes: r.likes,
      date: r.date,
      url: r.url,
      sentiment: r.sentiment,
    })),
  };

  return Response.json(result);
}
