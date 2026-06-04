'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export interface KeywordTrend {
  word: string;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  latestHot: number;
  latestRank: number | null;
  peakHot: number;
  appearances: number;
  deltaHot: number;
  series: Array<{ capturedAt: string; hotValue: number; rank: number | null }>;
}

interface Props {
  timeline: string[];
  trends: KeywordTrend[];
  selected: string[];
}

// 给不同关键词分配稳定的颜色
const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function fmtHot(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万';
  return String(v);
}

export default function TrendChart({ timeline, trends, selected }: Props) {
  const shown = trends.filter((t) => selected.includes(t.word));

  // 构造 recharts 数据：每个时间点一行，每个关键词一列
  const data = timeline.map((t, idx) => {
    const row: Record<string, number | string | null> = { time: fmtTime(t) };
    for (const tr of shown) {
      const p = tr.series[idx];
      row[tr.word] = p && p.rank !== null ? p.hotValue : null;
    }
    return row;
  });

  if (timeline.length < 2) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-center text-slate-400">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3">
          <path d="M3 3v18h18" /><path d="M7 14l4-4 4 3 4-6" />
        </svg>
        <p className="text-sm">趋势需要至少 2 次快照</p>
        <p className="text-xs mt-1">点击「立即刷新」或开启定时刷新，积累数据后这里会显示关键词热度趋势</p>
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => fmtHot(Number(v))}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [value == null ? '未上榜' : fmtHot(Number(value)), String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {shown.map((tr, i) => (
            <Line
              key={tr.word}
              type="monotone"
              dataKey={tr.word}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
