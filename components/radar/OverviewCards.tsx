'use client';

import { useMemo } from 'react';
import type { AnalysisResult } from '@/lib/types';
import RefButton from '@/components/layout/RefButton';
import { useI18n } from '@/lib/i18n';

interface Props {
  data: AnalysisResult;
}

function normalizeSource(raw: string): string {
  if (raw === '小红书') return '小红书';
  if (raw === '导入数据') return '导入数据';
  if (raw === '微博实时搜索' || raw.includes('微博')) return '微博';
  return raw;
}

const SOURCE_EN: Record<string, string> = {
  '小红书': 'Xiaohongshu',
  '导入数据': 'Imported',
  '微博': 'Weibo',
};

export default function OverviewCards({ data }: Props) {
  const { t, lang } = useI18n();
  const normalizedSources = useMemo(
    () => [...new Set(data.sources.map(normalizeSource))],
    [data.sources],
  );

  const localizeSource = (s: string) => (lang === 'zh' ? s : (SOURCE_EN[s] || s));

  const stats = [
    { label: t('搜索词', 'Keywords'), value: data.brands.length, color: 'text-blue-600' },
    { label: t('数据量', 'Items'), value: data.totalItems, color: 'text-indigo-600' },
    { label: t('数据来源', 'Sources'), value: normalizedSources.length, color: 'text-purple-600' },
  ];

  return (
    <div className="card p-4 relative group/card">
      <RefButton
        reference={{
          id: `radar-overview-${data.id}`,
          label: t('数据总览', 'Overview'),
          type: 'radar_overview',
          data: { brands: data.brands, totalItems: data.totalItems, sources: normalizedSources, dateRange: data.dateRange },
        }}
        className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity"
      />
      <h3 className="text-sm font-semibold text-slate-500 mb-3">{t('数据总览', 'Overview')}</h3>
      <div className="grid grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{t('时间范围：', 'Range: ')}{data.dateRange.start} ~ {data.dateRange.end}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {normalizedSources.map(s => (
            <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{localizeSource(s)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
