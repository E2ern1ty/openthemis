import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const brand = (formData.get('brand') as string) || '';

    if (!file) {
      return Response.json({ error: '请选择文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return Response.json({ error: 'Excel 文件无有效工作表' }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]);
    if (rows.length === 0) {
      return Response.json({ error: 'Excel 文件无数据行' }, { status: 400 });
    }

    const headers = Object.keys(rows[0]);
    const mapping = detectColumns(headers);

    const db = getDb();
    const batchId = randomUUID();

    const insert = db.prepare(
      `INSERT INTO uploaded_reviews (app_name, brand, content, score, author, date, platform, batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    let inserted = 0;
    const insertMany = db.transaction((items: Record<string, unknown>[]) => {
      for (const row of items) {
        const mainContent = String(row[mapping.content] ?? '').trim();
        const titleContent = mapping.title ? String(row[mapping.title] ?? '').trim() : '';
        const content = titleContent && mainContent
          ? `${titleContent}. ${mainContent}`
          : mainContent || titleContent;
        if (!content) continue;

        const appName = String((row[mapping.appName] ?? brand) || 'Unknown App');
        const score = mapping.score ? Number(row[mapping.score]) || null : null;
        const author = mapping.author ? String(row[mapping.author] ?? '') : '';
        const date = mapping.date ? normalizeDate(String(row[mapping.date] ?? '')) : '';
        const platform = mapping.platform ? String(row[mapping.platform] ?? 'App Store') : 'App Store';

        insert.run(appName, brand || appName, content, score, author, date, platform, batchId);
        inserted++;
      }
    });

    insertMany(rows);

    return Response.json({
      success: true,
      batch_id: batchId,
      total: inserted,
      columns_detected: mapping,
      sample: rows.slice(0, 3),
    });
  } catch (err) {
    console.error('[Upload Reviews]', err);
    return Response.json(
      { error: `解析失败: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  const db = getDb();
  const batches = db.prepare(`
    SELECT batch_id, app_name, brand, platform, COUNT(*) as count,
           MIN(created_at) as uploaded_at
    FROM uploaded_reviews
    GROUP BY batch_id
    ORDER BY uploaded_at DESC
    LIMIT 20
  `).all();
  return Response.json(batches);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batch_id');
  if (!batchId) {
    return Response.json({ error: 'batch_id required' }, { status: 400 });
  }
  const db = getDb();
  db.prepare('DELETE FROM uploaded_reviews WHERE batch_id = ?').run(batchId);
  return Response.json({ success: true });
}

interface ColumnMapping {
  content: string;
  title: string | null;
  appName: string;
  score: string | null;
  author: string | null;
  date: string | null;
  platform: string | null;
}

function detectColumns(headers: string[]): ColumnMapping {
  const lower = headers.map(h => h.toLowerCase().trim());

  const findExact = (candidates: string[]): string | null => {
    for (const c of candidates) {
      const idx = lower.findIndex(h => h === c);
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  const find = (candidates: string[], exclude?: string[]): string | null => {
    const excl = new Set((exclude || []).map(e => e.toLowerCase()));
    for (const c of candidates) {
      const idx = lower.findIndex(h => h.includes(c) && !excl.has(h));
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  const date = findExact(['reviewdate', 'date', 'review_date', 'created_at'])
    || find(['date', 'time', '日期', '时间', 'created', 'posted']);

  const dateCol = date?.toLowerCase() || '';

  return {
    content: findExact(['content', 'text', 'body', '内容', '评论'])
      || find(['content', 'text', 'comment', '评论', '内容', 'body', 'review'], [dateCol])
      || headers[0],
    title: findExact(['title', '标题']),
    appName: findExact(['app', 'appname', 'app_name', '应用'])
      || find(['app', '应用', '名称', 'product'], [dateCol])
      || headers[0],
    score: find(['rating', 'score', 'star', '评分', '星级', 'rate']),
    author: find(['author', 'username', 'user', '用户', '作者', 'reviewer']),
    date,
    platform: find(['platform', 'store', '平台', 'source']),
  };
}

function normalizeDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toISOString().split('T')[0];
}
