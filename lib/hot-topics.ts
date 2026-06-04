/**
 * 热搜话题快照与趋势
 * ─────────────────────────────────────────────────────────────
 * 从采集层（OpenCLI weibo hot）拉取热搜话题，落库为时间序列快照，
 * 供看板做「话题/关键词趋势」分析。
 */

import { getDb } from './db';
import { guessSentiment, type Sentiment } from './sentiment-heuristic';

export interface SnapshotTopic {
  rank: number;
  word: string;
  category: string;
  hotValue: number;
  sentiment: Sentiment;
  url: string;
}

export interface HotSnapshot {
  id: number;
  channel: string;
  capturedAt: string;
  topics: SnapshotTopic[];
}

function collectorBase(): string {
  return (process.env.COLLECTOR_URL || 'http://localhost:4001').replace(/\/$/, '');
}
function authHeaders(): Record<string, string> {
  const token = process.env.COLLECTOR_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface RawHot {
  rank?: number;
  word?: string;
  category?: string;
  hotValue?: number;
  url?: string;
}

/** 从采集层拉取一次微博热搜并落库为快照。返回该快照。 */
export async function captureSnapshot(channel = 'weibo', limit = 50): Promise<HotSnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let topics: SnapshotTopic[] = [];
  try {
    const res = await fetch(`${collectorBase()}/${channel}/hot?limit=${limit}`, {
      headers: authHeaders(),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    const raw: RawHot[] = Array.isArray(data?.topics) ? data.topics : [];
    topics = raw
      .map((t) => ({
        rank: Number(t.rank) || 0,
        word: String(t.word || '').trim(),
        category: String(t.category || '').trim(),
        hotValue: Number(t.hotValue) || 0,
        sentiment: guessSentiment({ word: String(t.word || ''), category: t.category, rank: t.rank }),
        url: String(t.url || ''),
      }))
      .filter((t) => t.word.length > 0);
  } finally {
    clearTimeout(timer);
  }

  if (topics.length === 0) {
    throw new Error('采集层未返回热搜数据（请确认 collector 已启动且微博可访问）');
  }

  const db = getDb();
  const info = db
    .prepare('INSERT INTO hot_snapshots (channel, topics) VALUES (?, ?)')
    .run(channel, JSON.stringify(topics));

  // 仅保留最近 200 个快照，避免无限增长
  db.prepare(
    `DELETE FROM hot_snapshots WHERE channel = ? AND id NOT IN (
       SELECT id FROM hot_snapshots WHERE channel = ? ORDER BY captured_at DESC LIMIT 200
     )`,
  ).run(channel, channel);

  return {
    id: Number(info.lastInsertRowid),
    channel,
    capturedAt: new Date().toISOString(),
    topics,
  };
}

function rowToSnapshot(row: { id: number; channel: string; captured_at: string; topics: string }): HotSnapshot {
  let topics: SnapshotTopic[] = [];
  try { topics = JSON.parse(row.topics); } catch { /* ignore */ }
  return {
    id: row.id,
    channel: row.channel,
    capturedAt: row.captured_at ? row.captured_at.replace(' ', 'T') + 'Z' : '',
    topics,
  };
}

export function getLatestSnapshot(channel = 'weibo'): HotSnapshot | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM hot_snapshots WHERE channel = ? ORDER BY captured_at DESC LIMIT 1')
    .get(channel) as { id: number; channel: string; captured_at: string; topics: string } | undefined;
  return row ? rowToSnapshot(row) : null;
}

export function getSnapshots(channel = 'weibo', limit = 30): HotSnapshot[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM hot_snapshots WHERE channel = ? ORDER BY captured_at DESC LIMIT ?')
    .all(channel, limit) as Array<{ id: number; channel: string; captured_at: string; topics: string }>;
  return rows.map(rowToSnapshot).reverse(); // 时间正序
}

export function countSnapshots(channel = 'weibo'): number {
  const db = getDb();
  const r = db.prepare('SELECT COUNT(*) as c FROM hot_snapshots WHERE channel = ?').get(channel) as { c: number };
  return r.c;
}

// ─── 趋势计算 ───────────────────────────────────────────────

export interface TrendPoint {
  capturedAt: string;
  hotValue: number;
  rank: number | null; // 该时刻是否在榜（null = 未上榜）
}

export interface KeywordTrend {
  word: string;
  category: string;
  sentiment: Sentiment;
  latestHot: number;
  latestRank: number | null;
  peakHot: number;
  appearances: number;       // 在多少个快照里出现
  deltaHot: number;          // 最新 vs 上一次 的热度变化
  series: TrendPoint[];
}

/**
 * 基于最近 N 个快照，计算各关键词的趋势序列。
 * 返回按「最新热度」降序的关键词趋势，最多 topN 个。
 */
export function computeTrends(channel = 'weibo', snapshotLimit = 30, topN = 12): {
  snapshots: number;
  timeline: string[];
  trends: KeywordTrend[];
} {
  const snaps = getSnapshots(channel, snapshotLimit);
  const timeline = snaps.map((s) => s.capturedAt);

  // 聚合每个 word 在各快照中的表现
  const byWord = new Map<string, { category: string; sentiment: Sentiment; points: Map<number, { hot: number; rank: number }> }>();
  snaps.forEach((snap, idx) => {
    for (const t of snap.topics) {
      let e = byWord.get(t.word);
      if (!e) {
        e = { category: t.category, sentiment: t.sentiment, points: new Map() };
        byWord.set(t.word, e);
      }
      // 用最新出现时的分类/情感
      e.category = t.category || e.category;
      e.sentiment = t.sentiment;
      e.points.set(idx, { hot: t.hotValue, rank: t.rank });
    }
  });

  const trends: KeywordTrend[] = [];
  for (const [word, e] of byWord) {
    const series: TrendPoint[] = snaps.map((s, idx) => {
      const p = e.points.get(idx);
      return { capturedAt: s.capturedAt, hotValue: p ? p.hot : 0, rank: p ? p.rank : null };
    });
    const present = series.filter((p) => p.rank !== null);
    const latest = series[series.length - 1];
    const prevPresent = [...series].slice(0, -1).reverse().find((p) => p.rank !== null);
    const latestHot = latest?.hotValue ?? 0;
    const peakHot = Math.max(0, ...series.map((p) => p.hotValue));
    trends.push({
      word,
      category: e.category,
      sentiment: e.sentiment,
      latestHot,
      latestRank: latest?.rank ?? null,
      peakHot,
      appearances: present.length,
      deltaHot: prevPresent ? latestHot - prevPresent.hotValue : 0,
      series,
    });
  }

  // 排序：最新在榜的优先，按最新热度降序；都不在榜则按峰值
  trends.sort((a, b) => {
    const aOn = a.latestRank !== null ? 1 : 0;
    const bOn = b.latestRank !== null ? 1 : 0;
    if (aOn !== bOn) return bOn - aOn;
    if (aOn) return b.latestHot - a.latestHot;
    return b.peakHot - a.peakHot;
  });

  return { snapshots: snaps.length, timeline, trends: trends.slice(0, topN) };
}
