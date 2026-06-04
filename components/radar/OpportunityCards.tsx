'use client';

import { motion } from 'framer-motion';
import type { OpportunityData } from '@/lib/types';
import RefButton from '@/components/layout/RefButton';

interface Props {
  opportunities: OpportunityData[];
  analysisId?: number;
}

function ConfidenceDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= level ? 'bg-blue-500' : 'bg-slate-200'
          }`}
        />
      ))}
    </span>
  );
}

export default function OpportunityCards({ opportunities, analysisId }: Props) {
  if (!opportunities.length) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-500">舆情研判</h3>
        <div className="card p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
          <p className="text-sm text-slate-500">暂未识别到关键研判点</p>
          <p className="text-xs text-slate-400 mt-1">设置"本方主体"后重新分析，AI 将从舆情中提炼风险与应对洞察</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-500">舆情研判</h3>
      {opportunities.map((opp, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="card p-4 hover:shadow-md transition-shadow relative group/opp"
        >
          <RefButton
            reference={{
              id: `radar-opp-${analysisId}-${idx}`,
              label: `研判${idx + 1}: ${opp.title}`,
              type: 'radar_opportunity',
              data: opp,
            }}
            className="absolute top-3 right-3 opacity-0 group-hover/opp:opacity-100 transition-opacity"
          />
          <div className="flex items-start justify-between mb-2 pr-8">
            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              <span className="text-blue-600">研判 {idx + 1}：</span>
              {opp.title}
            </h4>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-3">{opp.description}</p>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">置信度</span>
              <ConfidenceDots level={opp.confidence} />
            </div>
            <span className="text-[10px] text-slate-400">
              {opp.evidence.length} 条证据
            </span>
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">
              {opp.topic}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-2.5 mb-3">
            <p className="text-[10px] text-slate-500 mb-1.5">证据摘录：</p>
            <div className="space-y-1">
              {opp.evidence.slice(0, 3).map((ev, i) => (
                <p key={i} className="text-xs text-slate-600 before:content-['「'] after:content-['」'] before:text-slate-400 after:text-slate-400">
                  {ev}
                </p>
              ))}
            </div>
          </div>

          {opp.risk_note && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-amber-500 text-xs mt-0.5 shrink-0">!</span>
              <p className="text-[11px] text-amber-700">{opp.risk_note}</p>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
