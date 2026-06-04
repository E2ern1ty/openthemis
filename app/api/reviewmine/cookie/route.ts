import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.cwd(), 'data', 'reviewmine-token.txt');

function ensureDir() {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getReviewMineToken(): string {
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
  } catch {
    return '';
  }
}

export async function GET() {
  ensureDir();
  const token = getReviewMineToken();
  return Response.json({
    saved: !!token,
    preview: token ? token.slice(0, 20) + '...' : '',
  });
}

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token || typeof token !== 'string') {
    return Response.json({ error: '请提供 auth_token' }, { status: 400 });
  }
  ensureDir();
  fs.writeFileSync(TOKEN_FILE, token.trim(), 'utf-8');
  return Response.json({ success: true });
}

export async function DELETE() {
  ensureDir();
  if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
  return Response.json({ success: true });
}
