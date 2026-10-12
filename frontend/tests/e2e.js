// End-to-end checks. Usage: BASE=http://localhost:4310 ADMIN_PASSWORD=... node tests/e2e.js
const { chromium } = require('playwright-core');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4310';
const PASS = process.env.ADMIN_PASSWORD;
const EMAIL = 'goforgedigital@gmail.com';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, extra]); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
// Scroll through the page so every scroll-reveal fires, then return to the top (used before full-page screenshots).
async function revealAll(pg) {
  const h = await pg.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await pg.evaluate(y => scrollTo(0, y), y); await pg.waitForTimeout(120); }
  await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(900);
}
// Full-page shot by growing the viewport: Chrome's beyond-viewport capture can paint finished transform animations mid-way.
async function fullShot(pg, file) {
  const vp = pg.viewportSize();
  const h = await pg.evaluate(() => document.documentElement.scrollHeight);
  await pg.setViewportSize({ width: vp.width, height: h }); await pg.waitForTimeout(700);
  await pg.screenshot({ path: path.join(SHOTS, file) });
  await pg.setViewportSize(vp); await pg.waitForTimeout(200);
}
const waUrl = p => decodeURIComponent(p.url().replace(/\+/g, ' '));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });

  // ---------- desktop public ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  // 422s come from the deliberate invalid submissions below, so they are not counted.
  page.on('console', m => { if (m.type() === 'error' && !/status of 422/.test(m.text())) consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, 'home-desktop.png') });
  await revealAll(page);
  await fullShot(page, 'home-desktop-full.png');
  const bodyText = (await page.textContent('body')).toLowerCase();
  check('banned words absent on home', !/(unlock|elevate|cutting-edge|lorem)/.test(bodyText));
  check('no visiting-card mockup', !/visiting[- ]card|vcard/.test(await page.content()));
  check('home lists the internship roles', ['software engineering', 'ai/ml engineer', 'data analyst', 'web developer', 'digital marketing', 'similar roles'].every(t => bodyText.includes(t)));
  check('no animated counters', (await page.locator('[data-count],[data-counter]').count()) === 0);

  // ---- modals on home ----
  // service card -> service modal -> "Talk about this" -> contact modal with service prefilled
  const svcLink = page.locator('.service-link[data-dialog="dlg-svc-crm-erp"]');
  await svcLink.scrollIntoViewIfNeeded(); await page.waitForTimeout(700);
  await svcLink.click();
  await page.waitForSelector('#dlg-svc-crm-erp[open]');
  const modalAttrs = await page.evaluate(() => { const d = document.getElementById('dlg-svc-crm-erp'); return { am: d.getAttribute('aria-modal'), lab: !!document.getElementById(d.getAttribute('aria-labelledby')), locked: document.body.classList.contains('is-locked'), inside: d.contains(document.activeElement) }; });
  check('service modal opens with aria-modal, label, focus inside, scroll lock', modalAttrs.am === 'true' && modalAttrs.lab && modalAttrs.locked && modalAttrs.inside, JSON.stringify(modalAttrs));
  // focus trap: tab many times, focus stays inside
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  check('focus trapped in modal', await page.evaluate(() => document.getElementById('dlg-svc-crm-erp').contains(document.activeElement)));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'modal-open.png') });
  await page.click('#dlg-svc-crm-erp a[data-dialog="dlg-contact"]');
  await page.waitForSelector('#dlg-contact[open]');
  await page.waitForTimeout(400);
  check('"Talk about this" prefills the service in the contact modal', (await page.inputValue('#mc-service')) === 'CRM, ERP & Integrations');
  await page.screenshot({ path: path.join(SHOTS, 'modal-contact.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const afterEsc = await page.evaluate(() => ({ open: !!document.querySelector('dialog[open]'), locked: document.body.classList.contains('is-locked'), focus: document.activeElement.getAttribute('data-dialog') }));
  check('Esc closes modal, releases scroll lock, returns focus to opener', !afterEsc.open && !afterEsc.locked && afterEsc.focus === 'dlg-svc-crm-erp', JSON.stringify(afterEsc));

  // hero "Talk about a project" -> contact modal -> submit -> WhatsApp
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.click('.hero [data-dialog="dlg-contact"]');
  await page.waitForSelector('#dlg-contact[open]');
  await page.click('#dlg-contact [data-submit]');
  check('contact modal client-side validation', /required/i.test(await page.textContent('#dlg-contact [data-error-for="name"]')));
  await page.fill('#mc-name', 'Modal Visitor');
  await page.fill('#mc-business', 'E2E Modal Shop');
  await page.fill('#mc-phone', '+91 98765 43211');
  await page.fill('#mc-message', 'Automated modal test message. Please mark Closed.');
  const [mpop] = await Promise.all([ctx.waitForEvent('page'), page.click('#dlg-contact [data-submit]')]);
  await page.waitForSelector('#dlg-contact [data-form-success]:not([hidden])');
  await mpop.waitForURL(/wa\.me|whatsapp\.com/, { timeout: 15000 }).catch(() => {});
  check('contact modal saves + opens WhatsApp with same text', waUrl(mpop).includes('918448852971') && waUrl(mpop).includes('E2E Modal Shop'), waUrl(mpop).slice(0, 120));
  await mpop.close();
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // home role -> role modal -> Apply -> apply modal with role preselected
  const roleLink = page.locator('[data-dialog="dlg-role-ai-ml-engineer"]').first();
  await roleLink.scrollIntoViewIfNeeded(); await page.waitForTimeout(700);
  await roleLink.click();
  await page.waitForSelector('#dlg-role-ai-ml-engineer[open]');
  await page.click('#dlg-role-ai-ml-engineer a[data-dialog="dlg-apply"]');
  await page.waitForSelector('#dlg-apply[open]');
  check('role modal Apply preselects the role', (await page.inputValue('#ma-track')) === 'AI/ML Engineer');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  check('"Selected work will be added here." on home', bodyText.includes('selected work will be added here.'));
  check('JSON-LD present', (await page.locator('script[type="application/ld+json"]').count()) === 1);

  // Contact form: client validation first
  await page.goto(BASE + '/contact?service=' + encodeURIComponent('AI Automation & Workflows'), { waitUntil: 'networkidle' });
  check('no-JS fallback: /contact?service= prefills the service', (await page.inputValue('#c-service')) === 'AI Automation & Workflows', await page.inputValue('#c-service'));
  check('no contact modal on /contact itself', (await page.locator('#dlg-contact').count()) === 0);
  await page.click('[data-submit]');
  const errName = await page.textContent('[data-error-for="name"]');
  check('contact client-side validation shows errors', /required/i.test(errName), errName);

  // Contact form: real submit
  await page.fill('#c-name', 'Test Visitor');
  await page.fill('#c-business', 'E2E Test Shop');
  await page.fill('#c-phone', '+91 98765 43210');
  await page.selectOption('#c-service', 'CRM, ERP & Integrations');
  await page.fill('#c-message', 'Automated end-to-end test message. Please mark Closed.');
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-submit]')]);
  await page.waitForSelector('[data-form-success]:not([hidden])');
  await popup.waitForURL(/wa\.me|whatsapp\.com/, { timeout: 15000 }).catch(() => {});
  const popupUrl = decodeURIComponent(popup.url().replace(/\+/g, ' '));
  check('contact success confirmation shown', (await page.textContent('[data-success-text]')).includes('Test'));
  check('WhatsApp opened to 918448852971 with same text', /918448852971|phone=918448852971/.test(popupUrl) && popupUrl.includes('E2E Test Shop'), popupUrl.slice(0, 140));
  await popup.close();

  // Internship form
  await page.goto(BASE + '/internship', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, 'internship-desktop.png') });
  await revealAll(page);
  await fullShot(page, 'internship-desktop-full.png');
  const roleOpts = await page.$$eval('#a-track option', os => os.map(o => o.value).filter(Boolean));
  check('apply select offers the five roles + similar', ['Software Engineering', 'AI/ML Engineer', 'Data Analyst', 'Web Developer', 'Digital Marketing'].every(r => roleOpts.includes(r)) && roleOpts.some(r => /^Similar role/.test(r)), roleOpts.join(' / '));
  // role card -> modal -> Apply fills the inline form
  await page.locator('[data-dialog="dlg-role-data-analyst"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
  await page.click('[data-dialog="dlg-role-data-analyst"]');
  await page.waitForSelector('#dlg-role-data-analyst[open]');
  await page.click('#dlg-role-data-analyst a[data-dialog="dlg-apply"]');
  await page.waitForTimeout(900);
  check('role modal Apply preselects role in inline form', (await page.inputValue('#a-track')) === 'Data Analyst' && !(await page.locator('dialog[open]').count()));
  // similar role requires a note (server side)
  const simRes = await page.evaluate(async () => {
    const f = document.querySelector('form[data-form="apply"]'); const fd = new URLSearchParams(new FormData(f));
    fd.set('name', 'X Test'); fd.set('college', 'Y College'); fd.set('course', 'BCA 2nd'); fd.set('whatsapp', '9876543210'); fd.set('track', [...f.querySelectorAll('#a-track option')].map(o => o.value).find(v => /^Similar/.test(v))); fd.set('note', '');
    const r = await fetch(f.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } }); return { status: r.status, body: await r.text() };
  });
  check('server requires a note when "Similar role" is chosen', simRes.status === 422 && /note/i.test(simRes.body), simRes.status + ' ' + simRes.body.slice(0, 120));
  const badRole = await page.evaluate(async () => {
    const f = document.querySelector('form[data-form="apply"]'); const fd = new URLSearchParams(new FormData(f));
    fd.set('name', 'X Test'); fd.set('college', 'Y College'); fd.set('course', 'BCA 2nd'); fd.set('whatsapp', '9876543210'); fd.set('track', 'AI automation & workflows');
    const r = await fetch(f.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } }); return r.status;
  });
  check('server rejects an unknown role', badRole === 422, String(badRole));
  await page.goto(BASE + '/internship', { waitUntil: 'networkidle' });
  await page.fill('#a-name', 'Test Student');
  await page.fill('#a-college', 'E2E College of Engineering');
  await page.fill('#a-course', 'BTech CSE, 3rd year');
  await page.fill('#a-wa', '9876543210');
  await page.selectOption('#a-track', 'AI/ML Engineer');
  await page.fill('#a-note', 'Automated test application.');
  const [popup2] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-submit]')]);
  await page.waitForSelector('[data-form-success]:not([hidden])');
  await popup2.waitForURL(/wa\.me|whatsapp\.com/, { timeout: 15000 }).catch(() => {});
  check('internship success + WhatsApp popup', decodeURIComponent(popup2.url().replace(/\+/g, ' ')).includes('E2E College of Engineering') && waUrl(popup2).includes('Role: AI/ML Engineer'), waUrl(popup2).slice(0, 160));
  await popup2.close();
  await page.goto(BASE + '/services', { waitUntil: 'networkidle' });
  await revealAll(page);
  await page.screenshot({ path: path.join(SHOTS, 'services.png') });
  await fullShot(page, 'services-full.png');
  check('no console errors on public pages', consoleErrors.length === 0, consoleErrors.join(' | '));

  // ---------- admin ----------
  const actx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const ap = await actx.newPage();
  const r = await ap.goto(BASE + '/admin/contacts');
  check('admin redirects to login when signed out', ap.url().endsWith('/admin/login'));
  check('no public sign-up route', (await ap.request.get(BASE + '/admin/signup')).status() === 404);
  await ap.fill('#l-email', EMAIL); await ap.fill('#l-pass', 'wrong-password-123');
  await ap.click('button[type=submit]');
  check('wrong password rejected', (await ap.textContent('body')).includes('do not match'));
  await ap.fill('#l-email', EMAIL); await ap.fill('#l-pass', PASS);
  await ap.click('button[type=submit]');
  await ap.waitForURL(/\/admin\/contacts/);
  check('admin login works', ap.url().includes('/admin/contacts'));
  const cookies = await actx.cookies();
  const sid = cookies.find(c => c.name === 'gf_sid');
  check('session cookie is httpOnly + SameSite=Strict', sid && sid.httpOnly && sid.sameSite === 'Strict');
  check('contact appears in inbox', (await ap.textContent('.items')).includes('E2E Test Shop'));
  check('modal contact appears in inbox', (await ap.textContent('.items')).includes('E2E Modal Shop'));
  await ap.waitForTimeout(600);
  await ap.screenshot({ path: path.join(SHOTS, 'admin-inbox.png') });

  // search + filter
  await ap.fill('#q', 'E2E Test Shop'); await ap.click('.filters button[type=submit]');
  check('search filters inbox', (await ap.locator('.item').count()) >= 1 && ap.url().includes('q=E2E'));
  // status change (auto-submit select)
  const item = ap.locator('.item', { hasText: 'E2E Test Shop' }).first();
  await Promise.all([ap.waitForNavigation(), item.locator('select').selectOption('Contacted')]);
  check('status changed to Contacted', (await ap.locator('.item', { hasText: 'E2E Test Shop' }).first().locator('.pill').textContent()).trim() === 'Contacted');
  await ap.goto(BASE + '/admin/contacts?status=Contacted');
  check('status filter works', (await ap.textContent('.items')).includes('E2E Test Shop'));
  await ap.goto(BASE + '/admin/applications');
  const appsText = await ap.textContent('.items');
  check('application appears in internship inbox with Role', appsText.includes('E2E College of Engineering') && appsText.includes('AI/ML Engineer') && /Role/.test(appsText));
  await ap.waitForTimeout(600);
  await ap.screenshot({ path: path.join(SHOTS, 'admin-internship-inbox.png') });

  // settings edit reflected publicly
  await ap.goto(BASE + '/admin/settings');
  const oldPhone2 = await ap.inputValue('#s-phone2');
  const oldBlurb = await ap.inputValue('#s-blurb1');
  await ap.fill('#s-phone2', '+91 90000 11111');
  await ap.fill('#s-blurb1', 'TEST BLURB: tools and sites built around how the business works.');
  await ap.click('.settings-form button[type=submit]');
  await ap.waitForURL(/saved=1/);
  await ap.waitForTimeout(600);
  await ap.screenshot({ path: path.join(SHOTS, 'admin-settings.png') });
  const pub = await (await ap.request.get(BASE + '/')).text();
  check('settings edit shows on public home', pub.includes('+91 90000 11111') && pub.includes('TEST BLURB'));
  const pubContact = await (await ap.request.get(BASE + '/contact')).text();
  check('settings edit shows on contact page + tel link', pubContact.includes('tel:+919000011111'));
  // invalid setting rejected
  await ap.goto(BASE + '/admin/settings');
  await ap.fill('#s-email', 'not-an-email'); await ap.click('.settings-form button[type=submit]');
  check('invalid email rejected in settings', (await ap.textContent('body')).includes('valid email'));
  // revert
  await ap.goto(BASE + '/admin/settings');
  await ap.fill('#s-phone2', oldPhone2); await ap.fill('#s-blurb1', oldBlurb);
  await ap.click('.settings-form button[type=submit]'); await ap.waitForURL(/saved=1/);
  check('settings reverted', (await (await ap.request.get(BASE + '/')).text()).includes(oldPhone2));

  // CSRF: POST without token is refused
  const bad = await ap.request.post(BASE + '/admin/settings', { form: { phone1: '1' }, headers: { 'Accept': 'application/json' } });
  check('POST without CSRF token refused (403)', bad.status() === 403);

  // password change: wrong current rejected
  await ap.goto(BASE + '/admin/password');
  await ap.fill('#p-current', 'nope-nope-nope'); await ap.fill('#p-new_password', 'abcdefghijklmnop'); await ap.fill('#p-confirm', 'abcdefghijklmnop');
  await ap.click('form.panel button[type=submit]');
  check('password change rejects wrong current password', (await ap.textContent('body')).includes('not correct'));

  // mark test items Closed so the inbox stays clean for the founder
  for (const [slug, text] of [['contacts', 'E2E Test Shop'], ['contacts', 'E2E Modal Shop'], ['applications', 'E2E College of Engineering']]) {
    await ap.goto(BASE + `/admin/${slug}?q=` + encodeURIComponent(text));
    const its = ap.locator('.item');
    for (let i = 0; i < await its.count(); i++) {
      await Promise.all([ap.waitForNavigation(), its.nth(i).locator('select').selectOption('Closed')]);
    }
  }
  // logout
  await ap.goto(BASE + '/admin/contacts');
  await Promise.all([ap.waitForNavigation(), ap.click('.link-btn')]);
  check('logout works', ap.url().endsWith('/admin/login'));
  await ap.goto(BASE + '/admin/contacts');
  check('session invalid after logout', ap.url().endsWith('/admin/login'));

  // ---------- mobile ----------
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  for (const p of ['/', '/services', '/work', '/internship', '/about', '/contact', '/admin/login', '/does-not-exist']) {
    for (const w of [320, 375, 414]) {
      await mp.setViewportSize({ width: w, height: 812 });
      await mp.goto(BASE + p, { waitUntil: 'networkidle' });
      const res = await mp.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const over = [...document.querySelectorAll('body *')].filter(el => {
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          if (!r.width || cs.visibility === 'hidden' || el.closest('.hp,.skip-link,[data-menu]') || r.right <= vw + 1) return false;
          // decorative layers clipped by an overflow:hidden/clip ancestor cannot cause sideways scroll
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === 'hidden' || o === 'clip') && a.getBoundingClientRect().right <= vw + 1) return false; }
          return true;
        }).map(el => el.tagName + '.' + el.className);
        const small = [...document.querySelectorAll('a, button, input, select, textarea')].filter(el => {
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          if (!r.width || cs.visibility === 'hidden' || el.closest('.hp,.skip-link,[data-menu]')) return false;
          if (el.closest('p, li') && cs.display === 'inline' ) return false; // inline text links in prose
          return r.height < 44 || r.width < 44;
        }).map(el => el.tagName + ':' + (el.textContent || el.name || '').trim().slice(0, 30) + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
        return { sw: document.documentElement.scrollWidth, vw, over: over.slice(0, 5), small: small.slice(0, 8) };
      });
      check(`no horizontal overflow ${p} @${w}px`, res.sw <= res.vw && res.over.length === 0, `scrollWidth ${res.sw} / ${res.vw} ` + res.over.join(', '));
      if (w === 375) check(`tap targets >= 44px ${p}`, res.small.length === 0, res.small.join(' | '));
    }
  }
  await mp.setViewportSize({ width: 390, height: 844 });
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' }); await mp.waitForTimeout(1200);
  await mp.screenshot({ path: path.join(SHOTS, 'home-mobile.png') });
  await revealAll(mp);
  await fullShot(mp, 'home-mobile-full.png');
  await mp.click('[data-menu-btn]'); await mp.waitForTimeout(400);
  check('mobile menu opens', (await mp.getAttribute('[data-menu-btn]', 'aria-expanded')) === 'true');
  await mp.screenshot({ path: path.join(SHOTS, 'mobile-menu.png') });
  await mp.goto(BASE + '/internship', { waitUntil: 'networkidle' }); await mp.waitForTimeout(600);
  await revealAll(mp);
  await fullShot(mp, 'internship-mobile-full.png');
  await mp.locator('[data-dialog="dlg-role-web-developer"]').scrollIntoViewIfNeeded(); await mp.waitForTimeout(500);
  await mp.click('[data-dialog="dlg-role-web-developer"]'); await mp.waitForSelector('#dlg-role-web-developer[open]'); await mp.waitForTimeout(600);
  await mp.screenshot({ path: path.join(SHOTS, 'modal-mobile.png') });
  const sheet = await mp.evaluate(() => { const r = document.querySelector('#dlg-role-web-developer .modal-panel').getBoundingClientRect(); return { w: r.width, right: r.right, vw: innerWidth }; });
  check('mobile modal fits the screen', sheet.right <= sheet.vw + 1, JSON.stringify(sheet));
  await mp.keyboard.press('Escape'); await mp.waitForTimeout(400);

  // reduced motion
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  await rp.goto(BASE + '/', { waitUntil: 'networkidle' });
  const anim = await rp.evaluate(() => ({ main: getComputedStyle(document.querySelector('main')).animationName, line: getComputedStyle(document.querySelector('.hero-title .line > span')).animationName, moved: [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).transform !== 'none').length, parallax: [...document.querySelectorAll('[data-parallax]')].filter(e => e.style.translate).length }));
  check('reduced motion: opacity-only (no rise, no slide, no parallax)', anim.main === 'fade' && anim.line === 'fade' && anim.moved === 0 && anim.parallax === 0, JSON.stringify(anim));
  // no-JS: forms and links still work
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
  const np = await nctx.newPage();
  await np.goto(BASE + '/', { waitUntil: 'load' });
  const nojs = await np.evaluate(() => ({ hidden: [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity === '0').length, href: document.querySelector('.hero [data-dialog="dlg-contact"]').getAttribute('href') }));
  check('no-JS: content visible and modal triggers are real links', nojs.hidden === 0 && nojs.href === '/contact', JSON.stringify(nojs));
  await np.goto(BASE + '/internship?track=' + encodeURIComponent('Web Developer'), { waitUntil: 'load' });
  check('no-JS fallback: /internship?track= preselects the role', (await np.inputValue('#a-track')) === 'Web Developer');
  await nctx.close();

  // keyboard: skip link visible on focus
  await rp.keyboard.press('Tab');
  await rp.waitForTimeout(400);
  const skipTop = await rp.evaluate(() => document.activeElement.className + ':' + document.activeElement.getBoundingClientRect().top);
  check('skip link first in tab order and visible', skipTop.startsWith('skip-link') && parseFloat(skipTop.split(':')[1]) >= 0, skipTop);

  await browser.close();
  const failed = results.filter(r => r[0] === 'FAIL');
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
