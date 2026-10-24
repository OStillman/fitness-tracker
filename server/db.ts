import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'data', 'fitness.db');

// Ensure parent directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode for high performance concurrency
db.pragma('journal_mode = WAL');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default_user',
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      done INTEGER DEFAULT 1,
      swapped_for TEXT,
      notes TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parkruns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      time_seconds INTEGER,
      position INTEGER,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      distance_km REAL,
      duration_min INTEGER,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_parkruns_session ON parkruns(session_id);
    CREATE INDEX IF NOT EXISTS idx_activities_session ON activities(session_id);

    CREATE TABLE IF NOT EXISTS pending_activities (
      id TEXT PRIMARY KEY,
      title TEXT,
      type TEXT NOT NULL,
      distance_km REAL,
      duration_min INTEGER,
      start_date TEXT NOT NULL,
      start_time TEXT,
      source TEXT DEFAULT 'strava',
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pending_activities_status ON pending_activities(status);

    CREATE TABLE IF NOT EXISTS user_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT 'default_user',
      brizfit_weekly_target INTEGER DEFAULT 3,
      brizfit_target_days TEXT DEFAULT '[2,4,6]',
      run_weekly_target INTEGER DEFAULT 1,
      preferred_run_day INTEGER DEFAULT 1,
      cycle_weekly_target INTEGER DEFAULT 0,
      max_run_distance_km REAL DEFAULT 5.0,
      parkrun_athlete_id TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_user_goals_user ON user_goals(user_id);
  `);

  // Safe migration for existing user_goals tables
  try {
    const columns = db.pragma('table_info(user_goals)') as any[];
    const hasPreferredRunDay = columns.some((col: any) => col.name === 'preferred_run_day');
    if (!hasPreferredRunDay) {
      db.exec('ALTER TABLE user_goals ADD COLUMN preferred_run_day INTEGER DEFAULT 1');
    }
    const hasAthleteId = columns.some((col: any) => col.name === 'parkrun_athlete_id');
    if (!hasAthleteId) {
      db.exec('ALTER TABLE user_goals ADD COLUMN parkrun_athlete_id TEXT');
    }
  } catch (migErr) {
    // Table may have just been created with the column
  }

  console.log(`[Database] Initialized SQLite database at ${dbPath}`);
}
