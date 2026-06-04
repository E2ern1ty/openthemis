import type { SentimentResult, TopicResult, TopNegative, OpportunityData } from './types';
import { getPrompt, seedPrompt } from './prompts';
import { chatJSON, robustParseJSON } from './llm';

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  return chatJSON(systemPrompt, userMessage, { temperature: 0.1, maxTokens: 8000, label: 'Agent' });
}

// ═══════════════════════════════════════════════════════════════
// 第一步：情感与主题分层
// ═══════════════════════════════════════════════════════════════

export const SENTIMENT_PROMPT = `你是一位拥有15年经验的消费互联网竞争情报分析师。

任务：对采集到的竞品评论/内容进行情感分类。

分类规则（必须明确归类，不得模糊处理）：
- positive：明确表达满意、推荐、认可、好评
- negative：明确表达不满、投诉、批评、抱怨
- neutral：客观描述事实、转述新闻、无明显情感倾向
- emoji、网络用语（如yyds、绝了、无语）也要纳入情感判断

输出要求：
- 统计三类情感的条数
- details 只取每种情感最具代表性的 5 条做摘要（最多共 15 条）
- content 字段为原文精简摘要，不超过 40 字，不含换行符

严格返回 JSON（不要加解释文字、不要加 markdown 代码块）：
{"positive":数量,"neutral":数量,"negative":数量,"details":[{"content":"摘要","sentiment":"positive|neutral|negative"}]}`;

export async function analyzeSentiment(items: Array<{ content: string }>): Promise<SentimentResult> {
  seedPrompt('sentiment', SENTIMENT_PROMPT);
  const prompt = getPrompt('sentiment') || SENTIMENT_PROMPT;
  const sample = items.slice(0, 100);
  const texts = sample.map((it, i) => `${i + 1}. ${it.content.slice(0, 60)}`).join('\n');
  const raw = await callLLM(prompt, `以下是从微博、小红书等渠道采集的 ${sample.length} 条竞品相关内容（共采集 ${items.length} 条）：\n\n${texts}`);
  const result = robustParseJSON<SentimentResult>(raw);
  if (items.length > sample.length) {
    const ratio = items.length / sample.length;
    result.positive = Math.round(result.positive * ratio);
    result.neutral = Math.round(result.neutral * ratio);
    result.negative = Math.round(result.negative * ratio);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// 第一步（续）：主题聚类
// ═══════════════════════════════════════════════════════════════

export const TOPIC_PROMPT = `你是一位拥有15年经验的消费互联网竞争情报分析师。

任务：对竞品评论数据进行主题聚类，识别用户讨论的核心话题。

主题标签参考（可根据实际内容新增）：
- 价格体验（价格、性价比、收费、计费、优惠）
- 取还车流程（取车、还车、解锁、停车桩、等待）
- 车况与安全（车况、刹车、故障、脏、旧、安全）
- 客服响应（客服、投诉、回复、退款）
- App体验（App、定位、闪退、操作、导航）
- 活动权益（优惠券、月卡、骑行卡、促销、积分）
- 品牌对比（评测、对比、推荐、选择）
- 覆盖范围（找不到车、投放量、区域覆盖）

规则：
- 最多 8 个话题，按评论数量降序
- 同一条评论可归属多个主题（但统计时不重复计数）
- 每个话题必须判断整体情感倾向
- negative_ratio 高的话题重点标注

严格返回 JSON（不要加解释文字、不要加 markdown 代码块）：
{"topics":[{"name":"话题名称","count":涉及评论数,"sentiment":"positive|neutral|negative|mixed","keywords":["关键词1","关键词2","关键词3"]}]}`;

export async function analyzeTopics(items: Array<{ content: string }>): Promise<TopicResult> {
  seedPrompt('topic', TOPIC_PROMPT);
  const prompt = getPrompt('topic') || TOPIC_PROMPT;
  const sample = items.slice(0, 100);
  const texts = sample.map((it, i) => `${i + 1}. ${it.content.slice(0, 80)}`).join('\n');
  const raw = await callLLM(prompt, `以下是 ${sample.length} 条竞品评论/内容：\n\n${texts}`);
  return robustParseJSON<TopicResult>(raw);
}

// ═══════════════════════════════════════════════════════════════
// 第二步：差评深挖（重点）
// ═══════════════════════════════════════════════════════════════

export const NEGATIVE_PROMPT = `你是一位拥有15年经验的消费互联网竞争情报分析师，专注差评深挖。

任务：从负面评论中识别高频痛点，并判断严重性。

分析维度：
1. 高频痛点：同类诉求出现 ≥3 次即视为高频
2. 严重性判断：
   - "系统性缺陷"：跨不同时间段、跨用户的重复投诉，说明是产品/服务层面的结构性问题
   - "偶发抱怨"：个别用户的特定情境反馈，不具有普遍性
3. 情绪烈度：通过用词判断用户不满程度（强烈不满 vs 一般不满）

规则：
- 合并相似诉求，归纳为差评主题
- 每个主题给出 2-3 条原始证据（原文摘要不超过50字，不含换行符）
- 按 count 降序排列，必须输出 3-5 个差评主题（即使某些主题只有 1-2 条提及也应列出）
- severity 必须为 "系统性缺陷" 或 "偶发抱怨"
- 如果负面文本总量较少，也要尽量从中提取不同维度的痛点（如价格、服务、产品质量、体验流程等）

质量红线：
- 禁止模糊表述，"用户体验较差"不是有效洞察，"取车等待超5分钟被提及12次"才是
- 所有结论必须有原始信号支撑

严格返回 JSON（不要加解释文字、不要加 markdown 代码块）：
{"items":[{"summary":"差评核心问题概括（具体、可量化）","count":涉及条数,"topic":"所属话题","severity":"系统性缺陷|偶发抱怨","examples":["原文示例1","原文示例2"]}]}`;

export async function analyzeTopNegative(items: Array<{ content: string; sentiment?: string }>): Promise<TopNegative> {
  const negItems = items.filter(i => i.sentiment === 'negative');
  const feedItems = negItems.length >= 10 ? negItems : items;
  if (feedItems.length === 0) {
    return { items: [] };
  }
  seedPrompt('negative', NEGATIVE_PROMPT);
  const prompt = getPrompt('negative') || NEGATIVE_PROMPT;
  const texts = feedItems.slice(0, 80).map((it, i) => `${i + 1}. ${it.content.slice(0, 100)}`).join('\n');
  const label = negItems.length >= 10
    ? `以下是 ${negItems.length} 条被判定为负面情感的竞品评论`
    : `以下是 ${feedItems.length} 条竞品评论（含正面/中性/负面），请从中识别负面痛点`;
  const raw = await callLLM(prompt, `${label}：\n\n${texts}`);
  return robustParseJSON<TopNegative>(raw);
}

// ═══════════════════════════════════════════════════════════════
// 第四步：机会点识别（核心输出）
// ═══════════════════════════════════════════════════════════════

export function buildOpportunityPrompt(ownBrand?: string): string {
  const ownContext = ownBrand
    ? `\n\n本方监测主体：「${ownBrand}」
分析时请始终站在「${ownBrand}」的舆情视角：
- 负面舆情中暴露的问题，对「${ownBrand}」意味着怎样的风险或影响
- 正面舆情中的亮点，是「${ownBrand}」可巩固的口碑资产
- 直接提及「${ownBrand}」的评价，作为主体舆情现状参考`
    : '';

  return `你是一位拥有15年经验的舆情分析专家，专注于从海量舆情中提炼关键研判点与应对建议。${ownContext}

任务：基于多渠道舆情分析结果，输出${ownBrand ? `针对「${ownBrand}」的` : ''}关键舆情研判点。

每个研判点必须满足以下逻辑链：
高频/严重舆情信号 → 背后反映的真实问题或诉求 → 对主体的风险/影响判断 → 可落地的应对或关注建议

研判置信度评估：
- 5（高）：≥10条一致证据，覆盖多渠道
- 4（中高）：5-9条证据
- 3（中）：3-5条证据，或单一渠道
- 2（低）：<3条证据，或存在反向证据
- 1（极低）：仅为推测

规则：
- title 格式："舆情信号 → 研判结论"
- description 包含：舆情现象概述 + 反映的核心问题 + 应对/关注建议（不超过120字，不含换行符）
- evidence 从原始舆情中摘取，每条不超过50字
- risk_note 标注该研判的风险等级或需进一步核实的前提（不超过40字）
- 最多 5 个研判点，按 confidence 降序

质量红线：
1. 禁止编造数据：所有研判必须有可追溯的原始舆情支撑
2. 禁止模糊表述：要具体、可量化（如"被提及12次"而非"较多用户"）
3. 正负面均要如实呈现：不为凑数忽略真实的正面口碑
4. 优先级排序：按「置信度 × 影响程度」降序

严格返回 JSON（不要加解释文字、不要加 markdown 代码块）：
{"opportunities":[{"title":"舆情信号 → 研判结论","description":"研判与建议","confidence":5,"evidence":["原文1","原文2"],"brand":"涉及主体","topic":"所属话题","risk_note":"风险/核实提示"}]}`;
}

export async function identifyOpportunities(
  sentimentResult: SentimentResult,
  topicResult: TopicResult,
  topNegative: TopNegative,
  brands: string[],
  ownBrand?: string,
): Promise<OpportunityData[]> {
  const otherBrands = ownBrand ? brands.filter(b => b !== ownBrand) : brands;
  const brandLabel = ownBrand
    ? `本方主体「${ownBrand}」及相关主体「${otherBrands.join('、')}」`
    : `主体「${brands.join('、')}」`;
  seedPrompt('opportunity', buildOpportunityPrompt());
  const customPrompt = getPrompt('opportunity');
  const ctx = JSON.stringify({ sentimentResult, topicResult, topNegative, brands, ownBrand: ownBrand || null }, null, 2);
  const raw = await callLLM(
    customPrompt || buildOpportunityPrompt(ownBrand),
    `以下是对${brandLabel}的多渠道舆情分析结果，请输出关键研判点：\n\n${ctx}`,
  );
  const parsed = robustParseJSON<{ opportunities: OpportunityData[] }>(raw);
  return parsed.opportunities || [];
}
