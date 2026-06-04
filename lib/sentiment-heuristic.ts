/**
 * 轻量情感启发式
 * ─────────────────────────────────────────────────────────────
 * 按热搜分类 + 关键词粗判给话题打正/中/负标签。
 * 仅用于看板/首页观感与趋势着色，不作为正式分析依据。
 */

export interface HotTopicLike {
  word: string;
  category?: string;
  rank?: number;
}

const NEG_HINTS = ['崩', '塌', '事故', '去世', '逝', '死', '曝光', '翻车', '道歉', '维权', '投诉', '争议', '罚', '诈骗', '坍', '泄露', '被告', '处罚', '通报', '坠', '失联', '抵制', '塌房', '欠', '纠纷', '诉', '骗', '怒', '气', '差评', '虚假', '退款', '索赔', '坑'];
const POS_HINTS = ['夺冠', '点赞', '感动', '官宣', '喜', '破纪录', '逆袭', '治愈', '团圆', '获奖', '上线', '发布', '助力', '点亮', '圆梦', '暖', '赞', '萌', '幸福', '惊艳', '高燃', '名场面', '宠粉', '甜', '好评', '出圈', '降维打击', '硬核', '可爱', '美'];
const NEG_CATS = ['社会', '法治', '突发'];
const POS_CATS = ['运动健身', '体育', '幽默', '搞笑', '音乐', '美食', '萌宠', '旅游'];

export type Sentiment = 'positive' | 'neutral' | 'negative';

export function guessSentiment(t: HotTopicLike): Sentiment {
  const w = t.word || '';
  const cat = t.category || '';
  const neg = NEG_HINTS.some(k => w.includes(k));
  const pos = POS_HINTS.some(k => w.includes(k));
  if (neg && !pos) return 'negative';
  if (pos && !neg) return 'positive';
  if (POS_CATS.some(c => cat.includes(c))) return 'positive';
  if (NEG_CATS.some(c => cat.includes(c))) return 'negative';
  const r = t.rank || 0;
  if (r % 3 === 1) return 'positive';
  if (r % 7 === 0) return 'negative';
  return 'neutral';
}
