import { getLLMConfig, saveLLMConfig, testLLMConnection } from '@/lib/llm';

// 读取当前 LLM 配置（api_key 脱敏返回）
export async function GET() {
  const cfg = getLLMConfig();
  return Response.json({
    endpoint: cfg.endpoint,
    model: cfg.model,
    apiKeySet: Boolean(cfg.apiKey),
    apiKeyPreview: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}••••${cfg.apiKey.slice(-4)}` : '',
    configured: Boolean(cfg.endpoint && cfg.apiKey && cfg.model),
  });
}

// 保存配置。apiKey 为空字符串时表示「不修改」，留空已存在的 key。
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const patch: { endpoint?: string; model?: string; apiKey?: string } = {};
    if (typeof body.endpoint === 'string') patch.endpoint = body.endpoint;
    if (typeof body.model === 'string') patch.model = body.model;
    // 仅当显式传入非空 apiKey 才更新（避免脱敏值覆盖真实 key）
    if (typeof body.apiKey === 'string' && body.apiKey.trim() !== '') {
      patch.apiKey = body.apiKey;
    }
    const saved = saveLLMConfig(patch);
    return Response.json({
      ok: true,
      endpoint: saved.endpoint,
      model: saved.model,
      apiKeySet: Boolean(saved.apiKey),
      configured: Boolean(saved.endpoint && saved.apiKey && saved.model),
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

// 测试连接。可传入临时配置测试（不落库），不传则测当前已保存配置。
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const hasOverride = body && (body.endpoint || body.model || (body.apiKey && body.apiKey.trim()));
    if (hasOverride) {
      const current = getLLMConfig();
      const result = await testLLMConnection({
        endpoint: (body.endpoint || current.endpoint || '').trim(),
        model: (body.model || current.model || '').trim(),
        apiKey: (body.apiKey && body.apiKey.trim()) ? body.apiKey.trim() : current.apiKey,
      });
      return Response.json(result);
    }
    const result = await testLLMConnection();
    return Response.json(result);
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
