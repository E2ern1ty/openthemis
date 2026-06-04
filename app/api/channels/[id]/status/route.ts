import { channelStatus } from '@/lib/collector-client';

// 探测某渠道登录态（OpenCLI 复用用户 Chrome 会话）
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const status = await channelStatus(id);
    return Response.json(status);
  } catch (e) {
    console.error(`[Channels] status failed for ${id}:`, e);
    return Response.json({ loggedIn: false });
  }
}
