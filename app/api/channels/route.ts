import { listChannels } from '@/lib/collector-client';

// 列出所有可用采集渠道（由采集层/OpenCLI 网关提供）
export async function GET() {
  try {
    const channels = await listChannels();
    return Response.json({ channels });
  } catch (e) {
    console.error('[Channels] list failed:', e);
    return Response.json({ channels: [], error: '采集层不可用，请确认 collector 进程已启动' }, { status: 200 });
  }
}
