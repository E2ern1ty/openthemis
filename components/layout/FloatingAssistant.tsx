'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAssistant, type Reference } from '@/lib/assistant-context';
import { useI18n } from '@/lib/i18n';

function RefChip({ ref: r, onRemove }: { ref: Reference; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] max-w-[180px]">
      <span className="truncate">{r.label}</span>
      <button onClick={onRemove} className="shrink-0 hover:text-red-500 transition-colors">&times;</button>
    </span>
  );
}

const QUICK_QUESTIONS: [string, string][] = [
  ['当前页面的数据有什么洞察？', 'What insights does the current page data show?'],
  ['帮我总结一下关键发现', 'Summarize the key findings for me'],
  ['有哪些可优化的方向？', 'What can be improved?'],
];

export default function FloatingAssistant() {
  const { t } = useI18n();
  const {
    messages, references, open, loading, pageSnapshot,
    toggle, sendMessage, removeReference, clearHistory,
  } = useAssistant();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputValue = useRef('');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  function handleSend() {
    const text = inputRef.current?.value?.trim();
    if (!text) return;
    if (inputRef.current) inputRef.current.value = '';
    inputValue.current = '';
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasPageData = pageSnapshot && Object.keys(pageSnapshot.data).length > 0;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={toggle}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center hover:shadow-xl hover:shadow-blue-600/40 transition-shadow"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {Math.min(messages.filter(m => m.role === 'assistant').length, 99)}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">{t('舆情助手', 'Assistant')}</span>
                  {hasPageData && (
                    <span className="ml-2 px-1.5 py-0.5 text-[9px] bg-white/20 text-white/80 rounded">
                      {pageSnapshot.page}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    title={t('清空对话', 'Clear conversation')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={toggle}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[420px]">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <path d="M12 17h.01" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {t('你好，我是舆情助手', 'Hi, I\'m your opinion assistant')}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    {hasPageData
                      ? t(`已感知「${pageSnapshot.page}」页面数据，可直接提问`, `I'm aware of the "${pageSnapshot.page}" page data — ask away`)
                      : t('可以问我任何舆情分析相关的问题', 'Ask me anything about opinion analysis')}
                  </p>
                  <div className="space-y-1.5">
                    {QUICK_QUESTIONS.map(q => (
                      <button
                        key={q[0]}
                        onClick={() => sendMessage(t(q[0], q[1]))}
                        className="block w-full text-left text-xs text-blue-600 bg-blue-50/60 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                      >
                        {t(q[0], q[1])}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%]">
                    {msg.references && msg.references.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1 justify-end">
                        {msg.references.map(r => (
                          <span key={r.id} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">
                            @ {r.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.modified && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {t('策略已更新', 'Strategy updated')}
                      </span>
                    )}
                    {msg.role === 'assistant' && msg.confidence && msg.confidence !== 'high' && (
                      <span className={`inline-block mt-1 text-[10px] ${
                        msg.confidence === 'medium' ? 'text-amber-500' : 'text-red-400'
                      }`}>
                        {msg.confidence === 'medium' ? t('置信度中', 'Medium confidence') : t('置信度低', 'Low confidence')}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Referenced content chips */}
            {references.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-1.5">
                {references.map(r => (
                  <RefChip key={r.id} ref={r} onRemove={() => removeReference(r.id)} />
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-slate-100 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                onKeyDown={handleKeyDown}
                placeholder={hasPageData ? t(`基于「${pageSnapshot.page}」数据提问...`, `Ask about "${pageSnapshot.page}" data...`) : t('问我任何舆情问题...', 'Ask me anything about opinion...')}
                className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 border-none outline-none bg-transparent"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
