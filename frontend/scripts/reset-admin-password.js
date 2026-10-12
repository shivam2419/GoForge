// Usage: node scripts/reset-admin-password.js            -> generates a new password and prints it once
//        node scripts/reset-admin-password.js 'new pass'  -> sets the given password (min 12 chars)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, ready } = require('../lib/db');
const email = (process.env.ADMIN_EMAIL || 'goforgedigital@gmail.com').toLowerCase();
let pass = process.argv[2];
if (!pass) pass = crypto.randomBytes(15).toString('base64url');
if (pass.length < 12) { console.error('Password must be at least 12 characters.'); process.exit(1); }
const hash = bcrypt.hashSync(pass, 12);
(async () => {
  await ready();
  const row = await db.get('SELECT id FROM admins WHERE email = ?', email);
  if (row) await db.run("UPDATE admins SET password_hash = ?, password_changed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?", hash, row.id);
  else await db.run('INSERT INTO admins (email, password_hash) VALUES (?, ?)', email, hash);
  await db.run('DELETE FROM sessions');
  console.log(`Password for ${email} set. All sessions signed out.`);
  if (!process.argv[2]) console.log(`New password: ${pass}`);
})().catch(err => { console.error(err); process.exit(1); });
