'use client';

import { useState } from 'react';
import type { TopicResult } from '@/lib/types';
import RefButton from '@/components/layout/RefButton';

interface Props {
  data: TopicResult;
  analysisId?: number;
}

const SENTIMENT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  positive: { bg: 'bg-green-50', text: 'text-green-700', label: '正面' },
  neutral: { bg: 'bg-slate-50', text: 'text-slate-600', label: '中性' },
  negative: { bg: 'bg-red-50', text: 'text-red-700', label: '负面' },
  mixed: { bg: 'bg-amber-50', text: 'text-amber-700', label: '混合' },
};

export default function TopicList({ data, analysisId }: Props) {
  const maxCount = Math.max(...data.topics.map(t => t.count), 1);
  const totalCount = data.topics.reduce((s, t) => s + t.count, 0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="card p-4 relative group/card">
      <RefButton
        reference={{
          id: `radar-topic-${analysisId}`,
          label: '主题分布',
          type: 'radar_topic',
          data: data.topics.map(t => ({ name: t.name, count: t.count, sentiment: t.sentiment, keywords: t.keywords })),
        }}
        className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity"
      />
      <h3 className="text-sm font-semibold text-slate-500 mb-3">主题分布</h3>
      <div className="space-y-2.5">
        {data.topics.map((topic, idx) => {
          const style = SENTIMENT_STYLE[topic.sentiment] || SENTIMENT_STYLE.neutral;
          const width = (topic.count / maxCount) * 100;
          const pct = totalCount > 0 ? Math.round((topic.count / totalCount) * 100) : 0;
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={topic.name}
              className={`relative rounded-lg px-3 py-2 -mx-3 transition-colors cursor-default ${isHovered ? 'bg-slate-50' : ''}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">{topic.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{topic.count} 条</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${width}%`,
                    backgroundColor: topic.sentiment === 'positive' ? '#10b981'
                      : topic.sentiment === 'negative' ? '#ef4444'
                      : topic.sentiment === 'mixed' ? '#f59e0b' : '#94a3b8',
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {topic.keywords.slice(0, 4).map(kw => (
                  <span key={kw} className="text-[10px] text-slate-400">#{kw}</span>
                ))}
              </div>

              {isHovered && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-slate-500">占比 <strong className="text-slate-700">{pct}%</strong></span>
                    <span className="text-slate-500">提及量 <strong className="text-slate-700">{topic.count}/{totalCount}</strong></span>
                    <span className={`${style.text}`}>情感倾向：{style.label}</span>
                  </div>
                  {topic.keywords.length > 0 && (
                    <div>
                      <span className="text-[10px] text-slate-400">关联关键词：</span>
                      <span className="text-[10px] text-slate-600">{topic.keywords.join('、')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
