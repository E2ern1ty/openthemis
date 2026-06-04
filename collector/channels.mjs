/**
 * 渠道注册表
 * ─────────────────────────────────────────────────────────────
 * 所有采集渠道统一通过 OpenCLI 的 `opencli <site> search` 接口获取。
 * 新增一个渠道 = 在此追加一条配置，无需改动其它代码。
 *
 * map(row) 负责把某个 OpenCLI site 的输出行，归一化为统一的
 * FetchedItem 字段：{ content, likes, date, url }
 * （source / brand / score 由网关统一补齐）
 */

function pickDate(row) {
  const v = row.published_at || row.time || row.date || row.created_at || '';
  if (!v) return new Date().toISOString().split('T')[0];
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().split('T')[0];
}

function toLikes(row) {
  const v = row.likes ?? row.liked_count ?? row.like_count ?? 0;
  const n = typeof v === 'string' ? parseInt(v.replace(/[^\d]/g, ''), 10) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const CHANNELS = [
  {
    id: 'xiaohongshu',
    name: '小红书',
    site: 'xiaohongshu',
    loginUrl: 'https://www.xiaohongshu.com',
    map: (row) => ({
      content: [row.title, row.desc, row.content].filter(Boolean).join(' ').trim(),
      likes: toLikes(row),
      date: pickDate(row),
      url: row.url || '',
    }),
  },
  {
    id: 'weibo',
    name: '微博',
    site: 'weibo',
    loginUrl: 'https://weibo.com',
    map: (row) => ({
      content: [row.title, row.text, row.content].filter(Boolean).join(' ').trim(),
      likes: toLikes(row),
      date: pickDate(row),
      url: row.url || '',
    }),
  },
];

export function getChannel(id) {
  return CHANNELS.find((c) => c.id === id || c.site === id);
}

export function listChannels() {
  return CHANNELS.map((c) => ({ id: c.id, name: c.name, site: c.site, loginUrl: c.loginUrl }));
}
