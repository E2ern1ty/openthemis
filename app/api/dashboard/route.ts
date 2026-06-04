import { captureSnapshot, getLatestSnapshot, computeTrends, countSnapshots, type SnapshotTopic } from '@/lib/hot-topics';

/**
 * 看板数据
 * ─────────────────────────────────────────────────────────────
 * GET  /api/dashboard?channel=weibo&window=30&top=12
 *      返回最新快照概览 + 关键词趋势。若库中无快照则即时抓取一次。
 * POST /api/dashboard?channel=weibo
 *      主动抓取一次新快照（由前端定时刷新调用），返回最新看板数据。
 */

function summarize(topics: SnapshotTopic[]) {
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  const catMap = new Map<string, number>();
  for (const t of topics) {
    sentiment[t.sentiment]++;
    const c = t.category || '综合';
    catMap.set(c, (catMap.get(c) || 0) + 1);
  }
  const categories = [...catMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return { sentiment, categories, total: topics.length };
}

function buildPayload(channel: string, windowN: number, topN: number) {
  const latest = getLatestSnapshot(channel);
  const { snapshots, timeline, trends } = computeTrends(channel, windowN, topN);
  return {
    channel,
    capturedAt: latest?.capturedAt || null,
    snapshotCount: countSnapshots(channel),
    overview: latest ? summarize(latest.topics) : { sentiment: { positive: 0, neutral: 0, negative: 0 }, categories: [], total: 0 },
    topics: latest?.topics?.slice(0, 50) || [],
    timeline,
    trends,
    windowUsed: snapshots,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const channel = url.searchParams.get('channel') || 'weibo';
  const windowN = Math.min(Math.max(Number(url.searchParams.get('window')) || 30, 2), 200);
  const topN = Math.min(Math.max(Number(url.searchParams.get('top')) || 12, 1), 30);

  try {
    // 无任何快照时即时抓一次，保证看板首屏有数据
    if (countSnapshots(channel) === 0) {
      await captureSnapshot(channel).catch(() => null);
    }
    return Response.json(buildPayload(channel, windowN, topN));
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const channel = url.searchParams.get('channel') || 'weibo';
  const windowN = Math.min(Math.max(Number(url.searchParams.get('window')) || 30, 2), 200);
  const topN = Math.min(Math.max(Number(url.searchParams.get('top')) || 12, 1), 30);

  try {
    await captureSnapshot(channel);
    return Response.json(buildPayload(channel, windowN, topN));
  } catch (e) {
    // 抓取失败时仍返回已有数据 + 错误提示，避免看板空白
    return Response.json(
      { ...buildPayload(channel, windowN, topN), error: String((e as Error)?.message || e) },
      { status: 200 },
    );
  }
}
