'use strict';
const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PASS = 'SmokeTestPass-2027!';
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gf-smoke-'));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class Jar {
  constructor() { this.cookies = {}; }
  absorb(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of raw) {
      const [nv] = c.split(';');
      const i = nv.indexOf('=');
      if (i > 0) this.cookies[nv.slice(0, i).trim()] = nv.slice(i + 1).trim();
    }
  }
  header() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }
  async fetch(p, opts = {}) {
    const headers = new Headers(opts.headers || {});
    const h = this.header();
    if (h) headers.set('Cookie', h);
    const res = await fetch(BASE + p, { redirect: 'manual', ...opts, headers });
    this.absorb(res);
    return res;
  }
}

function csrfFrom(html) {
  const m = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  assert(m, 'Expected CSRF token in HTML');
  return m[1];
}

async function run() {
  const proc = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: TMP_DIR,
      ADMIN_INITIAL_PASSWORD: ADMIN_PASS,
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let logs = '';
  proc.stdout.on('data', d => { logs += d; });
  proc.stderr.on('data', d => { logs += d; });

  try {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(BASE + '/');
        if (r.status === 200) break;
      } catch {}
      await sleep(150);
    }

    const jar = new Jar();

    // 1. Default public site invariants
    const check200 = async p => {
      const r = await jar.fetch(p);
      assert.strictEqual(r.status, 200, `Expected 200 for ${p}, got ${r.status}`);
      return r.text();
    };

    const homeHtml = await check200('/');
    const internHtml = await check200('/internship');
    const progHtml = await check200('/internship/programs/software-engineering');
    const collegesHtml = await check200('/colleges');
    const verifyHtml = await check200('/verify');
    const verifyIdHtml = await check200('/verify?id=GF-2026-001');
    const aboutHtml = await check200('/about');
    const faqHtml = await check200('/faq');
    const sitemap = await check200('/sitemap.xml');

    assert.strictEqual((homeHtml.match(/class="gr-badge"/g) || []).length, 1, 'Google rating badge must appear once on /');
    assert.strictEqual((homeHtml.match(/kpi-pills trust-stats/g) || []).length, 1, 'Stats block must appear once on /');
    // /internship hero proof card shows the Google badge once (same Settings toggle as Home); other pages show none.
    assert.strictEqual((internHtml.match(/class="gr-badge"/g) || []).length, 1, 'Google rating badge once on /internship hero');
    for (const [name, html] of [['/internship', internHtml], ['/program', progHtml], ['/colleges', collegesHtml], ['/about', aboutHtml]]) {
      if (name !== '/internship') assert.strictEqual((html.match(/class="gr-badge"/g) || []).length, 0, `No Google rating badge on ${name}`);
      assert.strictEqual((html.match(/kpi-pills trust-stats/g) || []).length, 0, `No trust-stats on ${name}`);
      assert.strictEqual((html.match(/class="kpi-row"/g) || []).length, 0, `No kpi-row on ${name}`);
    }
    assert(!/Fridays are (dedicated )?doubt/i.test(internHtml), 'No old Friday doubt line on /internship');
    assert(internHtml.includes('Both schedules follow the same syllabus and fee'), 'Schedule note on /internship');
    assert(progHtml.includes('Both schedules follow the same syllabus and fee'), 'Schedule note on programme page');
    assert(!verifyHtml.includes('noindex'), 'Clean /verify must not be noindex');
    assert(verifyIdHtml.includes('noindex'), '/verify?id=... must be noindex');
    assert(sitemap.includes('/verify</loc>'), '/verify must be in sitemap');
    assert(!verifyHtml.includes('referred_by') && !verifyHtml.includes('₹200'), 'No referral on /verify');
    assert(!collegesHtml.includes('referred_by') && !collegesHtml.includes('₹200'), 'No referral on /colleges');
    assert.strictEqual((internHtml.match(/Paid once, no instalments/g) || []).length, 1, 'Paid once appears once on /internship');
    assert.strictEqual((progHtml.match(/Paid once, no instalments/g) || []).length, 1, 'Paid once appears once on programme page');
    assert(!/<h[1-3][^>]*>[^<]*paid[^<]*<\/h[1-3]>/i.test(internHtml + progHtml), 'No "paid" in any heading');
    // Home hero "For students" path carries both fees with the training + internship split (replaces the old 'from ₹2,999' student band).
    assert(homeHtml.includes('<strong>₹2,999</strong><span><b>3-Month Programme</b> &middot; 1 month training + 2 months internship') && homeHtml.includes('<strong>₹4,999</strong><span><b>6-Month Programme</b> &middot; 3 months training + 3 months internship') && homeHtml.includes('₹2,999 (3 months) or ₹4,999 (6 months)'), 'Home shows ₹2,999 and ₹4,999');
    assert(internHtml.includes('From ₹2,999') && internHtml.includes('₹2,999') && internHtml.includes('₹4,999'), '/internship shows ₹2,999 and ₹4,999');
    assert(progHtml.includes('"price":"2999"') && progHtml.includes('"price":"4999"'), 'Course JSON-LD shows 2999 and 4999');
    assert(progHtml.includes('<small>All-inclusive fee</small>'), 'Default tax_note empty -> All-inclusive fee');
    const VALUE_LINE = 'Includes live mentoring and real projects, not just a certificate.';
    assert((internHtml.match(new RegExp(VALUE_LINE, 'g')) || []).length >= 2, 'Value line on /internship fee cards');
    assert(progHtml.includes(VALUE_LINE), 'Value line on programme #fees');
    assert(homeHtml.includes(VALUE_LINE), 'Value line on Home student card');
    for (const [n, h] of [['/', homeHtml], ['/internship', internHtml], ['/program', progHtml], ['/faq', faqHtml]]) {
      assert(!/1,?499|1,?999/.test(h), 'No stale 1499 or 1999 on ' + n);
    }
    const overviewPdfBuf = Buffer.from(await (await jar.fetch('/internship/overview.pdf')).arrayBuffer());
    assert(overviewPdfBuf.slice(0, 5).toString() === '%PDF-' && overviewPdfBuf.length > 20000, 'overview.pdf is a real PDF');
    // Text is stored in embedded fonts, so read it back with pdftotext when it is installed.
    try {
      const pdfFile = path.join(TMP_DIR, 'overview.pdf');
      fs.writeFileSync(pdfFile, overviewPdfBuf);
      const pdfText = require('child_process').execFileSync('pdftotext', ['-layout', pdfFile, '-'], { encoding: 'utf8' });
      assert(pdfText.includes('2,999') && pdfText.includes('4,999'), 'overview.pdf uses 2,999 and 4,999');
      assert(/1 month training \+ 2 months internship/.test(pdfText) && /3 months training \+ 3 months internship/.test(pdfText), 'overview.pdf shows 1+2 and 3+3');
    } catch (e) { if (e.code !== 'ENOENT') throw e; }

    // Direct PDF downloads (no form gate)
    for (const pdfPath of ['/internship/guide.pdf', '/colleges/pack.pdf']) {
      const r = await jar.fetch(pdfPath);
      assert.strictEqual(r.status, 200, `Expected 200 for ${pdfPath}`);
      assert(r.headers.get('content-type').includes('application/pdf'), `PDF content-type for ${pdfPath}`);
      const buf = Buffer.from(await r.arrayBuffer());
      assert(buf.slice(0, 5).toString() === '%PDF-', `Expected %PDF- header for ${pdfPath}`);
    }
    const schoolsHtml = await check200('/schools');
    assert(schoolsHtml.includes('name="robots" content="noindex, follow"'), '/schools is noindex, follow');
    assert(!schoolsHtml.includes('noindex, nofollow') || schoolsHtml.includes('noindex, follow'), '/schools robots is follow');
    assert(!/school-stats|Students trained|Partner schools|NEP 2020|Classes 5|data-form="school"/.test(schoolsHtml), '/schools has no stats, programmes or form');
    assert(schoolsHtml.includes('GoForge Digital builds websites and school software for school offices.'), '/schools has short description');
    assert((schoolsHtml.match(/href="\/contact"/g) || []).length >= 1, '/schools has a contact link');
    for (const [n, h] of [['/', homeHtml], ['/internship', internHtml], ['/program', progHtml], ['/colleges', collegesHtml], ['/about', aboutHtml], ['/faq', faqHtml]]) {
      assert(!h.includes('href="/schools"'), 'No /schools promo link on ' + n);
    }
    const sm = await check200('/sitemap.xml');
    assert(!sm.includes('/schools</loc>'), '/schools not in sitemap');

    console.log('PASS: default public invariants + direct PDF downloads');

    // 2. Admin login
    const loginPage = await (await jar.fetch('/admin/login')).text();
    const loginCsrf = csrfFrom(loginPage);
    const loginRes = await jar.fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: loginCsrf, email: 'goforgedigital@gmail.com', password: ADMIN_PASS })
    });
    assert.strictEqual(loginRes.status, 303, 'Admin login must redirect 303');

    // 3. Admin settings render + edit
    const settingsPage = await check200('/admin/settings');
    assert(settingsPage.includes('name="batch_label"'), 'Settings page renders batch_label');
    assert(settingsPage.includes('name="track_3m_price"'), 'Settings page renders track_3m_price');
    assert(settingsPage.includes('name="guide_pdf_file"'), 'Settings page renders guide_pdf_file');
    assert(settingsPage.includes('href="/admin/faqs"'), 'Admin nav includes FAQs link');

    const fd = new FormData();
    fd.set('_csrf', csrfFrom(settingsPage));
    fd.set('_settings_v2', '1');
    fd.set('phone1', '+91 84488 52971');
    fd.set('phone2', '+91 85950 39354');
    fd.set('email', 'goforgedigital@gmail.com');
    fd.set('linkedin_company', 'https://www.linkedin.com/company/143989208');
    fd.set('batch_label', 'March 2027 batch');
    fd.set('batch_starts', '5 March 2027');
    fd.set('batch_first_weekend', '6 March 2027');
    fd.set('batch_deadline', '2 March 2027');
    fd.set('batch_weekday_timing', 'Mon–Fri, 8:00–9:30 PM IST');
    fd.set('batch_weekend_timing', 'Sat–Sun, 10:00 AM–1:00 PM IST');
    fd.set('seat_cap', '30');
    fd.set('seats_weekday', '5');
    fd.set('seats_weekend', '7');
    fd.set('schedule_note', 'Custom schedule note for March batch.');
    fd.set('track_3m_label', '3-Month Fast Track');
    fd.set('track_3m_price', '2499');
    fd.set('track_6m_label', '6-Month Pro Track');
    fd.set('track_6m_price', '3999');
    fd.set('tax_note', 'incl. GST');
    fd.set('fee_note', 'Custom fee note. Paid once, no instalments.');
    fd.set('price_value_line', 'Custom mentoring and projects line.');
    // Omit show_home_stats, show_google_badge, prog_show_* => toggled OFF
    fd.set('google_rating', '4.9');
    fd.set('google_badge_text', 'from verified clients');
    fd.set('kit_heading', 'Custom kit heading');
    fd.set('kit_intro', 'Custom kit intro copy.');
    fd.set('proof_heading', 'Custom proof heading');
    fd.set('proof_intro', 'Custom proof intro copy.');
    fd.set('intern_training', '4 weeks');
    fd.set('intern_work', '8 weeks');
    fd.set('intern_fee', '₹2,499 all-inclusive');
    fd.set('blurb1', 'Custom web applications and internal business software built cleanly.');
    fd.set('blurb2', 'Custom CRM and ERP pipelines tailored to sales and operations teams.');
    fd.set('blurb3', 'Practical AI workflow automation and internal assistants for teams.');
    fd.set('blurb4', 'Conversion-focused websites, SEO and digital marketing campaigns.');

    const testPdf = Buffer.from('%PDF-1.4\n%test-smoke-pdf\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
    fd.set('guide_pdf_file', new Blob([testPdf], { type: 'application/pdf' }), 'custom-guide.pdf');
    fd.set('college_pack_pdf_file', new Blob([testPdf], { type: 'application/pdf' }), 'custom-pack.pdf');

    const saveRes = await jar.fetch('/admin/settings', { method: 'POST', body: fd });
    assert.strictEqual(saveRes.status, 303, `Expected 303 on settings save, got ${saveRes.status}`);

    const homeAfter = await check200('/');
    assert(!homeAfter.includes('kpi-pills trust-stats'), 'Home stats hidden when show_home_stats=0');
    assert(!homeAfter.includes('class="gr-badge"'), 'Google badge hidden when show_google_badge=0');
    assert(homeAfter.includes('₹2,499'), 'Updated 3m price on home');

    const internAfter = await check200('/internship');
    assert(internAfter.includes('March 2027 batch'), 'Updated batch_label on /internship');
    assert(internAfter.includes('5 March 2027'), 'Updated batch_starts on /internship');
    assert(internAfter.includes('Custom schedule note for March batch.'), 'Updated schedule_note on /internship');
    assert(internAfter.includes('Custom kit heading'), 'Updated kit_heading on /internship');
    assert(internAfter.includes('Custom proof heading'), 'Updated proof_heading on /internship');
    assert(internAfter.includes('₹2,499') && internAfter.includes('₹3,999') && internAfter.includes('All-inclusive fee · incl. GST'), 'Updated prices + tax_note on /internship');
    assert(internAfter.includes('Custom mentoring and projects line.'), 'Updated price_value_line on /internship');
    assert((await check200('/')).includes('Custom mentoring and projects line.'), 'Updated price_value_line on Home');

    const progAfter = await check200('/internship/programs/software-engineering');
    assert(!progAfter.includes('id="curriculum"'), 'Curriculum hidden when prog_show_curriculum=0');
    assert(!progAfter.includes('id="tools"'), 'Tools hidden when prog_show_tools=0');
    assert(!progAfter.includes('id="batch"'), 'Batches hidden when prog_show_batches=0');
    assert(!progAfter.includes('id="fees"'), 'Fees hidden when prog_show_fees=0');

    // Uploaded PDFs served
    for (const pdfPath of ['/internship/guide.pdf', '/colleges/pack.pdf']) {
      const r = await jar.fetch(pdfPath);
      const txt = await r.text();
      assert(txt.includes('%test-smoke-pdf'), `Expected uploaded PDF bytes for ${pdfPath}`);
    }

    // Invalid PDF rejected (422)
    const badSettingsPage = await check200('/admin/settings');
    fd.set('_csrf', csrfFrom(badSettingsPage));
    fd.set('guide_pdf_file', new Blob([Buffer.from('NOT_A_PDF')], { type: 'application/pdf' }), 'bad.pdf');
    fd.delete('college_pack_pdf_file');
    const badPdfRes = await jar.fetch('/admin/settings', { method: 'POST', body: fd });
    assert.strictEqual(badPdfRes.status, 422, `Expected 422 on bad PDF, got ${badPdfRes.status}`);

    // Re-enable toggles + reset PDFs + test custom URL redirect
    const resetSettingsPage = await check200('/admin/settings');
    fd.set('_csrf', csrfFrom(resetSettingsPage));
    fd.delete('guide_pdf_file');
    fd.set('guide_pdf_reset', '1');
    fd.set('college_pack_pdf_reset', '1');
    fd.set('show_home_stats', '1');
    fd.set('show_google_badge', '1');
    fd.set('prog_show_curriculum', '1');
    fd.set('prog_show_tools', '1');
    fd.set('prog_show_batches', '1');
    fd.set('prog_show_fees', '1');
    const restoreRes = await jar.fetch('/admin/settings', { method: 'POST', body: fd });
    assert.strictEqual(restoreRes.status, 303, 'Settings restore 303');

    const homeRestored = await check200('/');
    assert(homeRestored.includes('kpi-pills trust-stats'), 'Home stats restored');
    assert(homeRestored.includes('4.9') && homeRestored.includes('from verified clients'), 'Updated Google badge text shown when toggled on');
    const guideResetBuf = Buffer.from(await (await jar.fetch('/internship/guide.pdf')).arrayBuffer());
    assert(!guideResetBuf.toString().includes('%test-smoke-pdf'), 'Reset restores built-in guide PDF');
    console.log('PASS: admin settings edit + section toggles + PDF upload/reset');

    // 4. Admin FAQs CRUD
    const faqsList = await check200('/admin/faqs');
    assert(faqsList.includes('cms-item'), 'Seeded FAQs listed in /admin/faqs');
    const faqNewPage = await check200('/admin/faqs/new');
    const faqFd = new FormData();
    faqFd.set('_csrf', csrfFrom(faqNewPage));
    faqFd.set('group_id', 'students');
    faqFd.set('question', 'Smoke test custom FAQ question?');
    faqFd.set('answer', 'Smoke test custom FAQ answer.');
    faqFd.set('show_on_internship', '1');
    faqFd.set('published', '1');
    faqFd.set('sort_order', '1');
    const faqCreateRes = await jar.fetch('/admin/faqs/new', { method: 'POST', body: faqFd });
    assert.strictEqual(faqCreateRes.status, 303, 'FAQ create 303');

    const faqAfterCreate = await check200('/faq');
    const internFaqAfter = await check200('/internship');
    assert(faqAfterCreate.includes('Smoke test custom FAQ question?'), 'Created FAQ on /faq');
    assert(internFaqAfter.includes('Smoke test custom FAQ question?'), 'Created FAQ on /internship');

    const faqsList2 = await check200('/admin/faqs');
    const delMatch = faqsList2.match(/\/admin\/faqs\/(\d+)\/delete/);
    assert(delMatch, 'Found FAQ id');
    const faqEditPage = await check200('/admin/faqs/' + delMatch[1]);
    const editFd = new FormData();
    editFd.set('_csrf', csrfFrom(faqEditPage));
    editFd.set('group_id', 'students');
    editFd.set('question', 'Smoke test EDITED FAQ question?');
    editFd.set('answer', 'Smoke test EDITED FAQ answer.');
    editFd.set('show_on_internship', '1');
    editFd.set('published', '1');
    editFd.set('sort_order', '2');
    const editRes = await jar.fetch('/admin/faqs/' + delMatch[1], { method: 'POST', body: editFd });
    assert.strictEqual(editRes.status, 303, 'FAQ edit 303');
    assert((await check200('/faq')).includes('Smoke test EDITED FAQ question?'), 'Edited FAQ on /faq');
    assert(delMatch, 'Found FAQ id to delete');
    const faqId = delMatch[1];
    const delRes = await jar.fetch(`/admin/faqs/${faqId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: csrfFrom(faqsList2) })
    });
    assert.strictEqual(delRes.status, 303, 'FAQ delete 303');
    const faqAfterDel = await check200('/faq');
    assert(!faqAfterDel.includes('Smoke test custom FAQ question?'), 'Deleted FAQ removed from /faq');
    console.log('PASS: /admin/faqs create + publish + /internship + /faq + delete');

    // 5. quoted_fee snapshot on new applications/counselling; existing rows stay NULL; admin can edit
    const { createClient } = require('@libsql/client');
    const raw = createClient({ url: 'file:' + require('path').join(TMP_DIR, 'goforge.db') });
    const cols = (await raw.execute('PRAGMA table_info(applications)')).rows.map(r => r.name);
    assert(cols.includes('quoted_fee'), 'applications.quoted_fee column exists');
    const ccols = (await raw.execute('PRAGMA table_info(contacts)')).rows.map(r => r.name);
    assert(ccols.includes('quoted_fee'), 'contacts.quoted_fee column exists');
    await raw.execute({
      sql: "INSERT INTO applications (full_name, college, course_year, whatsapp, track) VALUES (?, ?, ?, ?, ?)",
      args: ['Old Quote Student', 'ABC College', 'BTech 3', '9876500001', 'Software Engineering']
    });
    const oldRow = (await raw.execute({ sql: "SELECT quoted_fee FROM applications WHERE full_name = ?", args: ['Old Quote Student'] })).rows[0];
    assert.strictEqual(oldRow.quoted_fee, null, 'Existing application quoted_fee stays NULL');

    const applyPage = await check200('/internship');
    const applyBody = new URLSearchParams({
      _csrf: csrfFrom(applyPage),
      full_name: 'New Quote Student',
      college: 'XYZ College',
      course_year: 'BCA 2',
      phone: '9876500002',
      track: 'Software Engineering',
      schedule: 'Not sure yet',
      consent: 'yes'
    });
    const applyRes = await jar.fetch('/internship', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: applyBody
    });
    assert.ok([200, 303].includes(applyRes.status), 'Apply submission ok, got ' + applyRes.status);
    const appsAdmin = await check200('/admin/applications');
    assert(appsAdmin.includes('name="quoted_fee"'), 'Quoted fee field on /admin/applications');
    assert(appsAdmin.includes('₹2,499 (3-Month Fast Track) / ₹3,999 (6-Month Pro Track)') || appsAdmin.includes('₹2,999 (3-Month Programme) / ₹4,999 (6-Month Programme)'), 'New application stores then-current prices');
    assert(appsAdmin.includes('Old Quote Student') && appsAdmin.includes('placeholder="Not recorded — e.g. ₹1,499"'), 'Existing row shows empty quoted fee field');

    // Edit old row to ₹1,499
    const oldId = (await raw.execute({ sql: "SELECT id FROM applications WHERE full_name = ?", args: ['Old Quote Student'] })).rows[0].id;
    const feeRes = await jar.fetch('/admin/applications/' + oldId + '/quoted-fee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: csrfFrom(appsAdmin), quoted_fee: '₹1,499' })
    });
    assert.strictEqual(feeRes.status, 303, 'Quoted fee save 303');
    const appsAfter = await check200('/admin/applications');
    assert(appsAfter.includes('value="₹1,499"'), 'Admin can set historical ₹1,499 quote');
    const savedOld = (await raw.execute({ sql: "SELECT quoted_fee FROM applications WHERE full_name = ?", args: ['Old Quote Student'] })).rows[0];
    assert.strictEqual(savedOld.quoted_fee, '₹1,499', 'quoted_fee persisted as ₹1,499');

    const counselPage = await check200('/counselling');
    const counselBody = new URLSearchParams({
      _csrf: csrfFrom(counselPage),
      name: 'Counsel Quote Student',
      phone: '9876500003',
      track: '3-Month Fast Track (1 month training + 2 months internship)'
    });
    // After settings edit, labels may be Fast Track; fall back to default label if 422
    let counselRes = await jar.fetch('/counselling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: counselBody
    });
    if (counselRes.status === 422) {
      counselBody.set('track', '3-Month Programme (1 month training + 2 months internship)');
      counselRes = await jar.fetch('/counselling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: counselBody
      });
    }
    assert.ok([200, 303].includes(counselRes.status), 'Counselling submission ok, got ' + counselRes.status);
    const counselAdmin = await check200('/admin/counselling');
    assert(counselAdmin.includes('Counsel Quote Student'), 'Counselling lead listed');
    assert(counselAdmin.includes('value="₹2,499"') || counselAdmin.includes('value="₹2,999"'), 'Counselling quoted_fee is the 3-month price at submission');
    console.log('PASS: quoted_fee snapshot, NULL existing rows, admin edit, counselling');

    console.log('ALL SMOKE CHECKS PASSED');
  } finally {
    proc.kill('SIGTERM');
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    if (logs.includes('Error:') && !logs.includes('SIGTERM')) {
      console.error('Server logs:\n', logs);
    }
  }
}

run().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
