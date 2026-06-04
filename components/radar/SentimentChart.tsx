'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { SentimentResult } from '@/lib/types';
import RefButton from '@/components/layout/RefButton';

interface Props {
  data: SentimentResult;
  analysisId?: number;
}

const COLORS = {
  positive: '#10b981',
  neutral: '#94a3b8',
  negative: '#ef4444',
};

function renderPieLabel(entry: { name?: string; percent?: number }): string {
  return `${entry.name ?? ''} ${((entry.percent ?? 0) * 100).toFixed(0)}%`;
}

export default function SentimentChart({ data, analysisId }: Props) {
  const total = data.positive + data.neutral + data.negative;
  const chartData = [
    { name: '正面', value: data.positive, color: COLORS.positive },
    { name: '中性', value: data.neutral, color: COLORS.neutral },
    { name: '负面', value: data.negative, color: COLORS.negative },
  ];

  return (
    <div className="card p-4 relative group/card">
      <RefButton
        reference={{
          id: `radar-sentiment-${analysisId}`,
          label: '情感分布',
          type: 'radar_sentiment',
          data: { positive: data.positive, neutral: data.neutral, negative: data.negative, total },
        }}
        className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity"
      />
      <h3 className="text-sm font-semibold text-slate-500 mb-3">情感分布</h3>
      <div className="h-52" style={{ minWidth: 200 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={100}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              label={renderPieLabel as never}
              labelLine={false}
            >
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} 条 (${((Number(value) / total) * 100).toFixed(1)}%)`, String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        {chartData.map(d => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-slate-600">{d.name} {d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
