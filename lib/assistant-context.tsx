'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export interface Reference {
  id: string;
  label: string;
  type: 'radar_sentiment' | 'radar_topic' | 'radar_negative' | 'radar_opportunity' | 'radar_overview'
    | 'strategy_meta' | 'strategy_audience' | 'strategy_channel' | 'strategy_pacing' | 'strategy_assumption'
    | 'custom';
  data: unknown;
  addedAt: number;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Reference[];
  modified?: boolean;
  confidence?: string;
  timestamp: number;
}

export interface PageSnapshot {
  page: string;
  path: string;
  data: Record<string, unknown>;
}

interface AssistantState {
  messages: AssistantMessage[];
  references: Reference[];
  open: boolean;
  loading: boolean;
  pageContext: string;
  strategyId: number | null;
  pageSnapshot: PageSnapshot;
}

interface AssistantActions {
  toggle: () => void;
  setOpen: (open: boolean) => void;
  addReference: (ref: Reference) => void;
  removeReference: (id: string) => void;
  clearReferences: () => void;
  sendMessage: (text: string) => Promise<void>;
  setPageContext: (ctx: string, strategyId?: number | null) => void;
  updatePageSnapshot: (data: Record<string, unknown>) => void;
  clearHistory: () => void;
}

type AssistantCtx = AssistantState & AssistantActions;

const Ctx = createContext<AssistantCtx | null>(null);

const STORAGE_KEY = 'openthemis_assistant';

const PAGE_NAME_MAP: Record<string, string> = {
  '/': '首页',
  '/radar': '舆情分析',
  '/settings': '设置',
};

function resolvePageName(pathname: string): string {
  if (PAGE_NAME_MAP[pathname]) return PAGE_NAME_MAP[pathname];
  if (pathname.startsWith('/radar/')) return '舆情分析详情';
  return pathname;
}

function loadMessages(): AssistantMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMessages(msgs: AssistantMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50))); } catch { /* noop */ }
}

let msgCounter = 0;
function uid() { return `msg_${Date.now()}_${++msgCounter}`; }

export function AssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageContext, setPageContextRaw] = useState('radar');
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [pageSnapshot, setPageSnapshot] = useState<PageSnapshot>({ page: '首页', path: '/', data: {} });
  const snapshotRef = useRef<PageSnapshot>(pageSnapshot);

  useEffect(() => {
    const name = resolvePageName(pathname);
    setPageSnapshot(prev => {
      const next = { ...prev, page: name, path: pathname, data: {} };
      snapshotRef.current = next;
      return next;
    });
  }, [pathname]);

  useEffect(() => { setMessages(loadMessages()); }, []);
  useEffect(() => { if (messages.length > 0) saveMessages(messages); }, [messages]);

  const toggle = useCallback(() => setOpen(v => !v), []);

  const addReference = useCallback((ref: Reference) => {
    setReferences(prev => {
      const exists = prev.find(r => r.id === ref.id);
      if (exists) return prev;
      return [...prev.slice(-4), ref];
    });
    setOpen(true);
  }, []);

  const removeReference = useCallback((id: string) => {
    setReferences(prev => prev.filter(r => r.id !== id));
  }, []);

  const clearReferences = useCallback(() => setReferences([]), []);

  const setPageContext = useCallback((ctx: string, sid?: number | null) => {
    setPageContextRaw(ctx);
    setStrategyId(sid ?? null);
  }, []);

  const updatePageSnapshot = useCallback((data: Record<string, unknown>) => {
    setPageSnapshot(prev => {
      const next = { ...prev, data: { ...prev.data, ...data } };
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: AssistantMessage = {
      id: uid(), role: 'user', content: text,
      references: references.length > 0 ? [...references] : undefined,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.role, content: m.content,
      }));

      const currentSnapshot = snapshotRef.current;

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          page_context: pageContext,
          strategy_id: strategyId,
          page_snapshot: currentSnapshot,
          references: references.map(r => ({ label: r.label, type: r.type, data: r.data })),
          conversation_history: history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        setMessages(prev => [...prev, {
          id: uid(), role: 'assistant', content: err.error || '请求失败', timestamp: Date.now(),
        }]);
        return;
      }

      const data = await res.json();
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', content: data.answer,
        modified: data.modification_intent?.triggered,
        confidence: data.confidence,
        timestamp: Date.now(),
      }]);

      if (data.strategy_updated) {
        window.dispatchEvent(new CustomEvent('assistant:strategy-updated'));
      }
    } catch {
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', content: '网络错误，请重试', timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
      setReferences([]);
    }
  }, [loading, messages, references, pageContext, strategyId]);

  return (
    <Ctx.Provider value={{
      messages, references, open, loading, pageContext, strategyId, pageSnapshot,
      toggle, setOpen, addReference, removeReference, clearReferences,
      sendMessage, setPageContext, updatePageSnapshot, clearHistory,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAssistant must be inside AssistantProvider');
  return ctx;
}
