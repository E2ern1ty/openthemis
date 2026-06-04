import { getDb } from '@/lib/db';
import type { Opportunity } from '@/lib/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const analysisId = searchParams.get('analysis_id');

  const db = getDb();
  let opportunities: Opportunity[];

  if (analysisId) {
    opportunities = db.prepare(
      'SELECT * FROM opportunities WHERE analysis_id = ? ORDER BY confidence DESC',
    ).all(analysisId) as Opportunity[];
  } else {
    opportunities = db.prepare(
      'SELECT * FROM opportunities ORDER BY created_at DESC LIMIT 20',
    ).all() as Opportunity[];
  }

  return Response.json(
    opportunities.map(o => ({
      ...o,
      evidence: JSON.parse(o.evidence || '[]'),
    })),
  );
}
