'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Tabs ───
const TABS = [
  { id: 'llm', label: 'LLM 配置' },
  { id: 'prompts', label: '专家经验 Prompt' },
  { id: 'sources', label: '采集与数据源' },
] as const;
type TabId = (typeof TABS)[number]['id'];

// ─── LLM 配置 ───
interface LLMConfigState {
  endpoint: string;
  model: string;
  apiKeySet: boolean;
  apiKeyPreview: string;
  configured: boolean;
}

function LLMConfigTab() {
  const [cfg, setCfg] = useState<LLMConfigState | null>(null);
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/llm-config');
      const data: LLMConfigState = await r.json();
      setCfg(data);
      setEndpoint(data.endpoint || '');
      setModel(data.model || '');
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, string> = { endpoint: endpoint.trim(), model: model.trim() };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const r = await fetch('/api/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok) {
        setApiKey('');
        await load();
        setMsg({ type: 'ok', text: data.configured ? '已保存，配置生效' : '已保存（注意：仍缺少必填项）' });
      } else {
        setMsg({ type: 'err', text: data.error || '保存失败' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: String((e as Error).message) });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMsg({ type: 'info', text: '正在测试连接...' });
    try {
      const body: Record<string, string> = {};
      if (endpoint.trim()) body.endpoint = endpoint.trim();
      if (model.trim()) body.model = model.trim();
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const r = await fetch('/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.ok) setMsg({ type: 'ok', text: `连接成功 · 模型 ${data.model}` });
      else setMsg({ type: 'err', text: `连接失败：${data.error}` });
    } catch (e) {
      setMsg({ type: 'err', text: String((e as Error).message) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">LLM 配置（OpenAI 兼容）</h3>
          {cfg && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.configured ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-600'}`}>
              {cfg.configured ? '已配置' : '未配置'}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 -mt-1">
          平台所有内置分析（情感研判 / 话题聚类 / 负面深挖 / 舆情研判 / 助手）统一走此配置。仅支持 OpenAI 格式的
          <code className="font-mono mx-1">/v1/chat/completions</code>接口。
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">API Endpoint</label>
          <input
            value={endpoint}
            onChange={e => setEndpoint(e.target.value)}
            placeholder="https://api.openai.com/v1/chat/completions"
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
          <input
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="gpt-4o / deepseek-chat / Claude-sonnet-4.6 ..."
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
          <input
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            type="password"
            placeholder={cfg?.apiKeySet ? `已配置（${cfg.apiKeyPreview}），留空则不修改` : 'sk-...'}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {msg && (
          <div className={`text-sm px-3 py-2 rounded-lg ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700'
            : msg.type === 'err' ? 'bg-red-50 text-red-600'
            : 'bg-slate-50 text-slate-500'
          }`}>{msg.text}</div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? '保存中...' : '保存'}
          </button>
          <button onClick={test} disabled={testing} className="btn-secondary text-sm">
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>
      </div>

      <div className="card p-4 bg-blue-50 border-blue-200">
        <p className="text-xs text-blue-700 leading-relaxed">
          配置存储在本地 SQLite，热更新无需重启。也可用环境变量
          <code className="font-mono mx-1">LLM_ENDPOINT / LLM_API_KEY / LLM_MODEL</code>
          作为兜底（此处填写的配置优先级更高）。
        </p>
      </div>
    </div>
  );
}

// ─── Prompt 管理 ───
interface PromptRecord {
  id: string; module: string; name: string; description: string;
  content: string; is_default: number; updated_at: string;
}

function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('全部');

  const load = useCallback(async () => {
    const r = await fetch('/api/prompts');
    setPrompts(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const MODULE_ORDER = ['全部', '全局', '舆情分析'];
  const modules = MODULE_ORDER.filter(m => m === '全部' || prompts.some(p => p.module === m));
  const sortedPrompts = [...prompts].sort((a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module));
  const filtered = filter === '全部' ? sortedPrompts : sortedPrompts.filter(p => p.module === filter);

  const startEdit = (p: PromptRecord) => { setEditing(p.id); setDraft(p.content); };
  const cancel = () => { setEditing(null); setDraft(''); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch('/api/prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing, content: draft }) });
    setSaving(false);
    setEditing(null);
    load();
  };

  const reset = async (id: string) => {
    if (!confirm('确定恢复为默认 Prompt？你的自定义修改将丢失。')) return;
    await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {modules.map(m => (
          <button key={m} onClick={() => setFilter(m)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${filter === m ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >{m}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(p => (
          <div key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{p.module}</span>
                  <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                  {p.is_default === 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">已自定义</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">{p.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {editing !== p.id && (
                  <>
                    <button onClick={() => startEdit(p)} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">编辑</button>
                    {p.is_default === 0 && <button onClick={() => reset(p.id)} className="text-xs px-2.5 py-1 rounded-md text-amber-600 hover:bg-amber-50 transition-colors">恢复默认</button>}
                  </>
                )}
              </div>
            </div>

            {editing === p.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={16}
                  className="w-full text-sm font-mono border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y bg-slate-50"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{draft.length} 字符</span>
                  <div className="flex items-center gap-2">
                    <button onClick={cancel} className="btn-secondary text-xs !py-1.5">取消</button>
                    <button onClick={save} disabled={saving} className="btn-primary text-xs !py-1.5">{saving ? '保存中...' : '保存'}</button>
                  </div>
                </div>
              </div>
            ) : (
              <pre className="mt-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap break-words border border-slate-100">
                {p.content.slice(0, 300)}{p.content.length > 300 ? '...' : ''}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 数据源配置 ───
interface BatchInfo { batch_id: string; app_name: string; brand: string; platform: string; count: number; uploaded_at: string; }

interface Channel { id: string; name: string; site: string; loginUrl: string; }
interface ChannelStatus { loggedIn: boolean; loginUrl?: string; warning?: string; checking?: boolean; }

const PROXY_BASE = '/api/reviewmine';
function getStartPage() { return `${PROXY_BASE}/analysis-results/290?_t=${Date.now()}`; }

const SOURCE_TYPES = [
  { id: 'channel', label: '采集渠道',   desc: '通过 OpenCLI 统一接入，复用 Chrome 已登录会话（小红书 / 微博等）' },
  { id: 'import',  label: '数据导入',   desc: '导入 Excel 文件或第三方平台数据（App Store 等）' },
] as const;
type SourceType = (typeof SOURCE_TYPES)[number]['id'];

function SourcesTab() {
  const [sourceType, setSourceType] = useState<SourceType>('channel');

  // ── 采集渠道 state ──
  const [channels, setChannels] = useState<Channel[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ChannelStatus>>({});
  const [collectorError, setCollectorError] = useState<string | null>(null);

  // ── 数据导入 state ──
  const [importMode, setImportMode] = useState<'upload' | 'reviewmine'>('upload');
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── data loading ──
  const checkChannelStatus = useCallback(async (id: string) => {
    setStatuses(prev => ({ ...prev, [id]: { loggedIn: prev[id]?.loggedIn ?? false, checking: true } }));
    try {
      const r = await fetch(`/api/channels/${encodeURIComponent(id)}/status`);
      const data = await r.json();
      setStatuses(prev => ({ ...prev, [id]: { ...data, checking: false } }));
    } catch {
      setStatuses(prev => ({ ...prev, [id]: { loggedIn: false, checking: false } }));
    }
  }, []);
  const loadChannels = useCallback(async () => {
    try {
      const r = await fetch('/api/channels');
      const data = await r.json();
      const list: Channel[] = data.channels || [];
      setChannels(list);
      setCollectorError(data.error || null);
      list.forEach(c => checkChannelStatus(c.id));
    } catch {
      setCollectorError('采集层不可用，请确认 collector 进程已启动');
    }
  }, [checkChannelStatus]);
  const loadBatches = useCallback(async () => {
    try { const r = await fetch('/api/radar/upload-reviews'); setBatches(await r.json()); } catch {}
  }, []);
  const checkToken = useCallback(async () => {
    try { const r = await fetch(`${PROXY_BASE}/cookie`); const data = await r.json(); setTokenSaved(data.saved); } catch {}
  }, []);

  useEffect(() => {
    loadChannels(); loadBatches(); checkToken();
  }, [loadChannels, loadBatches, checkToken]);

  // ── 数据导入 handlers ──
  const handleUpload = async (file: File) => {
    setUploading(true); setUploadResult(null); setUploadError(null);
    const fd = new FormData(); fd.append('file', file);
    if (brand.trim()) fd.append('brand', brand.trim());
    try {
      const r = await fetch('/api/radar/upload-reviews', { method: 'POST', body: fd });
      const data = await r.json();
      if (r.ok) { setUploadResult(`导入成功: ${data.count} 条评论`); loadBatches(); }
      else setUploadError(data.error || '导入失败');
    } catch { setUploadError('网络错误'); }
    finally { setUploading(false); }
  };
  const deleteBatch = async (batchId: string) => {
    if (!confirm('确定删除此批次？')) return;
    await fetch(`/api/radar/upload-reviews?batch_id=${batchId}`, { method: 'DELETE' }); loadBatches();
  };
  const saveRmToken = async () => {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    await fetch(`${PROXY_BASE}/cookie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenInput.trim() }) });
    setTokenSaved(true); setSavingToken(false); setTokenInput('');
    if (iframeRef.current) iframeRef.current.src = getStartPage();
  };
  const clearRmToken = async () => { await fetch(`${PROXY_BASE}/cookie`, { method: 'DELETE' }); setTokenSaved(false); };

  return (
    <div className="space-y-5">
      {/* 子菜单 */}
      <div className="flex items-center gap-2">
        {SOURCE_TYPES.map(t => (
          <button key={t.id} onClick={() => setSourceType(t.id)}
            className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${sourceType === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >{t.label}</button>
        ))}
      </div>
      <p className="text-xs text-slate-400 -mt-2">{SOURCE_TYPES.find(t => t.id === sourceType)?.desc}</p>

      {/* ════ 采集渠道 ════ */}
      {sourceType === 'channel' && (
        <div className="space-y-4">
          {collectorError && (
            <div className="card p-4 bg-red-50 border-red-200">
              <p className="text-sm text-red-700">{collectorError}</p>
              <p className="text-xs text-red-500 mt-1">在 collector 目录运行 <code className="font-mono">npm start</code> 启动采集层。</p>
            </div>
          )}

          {channels.map(ch => {
            const st = statuses[ch.id];
            return (
              <div key={ch.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">{ch.name.slice(0, 1)}</div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{ch.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {st?.checking
                          ? <span className="text-slate-400">检测登录态中...</span>
                          : st?.loggedIn
                            ? <span className="text-emerald-600">已连接 · 复用 Chrome 会话</span>
                            : '请在 Chrome 中登录后，OpenCLI 将自动复用登录态'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!st?.loggedIn && (
                      <a href={ch.loginUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs !py-1.5">去 Chrome 登录</a>
                    )}
                    <button onClick={() => checkChannelStatus(ch.id)} className="text-xs text-blue-600 hover:underline">重新检测</button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="card p-4 bg-slate-50 border-slate-200">
            <p className="text-xs text-slate-500 leading-relaxed">
              采集层基于 OpenCLI 浏览器桥接，统一接入各平台并复用你本机 Chrome 中已登录的会话，
              无需在本应用内单独扫码。新增渠道只需在采集层的渠道注册表中追加配置。
            </p>
          </div>
        </div>
      )}

      {/* ════ 数据导入 ════ */}
      {sourceType === 'import' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setImportMode('upload')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${importMode === 'upload' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >Excel 导入</button>
            <button onClick={() => setImportMode('reviewmine')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${importMode === 'reviewmine' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >ReviewMine</button>
          </div>

          {importMode === 'upload' && (
            <div className="space-y-4">
              <div className="card p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-900">导入 App Store 评论</h4>
                <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="品牌名称（可选，如：哈啰单车）" className="w-full border rounded-lg px-3 py-2 text-sm" />
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]); }}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <p className="text-sm text-slate-500">{uploading ? '上传中...' : '点击或拖拽 Excel 文件到此处'}</p>
                  <p className="text-xs text-slate-400 mt-1">支持 .xlsx / .xls 格式</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
                {uploadResult && <p className="text-sm text-emerald-600">{uploadResult}</p>}
                {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              </div>

              {batches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">已导入批次 ({batches.length})</h4>
                  {batches.map(b => (
                    <div key={b.batch_id} className="card p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{b.app_name} {b.brand && `· ${b.brand}`}</div>
                        <div className="text-xs text-slate-500">{b.count} 条 · {b.platform} · {new Date(b.uploaded_at).toLocaleDateString('zh-CN')}</div>
                      </div>
                      <button onClick={() => deleteBatch(b.batch_id)} className="text-xs text-red-500 hover:underline">删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {importMode === 'reviewmine' && (
            <div className="space-y-3">
              <div className="card p-4 bg-slate-50 border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  ReviewMine 是第三方 App Store 评论分析平台。配置 Token 后，可直接在此浏览和筛选应用商店评论数据。
                  <a href="https://reviewmine.app/app-selection" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">获取 Token →</a>
                </p>
              </div>
              {!tokenSaved ? (
                <div className="card p-4 space-y-3">
                  <div className="flex gap-2">
                    <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} type="password" placeholder="ReviewMine auth_token" className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono" />
                    <button onClick={saveRmToken} disabled={savingToken} className="btn-primary text-xs !py-1.5">{savingToken ? '保存中...' : '保存 Token'}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-600">Token 已配置</span>
                    <button onClick={clearRmToken} className="text-xs text-red-500 hover:underline">清除 Token</button>
                  </div>
                  <iframe ref={iframeRef} src={getStartPage()} className="w-full h-[600px] rounded-xl border border-slate-200" />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ───
export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('llm');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">设置</h1>
        <p className="text-sm text-slate-500 mt-1">管理 LLM 配置、采集渠道与专家经验 Prompt</p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'llm' && <LLMConfigTab />}
      {tab === 'prompts' && <PromptsTab />}
      {tab === 'sources' && <SourcesTab />}
    </div>
  );
}
