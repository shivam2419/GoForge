// Usage: node scripts/reset-admin-password.js            -> generates a new password and prints it once
//        node scripts/reset-admin-password.js 'new pass'  -> sets the given password (min 12 chars)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('../lib/db');
const email = (process.env.ADMIN_EMAIL || 'goforgedigital@gmail.com').toLowerCase();
let pass = process.argv[2];
if (!pass) pass = crypto.randomBytes(15).toString('base64url');
if (pass.length < 12) { console.error('Password must be at least 12 characters.'); process.exit(1); }
const hash = bcrypt.hashSync(pass, 12);
const row = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
if (row) db.prepare("UPDATE admins SET password_hash = ?, password_changed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?").run(hash, row.id);
else db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(email, hash);
db.prepare('DELETE FROM sessions').run();
console.log(`Password for ${email} set. All sessions signed out.`);
if (!process.argv[2]) console.log(`New password: ${pass}`);
