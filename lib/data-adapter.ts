import { search as collectorSearch } from './collector-client';
import { getDb } from './db';

export interface FetchedItem {
  source: string;
  brand: string;
  content: string;
  score: number | null;
  likes: number;
  date: string;
  url: string;
}

/**
 * 从某个采集渠道（OpenCLI 网关）抓取某品牌关键词的数据。
 * 所有渠道统一经采集层 -> OpenCLI 获取。
 */
export async function fetchFromChannel(
  channelId: string,
  brand: string,
  limit = 20,
): Promise<FetchedItem[]> {
  try {
    const { items } = await collectorSearch(channelId, brand, brand, limit);
    console.log(`[Adapter] ${channelId}: fetched ${items.length} items for "${brand}"`);
    return items;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'AUTH_REQUIRED') {
      console.warn(`[Adapter] ${channelId} 未登录，跳过："${brand}"`);
    } else {
      console.error(`[Adapter] ${channelId} fetch failed for "${brand}":`, e);
    }
    return [];
  }
}

export async function fetchFromUploadedReviewsByBatch(
  batchIds: string[],
): Promise<FetchedItem[]> {
  if (batchIds.length === 0) return [];
  try {
    const db = getDb();
    const placeholders = batchIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT content, score, author, date, platform, app_name, brand
       FROM uploaded_reviews
       WHERE batch_id IN (${placeholders})
       ORDER BY created_at DESC`,
    ).all(...batchIds) as Array<{
      content: string; score: number | null; author: string;
      date: string; platform: string; app_name: string; brand: string;
    }>;

    const items: FetchedItem[] = rows.map(r => ({
      source: '导入数据',
      brand: r.brand || r.app_name || '未知',
      content: r.content,
      score: r.score,
      likes: 0,
      date: r.date || '',
      url: '',
    }));

    console.log(`[Adapter] Import: fetched ${items.length} reviews from ${batchIds.length} batch(es)`);
    return items;
  } catch (e) {
    console.error(`[Adapter] Import data fetch failed:`, e);
    return [];
  }
}
