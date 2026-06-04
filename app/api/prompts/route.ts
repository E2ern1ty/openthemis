import { NextRequest, NextResponse } from 'next/server';
import { getAllPrompts, upsertPrompt, resetPrompt, seedPrompt } from '@/lib/prompts';
import { SENTIMENT_PROMPT, TOPIC_PROMPT, NEGATIVE_PROMPT, buildOpportunityPrompt } from '@/lib/agent';
import { SYSTEM_PROMPT } from '@/app/api/assistant/chat/route';
import { BRAND_SUGGEST_PROMPT } from '@/app/api/brands/suggest/route';

const DEFAULT_CONTENTS: Record<string, string> = {
  sentiment: SENTIMENT_PROMPT,
  topic: TOPIC_PROMPT,
  negative: NEGATIVE_PROMPT,
  opportunity: buildOpportunityPrompt(),
  assistant: SYSTEM_PROMPT,
  brand_suggest: BRAND_SUGGEST_PROMPT,
};

function ensureSeeded() {
  for (const [id, content] of Object.entries(DEFAULT_CONTENTS)) {
    seedPrompt(id, content);
  }
}

export async function GET() {
  ensureSeeded();
  const prompts = getAllPrompts();
  return NextResponse.json(prompts);
}

export async function PUT(req: NextRequest) {
  const { id, content } = await req.json();
  if (!id || typeof content !== 'string') {
    return NextResponse.json({ error: '需要提供 id 和 content' }, { status: 400 });
  }
  upsertPrompt(id, content);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '需要提供 id' }, { status: 400 });
  }
  const defaultContent = DEFAULT_CONTENTS[id];
  if (!defaultContent) {
    return NextResponse.json({ error: '未找到默认 Prompt' }, { status: 404 });
  }
  resetPrompt(id, defaultContent);
  return NextResponse.json({ ok: true });
}
