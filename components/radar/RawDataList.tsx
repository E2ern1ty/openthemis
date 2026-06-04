'use client';

import { useState, useMemo } from 'react';
import type { RawItemBrief } from '@/lib/types';

interface Props {
  items: RawItemBrief[];
  totalItems: number;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  '小红书': { bg: 'bg-red-50', text: 'text-red-600' },
  '微博': { bg: 'bg-amber-50', text: 'text-amber-600' },
  '导入数据': { bg: 'bg-violet-50', text: 'text-violet-600' },
};
const DEFAULT_COLOR = { bg: 'bg-slate-50', text: 'text-slate-500' };

function normalizeSource(raw: string): string {
  if (raw === '小红书') return '小红书';
  if (raw === '导入数据') return '导入数据';
  return '微博';
}

export default function RawDataList({ items, totalItems }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  const normalizedItems = useMemo(
    () => items.map(i => ({ ...i, displaySource: normalizeSource(i.source) })),
    [items],
  );

  const sources = useMemo(
    () => [...new Set(normalizedItems.map(i => i.displaySource))],
    [normalizedItems],
  );

  const brands = useMemo(
    () => [...new Set(normalizedItems.map(i => i.brand))].sort(),
    [normalizedItems],
  );

  const filtered = useMemo(() => {
    let result = normalizedItems;
    if (sourceFilter) result = result.filter(i => i.displaySource === sourceFilter);
    if (brandFilter) result = result.filter(i => i.brand === brandFilter);
    return result;
  }, [normalizedItems, sourceFilter, brandFilter]);

  const visible = expanded ? filtered : filtered.slice(0, 10);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-500">
          采集原文
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            (共 {totalItems} 条{items.length < totalItems ? `，展示前 ${items.length}` : ''})
          </span>
        </h3>
        <div className="flex gap-1 flex-wrap justify-end">
          <button
            onClick={() => { setSourceFilter(null); setBrandFilter(null); }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              !sourceFilter && !brandFilter ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            全部
          </button>
          {sources.map(s => {
            const c = SOURCE_COLORS[s] || DEFAULT_COLOR;
            return (
              <button
                key={`src-${s}`}
                onClick={() => { setSourceFilter(sourceFilter === s ? null : s); setBrandFilter(null); }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  sourceFilter === s ? `${c.bg} ${c.text}` : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {brands.length > 1 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {brands.map(b => (
            <button
              key={`brand-${b}`}
              onClick={() => { setBrandFilter(brandFilter === b ? null : b); setSourceFilter(null); }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                brandFilter === b ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {visible.map((item, idx) => {
          const sc = SOURCE_COLORS[item.displaySource] || DEFAULT_COLOR;
          return (
            <div
              key={idx}
              className="flex items-start gap-2 py-2 px-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                {item.displaySource}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 leading-snug line-clamp-2">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 hover:underline"
                    >
                      {item.content}
                    </a>
                  ) : (
                    item.content
                  )}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                  <span>{item.brand}</span>
                  <span>{item.date}</span>
                  {item.likes > 0 && <span>{item.likes.toLocaleString()} 赞</span>}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-600 hover:underline"
                    >
                      原文链接
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full text-center py-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
        >
          {expanded ? '收起' : `展开全部 ${filtered.length} 条`}
        </button>
      )}
    </div>
  );
}
