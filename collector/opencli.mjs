import { spawn } from 'child_process';
import { getChannel } from './channels.mjs';

const OPENCLI_BIN = process.env.OPENCLI_BIN || 'opencli';
const SEARCH_TIMEOUT = Number(process.env.OPENCLI_TIMEOUT_MS || 120_000);

// OpenCLI 退出码约定：0 成功；77 需要登录（AUTH_REQUIRED）；其它为执行错误
const EXIT_AUTH_REQUIRED = 77;

export class AuthRequiredError extends Error {
  constructor(message, loginUrl) {
    super(message || 'login required');
    this.name = 'AuthRequiredError';
    this.code = 'AUTH_REQUIRED';
    this.loginUrl = loginUrl;
  }
}

function runOpenCli(args, { timeout = SEARCH_TIMEOUT } = {}) {
  return new Promise((resolve) => {
    const child = spawn(OPENCLI_BIN, args, {
      env: process.env,
      // 后台运行，不抢占前台窗口
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ code: -1, stdout, stderr: stderr + '\n[collector] opencli timed out' });
    }, timeout);

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(err?.message || err) });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

// stdout 为纯 JSON（banner/日志走 stderr）。容错地提取首个 JSON 数组/对象。
function parseJsonOutput(stdout) {
  const text = stdout.trim();
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch { /* fall through */ }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch { /* ignore */ }
  }
  return [];
}

/**
 * 通过 OpenCLI 在某渠道搜索关键词，返回归一化后的 FetchedItem[]。
 * 未登录时抛出 AuthRequiredError。
 */
export async function searchChannel(channelId, keyword, brand, limit = 20) {
  const channel = getChannel(channelId);
  if (!channel) {
    throw new Error(`unknown channel: ${channelId}`);
  }

  const args = [channel.site, 'search', keyword, '--limit', String(limit), '-f', 'json'];
  console.log(`[Collector] opencli ${args.join(' ')}`);
  const { code, stdout, stderr } = await runOpenCli(args);

  if (code === EXIT_AUTH_REQUIRED || /AUTH_REQUIRED/.test(stderr)) {
    throw new AuthRequiredError(
      `请在 Chrome 中登录${channel.name}后重试`,
      channel.loginUrl,
    );
  }
  if (code !== 0) {
    throw new Error(`opencli ${channel.site} search failed (code ${code}): ${stderr.slice(-300)}`);
  }

  const rows = parseJsonOutput(stdout);
  const items = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const mapped = channel.map(row);
      return {
        source: channel.name,
        brand: brand || keyword,
        content: (mapped.content || '').trim(),
        score: null,
        likes: mapped.likes || 0,
        date: mapped.date || '',
        url: mapped.url || '',
      };
    })
    .filter((it) => it.content.length > 0);

  console.log(`[Collector] ${channel.name}: ${items.length} items for "${keyword}"`);
  return items;
}

/**
 * 探测某渠道是否已登录（OpenCLI 复用用户 Chrome 会话）。
 * 用一次极小的 search 探测：拿到结果或空结果都视为已登录；
 * 抛 AuthRequiredError 视为未登录。
 */
export async function probeChannelLogin(channelId) {
  const channel = getChannel(channelId);
  if (!channel) return { loggedIn: false };
  try {
    await searchChannel(channelId, 'test', undefined, 1);
    return { loggedIn: true };
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return { loggedIn: false, loginUrl: channel.loginUrl };
    }
    // 其它错误（如选择器漂移）不代表未登录，按已连接处理但带上告警
    return { loggedIn: true, warning: String(e?.message || e).slice(0, 200) };
  }
}

export async function checkOpenCliAvailable() {
  const { code, stdout } = await runOpenCli(['--version'], { timeout: 10_000 });
  return { ok: code === 0, version: stdout.trim() };
}

/**
 * 拉取微博热搜话题（opencli weibo hot）。
 * 返回归一化的话题列表：{ rank, word, category, label, hotValue, url }
 * weibo hot 是公开接口，通常无需登录即可获取。
 */
export async function fetchWeiboHot(limit = 50) {
  const args = ['weibo', 'hot', '--limit', String(limit), '-f', 'json'];
  console.log(`[Collector] opencli ${args.join(' ')}`);
  const { code, stdout, stderr } = await runOpenCli(args, { timeout: 90_000 });

  if (code === EXIT_AUTH_REQUIRED || /AUTH_REQUIRED/.test(stderr)) {
    throw new AuthRequiredError('请在 Chrome 中登录微博后重试', 'https://weibo.com');
  }
  if (code !== 0) {
    throw new Error(`opencli weibo hot failed (code ${code}): ${stderr.slice(-300)}`);
  }

  const rows = parseJsonOutput(stdout);
  const topics = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      rank: Number(row.rank) || 0,
      word: String(row.word || row.title || '').trim(),
      category: String(row.category || '').trim(),
      label: String(row.label || '').trim(),
      hotValue: Number(row.hot_value ?? row.hotValue ?? 0) || 0,
      url: String(row.url || ''),
    }))
    .filter((t) => t.word.length > 0);

  console.log(`[Collector] weibo hot: ${topics.length} topics`);
  return topics;
}
