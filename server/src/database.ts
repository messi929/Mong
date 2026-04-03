import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  return db;
}

export function initDatabase() {
  const dbPath = path.join(__dirname, '../../data/mong-consulting.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT DEFAULT 'consultant' CHECK(role IN ('admin', 'consultant')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

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

    CREATE TABLE IF NOT EXISTS style_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL,
      profile TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS calibration_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      position TEXT,
      industry TEXT,
      content TEXT NOT NULL,
      source TEXT DEFAULT 'accepted',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_consultings_client ON consultings(client_id);
    CREATE INDEX IF NOT EXISTS idx_revisions_consulting ON revisions(consulting_id);
    CREATE INDEX IF NOT EXISTS idx_training_cases_client ON training_cases(client_id);
    CREATE INDEX IF NOT EXISTS idx_training_revisions_case ON training_revisions(case_id);
    CREATE INDEX IF NOT EXISTS idx_calibration_industry ON calibration_data(industry);
  `);

  // Migration: clients에 user_id 추가
  const cols = db.prepare("PRAGMA table_info(clients)").all() as any[];
  if (!cols.some((c: any) => c.name === 'user_id')) {
    db.exec('ALTER TABLE clients ADD COLUMN user_id INTEGER REFERENCES users(id)');
    console.log('[DB] Migration: clients.user_id added');
  }

  // 기본 admin 계정 생성 (없으면)
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password_hash, display_name, role) VALUES ('admin', ?, '관리자', 'admin')").run(hash);
    console.log('[DB] Default admin created (admin / admin123)');
  }

  console.log('[DB] Database initialized at', dbPath);
}
