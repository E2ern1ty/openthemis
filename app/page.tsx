'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { HomeFeed, HomeFeedTopic } from '@/lib/home-feed-types';
import { useI18n } from '@/lib/i18n';

/* ─── Data (bilingual) ─── */

const capabilities = [
  {
    num: '01',
    name: ['多渠道采集', 'Multi-channel'],
    accent: '#3B82F6',
    desc: ['统一接入微博、小红书等公开渠道，支持 Excel/CSV 导入，一处配置全渠道拉取舆情。', 'Unified access to Weibo, Xiaohongshu and more, plus Excel/CSV import — configure once, collect everywhere.'],
    tags: [['微博', 'Weibo'], ['小红书', 'Xiaohongshu'], ['数据导入', 'Import']],
  },
  {
    num: '02',
    name: ['情感研判', 'Sentiment'],
    accent: '#10B981',
    desc: ['AI 对每条舆情做正面 / 中性 / 负面三维分类，量化舆情健康度与情绪走向。', 'AI classifies each item as positive / neutral / negative and quantifies opinion health and mood.'],
    tags: [['情感分类', 'Classification'], ['情绪量化', 'Mood index'], ['健康度', 'Health']],
  },
  {
    num: '03',
    name: ['话题聚类', 'Topic clustering'],
    accent: '#6366F1',
    desc: ['自动识别讨论的核心话题及其情感倾向，定位高热、高负面的关键议题。', 'Automatically surfaces core topics and their sentiment, pinpointing high-heat and high-negativity issues.'],
    tags: [['话题发现', 'Discovery'], ['热度排序', 'Heat rank'], ['情感交叉', 'Cross-sentiment']],
  },
  {
    num: '04',
    name: ['风险预警', 'Risk alerting'],
    accent: '#F59E0B',
    desc: ['深挖负面舆情、判定严重性，提炼关键研判点与应对建议，及时预警。', 'Mines negative opinion, judges severity, and distills key findings with response suggestions.'],
    tags: [['负面深挖', 'Negative mining'], ['严重性判定', 'Severity'], ['研判建议', 'Advice']],
  },
];

const scenarios = [
  { label: ['品牌口碑监测', 'Brand reputation'], flow: ['情感 + 话题', 'Sentiment + Topics'] },
  { label: ['负面舆情预警', 'Negative alerting'], flow: ['风险预警', 'Risk alert'] },
  { label: ['热点事件追踪', 'Hot-event tracking'], flow: ['话题聚类', 'Topics'] },
  { label: ['竞品舆情对比', 'Competitor compare'], flow: ['多主体分析', 'Multi-subject'] },
  { label: ['产品反馈洞察', 'Product feedback'], flow: ['负面深挖', 'Negative mining'] },
  { label: ['危机舆情研判', 'Crisis assessment'], flow: ['风险预警', 'Risk alert'] },
];

const steps = [
  { n: 1, title: ['配置采集渠道', 'Configure channels'], desc: ['接入微博、小红书等公开渠道，或导入自有数据', 'Connect Weibo / Xiaohongshu, or import your own data'], time: ['2 分钟', '2 min'] },
  { n: 2, title: ['新建舆情监测', 'Start a monitor'], desc: ['输入监测主题，AI 自动拆解关键词并多渠道采集', 'Enter a topic; AI decomposes keywords and collects across channels'], time: ['15 分钟', '15 min'] },
  { n: 3, title: ['查看研判报告', 'View the report'], desc: ['情感分布、话题热度、负面深挖与风险研判一屏呈现', 'Sentiment, topic heat, negative mining and risk — all on one screen'], time: ['即时', 'Instant'] },
];

const ease = [0.16, 1, 0.3, 1] as const;

function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Hero Dashboard (live feed) ─── */

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

const HOT_SOURCES = [
  { id: 'weibo', label: '微博' },
  { id: 'reddit', label: 'Reddit' },
] as const;

function HeroDashboard() {
  const { t, lang } = useI18n();
  const [channel, setChannel] = useState<string>('weibo');
  const [feed, setFeed] = useState<HomeFeed | null>(null);

  useEffect(() => {
    let alive = true;
    setFeed(null);
    fetch(`/api/home-feed?channel=${channel}`)
      .then(r => r.json())
      .then((data: HomeFeed) => { if (alive) setFeed(data); })
      .catch(() => { /* keep skeleton */ });
    return () => { alive = false; };
  }, [channel]);

  const loading = !feed;
  const total = feed?.sampled ?? 0;
  const s = feed?.sentiment ?? { positive: 0, neutral: 0, negative: 0 };
  const topTopics: HomeFeedTopic[] = feed?.topTopics ?? [];
  const maxHot = Math.max(1, ...topTopics.map(t => t.hotValue));
  const sentLabel = { positive: t('正面', 'Positive'), neutral: t('中性', 'Neutral'), negative: t('负面', 'Negative') };

  const sentimentCards = [
    { key: 'positive' as const, val: pct(s.positive, total), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
    { key: 'neutral' as const, val: pct(s.neutral, total), color: 'text-stone-600', bg: 'bg-stone-50 border-stone-100' },
    { key: 'negative' as const, val: pct(s.negative, total), color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
  ];

  const fmtHot = (v: number) => {
    if (lang === 'zh') return v >= 10000 ? (v / 10000).toFixed(1) + '万' : String(v);
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return String(v);
  };

  return (
    <div className="relative w-full max-w-[560px]">
      <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/8 via-indigo-400/6 to-emerald-400/5 rounded-3xl blur-2xl" />
      <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl border border-stone-200/80 shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100 bg-stone-50/60">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-200" />
            <div className="w-2.5 h-2.5 rounded-full bg-stone-200" />
            <div className="w-2.5 h-2.5 rounded-full bg-stone-200" />
          </div>
          <span className="text-[11px] text-stone-400 ml-2 font-medium">{t('OpenThemis — 监测工作台', 'OpenThemis — Workbench')}</span>
          {/* 实时数据源切换 */}
          <div className="ml-auto flex items-center gap-0.5 bg-stone-100 rounded-md p-0.5">
            {HOT_SOURCES.map(src => (
              <button
                key={src.id}
                onClick={() => setChannel(src.id)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                  channel === src.id ? 'bg-white text-stone-700 shadow-sm font-medium' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {src.id === 'weibo' ? t('微博', 'Weibo') : src.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Live source strip */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${feed?.live ? 'bg-red-500' : 'bg-stone-400'} animate-pulse`} />
              <span className="text-[11px] font-semibold text-stone-600">
                {feed?.live
                  ? `${channel === 'reddit' ? t('Reddit 热门', 'Reddit Popular') : t('微博热搜', 'Weibo Hot')} · ${t('实时采集', 'live')}`
                  : t('舆情采集', 'Collection')}
              </span>
              <span className="text-[10px] text-stone-400 ml-auto">
                {loading ? t('加载中…', 'Loading…') : t(`${total} 条舆论`, `${total} items`)}
              </span>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-medium text-red-600 shrink-0">{channel === 'weibo' ? t('微博', 'Weibo') : 'Reddit'}</span>
              <div className="flex-1 overflow-hidden">
                <div className="text-[11px] text-stone-600 truncate">
                  {loading
                    ? t('正在随机捞取舆论…', 'Sampling live posts…')
                    : topTopics[0]
                      ? `# ${topTopics[0].word}`
                      : t('暂无实时数据', 'No live data')}
                </div>
              </div>
              <span className="text-sm font-bold text-red-600 tabular-nums shrink-0">{total}</span>
            </div>
          </div>

          {/* Sentiment distribution */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-stone-600">{t('情感分布', 'Sentiment')}</span>
              <span className="text-[10px] text-stone-400">{t(`共 ${total} 条`, `${total} items`)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {sentimentCards.map((d) => (
                <div key={d.key} className={`rounded-lg py-2.5 text-center border ${d.bg}`}>
                  <div className={`text-lg font-bold ${d.color}`}>{loading ? '··' : `${d.val}%`}</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{sentLabel[d.key]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Topic heat (live hot topics) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="text-[11px] font-semibold text-stone-600 mb-2.5">{t('热门话题', 'Hot topics')}</div>
            <div className="space-y-2">
              {(loading ? Array.from({ length: 4 }) : topTopics).map((tp, i) => {
                const topic = tp as HomeFeedTopic | undefined;
                const width = topic ? Math.max(12, Math.round((topic.hotValue / maxHot) * 100)) : 40;
                return (
                  <motion.div
                    key={topic ? topic.word + i : i}
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                  >
                    <span className="text-[11px] text-stone-600 w-28 shrink-0 truncate" title={topic?.word}>
                      {topic ? topic.word : t('加载中…', 'Loading…')}
                    </span>
                    <div className="flex-1 bg-stone-100/80 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          topic?.sentiment === 'negative'
                            ? 'bg-gradient-to-r from-red-400 to-red-300'
                            : topic?.sentiment === 'positive'
                              ? 'bg-gradient-to-r from-emerald-400 to-emerald-300'
                              : 'bg-gradient-to-r from-blue-400 to-blue-300'
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-stone-400 w-10 text-right tabular-nums">
                      {topic ? fmtHot(topic.hotValue) : ''}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Risk alert (live negative topic) */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3.5 border border-amber-100"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center text-white text-[11px] font-bold">!</div>
              <span className="text-[11px] font-semibold text-amber-700">{t('风险研判', 'Risk assessment')}</span>
              {feed?.alert && (
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full ml-auto font-medium">
                  {feed.alert.category || t('负面', 'Negative')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed mt-2">
              {loading
                ? t('正在研判负面舆情风险…', 'Assessing negative risk…')
                : feed?.alert
                  ? t(`「${feed.alert.word}」热度 ${fmtHot(feed.alert.hotValue)}，情绪偏负面，建议重点关注。`,
                       `"${feed.alert.word}" heat ${fmtHot(feed.alert.hotValue)}, leaning negative — worth close attention.`)
                  : t('当前未发现明显负面风险，舆情态势平稳。', 'No notable negative risk; opinion is stable.')}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ─── Capability Mocks ─── */

function CapabilityMock({ index }: { index: number }) {
  const { t } = useI18n();
  const shell = (accent: string, title: string, badge: string, children: React.ReactNode) => (
    <div className="bg-white rounded-2xl border border-stone-200/70 overflow-hidden shadow-[0_4px_24px_rgb(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-stone-100/80 bg-stone-50/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-stone-200/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-200/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-200/80" />
        </div>
        <span className="text-xs font-semibold text-stone-600 ml-1">{title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto" style={{ backgroundColor: accent + '14', color: accent }}>{badge}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  if (index === 0) {
    return shell('#3B82F6', t('多渠道采集', 'Multi-channel'), t('实时', 'Live'),
      <div className="space-y-3">
        {[
          { name: t('微博', 'Weibo'), count: 1247, color: 'bg-red-50 text-red-600 border-red-100' },
          { name: t('小红书', 'Xiaohongshu'), count: 892, color: 'bg-pink-50 text-pink-600 border-pink-100' },
          { name: t('导入数据', 'Imported'), count: 356, color: 'bg-slate-50 text-slate-600 border-slate-100' },
        ].map((s) => (
          <div key={s.name} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${s.color}`}>
            <span className="text-sm font-medium">{s.name}</span>
            <span className="text-sm font-bold tabular-nums">{t(`${s.count.toLocaleString()} 条`, `${s.count.toLocaleString()} items`)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[11px] text-stone-400">{t('统一接入，登录态复用浏览器会话', 'Unified access; login state reuses the browser session')}</span>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return shell('#10B981', t('情感研判', 'Sentiment'), t('已完成', 'Done'),
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('正面', 'Positive'), val: '64%', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
            { label: t('中性', 'Neutral'), val: '24%', color: 'text-stone-600', bg: 'bg-stone-50 border-stone-100' },
            { label: t('负面', 'Negative'), val: '12%', color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
          ].map((d) => (
            <div key={d.label} className={`rounded-xl py-4 text-center border ${d.bg}`}>
              <div className={`text-2xl font-bold ${d.color}`}>{d.val}</div>
              <div className="text-[11px] text-stone-400 mt-0.5">{d.label}</div>
            </div>
          ))}
        </div>
        <div className="bg-stone-50/80 rounded-xl p-3.5">
          <div className="text-[11px] text-stone-500 mb-1.5">{t('舆情健康度', 'Opinion health')}</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-stone-200/60 rounded-full h-2.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" style={{ width: '76%' }} />
            </div>
            <span className="text-sm font-bold text-emerald-600">76</span>
          </div>
        </div>
      </div>
    );
  }

  if (index === 2) {
    return shell('#6366F1', t('话题聚类', 'Topic clustering'), t('8 个话题', '8 topics'),
      <div className="space-y-2.5">
        {[
          { topic: t('产品质量', 'Quality'), pct: 85, count: 342, sentiment: t('负面', 'Negative'), sc: 'text-red-500 bg-red-50' },
          { topic: t('客服响应', 'Support'), pct: 65, count: 261, sentiment: t('负面', 'Negative'), sc: 'text-red-500 bg-red-50' },
          { topic: t('使用体验', 'Experience'), pct: 52, count: 208, sentiment: t('正面', 'Positive'), sc: 'text-emerald-600 bg-emerald-50' },
          { topic: t('价格争议', 'Pricing'), pct: 45, count: 178, sentiment: t('中性', 'Neutral'), sc: 'text-stone-500 bg-stone-100' },
          { topic: t('物流时效', 'Shipping'), pct: 32, count: 126, sentiment: t('负面', 'Negative'), sc: 'text-red-500 bg-red-50' },
        ].map((row) => (
          <div key={row.topic} className="flex items-center gap-3">
            <span className="text-[11px] text-stone-600 w-16 shrink-0">{row.topic}</span>
            <div className="flex-1 bg-stone-100/80 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-300 rounded-full" style={{ width: `${row.pct}%` }} />
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${row.sc}`}>{row.sentiment}</span>
            <span className="text-[10px] text-stone-400 w-8 text-right tabular-nums">{row.count}</span>
          </div>
        ))}
      </div>
    );
  }

  return shell('#F59E0B', t('风险预警', 'Risk alerting'), t('研判', 'Assessed'),
    <div className="space-y-3">
      {[
        { title: t('「客服响应慢」高频负面', '"Slow support" — high-frequency negative'), sev: t('系统性缺陷', 'Systemic'), cnt: 261, sc: 'bg-red-50 text-red-600 border-red-100' },
        { title: t('「退款流程繁琐」集中投诉', '"Refund process too complex" — clustered complaints'), sev: t('系统性缺陷', 'Systemic'), cnt: 143, sc: 'bg-red-50 text-red-600 border-red-100' },
        { title: t('「包装破损」偶发反馈', '"Damaged packaging" — occasional feedback'), sev: t('偶发抱怨', 'Occasional'), cnt: 38, sc: 'bg-amber-50 text-amber-600 border-amber-100' },
      ].map((r) => (
        <div key={r.title} className="rounded-xl border border-stone-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[12px] font-bold text-stone-800 flex-1">{r.title}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${r.sc}`}>{r.sev}</span>
          </div>
          <div className="text-[11px] text-stone-400">{t('被提及', 'Mentioned')} <span className="font-semibold text-stone-600">{r.cnt}</span> {t('次', 'times')}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */

export default function HomePage() {
  const [active, setActive] = useState(0);
  const { t, lang, toggle } = useI18n();
  const L = (pair: string[]) => (lang === 'zh' ? pair[0] : pair[1]);

  return (
    <div className="min-h-screen bg-[#FAFAFA]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#FAFAFA]/80 backdrop-blur-xl border-b border-stone-200/40">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-openthemis.svg" alt="OpenThemis" width={28} height={28} className="rounded-lg" unoptimized />
            <span className="text-[15px] font-semibold text-stone-800 tracking-tight">OpenThemis</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              {t('AI 舆情分析系统', 'AI Opinion Analysis')}
            </span>
            <button
              onClick={toggle}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-[13px] text-stone-500 font-medium hover:border-blue-300 hover:text-blue-600 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {lang === 'zh' ? 'EN' : '中'}
            </button>
            <Link href="/radar" className="inline-flex items-center px-4 py-1.5 rounded-lg border border-stone-300 text-[13px] text-stone-600 font-medium hover:border-blue-300 hover:text-blue-600 transition-all">
              {t('进入工作台', 'Open app')} <span className="ml-1">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-5%] w-[600px] h-[600px] rounded-full bg-blue-400/[0.04] blur-[140px] pointer-events-none" />
          <div className="absolute bottom-[-30%] left-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-300/[0.04] blur-[120px] pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
                <h1 className="text-[2.25rem] sm:text-[3rem] font-extrabold text-stone-900 tracking-tight leading-[1.15]">
                  {lang === 'zh'
                    ? <>让每一条舆情，<br />都被看见与研判</>
                    : <>See and assess<br />every public signal</>}
                </h1>
                <p className="mt-5 text-base sm:text-lg text-stone-400 max-w-md leading-relaxed">
                  {t('多渠道采集、情感研判、话题聚类、风险预警——AI 驱动的一站式舆情分析系统。',
                     'Multi-channel collection, sentiment, topic clustering and risk alerting — an AI-driven, one-stop public-opinion analysis system.')}
                </p>
                <div className="mt-8">
                  <Link href="/radar" className="inline-flex items-center px-7 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all hover:shadow-md hover:shadow-blue-500/25">
                    {t('开始监测', 'Start monitoring')} →
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.9, ease, delay: 0.2 }}
                className="flex justify-center lg:justify-end"
              >
                <HeroDashboard />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Core Capabilities ── */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-20">
          <FadeIn>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-[0.15em]">{t('核心能力', 'CAPABILITIES')}</p>
            <h2 className="mt-2 text-2xl font-bold text-stone-800 tracking-tight">
              {t('从采集到研判，一条流水线', 'From collection to assessment, one pipeline')}
            </h2>
            <p className="mt-1 text-sm text-stone-400">{t('采集 → 情感 → 话题 → 风险，自动串联', 'Collect → Sentiment → Topics → Risk, auto-chained')}</p>
          </FadeIn>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
            <div className="lg:col-span-2 space-y-1">
              {capabilities.map((m, i) => (
                <FadeIn key={m.num} delay={i * 0.06}>
                  <button
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-left group flex items-start gap-4 p-4 rounded-xl transition-all duration-200 ${
                      active === i
                        ? 'bg-white shadow-sm border border-stone-200/80'
                        : 'hover:bg-white/50 border border-transparent'
                    }`}
                  >
                    <span className={`text-lg font-bold tabular-nums shrink-0 leading-none pt-0.5 transition-colors ${
                      active === i ? 'text-blue-400' : 'text-stone-200 group-hover:text-stone-300'
                    }`}>
                      {m.num}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.accent }} />
                        <h3 className={`text-sm font-bold transition-colors ${
                          active === i ? 'text-stone-800' : 'text-stone-600 group-hover:text-stone-700'
                        }`}>{L(m.name)}</h3>
                      </div>
                      <p className="mt-1 text-[12px] text-stone-400 leading-relaxed">{L(m.desc)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.tags.map(tag => (
                          <span key={tag[0]} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{L(tag)}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                </FadeIn>
              ))}

              <FadeIn delay={0.3}>
                <div className="mt-4 flex items-center gap-2 px-4">
                  {capabilities.map((m, i) => (
                    <div key={m.num} className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{
                        backgroundColor: active === i ? m.accent + '18' : '#f5f5f4',
                        color: active === i ? m.accent : '#a8a29e',
                      }}>{L(m.name)}</span>
                      {i < capabilities.length - 1 && <span className="text-stone-300 text-[10px]">→</span>}
                    </div>
                  ))}
                </div>
              </FadeIn>
            </div>

            <div className="lg:col-span-3 flex items-start justify-center">
              <FadeIn>
                <div className="w-full max-w-lg relative">
                  <div className="absolute -inset-3 bg-gradient-to-br from-stone-100/50 to-stone-50/30 rounded-2xl -z-10" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, ease }}
                    >
                      <CapabilityMock index={active} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── Scenarios ── */}
        <section className="border-y border-stone-200/50 bg-stone-50/30">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <FadeIn>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-[0.15em]">{t('应用场景', 'USE CASES')}</p>
                  <h2 className="mt-1.5 text-xl font-bold text-stone-800 tracking-tight">{t('覆盖常见舆情诉求', 'Covers common monitoring needs')}</h2>
                </div>
                <p className="text-sm text-stone-400">{t('一个监测，多维研判', 'One monitor, multi-dimensional insight')}</p>
              </div>
            </FadeIn>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
              {scenarios.map((s, i) => (
                <FadeIn key={s.label[0]} delay={i * 0.04}>
                  <Link
                    href="/radar"
                    className="group flex items-center justify-between py-4 border-b border-stone-200/50 last:border-0 hover:border-blue-200/60 transition-colors"
                  >
                    <span className="text-sm font-medium text-stone-600 group-hover:text-blue-500 transition-colors">{L(s.label)}</span>
                    <span className="text-xs text-stone-400 group-hover:text-blue-400 transition-colors shrink-0 ml-3">{L(s.flow)}</span>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── Getting Started ── */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <FadeIn>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-[0.15em]">{t('快速上手', 'GET STARTED')}</p>
            <h2 className="mt-1.5 text-xl font-bold text-stone-800 tracking-tight">
              {t('三步获得第一份舆情研判报告', 'Your first report in three steps')}
            </h2>
          </FadeIn>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            {steps.map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.1}>
                <div className="relative">
                  <span className="text-[3.5rem] font-extrabold text-stone-100 leading-none select-none">{s.n}</span>
                  <h3 className="mt-1 text-sm font-bold text-stone-800">{L(s.title)}</h3>
                  <p className="mt-1.5 text-sm text-stone-400 leading-relaxed">{L(s.desc)}</p>
                  <p className="mt-2 text-xs text-stone-300">{t('约', '~')} {L(s.time)}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3}>
            <div className="mt-14 flex items-center gap-3">
              <Link href="/radar" className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors">
                {t('开始监测', 'Start monitoring')} →
              </Link>
              <Link href="/settings" className="inline-flex items-center px-5 py-2.5 rounded-lg bg-stone-900 text-stone-100 text-sm font-medium hover:bg-stone-800 transition-colors">
                {t('配置渠道与模型', 'Configure channels & model')}
              </Link>
            </div>
          </FadeIn>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-stone-200/50 bg-stone-50/30">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2.5">
                  <Image src="/logo-openthemis.svg" alt="OpenThemis" width={22} height={22} className="rounded opacity-70" unoptimized />
                  <span className="text-sm font-semibold text-stone-600">OpenThemis</span>
                </div>
                <p className="mt-1.5 text-[12px] text-stone-400">{t('Themis 舆情分析系统 · AI 驱动的一站式舆情分析', 'Themis · AI-driven one-stop public-opinion analysis')}</p>
              </div>
              <div className="flex items-center gap-6 text-[12px] text-stone-400">
                <Link href="/radar" className="hover:text-stone-600 transition-colors">{t('舆情分析', 'Analysis')}</Link>
                <Link href="/settings" className="hover:text-stone-600 transition-colors">{t('设置', 'Settings')}</Link>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-stone-200/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-stone-300">
              <span>© {new Date().getFullYear()} OpenThemis. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <span className="hover:text-stone-400 cursor-pointer transition-colors">{t('隐私政策', 'Privacy')}</span>
                <span className="hover:text-stone-400 cursor-pointer transition-colors">{t('使用条款', 'Terms')}</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
