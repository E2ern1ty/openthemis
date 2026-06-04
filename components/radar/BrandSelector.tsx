'use client';

import { useState, useEffect, useRef } from 'react';

export interface SourceOption {
  id: string;
  name: string;
  type: string;
}

interface SuggestedKeyword {
  name: string;
  tag: string;
  priority?: 'high' | 'medium' | 'low';
  aspect?: string;
}

interface ImportBatch {
  batch_id: string;
  app_name: string;
  brand: string;
  platform: string;
  count: number;
  uploaded_at: string;
}

interface Props {
  onStartAnalysis: (data: {
    brands: string[];
    ownBrand: string;
    sourceIds: string[];
    researchQuestion: string;
    dateRange: string;
  }) => void;
  loading: boolean;
  onCancel: () => void;
}

const DATE_RANGES = [
  { label: '近7天', value: '7' },
  { label: '近15天', value: '15' },
  { label: '近30天', value: '30' },
  { label: '近90天', value: '90' },
];

const TAG_PALETTE = [
  'bg-red-50 text-red-600 border-red-200',
  'bg-amber-50 text-amber-600 border-amber-200',
  'bg-purple-50 text-purple-600 border-purple-200',
  'bg-teal-50 text-teal-600 border-teal-200',
  'bg-blue-50 text-blue-600 border-blue-200',
  'bg-emerald-50 text-emerald-600 border-emerald-200',
  'bg-pink-50 text-pink-600 border-pink-200',
  'bg-orange-50 text-orange-600 border-orange-200',
  'bg-cyan-50 text-cyan-600 border-cyan-200',
  'bg-indigo-50 text-indigo-600 border-indigo-200',
];

const tagColorCache: Record<string, string> = {};
let tagIdx = 0;
function getTagColor(tag: string): string {
  if (!tagColorCache[tag]) {
    tagColorCache[tag] = TAG_PALETTE[tagIdx % TAG_PALETTE.length];
    tagIdx++;
  }
  return tagColorCache[tag];
}

export default function BrandSelector({ onStartAnalysis, loading, onCancel }: Props) {
  const [ownBrand, setOwnBrand] = useState('');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [dateRange, setDateRange] = useState('30');

  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);

  const [suggestions, setSuggestions] = useState<SuggestedKeyword[]>([]);
  const [intentSummary, setIntentSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const selectedRef = useRef(selectedKeywords);
  selectedRef.current = selectedKeywords;

  const [manualInput, setManualInput] = useState('');

  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [importLoaded, setImportLoaded] = useState(false);

  const selectedImportIds = selectedSources.filter(s => s.startsWith('import:'));
  const selectedRegularIds = selectedSources.filter(s => !s.startsWith('import:'));

  useEffect(() => {
    // 渠道由采集层（OpenCLI 网关）统一提供；同时探测各渠道登录态
    fetch('/api/channels')
      .then(r => r.json())
      .then(async ({ channels }: { channels?: Array<{ id: string; name: string }> }) => {
        const list = channels || [];
        const opts: SourceOption[] = list.map(c => ({ id: c.id, name: c.name, type: 'channel' }));
        setSourceOptions(opts);
        // 默认选中已登录的渠道
        const statuses = await Promise.all(
          list.map(c =>
            fetch(`/api/channels/${encodeURIComponent(c.id)}/status`)
              .then(r => r.json())
              .then((s: { loggedIn?: boolean }) => ({ id: c.id, loggedIn: !!s.loggedIn }))
              .catch(() => ({ id: c.id, loggedIn: false })),
          ),
        );
        const connected = statuses.filter(s => s.loggedIn).map(s => s.id);
        setSelectedSources(connected.length > 0 ? connected : opts.map(o => o.id));
      })
      .catch(() => {
        setSourceOptions([]);
      });
  }, []);

  const generateKeywords = async () => {
    if (!researchQuestion.trim() || aiLoading) return;
    setAiLoading(true);
    setSuggestions([]);
    setIntentSummary('');
    setSelectedKeywords([]);
    try {
      const res = await fetch('/api/brands/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: researchQuestion, ownBrand: ownBrand.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        const kws: SuggestedKeyword[] = data.keywords || [];
        setSuggestions(kws);
        setIntentSummary(data.intent_summary || '');
        const highPriority = kws.filter(k => k.priority === 'high').map(k => k.name);
        setSelectedKeywords(highPriority.length > 0 ? highPriority : kws.slice(0, 6).map(k => k.name));
      }
    } catch { /* ignore */ }
    setAiLoading(false);
  };

  const toggleKeyword = (name: string) => {
    const cur = selectedRef.current;
    setSelectedKeywords(cur.includes(name) ? cur.filter(k => k !== name) : [...cur, name]);
  };

  const addManualKeyword = () => {
    const val = manualInput.trim();
    if (!val) return;
    if (!suggestions.find(s => s.name === val)) {
      setSuggestions(prev => [...prev, { name: val, tag: '自定义', priority: 'medium' }]);
    }
    if (!selectedRef.current.includes(val)) {
      setSelectedKeywords([...selectedRef.current, val]);
    }
    setManualInput('');
  };

  const toggleSource = (id: string) => {
    setSelectedSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleImportClick = async () => {
    if (!importLoaded) {
      try {
        const res = await fetch('/api/radar/upload-reviews');
        const data = await res.json();
        setImportBatches(Array.isArray(data) ? data : []);
      } catch { setImportBatches([]); }
      setImportLoaded(true);
    }
    setShowImportPanel(v => !v);
  };

  const toggleImportBatch = (batchId: string) => {
    const importId = `import:${batchId}`;
    setSelectedSources(prev => prev.includes(importId) ? prev.filter(s => s !== importId) : [...prev, importId]);
  };

  const formatUploadDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }); }
    catch { return d; }
  };

  const canStart = selectedKeywords.length > 0 && selectedSources.length > 0 && !loading;

  const handleSubmit = () => {
    if (!canStart) return;
    onStartAnalysis({
      brands: selectedKeywords,
      ownBrand,
      sourceIds: selectedSources,
      researchQuestion,
      dateRange,
    });
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">新建舆情监测</h2>
        <p className="text-xs text-slate-500 mt-0.5">输入监测主题，AI 自动拆解为检索关键词</p>
      </div>

      <div className="p-5 space-y-5">
        {/* Step 1: My Brand */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">本方主体</label>
          {ownBrand ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
              {ownBrand}
              <button onClick={() => setOwnBrand('')} className="text-blue-300 hover:text-blue-600 ml-0.5 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ) : (
            <input
              type="text"
              placeholder="输入要监测的主体名称，回车确认"
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 w-64 transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) { setOwnBrand(val); (e.target as HTMLInputElement).value = ''; }
                }
              }}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val) { setOwnBrand(val); e.target.value = ''; }
              }}
            />
          )}
          <p className="text-xs text-slate-400 mt-1.5">分析时将以此主体视角研判舆情风险与应对</p>
        </div>

        {/* Step 2: Research Question */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">监测主题</label>
          <div className="flex items-center gap-2">
            <input
              value={researchQuestion}
              onChange={e => setResearchQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateKeywords()}
              placeholder='例如："某品牌近期负面舆情监测"、"行业热点事件追踪"'
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 placeholder:text-slate-400"
              disabled={aiLoading}
            />
            <button
              onClick={generateKeywords}
              disabled={!researchQuestion.trim() || aiLoading}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              {aiLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  拆解中
                </span>
              ) : '拆解关键词'}
            </button>
          </div>
        </div>

        {/* Step 3: Generated Keywords */}
        {suggestions.length > 0 && (
          <div className="bg-slate-50/80 rounded-xl p-4 space-y-3 border border-slate-100">
            {intentSummary && (
              <p className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">{intentSummary}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">检索关键词</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{selectedKeywords.length}/{suggestions.length} 已选</span>
                <button
                  onClick={() => setSelectedKeywords(selectedKeywords.length === suggestions.length ? [] : suggestions.map(s => s.name))}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedKeywords.length === suggestions.length ? '取消全选' : '全选'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((kw, idx) => {
                const isSelected = selectedKeywords.includes(kw.name);
                const tagColor = getTagColor(kw.tag);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleKeyword(kw.name)}
                    title={kw.aspect || kw.tag}
                    className={`group inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full text-sm transition-all border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-all ${
                      isSelected ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-blue-100'
                    }`}>
                      {isSelected ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                      ) : (
                        <span className="text-slate-400 group-hover:text-blue-500">+</span>
                      )}
                    </span>
                    <span className="font-medium">{kw.name}</span>
                    {!isSelected && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tagColor}`}>{kw.tag}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Manual add */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
              <input
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addManualKeyword()}
                placeholder="手动添加关键词"
                className="px-2.5 py-1 text-sm border border-dashed border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 w-36"
              />
              <button onClick={addManualKeyword} className="text-xs text-blue-600 hover:text-blue-800 font-medium">添加</button>
            </div>
          </div>
        )}

        {/* Step 4: Data sources */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">数据源</label>
          <div className="flex flex-wrap items-center gap-2">
            {sourceOptions.map(src => (
              <button
                key={src.id}
                onClick={() => toggleSource(src.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedRegularIds.includes(src.id)
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {selectedRegularIds.includes(src.id) && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {src.name}
              </button>
            ))}

            <div className="relative">
              <button
                onClick={handleImportClick}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  selectedImportIds.length > 0
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'border-dashed border-blue-300 text-blue-600 hover:bg-blue-50'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                导入数据
                {selectedImportIds.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">{selectedImportIds.length}</span>
                )}
              </button>

              {showImportPanel && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowImportPanel(false)} />
                  <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500">选择导入文件</p>
                      {selectedImportIds.length > 0 && (
                        <button onClick={() => setSelectedSources(selectedRegularIds)} className="text-[10px] text-slate-400 hover:text-red-500">清除选择</button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {importBatches.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-slate-400">暂无导入数据</p>
                          <p className="text-[10px] text-slate-300 mt-1">请在数据源配置中上传文件</p>
                        </div>
                      ) : (
                        importBatches.map(batch => {
                          const isSelected = selectedSources.includes(`import:${batch.batch_id}`);
                          return (
                            <label key={batch.batch_id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleImportBatch(batch.batch_id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{batch.brand || batch.app_name || '导入文件'}</p>
                                <p className="text-[11px] text-slate-400">{batch.count}条 · {batch.platform || '通用'} · {formatUploadDate(batch.uploaded_at)}</p>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DATE_RANGES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">取消</button>
            <button
              onClick={handleSubmit}
              disabled={!canStart}
              className="btn-primary text-sm"
            >
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  分析中...
                </span>
              ) : '开始分析'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
