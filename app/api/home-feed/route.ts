/**
 * 首页实时舆情 Feed
 * ─────────────────────────────────────────────────────────────
 * 启动后首次请求时，从微博渠道（OpenCLI weibo hot）随机捞取热搜话题，
 * 作为首页展示数据，替代固定 mock。结果在进程生命周期内缓存（"每次启动"拉取一次）。
 * 采集层不可用 / 未登录时优雅降级为内置示例数据。
 */

import type { HomeFeed, HomeFeedTopic } from '@/lib/home-feed-types';
import { guessSentiment } from '@/lib/sentiment-heuristic';

interface HotTopic {
  rank: number;
  word: string;
  category: string;
  label: string;
  hotValue: number;
  url: string;
}

// 进程级缓存：启动后只拉取一次
let cached: HomeFeed | null = null;
let inflight: Promise<HomeFeed> | null = null;

function collectorBase(): string {
  return (process.env.COLLECTOR_URL || 'http://localhost:4001').replace(/\/$/, '');
}
function authHeaders(): Record<string, string> {
  const token = process.env.COLLECTOR_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 轻量情感启发式（共享自 lib/sentiment-heuristic），仅用于首页观感
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildFeed(topics: HotTopic[], live: boolean, source: string): HomeFeed {
  // 随机抽样最多 50 条作为"舆论"
  const sampled = shuffle(topics).slice(0, 50);
  const enriched: HomeFeedTopic[] = sampled.map(t => ({
    word: t.word,
    category: t.category || '综合',
    hotValue: t.hotValue,
    sentiment: guessSentiment(t),
    url: t.url,
  }));

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const e of enriched) sentiment[e.sentiment]++;

  // 话题热度榜：按热度降序取前若干
  const topTopics = [...enriched].sort((a, b) => b.hotValue - a.hotValue).slice(0, 6);
  // 风险研判样例：优先负面里热度最高的
  const alert = [...enriched]
    .filter(e => e.sentiment === 'negative')
    .sort((a, b) => b.hotValue - a.hotValue)[0] || null;

  return {
    live,
    source,
    fetchedAt: new Date().toISOString(),
    total: topics.length,
    sampled: enriched.length,
    sentiment,
    topTopics,
    alert,
  };
}

// 内置降级数据（采集层不可用时）
function fallbackFeed(): HomeFeed {
  const demo: HotTopic[] = [
    { rank: 1, word: '新能源汽车销量创新高', category: '财经', label: '', hotValue: 980000, url: '' },
    { rank: 2, word: '某品牌客服响应慢被投诉', category: '社会', label: '', hotValue: 760000, url: '' },
    { rank: 3, word: '国货美妆集体出海', category: '财经', label: '', hotValue: 640000, url: '' },
    { rank: 4, word: '热门剧集口碑两极分化', category: '剧集', label: '', hotValue: 520000, url: '' },
    { rank: 5, word: '城市夜经济点亮消费', category: '社会', label: '', hotValue: 410000, url: '' },
    { rank: 6, word: '某产品质量问题曝光', category: '社会', label: '', hotValue: 350000, url: '' },
    { rank: 7, word: '马拉松赛事破纪录', category: '运动健身', label: '', hotValue: 300000, url: '' },
    { rank: 8, word: '直播电商监管新规', category: '国内时政', label: '', hotValue: 260000, url: '' },
  ];
  return buildFeed(demo, false, 'demo');
}

async function fetchFeed(): Promise<HomeFeed> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    const res = await fetch(`${collectorBase()}/weibo/hot?limit=50`, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    const topics: HotTopic[] = Array.isArray(data?.topics) ? data.topics : [];
    if (!res.ok || topics.length === 0) {
      return fallbackFeed();
    }
    return buildFeed(topics, true, '微博热搜');
  } catch {
    return fallbackFeed();
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === '1';

  if (cached && !refresh) {
    return Response.json(cached);
  }
  if (!inflight) {
    inflight = fetchFeed().then(feed => {
      cached = feed;
      inflight = null;
      return feed;
    });
  }
  const feed = await inflight;
  return Response.json(feed);
}
