'use strict';
// Email alerts for new form leads, sent through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// - Off unless RESEND_API_KEY is set. LEAD_ALERT_TO defaults to info@goforgedigital.com.
// - Never blocks or breaks a form: the lead is already saved before this runs, the request is
//   fire-and-forget with a timeout, and any failure is only logged.
// - On Vercel, waitUntil() keeps the function alive until the email call finishes after the response is sent.
let waitUntil = null;
try { ({ waitUntil } = require('@vercel/functions')); } catch { /* optional outside Vercel */ }

const TIMEOUT_MS = 5000;
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ESC[c]);
// Keep header-bound text (subject) on one line and short.
const oneLine = v => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120);

function config() {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key) return null;
  return {
    key,
    to: (process.env.LEAD_ALERT_TO || 'info@goforgedigital.com').split(',').map(s => s.trim()).filter(Boolean),
    from: (process.env.LEAD_ALERT_FROM || 'Goforge Digital Website <alerts@goforgedigital.com>').trim()
  };
}

// fields: array of [label, value]; empty values are skipped.
function buildEmail({ title, name, fields, adminUrl, replyTo }) {
  const rows = fields.filter(([, v]) => v != null && String(v).trim() !== '');
  const subject = oneLine(`New ${title}: ${name || 'website lead'}`);
  const text = [
    `New ${title} from the Goforge Digital website.`, '',
    ...rows.map(([k, v]) => `${k}: ${String(v)}`), '',
    `Open the admin inbox: ${adminUrl}`
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#141C30;max-width:560px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7C5C20">Goforge Digital website</p>
<h2 style="margin:0 0 16px;font-size:20px">New ${esc(title)}</h2>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #e6e0d4;color:#47526C;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e6e0d4;white-space:pre-wrap">${esc(v)}</td></tr>`).join('\n')}
</table>
<p style="margin:20px 0 0"><a href="${esc(adminUrl)}" style="display:inline-block;background:#141C30;color:#F0ECE3;padding:10px 16px;border-radius:8px;text-decoration:none">Open the admin inbox</a></p>
</div>`;
  const body = { subject, text, html };
  if (replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(replyTo)) body.reply_to = replyTo;
  return body;
}

async function send(cfg, email) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.from, to: cfg.to, ...email }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
}

// Fire-and-forget. Returns immediately; never throws.
function notifyLead(lead) {
  try {
    const cfg = config();
    if (!cfg) return;
    const p = send(cfg, buildEmail(lead)).catch(err => console.error('[lead-alert] email failed:', err && err.message));
    if (waitUntil) { try { waitUntil(p); } catch { /* not in a Vercel request context */ } }
  } catch (err) {
    console.error('[lead-alert] skipped:', err && err.message);
  }
}

module.exports = { notifyLead, buildEmail, esc };
