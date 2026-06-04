import { getDb } from '@/lib/db';
import type { Brand } from '@/lib/types';

export async function GET() {
  const db = getDb();
  const brands = db.prepare('SELECT * FROM brands ORDER BY id').all() as Brand[];
  return Response.json(brands);
}

export async function POST(request: Request) {
  const { name, industry } = await request.json();
  if (!name) return Response.json({ error: '品牌名称不能为空' }, { status: 400 });

  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO brands (name, industry) VALUES (?, ?)').run(name, industry || '出行');
    return Response.json({ id: result.lastInsertRowid, name, industry: industry || '出行' }, { status: 201 });
  } catch {
    return Response.json({ error: '品牌已存在' }, { status: 409 });
  }
}
