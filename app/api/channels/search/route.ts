import { search } from '@/lib/collector-client';

// 统一的渠道搜索入口（只读）
export async function POST(request: Request) {
  try {
    const { channel, keyword, brand, limit = 20 } = await request.json();
    if (!channel) return Response.json({ error: '缺少 channel 参数' }, { status: 400 });
    if (!keyword) return Response.json({ error: '关键词不能为空' }, { status: 400 });

    const result = await search(channel, keyword, brand || keyword, limit);
    return Response.json(result);
  } catch (e) {
    const status = (e as { status?: number }).status;
    const code = (e as { code?: string }).code;
    if (status === 401 || code === 'AUTH_REQUIRED') {
      return Response.json(
        {
          error: (e as Error).message || '该渠道未登录',
          code: 'AUTH_REQUIRED',
          loginUrl: (e as { loginUrl?: string }).loginUrl,
        },
        { status: 401 },
      );
    }
    console.error('[Channels] search failed:', e);
    return Response.json({ error: '搜索失败' }, { status: 500 });
  }
}
