// 首页实时舆情 Feed 的共享类型（前后端共用）

export interface HomeFeedTopic {
  word: string;
  category: string;
  hotValue: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  url: string;
}

export interface HomeFeed {
  live: boolean;
  source: string;
  fetchedAt: string;
  total: number;
  sampled: number;
  sentiment: { positive: number; neutral: number; negative: number };
  topTopics: HomeFeedTopic[];
  alert: HomeFeedTopic | null;
}
