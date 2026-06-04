import { retryAnalysis } from '@/lib/analysis';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysisId = Number(id);

  if (!analysisId || isNaN(analysisId)) {
    return Response.json({ error: '无效的分析 ID' }, { status: 400 });
  }

  try {
    retryAnalysis(analysisId).catch(err => {
      console.error(`Retry ${analysisId} background error:`, err);
    });

    return Response.json({ id: analysisId, status: 'processing' });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
