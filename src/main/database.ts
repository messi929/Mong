import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function getDb(): Database.Database {
  return db;
}

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'mong-consulting.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      education TEXT,
      major TEXT,
      experience TEXT,
      target_industry TEXT,
      target_position TEXT,
      memo TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS consultings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      company_name TEXT NOT NULL,
      position TEXT NOT NULL,
      job_posting TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'in_progress', 'completed')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consulting_id INTEGER NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('draft', 'first', 'second', 'final')),
      content TEXT NOT NULL,
      comments TEXT,
      evaluation TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (consulting_id) REFERENCES consultings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS training_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      title TEXT NOT NULL,
      company_name TEXT,
      position TEXT,
      direction_memo TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS training_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('draft', 'first', 'second', 'final')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (case_id) REFERENCES training_cases(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_consultings_client ON consultings(client_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_consulting ON revisions(consulting_id);
    CREATE INDEX IF NOT EXISTS idx_training_cases_client ON training_cases(client_id);
    CREATE INDEX IF NOT EXISTS idx_training_revisions_case ON training_revisions(case_id);
  `);
}
