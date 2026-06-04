import { getDb } from './db';
import { fetchFromChannel, fetchFromUploadedReviewsByBatch, type FetchedItem } from './data-adapter';
import { analyzeSentiment, analyzeTopics, analyzeTopNegative, identifyOpportunities } from './agent';
import type { SentimentResult, TopicResult, TopNegative, Analysis } from './types';

export async function processAnalysis(
  analysisId: number,
  brands: string[],
  _dateRange: { start: string; end: string },
  sourceIds?: string[],
  ownBrand?: string,
) {
  const db = getDb();

  const setProgress = (p: number) =>
    db.prepare('UPDATE analyses SET progress = ? WHERE id = ?').run(p, analysisId);

  const setError = (msg: string) => {
    console.error(`Analysis ${analysisId} error:`, msg);
    db.prepare('UPDATE analyses SET status = ?, progress = 0 WHERE id = ?').run('error', analysisId);
  };

  try {
    setProgress(5);

    // sourceIds 语义：采集渠道 id（如 xiaohongshu / weibo）+ import:<batchId>
    const selected = sourceIds ?? [];
    const importBatchIds = selected
      .filter(id => id.startsWith('import:'))
      .map(id => id.replace('import:', ''));
    const channelIds = selected.filter(id => !id.startsWith('import:'));

    let realItems: FetchedItem[] = [];

    for (const channelId of channelIds) {
      for (const brand of brands) {
        console.log(`[Radar] Fetching "${brand}" from channel ${channelId} ...`);
        const fetched = await fetchFromChannel(channelId, brand);
        realItems.push(...fetched);
      }
    }

    if (importBatchIds.length > 0) {
      console.log(`[Radar] Fetching imported data from ${importBatchIds.length} batch(es) ...`);
      const fetched = await fetchFromUploadedReviewsByBatch(importBatchIds);
      console.log(`[Radar] Import data returned ${fetched.length} items`);
      realItems.push(...fetched);
    }

    setProgress(15);

    const allItems = realItems;
    console.log(`[Radar] Collected ${allItems.length} real items from ${channelIds.length} channel(s) + ${importBatchIds.length} import batch(es)`);

    if (allItems.length === 0) {
      setError('未采集到任何数据，请检查数据源配置和品牌关键词');
      return;
    }

    setProgress(20);

    const insertRaw = db.prepare(
      `INSERT INTO raw_data (source, brand, content, score, likes, date, url, analysis_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMany = db.transaction((rows: FetchedItem[]) => {
      for (const r of rows) {
        insertRaw.run(r.source, r.brand, r.content, r.score, r.likes, r.date, r.url, analysisId);
      }
    });
    insertMany(allItems);

    db.prepare('UPDATE analyses SET total_items = ? WHERE id = ?').run(allItems.length, analysisId);
    setProgress(35);

    await runLLMPipeline(analysisId, allItems.map(i => ({ content: i.content })), brands, undefined, ownBrand);
  } catch (err) {
    setError(String(err));
  }
}

async function runLLMPipeline(
  analysisId: number,
  items: Array<{ content: string }>,
  brands: string[],
  existing?: { sentiment?: SentimentResult; topic?: TopicResult; negative?: TopNegative },
  ownBrand?: string,
) {
  const db = getDb();
  const setProgress = (p: number) =>
    db.prepare('UPDATE analyses SET progress = ? WHERE id = ?').run(p, analysisId);

  let sentimentResult = existing?.sentiment ?? null;
  if (!sentimentResult) {
    console.log(`[Retry] Analysis ${analysisId}: running sentiment analysis...`);
    sentimentResult = await analyzeSentiment(items);
    db.prepare('UPDATE analyses SET sentiment_result = ? WHERE id = ?')
      .run(JSON.stringify(sentimentResult), analysisId);
  } else {
    console.log(`[Retry] Analysis ${analysisId}: sentiment already exists, skipping`);
  }
  setProgress(55);

  let topicResult = existing?.topic ?? null;
  if (!topicResult) {
    console.log(`[Retry] Analysis ${analysisId}: running topic analysis...`);
    topicResult = await analyzeTopics(items);
    db.prepare('UPDATE analyses SET topic_result = ? WHERE id = ?')
      .run(JSON.stringify(topicResult), analysisId);
  } else {
    console.log(`[Retry] Analysis ${analysisId}: topics already exist, skipping`);
  }
  setProgress(70);

  let topNeg = existing?.negative ?? null;
  if (!topNeg) {
    console.log(`[Retry] Analysis ${analysisId}: running negative review analysis...`);
    const itemsWithSentiment = items.map((item, idx) => ({
      content: item.content,
      sentiment: sentimentResult!.details[idx]?.sentiment,
    }));
    topNeg = await analyzeTopNegative(itemsWithSentiment);
    db.prepare('UPDATE analyses SET top_negative = ? WHERE id = ?')
      .run(JSON.stringify(topNeg), analysisId);
  } else {
    console.log(`[Retry] Analysis ${analysisId}: negative reviews already exist, skipping`);
  }
  setProgress(85);

  const existingOpps = db.prepare('SELECT COUNT(*) as c FROM opportunities WHERE analysis_id = ?').get(analysisId) as { c: number };
  if (existingOpps.c === 0) {
    console.log(`[Retry] Analysis ${analysisId}: running opportunity identification...`);
    const opportunities = await identifyOpportunities(sentimentResult!, topicResult!, topNeg!, brands, ownBrand);
    const insertOpp = db.prepare(
      `INSERT INTO opportunities (analysis_id, title, description, confidence, evidence, brand, topic)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const opp of opportunities) {
      insertOpp.run(
        analysisId, opp.title, opp.description, opp.confidence,
        JSON.stringify(opp.evidence), opp.brand, opp.topic,
      );
    }
  } else {
    console.log(`[Retry] Analysis ${analysisId}: opportunities already exist (${existingOpps.c}), skipping`);
  }

  setProgress(100);
  db.prepare('UPDATE analyses SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('completed', analysisId);
}

export async function retryAnalysis(analysisId: number) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId) as Analysis | undefined;
  if (!row) throw new Error(`Analysis ${analysisId} not found`);
  if (row.status !== 'error') throw new Error(`Analysis ${analysisId} is not in error state`);

  db.prepare('UPDATE analyses SET status = ?, progress = 35 WHERE id = ?').run('processing', analysisId);

  const brands: string[] = JSON.parse(row.brands);
  const ownBrand: string = row.own_brand || '';

  const rawRows = db.prepare('SELECT content FROM raw_data WHERE analysis_id = ?').all(analysisId) as Array<{ content: string }>;
  if (rawRows.length === 0) {
    db.prepare('UPDATE analyses SET status = ?, progress = 0 WHERE id = ?').run('error', analysisId);
    throw new Error('No raw data found — cannot retry, please start a new analysis');
  }

  console.log(`[Retry] Analysis ${analysisId}: resuming with ${rawRows.length} raw items, checking checkpoints...`);

  const existing: { sentiment?: SentimentResult; topic?: TopicResult; negative?: TopNegative } = {};
  if (row.sentiment_result) {
    try { existing.sentiment = JSON.parse(row.sentiment_result); } catch { /* re-run */ }
  }
  if (row.topic_result) {
    try { existing.topic = JSON.parse(row.topic_result); } catch { /* re-run */ }
  }
  if (row.top_negative) {
    try { existing.negative = JSON.parse(row.top_negative); } catch { /* re-run */ }
  }

  const skipped = [
    existing.sentiment ? '情感分析' : null,
    existing.topic ? '主题聚类' : null,
    existing.negative ? '差评深挖' : null,
  ].filter(Boolean);
  if (skipped.length > 0) {
    console.log(`[Retry] Analysis ${analysisId}: will skip: ${skipped.join(', ')}`);
  }

  try {
    await runLLMPipeline(analysisId, rawRows, brands, existing, ownBrand);
  } catch (err) {
    console.error(`Analysis ${analysisId} retry error:`, String(err));
    db.prepare('UPDATE analyses SET status = ?, progress = 0 WHERE id = ?').run('error', analysisId);
    throw err;
  }
}
