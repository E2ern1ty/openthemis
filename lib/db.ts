import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'growthbox.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      industry TEXT DEFAULT '出行',
      is_own INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS raw_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      brand TEXT NOT NULL,
      content TEXT NOT NULL,
      score REAL,
      likes INTEGER DEFAULT 0,
      date TEXT,
      url TEXT,
      sentiment TEXT,
      topics TEXT,
      data_source_id INTEGER,
      analysis_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brands TEXT NOT NULL,
      own_brand TEXT DEFAULT '',
      date_range TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      total_items INTEGER DEFAULT 0,
      sentiment_result TEXT,
      topic_result TEXT,
      top_negative TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      confidence INTEGER DEFAULT 3,
      evidence TEXT DEFAULT '[]',
      brand TEXT,
      topic TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (analysis_id) REFERENCES analyses(id)
    );

    CREATE TABLE IF NOT EXISTS uploaded_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      score REAL,
      author TEXT DEFAULT '',
      date TEXT,
      platform TEXT DEFAULT 'App Store',
      batch_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      is_default INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS llm_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      endpoint TEXT NOT NULL DEFAULT '',
      api_key TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hot_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL DEFAULT 'weibo',
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      topics TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hot_snapshots_time ON hot_snapshots(channel, captured_at);
  `);

  // Migrations
  const brandCols = db.prepare("PRAGMA table_info(brands)").all() as Array<{ name: string }>;
  if (!brandCols.find(c => c.name === 'is_own')) {
    db.exec('ALTER TABLE brands ADD COLUMN is_own INTEGER DEFAULT 0');
  }
  const analysisCols = db.prepare("PRAGMA table_info(analyses)").all() as Array<{ name: string }>;
  if (!analysisCols.find(c => c.name === 'own_brand')) {
    db.exec("ALTER TABLE analyses ADD COLUMN own_brand TEXT DEFAULT ''");
  }
  if (!analysisCols.find(c => c.name === 'research_question')) {
    db.exec("ALTER TABLE analyses ADD COLUMN research_question TEXT DEFAULT ''");
  }

  // 历史遗留表清理：采集渠道改由 OpenCLI 网关提供；营销模块（策略/沙盘/复盘）已下线。
  db.exec('DROP TABLE IF EXISTS data_sources');
  db.exec('DROP TABLE IF EXISTS sandbox_scenarios');
  db.exec('DROP TABLE IF EXISTS campaigns');
  db.exec('DROP TABLE IF EXISTS strategies');
}
