'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TrendChart, { type KeywordTrend } from '@/components/dashboard/TrendChart';

interface SnapshotTopic {
  rank: number;
  word: string;
  category: string;
  hotValue: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  url: string;
}

interface DashboardData {
  channel: string;
  capturedAt: string | null;
  snapshotCount: number;
  overview: {
    sentiment: { positive: number; neutral: number; negative: number };
    categories: Array<{ name: string; count: number }>;
    total: number;
  };
  topics: SnapshotTopic[];
  timeline: string[];
  trends: KeywordTrend[];
  windowUsed: number;
  error?: string;
}

const REFRESH_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '30 秒', value: 30 },
  { label: '1 分钟', value: 60 },
  { label: '5 分钟', value: 300 },
  { label: '10 分钟', value: 600 },
];

const SENT = {
  positive: { label: '正面', text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', bar: '#10b981' },
  neutral: { label: '中性', text: 'text-slate-600', bg: 'bg-slate-50 border-slate-100', bar: '#94a3b8' },
  negative: { label: '负面', text: 'text-red-500', bg: 'bg-red-50 border-red-100', bar: '#ef4444' },
} as const;

function fmtHot(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万';
  return String(v);
}
function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [interval, setIntervalSec] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedInit = useRef(false);

  const applyData = useCallback((d: DashboardData) => {
    setData(d);
    setError(d.error || null);
    // 首次加载默认选中前 5 个关键词
    if (!selectedInit.current && d.trends.length > 0) {
      setSelected(d.trends.slice(0, 5).map((t) => t.word));
      selectedInit.current = true;
    }
  }, []);

  // 读取看板数据（不抓新快照）
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard?window=40&top=14');
      const d: DashboardData = await r.json();
      applyData(d);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  // 抓取新快照
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch('/api/dashboard?window=40&top=14', { method: 'POST' });
      const d: DashboardData = await r.json();
      applyData(d);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setRefreshing(false);
    }
  }, [applyData]);

  useEffect(() => { load(); }, [load]);

  // 定时刷新
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (interval > 0) {
      setCountdown(interval);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { refresh(); return interval; }
          return c - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [interval, refresh]);

  const toggleKeyword = (word: string) => {
    setSelected((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : prev.length >= 8 ? prev : [...prev, word],
    );
  };

  const ov = data?.overview;
  const total = ov?.total || 0;
  const sentEntries = (['positive', 'neutral', 'negative'] as const).map((k) => ({
    key: k, count: ov?.sentiment[k] || 0,
    pct: total > 0 ? Math.round(((ov?.sentiment[k] || 0) / total) * 100) : 0,
  }));
  const maxCat = Math.max(1, ...(ov?.categories.map((c) => c.count) || [1]));

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">舆情看板</h1>
          <p className="text-sm text-slate-500 mt-1">
            微博热搜实时监测 · 话题关键词趋势
            {data?.capturedAt && <span className="ml-2 text-slate-400">最近更新 {fmtTime(data.capturedAt)}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* refresh interval selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
            </svg>
            <span className="text-xs text-slate-500">定时刷新</span>
            <select
              value={interval}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
              className="text-xs bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              {REFRESH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {interval > 0 && (
              <span className="text-[10px] text-blue-500 tabular-nums w-9 text-right">{countdown}s</span>
            )}
          </div>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'animate-spin' : ''}>
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
            </svg>
            {refreshing ? '抓取中' : '立即刷新'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-3 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* sentiment */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-500">情感分布</h3>
            <span className="text-[11px] text-slate-400">共 {total} 条</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sentEntries.map((s) => (
              <div key={s.key} className={`rounded-lg py-3 text-center border ${SENT[s.key].bg}`}>
                <div className={`text-xl font-bold ${SENT[s.key].text}`}>{s.pct}%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{SENT[s.key].label} · {s.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* categories */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-500 mb-3">话题分类分布</h3>
          {ov && ov.categories.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-5 gap-y-2">
              {ov.categories.map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600 w-16 shrink-0 truncate">{c.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-400 to-blue-300 rounded-full" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 w-6 text-right tabular-nums">{c.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">暂无数据</p>
          )}
        </div>
      </div>

      {/* Trend chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-500">话题关键词热度趋势</h3>
          <span className="text-[11px] text-slate-400">
            {data ? `${data.windowUsed} 个快照 · 已采集 ${data.snapshotCount} 次` : ''}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">点选下方关键词加入/移出趋势图（最多 8 个）</p>

        <TrendChart timeline={data?.timeline || []} trends={data?.trends || []} selected={selected} />

        {/* keyword chips */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
          {(data?.trends || []).map((t) => {
            const on = selected.includes(t.word);
            const up = t.deltaHot > 0, down = t.deltaHot < 0;
            return (
              <button
                key={t.word}
                onClick={() => toggleKeyword(t.word)}
                title={`${t.category || '综合'} · 出现 ${t.appearances} 次 · 峰值 ${fmtHot(t.peakHot)}`}
                className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-xs border transition-all ${
                  on ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SENT[t.sentiment].bar }} />
                <span className="max-w-[160px] truncate">{t.word}</span>
                {t.latestRank !== null && (
                  <span className={`text-[9px] ${on ? 'text-blue-100' : 'text-slate-400'}`}>#{t.latestRank}</span>
                )}
                {(up || down) && (
                  <span className={`text-[9px] ${up ? (on ? 'text-emerald-200' : 'text-emerald-500') : (on ? 'text-red-200' : 'text-red-400')}`}>
                    {up ? '↑' : '↓'}
                  </span>
                )}
              </button>
            );
          })}
          {(!data || data.trends.length === 0) && (
            <span className="text-xs text-slate-400">暂无关键词，刷新后生成</span>
          )}
        </div>
      </div>

      {/* Live topic ranking */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-500 mb-3">实时热搜榜（最新快照）</h3>
        {data && data.topics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
            {data.topics.slice(0, 30).map((t) => (
              <a
                key={t.rank + t.word}
                href={t.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <span className={`text-xs font-bold tabular-nums w-5 text-center shrink-0 ${t.rank <= 3 ? 'text-red-500' : 'text-slate-300'}`}>{t.rank}</span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: SENT[t.sentiment].bar }} />
                <span className="text-sm text-slate-700 flex-1 truncate group-hover:text-blue-600">{t.word}</span>
                {t.category && <span className="text-[10px] text-slate-400 shrink-0">{t.category}</span>}
                <span className="text-[11px] text-slate-400 tabular-nums w-12 text-right shrink-0">{fmtHot(t.hotValue)}</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400">
            {loading ? '加载中…' : '暂无数据，点击「立即刷新」从微博采集'}
          </div>
        )}
      </div>
    </div>
  );
}
