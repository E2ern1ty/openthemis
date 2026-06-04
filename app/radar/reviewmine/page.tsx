'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface BatchInfo {
  batch_id: string;
  app_name: string;
  brand: string;
  platform: string;
  count: number;
  uploaded_at: string;
}

const PROXY_BASE = '/api/reviewmine';
function getStartPage() {
  return `${PROXY_BASE}/analysis-results/290?_t=${Date.now()}`;
}

export default function ReviewMinePage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'upload'>('browse');
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ total: number; batch_id: string } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [brand, setBrand] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [tokenSaved, setTokenSaved] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/radar/upload-reviews');
      if (res.ok) setBatches(await res.json());
    } catch { /* ignore */ }
  }, []);

  const checkToken = useCallback(async () => {
    try {
      const res = await fetch('/api/reviewmine/cookie');
      const data = await res.json();
      setTokenSaved(data.saved);
    } catch { setTokenSaved(false); }
  }, []);

  useEffect(() => {
    fetchBatches();
    checkToken();
  }, [fetchBatches, checkToken]);

  async function saveToken() {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    try {
      const res = await fetch('/api/reviewmine/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      if (res.ok) {
        setTokenSaved(true);
        setTokenInput('');
      }
    } catch { /* ignore */ }
    setSavingToken(false);
  }

  async function clearToken() {
    await fetch('/api/reviewmine/cookie', { method: 'DELETE' });
    setTokenSaved(false);
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    setUploadResult(null);
    const fd = new FormData();
    fd.append('file', file);
    if (brand.trim()) fd.append('brand', brand.trim());
    try {
      const res = await fetch('/api/radar/upload-reviews', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) setUploadError(data.error || '上传失败');
      else { setUploadResult({ total: data.total, batch_id: data.batch_id }); fetchBatches(); }
    } catch { setUploadError('网络错误'); }
    setUploading(false);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleUpload(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f);
  }

  async function deleteBatch(batchId: string) {
    await fetch(`/api/radar/upload-reviews?batch_id=${batchId}`, { method: 'DELETE' });
    fetchBatches();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/radar" className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">App Store 评价采集</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              通过 ReviewMine 采集应用商店评论，导出后导入雷达分析
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tokenSaved ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                已登录
              </span>
              <button onClick={clearToken} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                退出
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">未登录</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'browse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            ReviewMine
          </span>
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            导入 Excel
            {batches.length > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{batches.length}</span>
            )}
          </span>
        </button>
      </div>

      {/* Tab: ReviewMine via proxy */}
      {activeTab === 'browse' && (
        <div className="space-y-3">
          {/* Token setup */}
          {!tokenSaved && (
            <div className="card p-5 border-amber-200 bg-amber-50/50">
              <div className="flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0 mt-0.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-amber-800">配置 ReviewMine Token</p>
                    <p className="text-xs text-amber-700 mt-1">
                      请提供 ReviewMine 的 <code className="bg-amber-100 px-1 rounded">auth_token</code>，
                      系统将通过后端代理访问 ReviewMine，无需在 iframe 内登录。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveToken()}
                      placeholder="粘贴 auth_token（eyJ...）"
                      className="flex-1 px-3 py-2 text-xs font-mono border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      onClick={saveToken}
                      disabled={!tokenInput.trim() || savingToken}
                      className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {savingToken ? '验证中...' : '保存'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* iframe via proxy */}
          {tokenSaved && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-slate-500">reviewmine.app (via proxy)</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { if (iframeRef.current) iframeRef.current.src = getStartPage(); }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    刷新
                  </button>
                  <a
                    href="https://reviewmine.app/app-selection"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1"
                  >
                    新窗口
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </div>
              </div>
              <iframe
                ref={iframeRef}
                src={getStartPage()}
                className="w-full border-0"
                style={{ height: 'calc(100vh - 260px)', minHeight: '600px' }}
              />
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-slate-200">
                <p className="text-xs text-slate-600">
                  在上方操作 ReviewMine：搜索 App &rarr; 查看分析 &rarr; 导出 Excel &rarr; 切换「导入 Excel」标签上传，即可加入舆情分析。
                </p>
              </div>
            </div>
          )}

          {!tokenSaved && (
            <div className="card p-10 text-center">
              <svg className="mx-auto mb-3 text-slate-200" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <h3 className="text-base font-semibold text-slate-600">配置 Token 后即可在此操作 ReviewMine</h3>
              <p className="text-sm text-slate-400 mt-1">也可以直接在「导入 Excel」标签页上传已有文件</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Upload Excel */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <input
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="关联品牌名称（可选，如：哈啰出行）"
                className="flex-1 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">指定后将自动关联到该品牌的雷达分析</span>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-600">正在解析文件...</p>
                </div>
              ) : (
                <>
                  <svg className="mx-auto mb-3 text-slate-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="text-sm font-medium text-slate-700">拖拽 Excel 文件到此处，或点击选择</p>
                  <p className="text-xs text-slate-400 mt-1">支持 .xlsx / .xls / .csv，自动识别列映射</p>
                </>
              )}
            </div>

            {uploadError && (
              <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{uploadError}</p>
              </div>
            )}
            {uploadResult && (
              <div className="mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-700">
                  成功导入 <strong>{uploadResult.total}</strong> 条评论。
                  在舆情分析中选择「App Store 评价」数据源即可参与分析。
                </p>
              </div>
            )}
          </div>

          {batches.length > 0 && (
            <div className="card">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">已导入的数据批次</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {batches.map(b => (
                  <div key={b.batch_id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {b.app_name || b.brand || '未知应用'}
                          <span className="ml-2 text-xs text-slate-400">{b.platform}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {b.count} 条评论 &middot; {new Date(b.uploaded_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteBatch(b.batch_id)}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
