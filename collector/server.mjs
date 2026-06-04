import http from 'http';
import { listChannels, getChannel } from './channels.mjs';
import {
  searchChannel,
  probeChannelLogin,
  checkOpenCliAvailable,
  fetchWeiboHot,
  AuthRequiredError,
} from './opencli.mjs';

const PORT = Number(process.env.COLLECTOR_PORT || 4001);
const TOKEN = process.env.COLLECTOR_TOKEN || '';

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

// 采集层对外的统一 HTTP 契约（全部只读，所有渠道经 OpenCLI 统一接入）：
//   GET  /health                 健康检查（含 opencli 可用性）
//   GET  /channels               列出所有可用采集渠道
//   GET  /channels/:id/status    探测某渠道登录态（复用用户 Chrome 会话）
//   POST /search                 { channel, keyword, brand?, limit? } 关键词搜索
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  if (TOKEN && pathname !== '/health') {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${TOKEN}`) {
      return send(res, 401, { error: 'unauthorized' });
    }
  }

  try {
    if (method === 'GET' && pathname === '/health') {
      const oc = await checkOpenCliAvailable();
      return send(res, 200, {
        ok: true,
        service: 'openthemis-collector',
        opencli: oc,
      });
    }

    if (method === 'GET' && pathname === '/channels') {
      return send(res, 200, { channels: listChannels() });
    }

    // GET /weibo/hot?limit=50  微博热搜话题
    if (method === 'GET' && pathname === '/weibo/hot') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 50);
      const topics = await fetchWeiboHot(limit);
      return send(res, 200, { topics, total: topics.length });
    }

    // GET /channels/:id/status
    const statusMatch = pathname.match(/^\/channels\/([^/]+)\/status$/);
    if (method === 'GET' && statusMatch) {
      const id = decodeURIComponent(statusMatch[1]);
      if (!getChannel(id)) return send(res, 404, { error: `unknown channel: ${id}` });
      const result = await probeChannelLogin(id);
      return send(res, 200, result);
    }

    if (method === 'POST' && pathname === '/search') {
      const { channel, keyword, brand, limit = 20 } = await readBody(req);
      if (!channel) return send(res, 400, { error: '缺少 channel 参数' });
      if (!keyword) return send(res, 400, { error: '关键词不能为空' });
      if (!getChannel(channel)) return send(res, 404, { error: `unknown channel: ${channel}` });

      const items = await searchChannel(channel, keyword, brand, limit);
      return send(res, 200, { items, total: items.length });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return send(res, 401, { error: e.message, code: 'AUTH_REQUIRED', loginUrl: e.loginUrl });
    }
    console.error(`[Collector] Error on ${method} ${pathname}:`, e);
    return send(res, 500, { error: String(e?.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`[Collector] OpenThemis 采集层（OpenCLI 网关）已启动: http://localhost:${PORT}`);
  console.log(`[Collector] 渠道: ${listChannels().map((c) => c.name).join(', ')}`);
  if (TOKEN) console.log('[Collector] Token auth enabled');
});

function shutdown() {
  console.log('\n[Collector] Shutting down...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
