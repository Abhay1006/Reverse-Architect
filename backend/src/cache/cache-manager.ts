import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Path for the SQLite database
const DB_PATH = process.env.ATLAS_DB_PATH || path.join(os.homedir(), '.atlas', 'cache.db');

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize schema
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS repos (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    last_commit TEXT,
    last_analyzed DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ready'
  );

  CREATE TABLE IF NOT EXISTS analysis_cache (
    repo_id TEXT PRIMARY KEY REFERENCES repos(id) ON DELETE CASCADE,
    result_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS recent_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id TEXT REFERENCES repos(id) ON DELETE CASCADE,
    repo_name TEXT NOT NULL,
    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    node_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_recent_analyses_time ON recent_analyses(analyzed_at DESC);
`);

export interface CachedAnalysis {
  repo_id: string;
  result_json: string;
  created_at: string;
}

export interface RecentRepo {
  repo_id: string;
  repo_name: string;
  analyzed_at: string;
  node_count: number;
  edge_count: number;
}

export interface AnalysisPayload {
  nodes: unknown[];
  edges: unknown[];
  godObjectDetails?: unknown[];
  deadCodeDetails?: unknown[];
  entryPoint?: { entryFile: string; framework: string } | null | undefined;
}

export class CacheManager {
  /**
   * Get the full cached analysis result for a repo.
   */
  static getCachedResult(repoId: string): AnalysisPayload | null {
    const row = db.prepare('SELECT result_json FROM analysis_cache WHERE repo_id = ?').get(repoId) as { result_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.result_json) as AnalysisPayload;
    } catch {
      return null;
    }
  }

  /**
   * Get the last analyzed commit SHA for a repo.
   */
  static getLastCommit(repoId: string): string | null {
    const row = db.prepare('SELECT last_commit FROM repos WHERE id = ?').get(repoId) as { last_commit: string } | undefined;
    return row?.last_commit || null;
  }

  /**
   * Save a full analysis result to the cache.
   */
  static saveResult(repoId: string, url: string, commitSha: string, result: AnalysisPayload): void {
    const resultJson = JSON.stringify(result);
    const nodeCount = result.nodes?.length || 0;
    const edgeCount = result.edges?.length || 0;
    const repoName = url.replace(/^https?:\/\/(www\.)?github\.com\//, '');

    const insertRepo = db.prepare(`
      INSERT INTO repos (id, url, last_commit, file_count, last_analyzed, status)
      VALUES (@id, @url, @commit, @fileCount, CURRENT_TIMESTAMP, 'ready')
      ON CONFLICT(id) DO UPDATE SET
        last_commit = @commit,
        last_analyzed = CURRENT_TIMESTAMP,
        file_count = @fileCount,
        status = 'ready'
    `);

    const insertCache = db.prepare(`
      INSERT INTO analysis_cache (repo_id, result_json, created_at)
      VALUES (@id, @json, CURRENT_TIMESTAMP)
      ON CONFLICT(repo_id) DO UPDATE SET
        result_json = @json,
        created_at = CURRENT_TIMESTAMP
    `);

    const insertRecent = db.prepare(`
      INSERT INTO recent_analyses (repo_id, repo_name, node_count, edge_count, analyzed_at)
      VALUES (@id, @name, @nodeCount, @edgeCount, CURRENT_TIMESTAMP)
    `);

    const transaction = db.transaction(() => {
      insertRepo.run({ id: repoId, url, commit: commitSha, fileCount: nodeCount });
      insertCache.run({ id: repoId, json: resultJson });
      
      // Cleanup old recent entries for this repo to avoid duplicates
      db.prepare('DELETE FROM recent_analyses WHERE repo_id = ?').run(repoId);
      insertRecent.run({ id: repoId, name: repoName, nodeCount, edgeCount });
      
      // Keep only top 20 recent analyses total
      db.prepare(`
        DELETE FROM recent_analyses 
        WHERE id NOT IN (
          SELECT id FROM recent_analyses ORDER BY analyzed_at DESC LIMIT 20
        )
      `).run();
    });

    transaction();
  }

  /**
   * Get the most recently analyzed repositories.
   */
  static getRecentRepos(limit: number = 5): RecentRepo[] {
    return db.prepare('SELECT * FROM recent_analyses ORDER BY analyzed_at DESC LIMIT ?').all(limit) as RecentRepo[];
  }
}
