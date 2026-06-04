'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AnalysisResult } from '@/lib/types';
import { useAssistant } from '@/lib/assistant-context';
import BrandSelector from '@/components/radar/BrandSelector';
import AnalysisProgress from '@/components/radar/AnalysisProgress';
import OverviewCards from '@/components/radar/OverviewCards';
import SentimentChart from '@/components/radar/SentimentChart';
import TopicList from '@/components/radar/TopicList';
import NegativeReviewList from '@/components/radar/NegativeReviewList';
import OpportunityCards from '@/components/radar/OpportunityCards';
import RawDataList from '@/components/radar/RawDataList';

interface HistoryItem {
  id: number;
  brands: string[];
  ownBrand: string;
  researchQuestion: string;
  dateRange: { start: string; end: string };
  status: string;
  totalItems: number;
  createdAt: string;
}

type ExtendedResult = AnalysisResult & { researchQuestion?: string; createdAt?: string };

export default function RadarPage() {
  const { setPageContext, updatePageSnapshot } = useAssistant();
  useEffect(() => { setPageContext('radar'); }, [setPageContext]);

  const [showNewResearch, setShowNewResearch] = useState(false);
  const [analysisId, setAnalysisId] = useState<number | null>(null);
  const [result, setResult] = useState<ExtendedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/radar/analyze');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
        return data as HistoryItem[];
      }
    } catch { /* ignore */ }
    return [];
  }, []);

  const loadAnalysis = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/radar/analyze/${id}`);
      if (res.ok) {
        const data: ExtendedResult = await res.json();
        setResult(data);
        setAnalysisId(data.id);
        setShowNewResearch(false);
        return data;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  useEffect(() => {
    (async () => {
      const items = await fetchHistory();
      const latest = items.find((h: HistoryItem) => h.status === 'completed');
      if (latest) {
        await loadAnalysis(latest.id);
      }
      setInitialLoading(false);
    })();
  }, [fetchHistory, loadAnalysis]);

  useEffect(() => {
    if (result && result.status === 'completed') {
      updatePageSnapshot({
        analysisId: result.id,
        brands: result.brands,
        ownBrand: result.ownBrand,
        totalItems: result.totalItems,
        sentiment: result.sentiment,
        topics: result.topics,
        topNegative: result.topNegative,
        opportunities: result.opportunities,
      });
    }
  }, [result, updatePageSnapshot]);

  const pollStatus = useCallback((id: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/radar/analyze/${id}`);
        const data: ExtendedResult = await res.json();
        setResult(data);
        if (data.status === 'completed' || data.status === 'error') {
          stopPolling();
          setLoading(false);
          fetchHistory();
          if (data.status === 'error') setError('分析失败，请重试');
        }
      } catch { stopPolling(); setLoading(false); setError('网络错误'); }
    }, 800);
  }, [stopPolling, fetchHistory]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startAnalysis = async (data: {
    brands: string[];
    ownBrand: string;
    sourceIds: string[];
    researchQuestion: string;
    dateRange: string;
  }) => {
    setError('');
    setLoading(true);
    setResult(null);

    const days = parseInt(data.dateRange);
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);

    try {
      const res = await fetch('/api/radar/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brands: data.brands,
          ownBrand: data.ownBrand || undefined,
          sourceIds: data.sourceIds,
          researchQuestion: data.researchQuestion || '',
          dateRange: {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
          },
        }),
      });

      const resData = await res.json();
      if (!res.ok) { setError(resData.error); setLoading(false); return; }

      setAnalysisId(resData.id);
      setShowNewResearch(false);
      setResult({
        id: resData.id, status: 'processing', progress: 0,
        brands: data.brands,
        ownBrand: data.ownBrand,
        researchQuestion: data.researchQuestion,
        dateRange: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
        totalItems: 0, sentiment: null, topics: null, topNegative: null,
        opportunities: [], sources: [],
      });
      pollStatus(resData.id);
    } catch {
      setError('请求失败，请检查网络');
      setLoading(false);
    }
  };

  function handleHistorySelect(item: HistoryItem) {
    setHistoryOpen(false);
    if (item.status === 'completed') {
      loadAnalysis(item.id);
    }
  }

  async function handleRetry(e: React.MouseEvent, item: HistoryItem) {
    e.stopPropagation();
    setHistoryOpen(false);
    setError('');
    setLoading(true);
    setShowNewResearch(false);
    setResult({
      id: item.id, status: 'processing', progress: 35,
      brands: item.brands,
      ownBrand: item.ownBrand,
      researchQuestion: item.researchQuestion,
      dateRange: item.dateRange,
      totalItems: item.totalItems ?? 0, sentiment: null, topics: null, topNegative: null,
      opportunities: [], sources: [],
    });
    setAnalysisId(item.id);

    try {
      const res = await fetch(`/api/radar/analyze/${item.id}/retry`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '重试失败');
        setLoading(false);
        return;
      }
      pollStatus(item.id);
    } catch { setError('重试请求失败'); setLoading(false); }
  }

  function formatDate(d: string) {
    try { return new Date(d).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  }

  const isCompleted = result?.status === 'completed';
  const visibleHistory = history.filter(h => h.status === 'completed' || h.status === 'error');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">舆情分析</h1>
          <p className="text-sm text-slate-500 mt-1">从公开渠道采集舆情，AI 自动研判情感、话题与风险</p>
        </div>

        <div className="flex items-center gap-2">
          {!showNewResearch && (
            <button
              onClick={() => setShowNewResearch(true)}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              新建监测
            </button>
          )}

          {visibleHistory.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                历史记录
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{visibleHistory.length}</span>
              </button>

              {historyOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setHistoryOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-semibold text-slate-500">监测历史</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {visibleHistory.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleHistorySelect(item)}
                          role="button"
                          tabIndex={0}
                          className={`w-full text-left px-3 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer ${
                            analysisId === item.id ? 'bg-blue-50/70' : ''
                          }`}
                        >
                          {/* Research question */}
                          {item.researchQuestion && (
                            <p className="text-sm font-medium text-slate-800 mb-1 line-clamp-1">{item.researchQuestion}</p>
                          )}

                          {/* Keywords */}
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {item.brands.slice(0, 6).map((b, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{b}</span>
                            ))}
                            {item.brands.length > 6 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{item.brands.length - 6}</span>
                            )}
                          </div>

                          {/* Meta */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              {item.ownBrand && (
                                <span className="text-blue-500">
                                  <svg className="inline w-3 h-3 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                  {item.ownBrand}
                                </span>
                              )}
                              <span>{formatDate(item.createdAt)}</span>
                              <span>{item.totalItems ?? 0} 条</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {item.status === 'error' && (
                                <button
                                  onClick={(e) => handleRetry(e, item)}
                                  className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full hover:bg-orange-100 transition-colors"
                                >重试</button>
                              )}
                              {analysisId === item.id && (
                                <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">当前</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Current result header — show research context */}
      {isCompleted && result && !showNewResearch && (
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1 min-w-0">
              {result.researchQuestion && (
                <div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">监测主题</span>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{result.researchQuestion}</p>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {result.ownBrand && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    {result.ownBrand}
                  </span>
                )}
                <div className="flex flex-wrap gap-1">
                  {result.brands.map((b, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{b}</span>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                {result.createdAt && (
                  <span>创建于 {formatDate(result.createdAt)} · </span>
                )}
                数据区间 {result.dateRange.start} ~ {result.dateRange.end} · {result.totalItems} 条数据
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New research panel */}
      {showNewResearch && (
        <BrandSelector
          onStartAnalysis={startAnalysis}
          loading={loading}
          onCancel={() => setShowNewResearch(false)}
        />
      )}

      {error && (
        <div className="card p-3 border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {result && result.status === 'processing' && (
        <AnalysisProgress progress={result.progress} status={result.status} />
      )}

      {isCompleted && result && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <OverviewCards data={result} />
            {result.sentiment && <SentimentChart data={result.sentiment} analysisId={result.id} />}
            {result.topics && <TopicList data={result.topics} analysisId={result.id} />}
            {result.topNegative && <NegativeReviewList data={result.topNegative} analysisId={result.id} />}
            {result.rawItems && result.rawItems.length > 0 && (
              <RawDataList items={result.rawItems} totalItems={result.totalItems} />
            )}
          </div>
          <div className="lg:col-span-2">
            <OpportunityCards opportunities={result.opportunities} analysisId={result.id} />
          </div>
        </div>
      )}

      {initialLoading && !result && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {!initialLoading && !result && !loading && !showNewResearch && (
        <div className="card p-12 text-center">
          <svg className="mx-auto mb-4 text-slate-300" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" /><path d="M4 6h.01" />
            <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" /><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
            <path d="M12 18h.01" /><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-700">还没有监测记录</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            输入监测主题，AI 自动拆解关键词并从多渠道采集研判舆情
          </p>
          <button
            onClick={() => setShowNewResearch(true)}
            className="btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建第一个监测
          </button>
        </div>
      )}
    </div>
  );
}
