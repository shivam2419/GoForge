'use strict';
// Image uploads for the admin panel.
// - BLOB_READ_WRITE_TOKEN set (Vercel Blob connected): files go to Vercel Blob, public URL saved.
// - Not on Vercel (local / VPS): files go to DATA_DIR/uploads and are served at /uploads/<name>.
// - On Vercel without Blob: uploads are disabled; the admin pastes an image URL instead.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DATA_DIR } = require('./db');

const MAX_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const mode = process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : (process.env.VERCEL ? 'off' : 'local');

function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', type: 'image/png' };
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

async function storeImage(file, folder) {
  if (!file || !file.buffer || !file.size) return { url: null };
  if (mode === 'off') return { error: 'Image upload is not set up on this site yet. Paste an image link instead.' };
  if (file.size > MAX_BYTES) return { error: 'Please use an image under 2 MB.' };
  const kind = sniff(file.buffer);
  if (!kind) return { error: 'Please upload a JPG, PNG or WebP image.' };
  const name = `${folder}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${kind.ext}`;
  if (mode === 'blob') {
    const { put } = require('@vercel/blob');
    const out = await put(`goforge/${name}`, file.buffer, { access: 'public', contentType: kind.type, addRandomSuffix: false });
    return { url: out.url };
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
  return { url: '/uploads/' + name };
}

module.exports = { storeImage, UPLOAD_DIR, MAX_BYTES, uploadMode: mode };
