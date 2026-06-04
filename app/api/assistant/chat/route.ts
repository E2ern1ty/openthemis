import { NextRequest, NextResponse } from 'next/server';
import { getPrompt, seedPrompt } from '@/lib/prompts';
import { chat, extractJSON } from '@/lib/llm';

export const SYSTEM_PROMPT = `你是 Themis舆情分析系统（OpenThemis）的智能助手。你既是平台的智能向导，也是一位资深的舆情分析专家。

## 你的身份
你同时具备两种能力：
1. **平台助手**：熟悉 Themis舆情分析系统的功能（多渠道采集、情感研判、话题聚类、风险预警），能基于用户当前页面的实际数据给出精准分析。
2. **舆情专家**：拥有资深舆情分析师的专业能力，能回答品牌口碑、危机公关、负面研判、热点传播、情绪监测、风险预警等各类舆情问题。

## 舆情专业知识范围
你可以自由回答以下领域的问题（不限于平台数据）：
- 舆情监测与情感分析方法论（情感分类、情绪强度、健康度评估）
- 话题发现与传播分析（热点识别、话题演化、传播路径）
- 负面舆情与危机研判（严重性判定、系统性 vs 偶发、应对分级）
- 品牌口碑与声誉管理（口碑资产、正负面占比、对比研判）
- 风险预警与处置建议（预警阈值、响应优先级、回应口径）
- 多渠道舆情特征（微博、小红书等平台的舆情差异）
- 舆情数据采集与去噪（关键词拆解、噪声过滤、样本代表性）
- 舆情报告撰写（结论先行、证据支撑、可操作建议）

## 页面上下文感知
系统会自动传入用户当前所在页面的信息和数据。你应该：
- 主动感知用户所在的页面，并理解页面上下文
- 当页面有分析数据时，结合这些数据回答问题
- 如果用户的问题与当前页面数据相关，优先使用页面数据佐证你的回答
- 如果用户问的是通用舆情问题，则直接用你的专业知识回答，同时可以适当关联当前页面

## 回答风格
- 专业但不晦涩，像一位经验丰富的舆情分析负责人在交流
- 先给结论、再给理由和论据
- 数字和数据要具体，避免空泛描述
- 3-8句话为宜，复杂问题可以适当展开
- 可以主动提供可操作的建议
- 当涉及平台数据时标注数据来源

返回纯 JSON（不要 markdown 代码块）：
{
  "answer": "回答文本",
  "action_type": "query|analysis|decision|modification|general",
  "modification_intent": {"triggered": false, "description": null},
  "confidence": "high|medium|low"
}`;

interface PageSnapshot {
  page: string;
  path: string;
  data: Record<string, unknown>;
}

function buildPageContextBlock(snapshot?: PageSnapshot): string {
  if (!snapshot) return '';
  const parts: string[] = [];
  parts.push(`📍 用户当前所在页面：${snapshot.page}（路径：${snapshot.path}）`);

  const d = snapshot.data;
  if (!d || Object.keys(d).length === 0) {
    parts.push('（该页面暂无加载数据）');
    return parts.join('\n');
  }

  if (snapshot.path === '/radar' || snapshot.page.includes('舆情')) {
    parts.push('\n=== 舆情分析数据 ===');
    if (d.brands) parts.push(`监测主体/关键词：${JSON.stringify(d.brands)}`);
    if (d.ownBrand) parts.push(`本方主体：${d.ownBrand}`);
    if (d.totalItems) parts.push(`数据量：${d.totalItems} 条`);
    if (d.sentiment) parts.push(`情感分析：${JSON.stringify(d.sentiment)}`);
    if (d.topics) parts.push(`热门话题：${JSON.stringify(d.topics)}`);
    if (d.topNegative) {
      const neg = Array.isArray(d.topNegative) ? d.topNegative.slice(0, 5) : d.topNegative;
      parts.push(`负面舆情洞察（top5）：${JSON.stringify(neg)}`);
    }
    if (d.opportunities) parts.push(`舆情研判：${JSON.stringify(d.opportunities)}`);
  }

  return parts.join('\n');
}

function truncateContext(text: string, maxLen = 12000): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '\n...(数据过长已截断)';
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    question: string;
    page_context: string;
    page_snapshot?: PageSnapshot;
    references: Array<{ label: string; type: string; data: unknown }>;
    conversation_history: Array<{ role: string; content: string }>;
  };

  if (!body.question?.trim()) {
    return NextResponse.json({ error: '问题不能为空' }, { status: 400 });
  }

  try {
    const contextParts: string[] = [];

    const pageCtxBlock = buildPageContextBlock(body.page_snapshot);
    if (pageCtxBlock) {
      contextParts.push(truncateContext(pageCtxBlock));
    } else {
      contextParts.push(`当前页面：${body.page_context}`);
    }

    if (body.references.length > 0) {
      contextParts.push('用户引用的数据：');
      for (const ref of body.references) {
        contextParts.push(`[${ref.label}] (${ref.type}):\n${JSON.stringify(ref.data, null, 2)}`);
      }
    }

    if (body.conversation_history.length > 0) {
      contextParts.push('对话历史：');
      for (const m of body.conversation_history.slice(-6)) {
        contextParts.push(`${m.role}: ${m.content}`);
      }
    }

    contextParts.push(`用户问题：${body.question}`);

    const systemPrompt = (() => {
      seedPrompt('assistant', SYSTEM_PROMPT);
      return getPrompt('assistant') || SYSTEM_PROMPT;
    })();

    const { content } = await chat(systemPrompt, contextParts.join('\n\n'), {
      temperature: 0.3,
      maxTokens: 16000,
      label: 'Assistant',
    });

    let parsed;
    try {
      parsed = JSON.parse(extractJSON(content));
    } catch {
      parsed = { answer: content, action_type: 'general', confidence: 'medium' };
    }

    return NextResponse.json({
      answer: parsed.answer || content,
      action_type: parsed.action_type || 'general',
      modification_intent: parsed.modification_intent || null,
      confidence: parsed.confidence || 'medium',
      strategy_updated: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Assistant] General chat error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
