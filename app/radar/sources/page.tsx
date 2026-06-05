'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';

interface Channel {
  id: string;
  name: string;
  site: string;
  loginUrl: string;
}

interface ChannelStatus {
  loggedIn: boolean;
  loginUrl?: string;
  warning?: string;
  checking?: boolean;
}

export default function DataSourcesPage() {
  const { t } = useI18n();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ChannelStatus>>({});
  const [collectorError, setCollectorError] = useState<string | null>(null);

  const checkStatus = useCallback(async (id: string) => {
    setStatuses(prev => ({ ...prev, [id]: { ...prev[id], loggedIn: prev[id]?.loggedIn ?? false, checking: true } }));
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
      if (data.error) setCollectorError(data.error);
      else setCollectorError(null);
      list.forEach(c => checkStatus(c.id));
    } catch {
      setCollectorError(t('采集层不可用，请确认 collector 进程已启动', 'Collector unavailable; make sure the collector process is running'));
    }
  }, [checkStatus, t]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('采集渠道', 'Channels')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('所有渠道通过 OpenCLI 统一接入，复用你在 Chrome 中已登录的会话', 'All channels connect via OpenCLI, reusing your logged-in Chrome sessions')}
          </p>
        </div>
        <button onClick={loadChannels} className="btn-secondary text-sm">{t('刷新状态', 'Refresh')}</button>
      </div>

      {collectorError && (
        <div className="card p-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">{collectorError}</p>
          <p className="text-xs text-red-500 mt-1">{t('在 collector 目录运行', 'In the collector directory run')} <code className="font-mono">npm start</code> {t('启动采集层。', 'to start the collector.')}</p>
        </div>
      )}

      <div className="grid gap-3">
        {channels.map(ch => {
          const st = statuses[ch.id];
          const loggedIn = st?.loggedIn;
          return (
            <div key={ch.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                    {ch.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{ch.name}</h3>
                      {st?.checking ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />{t('检测中', 'Checking')}
                        </span>
                      ) : loggedIn ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{t('已连接', 'Connected')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />{t('未登录', 'Not logged in')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {loggedIn
                        ? t('已可用于舆情采集', 'Ready for opinion collection')
                        : t('请在 Chrome 中登录该平台，OpenCLI 将自动复用登录态', 'Log in to this platform in Chrome; OpenCLI will reuse the session')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!loggedIn && (
                    <a href={ch.loginUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
                      {t('去 Chrome 登录', 'Log in via Chrome')}
                    </a>
                  )}
                  <button onClick={() => checkStatus(ch.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    {t('重新检测', 'Re-check')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {channels.length === 0 && !collectorError && (
          <div className="card p-12 text-center text-sm text-slate-500">{t('正在加载采集渠道...', 'Loading channels...')}</div>
        )}
      </div>

      <div className="card p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <svg className="text-blue-600 mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-blue-800">{t('关于登录', 'About login')}</h4>
            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
              {t('采集层基于 OpenCLI 浏览器桥接，直接复用你本机 Chrome 中已登录的会话，无需在本应用内单独扫码。首次使用请确认已安装 OpenCLI 浏览器扩展，并在 Chrome 中登录对应平台。CSV / Excel 数据导入请前往「设置 → 数据导入」。',
                 'The collector uses an OpenCLI browser bridge to reuse your local Chrome login sessions directly — no separate QR scan needed here. On first use, make sure the OpenCLI browser extension is installed and you are logged into the platform in Chrome. For CSV / Excel import, go to Settings → Import.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
