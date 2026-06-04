/**
 * 采集层客户端
 * ─────────────────────────────────────────────────────────────
 * 分析执行层通过本模块以 HTTP 契约调用「采集层」独立进程。
 * 采集层是一个 OpenCLI 网关：所有渠道（小红书 / 微博 / …）都统一
 * 通过 `opencli <site> search` 获取，登录态复用用户的 Chrome 会话。
 *
 * 配置：
 *   COLLECTOR_URL    采集层地址，默认 http://localhost:4001
 *   COLLECTOR_TOKEN  可选，与采集层一致时携带 Bearer 鉴权
 */

export interface CollectorFetchedItem {
  source: string;
  brand: string;
  content: string;
  score: number | null;
  likes: number;
  date: string;
  url: string;
}

export interface CollectorChannel {
  id: string;
  name: string;
  site: string;
  loginUrl: string;
}

export interface ChannelStatus {
  loggedIn: boolean;
  loginUrl?: string;
  warning?: string;
}

function baseUrl(): string {
  return (process.env.COLLECTOR_URL || 'http://localhost:4001').replace(/\/$/, '');
}

function authHeaders(): Record<string, string> {
  const token = process.env.COLLECTOR_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 130_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data as { error?: string }).error || `Collector ${res.status}`) as Error & {
        status?: number;
        code?: string;
        loginUrl?: string;
      };
      err.status = res.status;
      err.code = (data as { code?: string }).code;
      err.loginUrl = (data as { loginUrl?: string }).loginUrl;
      throw err;
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function collectorHealth(): Promise<boolean> {
  try {
    await call('GET', '/health', undefined, 12_000);
    return true;
  } catch {
    return false;
  }
}

export async function listChannels(): Promise<CollectorChannel[]> {
  const { channels } = await call<{ channels: CollectorChannel[] }>('GET', '/channels', undefined, 8_000);
  return channels;
}

export function channelStatus(channelId: string): Promise<ChannelStatus> {
  return call('GET', `/channels/${encodeURIComponent(channelId)}/status`, undefined, 130_000);
}

export async function search(
  channel: string,
  keyword: string,
  brand?: string,
  limit = 20,
): Promise<{ items: CollectorFetchedItem[]; total: number }> {
  return call('POST', '/search', { channel, keyword, brand, limit }, 130_000);
}
