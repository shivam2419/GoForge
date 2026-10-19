'use strict';
// Storage: a hosted Turso (libSQL) database when TURSO_DATABASE_URL is set (production on Vercel),
// otherwise a local SQLite file in DATA_DIR (local dev). Same SQL dialect in both cases.
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const DB_URL = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || '';
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || undefined;
const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/goforge' : path.join(__dirname, '..', 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });
const IS_REMOTE = !!DB_URL;
if (process.env.VERCEL && !IS_REMOTE) {
  console.warn('[goforge] TURSO_DATABASE_URL is not set: using temporary /tmp storage. Data WILL be lost. See README "Database".');
}

const client = createClient(IS_REMOTE
  ? { url: DB_URL, authToken: DB_TOKEN }
  : { url: 'file:' + path.join(DATA_DIR, 'goforge.db') });

const SCHEMA = `
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
`;

const toArgs = a => a.map(v => (v === undefined ? null : v));
const db = {
  async get(sql, ...args) { const r = await client.execute({ sql, args: toArgs(args) }); return r.rows[0]; },
  async all(sql, ...args) { const r = await client.execute({ sql, args: toArgs(args) }); return r.rows; },
  async run(sql, ...args) { return client.execute({ sql, args: toArgs(args) }); },
  async batch(stmts) { return client.batch(stmts.map(([sql, ...args]) => ({ sql, args: toArgs(args) })), 'write'); },
  client
};

const DEFAULT_SETTINGS = {
  phone1: '+91 84488 52971',
  phone2: '+91 89580 39354',
  email: 'info@goforgedigital.com',
  linkedin_company: 'https://www.linkedin.com/company/143989208',
  blurb1: 'Web apps, portals and internal tools built around your workflow, so your team works faster from one secure system.',
  blurb2: 'CRM and ERP systems that bring leads, customers, stock and billing together, connected with the tools you already use.',
  blurb3: 'AI-powered workflows that send instant alerts, timely follow-ups and smart drafts, saving hours while your team stays in control.',
  blurb4: 'Local SEO, Google Business Profile and targeted ads that bring more qualified enquiries, with clear monthly reports.',
  intern_training: '6 weeks',
  intern_work: '12 weeks',
  intern_fee: 'Contact for fees',
  // Real seats filled per batch, typed in by the admin (Admin > Settings). Never computed or auto-incremented.
  seats_weekday: '0',
  seats_weekend: '0'
};

async function init() {
  if (!IS_REMOTE) {
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA busy_timeout = 5000');
  }
  await client.execute('PRAGMA foreign_keys = ON');
  const stmts = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
  await client.batch(stmts, 'write');
  await db.batch([
    ...Object.entries(DEFAULT_SETTINGS).map(([k, v]) => ['INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', k, v]),
    ["UPDATE settings SET value = '+91 89580 39354' WHERE key = 'phone2' AND value = '+91 85950 39354'"],
    ["DELETE FROM settings WHERE key = 'whatsapp'"],
    // Public contact email moved to the company domain. The admin login email is separate (ADMIN_EMAIL) and unchanged.
    // Service card copy refreshed (only replaces the untouched old default).
    ["UPDATE settings SET value = ? WHERE key = 'blurb1' AND value = ?", 'Web apps, portals and internal tools built around your workflow, so your team works faster from one secure system.', 'Tools and sites built around how the business actually works, not a stretched template.'],
    ["UPDATE settings SET value = ? WHERE key = 'blurb2' AND value = ?", 'CRM and ERP systems that bring leads, customers, stock and billing together, connected with the tools you already use.', 'Leads, records, and the tools the team already uses, joined so work is not split across five places.'],
    ["UPDATE settings SET value = ? WHERE key = 'blurb3' AND value = ?", 'AI-powered workflows that send instant alerts, timely follow-ups and smart drafts, saving hours while your team stays in control.', 'Repeat follow-ups and form-to-message flows, with a person still in the loop.'],
    ["UPDATE settings SET value = ? WHERE key = 'blurb4' AND value = ?", 'Local SEO, Google Business Profile and targeted ads that bring more qualified enquiries, with clear monthly reports.', 'A clear presence, search basics, and ads with a budget the client can see.'],
    ["UPDATE settings SET value = 'info@goforgedigital.com' WHERE key = 'email' AND value = 'goforgedigital@gmail.com'"],
    ["UPDATE settings SET value = 'Contact for fees' WHERE key = 'intern_fee' AND value = 'Confirmed on the call'"]
  ]);
}
let readyPromise = null;
function ready() {
  if (!readyPromise) readyPromise = init().catch(err => { readyPromise = null; throw err; });
  return readyPromise;
}

// Settings are cached per instance. Serverless instances refresh every 30 s so a save made on one
// instance shows on the others shortly after; the instance that saved sees it immediately.
const SETTINGS_TTL_MS = 30 * 1000;
let cache = null, cacheAt = 0;
async function loadSettings(force = false) {
  if (!force && cache && Date.now() - cacheAt < SETTINGS_TTL_MS) return cache;
  const next = { ...DEFAULT_SETTINGS };
  for (const row of await db.all('SELECT key, value FROM settings')) next[row.key] = row.value;
  cache = next; cacheAt = Date.now();
  return cache;
}
function getSettings() { return cache || { ...DEFAULT_SETTINGS }; }
async function saveSettings(values) {
  const sql = `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`;
  const stmts = Object.entries(values).filter(([k]) => Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k)).map(([k, v]) => [sql, k, v]);
  if (stmts.length) await db.batch(stmts);
  await loadSettings(true);
}

module.exports = { db, DATA_DIR, IS_REMOTE, DEFAULT_SETTINGS, ready, loadSettings, getSettings, saveSettings };
