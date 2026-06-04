'use client';

import { useState } from 'react';
import type { TopNegative } from '@/lib/types';
import RefButton from '@/components/layout/RefButton';

interface Props {
  data: TopNegative;
  analysisId?: number;
}

export default function NegativeReviewList({ data, analysisId }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="card p-4 relative group/card">
      <RefButton
        reference={{
          id: `radar-negative-${analysisId}`,
          label: '差评洞察',
          type: 'radar_negative',
          data: data.items.map(i => ({ summary: i.summary, count: i.count, topic: i.topic, severity: i.severity })),
        }}
        className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity"
      />
      <h3 className="text-sm font-semibold text-slate-500 mb-3">差评 Top{data.items.length}</h3>
      <div className="space-y-2">
        {data.items.map((item, idx) => (
          <div
            key={idx}
            className="p-3 bg-red-50/50 rounded-lg border border-red-100 cursor-pointer hover:bg-red-50 transition-colors"
            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <span className="text-sm font-bold text-red-400 mt-0.5">{idx + 1}.</span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.summary}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-medium">
                      {item.topic}
                    </span>
                    {item.severity && (
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                        item.severity === '系统性缺陷'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.severity}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs text-red-500 font-medium whitespace-nowrap ml-2">{item.count} 条</span>
            </div>
            {expandedIdx === idx && (
              <div className="mt-2 pl-5 space-y-1">
                {item.examples.map((ex, i) => (
                  <p key={i} className="text-xs text-slate-500 before:content-['「'] after:content-['」']">{ex}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
