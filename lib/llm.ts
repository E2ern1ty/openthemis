/**
 * 统一 LLM 客户端
 * ─────────────────────────────────────────────────────────────
 * 平台所有内置分析（研究 / 策略 / 沙盘 / 复盘 / 助手 / 关键词建议）
 * 统一通过本模块调用 LLM。只支持 OpenAI 兼容（/v1/chat/completions）接口。
 *
 * 配置来源优先级：
 *   1. 数据库 llm_config 表（Settings 页面可视化配置，热更新）
 *   2. 环境变量 LLM_ENDPOINT / LLM_API_KEY / LLM_MODEL（兜底）
 */

import { getDb } from './db';

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface LLMConfigRow {
  endpoint: string;
  api_key: string;
  model: string;
  updated_at: string;
}

function envConfig(): LLMConfig {
  return {
    endpoint: process.env.LLM_ENDPOINT || '',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || '',
  };
}

/** 读取当前生效配置（DB 优先，逐字段回退到环境变量）。 */
export function getLLMConfig(): LLMConfig {
  const env = envConfig();
  try {
    const row = getDb()
      .prepare('SELECT endpoint, api_key, model, updated_at FROM llm_config WHERE id = 1')
      .get() as LLMConfigRow | undefined;
    if (row) {
      return {
        endpoint: row.endpoint || env.endpoint,
        apiKey: row.api_key || env.apiKey,
        model: row.model || env.model,
      };
    }
  } catch {
    /* DB 不可用时回退环境变量 */
  }
  return env;
}

/** 持久化配置（来自 Settings 页面）。 */
export function saveLLMConfig(cfg: Partial<LLMConfig>): LLMConfig {
  const db = getDb();
  const current = getLLMConfig();
  const next: LLMConfig = {
    endpoint: (cfg.endpoint ?? current.endpoint).trim(),
    apiKey: (cfg.apiKey ?? current.apiKey).trim(),
    model: (cfg.model ?? current.model).trim(),
  };
  db.prepare(
    `INSERT INTO llm_config (id, endpoint, api_key, model, updated_at)
     VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       endpoint = excluded.endpoint,
       api_key = excluded.api_key,
       model = excluded.model,
       updated_at = CURRENT_TIMESTAMP`,
  ).run(next.endpoint, next.apiKey, next.model);
  return next;
}

export function isLLMConfigured(): boolean {
  const c = getLLMConfig();
  return Boolean(c.endpoint && c.apiKey && c.model);
}

// ─── JSON 提取与鲁棒解析（供各 Agent 复用）────────────────────

export function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text.trim();
}

export function robustParseJSON<T>(raw: string): T {
  const attempts = [
    raw,
    raw.replace(/("(?:[^"\\]|\\.)*")/g, (m) =>
      m.replace(/(?<!\\)\t/g, '\\t').replace(/(?<!\\)\n/g, '\\n').replace(/(?<!\\)\r/g, '\\r'),
    ),
    raw.replace(/[\x00-\x1f]/g, (c) => (c === '\n' || c === '\r' || c === '\t') ? ' ' : ''),
  ];
  for (const text of attempts) {
    try { return JSON.parse(text); } catch { /* next */ }
  }
  const stripped = raw.replace(/[\x00-\x1f]/g, (c) => (c === '\n' || c === '\r' || c === '\t') ? ' ' : '');
  const lastGoodComma = stripped.lastIndexOf(',');
  if (lastGoodComma > 0) {
    const truncated = stripped.slice(0, lastGoodComma);
    let opens = 0, openBraces = 0;
    for (const ch of truncated) {
      if (ch === '[') opens++;
      if (ch === ']') opens--;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
    }
    let suffix = '';
    for (let i = 0; i < openBraces; i++) suffix += '}';
    for (let i = 0; i < opens; i++) suffix += ']';
    try { return JSON.parse(truncated + suffix); } catch { /* final */ }
  }
  throw new Error(`Failed to parse LLM JSON (${raw.length} chars): ${raw.slice(0, 100)}...`);
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/\u0000/g, '');
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** 仅用于日志标识调用方，如 "Strategy Agent" */
  label?: string;
  /** 是否对输入做控制字符清洗（默认 true） */
  sanitize?: boolean;
}

export interface ChatResult {
  content: string;
  finishReason?: string;
}

/**
 * OpenAI 兼容的 chat completions 调用。返回原始 content（未做 JSON 提取）。
 * 未配置 LLM 时抛错 "LLM not configured"。
 */
export async function chat(
  systemPrompt: string,
  userMessage: string,
  options: ChatOptions = {},
): Promise<ChatResult> {
  const { temperature = 0.2, maxTokens = 8000, label = 'LLM', sanitize = true } = options;
  const config = getLLMConfig();
  if (!config.endpoint || !config.apiKey || !config.model) {
    throw new Error('LLM not configured');
  }

  const system = sanitize ? sanitizeText(systemPrompt) : systemPrompt;
  const user = sanitize ? sanitizeText(userMessage) : userMessage;

  console.log(`[${label}] Calling LLM (${config.model})...`);
  const startTime = Date.now();

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  const finishReason = choice?.finish_reason;
  if (!content) throw new Error('LLM returned empty content');

  console.log(`[${label}] LLM responded in ${Date.now() - startTime}ms (${content.length} chars${finishReason ? `, finish_reason: ${finishReason}` : ''})`);
  if (finishReason === 'length') {
    console.warn(`[${label}] Response was truncated due to token limit`);
  }

  return { content, finishReason };
}

/** 便捷封装：调用后直接提取 JSON 字符串。 */
export async function chatJSON(
  systemPrompt: string,
  userMessage: string,
  options: ChatOptions = {},
): Promise<string> {
  const { content } = await chat(systemPrompt, userMessage, options);
  return extractJSON(content);
}

/** 用一次最小调用测试当前配置是否可用。 */
export async function testLLMConnection(cfg?: LLMConfig): Promise<{ ok: boolean; error?: string; model?: string }> {
  const config = cfg || getLLMConfig();
  if (!config.endpoint || !config.apiKey || !config.model) {
    return { ok: false, error: 'LLM 未配置（需填写 Endpoint / API Key / Model）' };
  }
  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    if (!data.choices?.[0]) {
      return { ok: false, error: '响应格式异常：未返回 choices' };
    }
    return { ok: true, model: config.model };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}
