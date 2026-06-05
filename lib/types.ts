export interface Brand {
  id: number;
  name: string;
  industry: string;
  is_own: number;
  created_at: string;
}

export interface RawDataItem {
  id: number;
  source: string;
  brand: string;
  content: string;
  score: number | null;
  likes: number;
  date: string;
  url: string;
  sentiment: string | null;
  topics: string | null;
  data_source_id: number | null;
  created_at: string;
}

export interface Analysis {
  id: number;
  brands: string;
  own_brand: string;
  research_question: string;
  date_range: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  total_items: number;
  sentiment_result: string | null;
  topic_result: string | null;
  top_negative: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Opportunity {
  id: number;
  analysis_id: number;
  title: string;
  description: string;
  confidence: number;
  evidence: string;
  brand: string;
  topic: string;
  created_at: string;
}

export interface SentimentResult {
  positive: number;
  neutral: number;
  negative: number;
  details: Array<{ content: string; sentiment: 'positive' | 'neutral' | 'negative' }>;
}

export interface TopicResult {
  topics: Array<{
    name: string;
    count: number;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    keywords: string[];
  }>;
}

export interface TopNegative {
  items: Array<{
    summary: string;
    count: number;
    topic: string;
    severity: '系统性缺陷' | '偶发抱怨';
    examples: string[];
  }>;
}

export interface OpportunityData {
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  brand: string;
  topic: string;
  risk_note?: string;
}

export interface RawItemBrief {
  source: string;
  brand: string;
  content: string;
  likes: number;
  date: string;
  url: string;
  sentiment: string | null;
}

export interface AnalysisResult {
  id: number;
  status: string;
  progress: number;
  brands: string[];
  ownBrand?: string;
  dateRange: { start: string; end: string };
  totalItems: number;
  sentiment: SentimentResult | null;
  topics: TopicResult | null;
  topNegative: TopNegative | null;
  opportunities: OpportunityData[];
  sources: string[];
  rawItems?: RawItemBrief[];
}

// ─── Uploaded Reviews Types ───────────────────────────────────

export interface UploadedReview {
  id: number;
  app_name: string;
  brand: string;
  content: string;
  score: number | null;
  author: string;
  date: string;
  platform: string;
  batch_id: string;
  created_at: string;
}
