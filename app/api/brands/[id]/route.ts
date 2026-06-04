import { getDb } from '@/lib/db';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare('DELETE FROM brands WHERE id = ?').run(id);

  if (result.changes === 0) {
    return Response.json({ error: '品牌不存在' }, { status: 404 });
  }
  return Response.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  if (typeof body.is_own === 'number') {
    if (body.is_own === 1) {
      db.prepare('UPDATE brands SET is_own = 0').run();
    }
    db.prepare('UPDATE brands SET is_own = ? WHERE id = ?').run(body.is_own, id);
  }

  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
  if (!brand) return Response.json({ error: '品牌不存在' }, { status: 404 });
  return Response.json(brand);
}
