'use strict';
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/goforge' : path.join(__dirname, '..', 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });

function openDatabase(file) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    return db;
  } catch (err) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    db.pragma = () => {};
    db.transaction = (fn) => () => fn();
    return db;
  }
}

const db = openDatabase(path.join(DATA_DIR, 'goforge.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  password_changed_at TEXT,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  business TEXT,
  phone TEXT NOT NULL,
  service TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','Closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  college TEXT NOT NULL,
  course_year TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  track TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','Closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

const DEFAULT_SETTINGS = {
  phone1: '+91 84488 52971',
  phone2: '+91 89580 39354',
  whatsapp: '+91 84488 52971',
  email: 'goforgedigital@gmail.com',
  blurb1: 'Tools and sites built around how the business actually works, not a stretched template.',
  blurb2: 'Leads, records, and the tools the team already uses, joined so work is not split across five places.',
  blurb3: 'Repeat follow-ups and form-to-message flows, with a person still in the loop.',
  blurb4: 'A clear presence, search basics, and ads with a budget the client can see.',
  intern_training: '6 weeks',
  intern_work: '12 weeks',
  intern_fee: 'Confirmed on the call'
};

const insertDefault = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
db.transaction(() => {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertDefault.run(k, v);
})();
db.prepare("UPDATE settings SET value = '+91 89580 39354' WHERE key = 'phone2' AND value = '+91 85950 39354'").run();

let cache = null;
function getSettings() {
  if (!cache) {
    cache = { ...DEFAULT_SETTINGS };
    for (const row of db.prepare('SELECT key, value FROM settings').all()) cache[row.key] = row.value;
  }
  return cache;
}
function saveSettings(values) {
  const stmt = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
  db.transaction(() => {
    for (const [k, v] of Object.entries(values)) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k)) stmt.run(k, v);
    }
  })();
  cache = null;
}

module.exports = { db, DATA_DIR, DEFAULT_SETTINGS, getSettings, saveSettings };
