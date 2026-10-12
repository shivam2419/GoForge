'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const { db, DATA_DIR, getSettings, saveSettings } = require('./lib/db');
const { SERVICES, CONTACT_SERVICES, TRACKS, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, BRAND, WHY_SMALL, FAQ, OFFERS } = require('./lib/content');
const { programmePdf, programmeLines } = require('./lib/pdf');

const PORT = Number(process.env.PORT) || 3000;
const SITE_URL = (process.env.SITE_URL || 'https://goforgedigital.com').replace(/\/+$/, '');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'goforgedigital@gmail.com').toLowerCase();
const SESSION_DAYS = 7;
const BCRYPT_COST = 12;
const GA_ID = /^G-[A-Z0-9]+$/.test(process.env.GA_MEASUREMENT_ID || '') ? process.env.GA_MEASUREMENT_ID : '';
const PLAUSIBLE_DOMAIN = (process.env.PLAUSIBLE_DOMAIN || '').replace(/[^a-z0-9.-]/gi, '');
const PLAUSIBLE_SRC = process.env.PLAUSIBLE_SRC || 'https://plausible.io';

// ---------- secrets ----------
function loadSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  const file = path.join(DATA_DIR, 'secret.key');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}
const SECRET = loadSecret();

// ---------- first admin ----------
function generatePassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '-_.!@#%'];
  const all = sets.join('');
  const pick = s => s[crypto.randomInt(s.length)];
  const chars = sets.map(pick);
  while (chars.length < 20) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}
(function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  if (count > 0) return;
  const password = process.env.ADMIN_INITIAL_PASSWORD || generatePassword();
  db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(ADMIN_EMAIL, bcrypt.hashSync(password, BCRYPT_COST));
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    const file = process.env.ADMIN_PASSWORD_FILE || path.join(DATA_DIR, 'ADMIN_INITIAL_PASSWORD.txt');
    try {
      fs.writeFileSync(file, `Goforge Digital admin\nLogin: /admin/login\nEmail: ${ADMIN_EMAIL}\nInitial password: ${password}\n\nChange it after first login (Admin > Password), then delete this file.\n`, { mode: 0o600 });
      console.log(`[goforge] Admin account created for ${ADMIN_EMAIL}. Initial password written to ${file}`);
    } catch (err) {
      console.log(`[goforge] Admin account created for ${ADMIN_EMAIL}. Password file was not written (${err.message}). Set ADMIN_INITIAL_PASSWORD to choose it.`);
    }
  }
})();

// ---------- helpers ----------
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const digits = s => String(s || '').replace(/\D/g, '');
const telHref = p => 'tel:+' + digits(p);
function waUrl(number, text) {
  const n = digits(number);
  return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
}
const fmtTime = iso => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' IST';

function assetVersion() {
  const h = crypto.createHash('md5');
  for (const f of ['public/css/site.css', 'public/css/admin.css', 'public/js/site.js']) {
    try { h.update(fs.readFileSync(path.join(__dirname, f))); } catch (_) { /* optional */ }
  }
  return h.digest('hex').slice(0, 10);
}
const ASSET_V = assetVersion();

// ---------- validation ----------
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
function text(v) { return String(v == null ? '' : v).replace(CTRL, '').replace(/\r\n/g, '\n').trim(); }
function field(errors, values, body, name, label, { required = false, min = 0, max = 200 } = {}) {
  const v = text(body[name]);
  values[name] = v;
  if (!v) { if (required) errors[name] = `Please enter ${label}.`; return v; }
  if (v.length < min) errors[name] = `${label[0].toUpperCase() + label.slice(1)} looks too short.`;
  else if (v.length > max) errors[name] = `Please keep ${label} under ${max} characters.`;
  return v;
}
function phoneField(errors, values, body, name, label, required = true) {
  const v = text(body[name]);
  values[name] = v;
  if (!v) { if (required) errors[name] = `Please enter ${label}.`; return v; }
  const d = digits(v);
  if (!/^[+\d\s\-().]+$/.test(v) || d.length < 10 || d.length > 15) errors[name] = `Please enter a valid ${label}, for example +91 98765 43210.`;
  return v;
}

function validateContact(body) {
  const errors = {}, values = {};
  field(errors, values, body, 'name', 'your name', { required: true, min: 2, max: 80 });
  field(errors, values, body, 'business', 'the business name', { max: 120 });
  phoneField(errors, values, body, 'phone', 'phone number');
  values.service = text(body.service);
  if (values.service && !CONTACT_SERVICES.includes(values.service)) errors.service = 'Please choose a service from the list.';
  field(errors, values, body, 'message', 'a short message', { required: true, min: 10, max: 2000 });
  return { errors, values };
}
function validateApplication(body) {
  const errors = {}, values = {};
  field(errors, values, body, 'full_name', 'your full name', { required: true, min: 2, max: 80 });
  field(errors, values, body, 'college', 'your college', { required: true, min: 2, max: 120 });
  field(errors, values, body, 'course_year', 'your course and year', { required: true, min: 2, max: 60 });
  phoneField(errors, values, body, 'whatsapp', 'WhatsApp number');
  values.track = text(body.track);
  if (!values.track) errors.track = 'Please choose a role.';
  else if (!TRACKS.includes(values.track)) errors.track = 'Please choose a role from the list.';
  field(errors, values, body, 'note', 'the note', { max: 1000 });
  if (values.track === SIMILAR_ROLE && !errors.note && (values.note || '').length < 5) errors.note = 'Please name the role you want in the note.';
  return { errors, values };
}

function contactMessage(v) {
  return [
    'Hello Goforge Digital, I sent this from your website.',
    `Name: ${v.name}`,
    v.business ? `Business: ${v.business}` : null,
    `Phone: ${v.phone}`,
    v.service ? `Service: ${v.service}` : null,
    `Message: ${v.message}`
  ].filter(Boolean).join('\n');
}
function applicationMessage(v) {
  return [
    'Hello Goforge Digital, I applied for the internship on your website.',
    `Name: ${v.full_name}`,
    `College: ${v.college}`,
    `Course and year: ${v.course_year}`,
    `WhatsApp: ${v.whatsapp}`,
    `Role: ${v.track}`,
    v.note ? `Note: ${v.note}` : null
  ].filter(Boolean).join('\n');
}

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.VERCEL ? 1 : (process.env.TRUST_PROXY || 'loopback'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (process.env.NODE_ENV !== 'development') app.set('view cache', true);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"].concat(GA_ID ? ['https://www.googletagmanager.com'] : [], PLAUSIBLE_DOMAIN ? [PLAUSIBLE_SRC] : []),
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:'].concat(GA_ID ? ['https://www.google-analytics.com'] : []),
      'font-src': ["'self'"],
      'connect-src': ["'self'"].concat(
        GA_ID ? ['https://www.google-analytics.com', 'https://www.googletagmanager.com', 'https://region1.google-analytics.com'] : [],
        PLAUSIBLE_DOMAIN ? [PLAUSIBLE_SRC] : []
      ),
      'frame-src': ['https://www.google.com', 'https://maps.google.com'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': null
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(compression());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.json({ limit: '20kb' }));

app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  setHeaders(res, file) {
    if (/\.(woff2|png|svg|ico|webp|jpg)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=2592000');
    else if (/\.(css|js)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Shared locals
app.use((req, res, next) => {
  const s = getSettings();
  Object.assign(res.locals, {
    s, BRAND, SERVICES, TRACKS, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, CONTACT_SERVICES,
    WHY_SMALL, FAQ, OFFERS,
    analytics: { ga: GA_ID, plausibleDomain: PLAUSIBLE_DOMAIN, plausibleSrc: PLAUSIBLE_SRC },
    mapEmbed: 'https://maps.google.com/maps?q=' + encodeURIComponent(BRAND.mapQuery) + '&z=16&output=embed',
    siteUrl: SITE_URL, assetV: ASSET_V, path: req.path, year: new Date().getFullYear(),
    telHref, waUrl, digits, fmtTime, errors: {}, values: {}
  });
  next();
});

// CSRF: random per-browser cookie + HMAC token in each form (double submit, signed).
app.use((req, res, next) => {
  let id = req.cookies.gf_csrf;
  if (!id || !/^[a-f0-9]{48}$/.test(id)) {
    id = crypto.randomBytes(24).toString('hex');
    res.cookie('gf_csrf', id, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' });
  }
  res.locals.csrf = hmac('csrf:' + id);
  if (req.method === 'POST') {
    const origin = req.get('origin');
    if (origin && origin !== 'null') {
      let host = '';
      try { host = new URL(origin).host; } catch (_) { /* invalid */ }
      const allowed = [req.get('host'), req.get('x-forwarded-host')].filter(Boolean);
      if (!allowed.includes(host)) return res.status(403).type('text').send('Cross-site request refused.');
    }
    const sent = String((req.body && req.body._csrf) || req.get('x-csrf-token') || '');
    const ok = req.cookies.gf_csrf && sent.length === 64 &&
      crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(hmac('csrf:' + req.cookies.gf_csrf)));
    if (!ok) {
      if (wantsJson(req)) return res.status(403).json({ ok: false, message: 'Your session expired. Please reload the page and try again.' });
      return res.status(403).render('error', { ...pageMeta(req, 'Session expired', 'Session expired'), code: 403, heading: 'This form has expired', body: 'Please go back, reload the page, and send it again.' });
    }
  }
  next();
});

function wantsJson(req) { return (req.get('accept') || '').includes('application/json'); }

function pageMeta(req, title, desc, extra = {}) {
  const seoTitle = extra.seoTitle;
  const rest = { ...extra };
  delete rest.seoTitle;
  return {
    pageTitle: seoTitle || (title === 'Home'
      ? 'Custom software and marketing studio in Faridabad | Goforge Digital'
      : `${title} | Goforge Digital`),
    pageDesc: desc,
    canonicalPath: req.path === '/' ? '/' : req.path.replace(/\/+$/, ''),
    ...rest
  };
}

function jsonLd() {
  const s = getSettings();
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: BRAND.name,
    slogan: BRAND.tagline,
    url: SITE_URL + '/',
    logo: SITE_URL + '/img/gf-512.png',
    image: SITE_URL + '/img/og.png',
    email: s.email,
    telephone: [s.phone1, s.phone2].map(p => '+' + digits(p)),
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.address.line1 + ', Sector-8',
      addressLocality: BRAND.address.locality,
      addressRegion: BRAND.address.region,
      addressCountry: BRAND.address.country
    },
    founder: { '@type': 'Person', name: BRAND.founder, jobTitle: BRAND.founderRole, sameAs: [BRAND.linkedin] },
    sameAs: [BRAND.instagram],
    knowsAbout: SERVICES.map(x => x.name)
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function faqJsonLd() {
  const entities = FAQ.flatMap(group => group.items.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a }
  })));
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: entities }).replace(/</g, '\\u003c');
}

// ---------- rate limits ----------
const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => {
    const msg = 'Too many messages from this connection. Please try again in an hour, or message us on WhatsApp.';
    if (wantsJson(req)) return res.status(429).json({ ok: false, message: msg });
    res.status(429).render('error', { ...pageMeta(req, 'Please wait', msg), code: 429, heading: 'Please wait a little', body: msg });
  }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false, skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).render('admin/login', { ...pageMeta(req, 'Admin login', 'Admin'), noindex: true, error: 'Too many attempts. Please wait 15 minutes and try again.', email: '' })
});

// ---------- public pages ----------
app.get('/', (req, res) => res.render('home', pageMeta(req, 'Home',
  'Goforge Digital is a studio in Faridabad. Custom software, CRM and ERP, AI automation, and digital marketing for small businesses. Online internship after live training.', { jsonld: jsonLd() })));

app.get('/services', (req, res) => res.render('services', pageMeta(req, 'Services',
  'Custom software, CRM, ERP, AI automation, and digital marketing from a studio in Faridabad. See what each service includes and what you get at handover.',
  { seoTitle: 'Custom software, CRM and marketing in Faridabad | Goforge Digital' })));

app.get('/services/:slug', (req, res, next) => {
  const service = SERVICES.find(item => item.slug === req.params.slug);
  if (!service) return next();
  res.render('service', pageMeta(req, service.name,
    service.name + ' from Goforge Digital in Faridabad. What it includes, the questions on a first call, and what you receive at handover.',
    { seoTitle: service.name + ' in Faridabad | Goforge Digital', service }));
});

app.get('/work', (req, res) => res.render('work', pageMeta(req, 'Work',
  'Portfolio of Goforge Digital, a studio in Faridabad. Only finished work we are allowed to show is listed here.',
  { seoTitle: 'Portfolio | Goforge Digital, Faridabad' })));

app.get('/internship', (req, res) => res.render('internship', { values: { track: TRACKS.includes(req.query.track) ? req.query.track : '' }, ...pageMeta(req, 'Internship',
  'Live online training, then a supervised internship with Goforge Digital in Faridabad. For BTech, BCA and similar students. The college decides whether it counts.',
  { seoTitle: 'Online internship after live training | Goforge Digital, Faridabad' }) }));

app.get('/internship/roles/:slug', (req, res, next) => {
  const role = TRACK_DETAILS.find(item => item.slug === req.params.slug);
  if (!role) return next();
  res.render('role', pageMeta(req, role.name + ' internship',
    role.name + ' internship at Goforge Digital: tools such as ' + role.tools.slice(0, 3).join(', ') + ', a typical project, and who the role suits.',
    { seoTitle: role.name + ' internship | Goforge Digital, Faridabad', role }));
});

app.get('/internship/overview', (req, res) => res.render('overview', pageMeta(req, 'Programme overview',
  'Printable overview of the Goforge Digital internship: stages, roles, letter, and what a college should check.',
  { seoTitle: 'Internship programme overview | Goforge Digital, Faridabad' })));

app.get('/internship/overview.pdf', (req, res) => {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'inline; filename="goforge-internship-overview.pdf"');
  res.send(programmePdf(programmeLines({ settings: getSettings(), brand: BRAND, tracks: TRACK_DETAILS })));
});

app.get('/faq', (req, res) => res.render('faq', pageMeta(req, 'FAQ',
  'Answers for students and clients: how the internship works, college acceptance, the letter, how projects are chosen, and how client work is priced.',
  { seoTitle: 'FAQ for students and clients | Goforge Digital, Faridabad', jsonld: faqJsonLd() })));

app.get('/about', (req, res) => res.render('about', pageMeta(req, 'About',
  'Goforge Digital is an early studio in Sector 8, Faridabad, led by Rohit Sharma, Founder and Director.',
  { seoTitle: 'About Goforge Digital, a studio in Faridabad' })));

app.get('/contact', (req, res) => res.render('contact', { values: { service: CONTACT_SERVICES.includes(req.query.service) ? req.query.service : '' }, ...pageMeta(req, 'Contact',
  'Call, WhatsApp or visit Goforge Digital at Puri Highstreet, Sector 8, Faridabad. Office hours Monday to Saturday.',
  { seoTitle: 'Contact Goforge Digital in Faridabad' }) }));

app.get('/privacy', (req, res) => res.render('legal', pageMeta(req, 'Privacy',
  'Privacy notice for Goforge Digital: what the enquiry and internship forms collect, why, and how to ask for a correction or deletion.',
  { seoTitle: 'Privacy notice | Goforge Digital', kind: 'privacy' })));

app.get('/terms', (req, res) => res.render('legal', pageMeta(req, 'Terms',
  'Terms for using the Goforge Digital website, asking for a project, and applying to the internship.',
  { seoTitle: 'Terms of use | Goforge Digital', kind: 'terms' })));

app.get('/refund', (req, res) => res.render('legal', pageMeta(req, 'Refunds',
  'Refund template for the Goforge Digital internship and for client deposits. Blank items must be confirmed before you rely on them.',
  { seoTitle: 'Refund policy | Goforge Digital', kind: 'refund' })));

app.post('/contact', formLimiter, (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'contact', 'Thanks. Your message has been sent.', waUrl(getSettings().whatsapp, ''));
  const { errors, values } = validateContact(req.body);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('contact', { ...pageMeta(req, 'Contact', 'Contact Goforge Digital'), errors, values });
  }
  db.prepare('INSERT INTO contacts (name, business, phone, service, message) VALUES (?, ?, ?, ?, ?)')
    .run(values.name, values.business || null, values.phone, values.service || null, values.message);
  respondOk(req, res, 'contact', 'Thanks, ' + values.name.split(' ')[0] + '. Your message is saved and we will reply soon.', waUrl(getSettings().whatsapp, contactMessage(values)));
});

app.post('/internship', formLimiter, (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'internship', 'Thanks. Your application has been sent.', waUrl(getSettings().whatsapp, ''));
  const { errors, values } = validateApplication(req.body);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('internship', { ...pageMeta(req, 'Internship', 'Internship at Goforge Digital'), errors, values });
  }
  db.prepare('INSERT INTO applications (full_name, college, course_year, whatsapp, track, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(values.full_name, values.college, values.course_year, values.whatsapp, values.track, values.note || null);
  respondOk(req, res, 'internship', 'Thanks, ' + values.full_name.split(' ')[0] + '. Your application is saved. We will contact you on WhatsApp.', waUrl(getSettings().whatsapp, applicationMessage(values)));
});

function respondOk(req, res, kind, message, whatsappUrl) {
  if (wantsJson(req)) return res.json({ ok: true, message, whatsappUrl });
  res.render('thanks', { ...pageMeta(req, 'Sent', message), noindex: true, kind, message, whatsappUrl });
}

app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const pages = ['/', '/services', '/work', '/internship', '/internship/overview', '/about', '/contact', '/faq', '/privacy', '/terms', '/refund']
    .concat(SERVICES.map(item => '/services/' + item.slug))
    .concat(TRACK_DETAILS.map(item => '/internship/roles/' + item.slug));
  const today = new Date().toISOString().slice(0, 10);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
});
app.get('/js/analytics.js', (req, res) => {
  if (!GA_ID) return res.status(404).type('text').send('');
  res.type('application/javascript').set('Cache-Control', 'public, max-age=3600').send(
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{anonymize_ip:true});`
  );
});
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'favicon-32.png')));
app.get('/healthz', (req, res) => res.type('text').send('ok'));

// ---------- admin ----------
function clearSession(req, res) {
  if (req.cookies.gf_sid) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(req.cookies.gf_sid));
  res.clearCookie('gf_sid', { path: '/' });
}
function loadAdmin(req, res, next) {
  const token = req.cookies.gf_sid;
  if (token) {
    const row = db.prepare('SELECT a.id, a.email, s.expires_at FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?').get(sha256(token));
    if (row && row.expires_at > Date.now()) { req.admin = row; res.locals.admin = row; }
  }
  next();
}
function requireAdmin(req, res, next) {
  if (!req.admin) return res.redirect(303, '/admin/login');
  res.set('Cache-Control', 'no-store');
  res.locals.noindex = true;
  res.locals.newCounts = {
    contacts: db.prepare("SELECT COUNT(*) n FROM contacts WHERE status = 'New'").get().n,
    applications: db.prepare("SELECT COUNT(*) n FROM applications WHERE status = 'New'").get().n
  };
  next();
}
app.use('/admin', loadAdmin, (req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });

app.get('/admin/login', (req, res) => {
  if (req.admin) return res.redirect(303, '/admin');
  res.set('Cache-Control', 'no-store');
  res.render('admin/login', { ...pageMeta(req, 'Admin login', 'Admin'), noindex: true, error: null, email: '' });
});
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);
app.post('/admin/login', loginLimiter, async (req, res) => {
  const email = text(req.body.email).toLowerCase().slice(0, 200);
  const password = String(req.body.password || '').slice(0, 200);
  const user = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) {
    res.status(401);
    return res.render('admin/login', { ...pageMeta(req, 'Admin login', 'Admin'), noindex: true, error: 'That email and password do not match.', email });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('INSERT INTO sessions (token_hash, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), user.id, now, now + SESSION_DAYS * 864e5);
  db.prepare("UPDATE admins SET last_login_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?").run(user.id);
  res.cookie('gf_sid', token, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/', maxAge: SESSION_DAYS * 864e5 });
  res.redirect(303, '/admin');
});
app.post('/admin/logout', (req, res) => { clearSession(req, res); res.redirect(303, '/admin/login'); });

app.get('/admin', requireAdmin, (req, res) => res.redirect(303, '/admin/contacts'));

const INBOXES = {
  contacts: {
    table: 'contacts', title: 'Project enquiries', search: ['name', 'business', 'phone', 'service', 'message']
  },
  applications: {
    table: 'applications', title: 'Internship applications', search: ['full_name', 'college', 'course_year', 'whatsapp', 'track', 'note']
  }
};
const PAGE_SIZE = 25;
for (const [slug, cfg] of Object.entries(INBOXES)) {
  app.get(`/admin/${slug}`, requireAdmin, (req, res) => {
    const q = text(req.query.q).slice(0, 100);
    const status = STATUSES.includes(req.query.status) ? req.query.status : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const where = [], params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (q) {
      const like = '%' + q.replace(/[\\%_]/g, m => '\\' + m) + '%';
      where.push('(' + cfg.search.map(c => `${c} LIKE ? ESCAPE '\\'`).join(' OR ') + ')');
      cfg.search.forEach(() => params.push(like));
    }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) n FROM ${cfg.table} ${w}`).get(...params).n;
    const rows = db.prepare(`SELECT * FROM ${cfg.table} ${w} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`).all(...params, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    const counts = Object.fromEntries(STATUSES.map(st => [st, db.prepare(`SELECT COUNT(*) n FROM ${cfg.table} WHERE status = ?`).get(st).n]));
    res.render('admin/inbox', {
      ...pageMeta(req, cfg.title, 'Admin'), slug, cfg, rows, q, status, page, total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), counts, flash: req.query.saved ? 'Status updated.' : null
    });
  });
  app.post(`/admin/${slug}/:id/status`, requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const st = req.body.status;
    if (!STATUSES.includes(st) || !id) return res.status(400).type('text').send('Invalid status.');
    db.prepare(`UPDATE ${cfg.table} SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`).run(st, id);
    const back = new URLSearchParams();
    if (req.body.q) back.set('q', text(req.body.q).slice(0, 100));
    if (STATUSES.includes(req.body.f)) back.set('status', req.body.f);
    if (parseInt(req.body.page, 10) > 1) back.set('page', String(parseInt(req.body.page, 10)));
    back.set('saved', '1');
    res.redirect(303, `/admin/${slug}?${back}#item-${id}`);
  });
}

app.get('/admin/settings', requireAdmin, (req, res) => {
  res.render('admin/settings', { ...pageMeta(req, 'Site settings', 'Admin'), values: getSettings(), errors: {}, flash: req.query.saved ? 'Saved. The public site now shows these details.' : null });
});
app.post('/admin/settings', requireAdmin, (req, res) => {
  const errors = {}, values = {};
  phoneField(errors, values, req.body, 'phone1', 'first phone number');
  phoneField(errors, values, req.body, 'phone2', 'second phone number');
  phoneField(errors, values, req.body, 'whatsapp', 'WhatsApp number');
  values.email = text(req.body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email) || values.email.length > 120) errors.email = 'Please enter a valid email address.';
  for (const k of ['blurb1', 'blurb2', 'blurb3', 'blurb4']) field(errors, values, req.body, k, 'the service line', { required: true, min: 10, max: 220 });
  field(errors, values, req.body, 'intern_training', 'the training length', { required: true, max: 40 });
  field(errors, values, req.body, 'intern_work', 'the internship length', { required: true, max: 40 });
  field(errors, values, req.body, 'intern_fee', 'the fee line', { required: true, max: 80 });
  if (Object.keys(errors).length) {
    return res.status(422).render('admin/settings', { ...pageMeta(req, 'Site settings', 'Admin'), values: { ...getSettings(), ...values }, errors, flash: null });
  }
  saveSettings(values);
  res.redirect(303, '/admin/settings?saved=1');
});

app.get('/admin/password', requireAdmin, (req, res) => {
  res.render('admin/password', { ...pageMeta(req, 'Change password', 'Admin'), errors: {}, flash: req.query.saved ? 'Password changed. Other sessions were signed out.' : null });
});
app.post('/admin/password', requireAdmin, async (req, res) => {
  const errors = {};
  const current = String(req.body.current || '').slice(0, 200);
  const next1 = String(req.body.new_password || '').slice(0, 200);
  const next2 = String(req.body.confirm || '').slice(0, 200);
  const user = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!(await bcrypt.compare(current, user.password_hash))) errors.current = 'The current password is not correct.';
  if (next1.length < 12) errors.new_password = 'Use at least 12 characters.';
  else if (next1 === current) errors.new_password = 'Choose a password different from the current one.';
  if (next1 !== next2) errors.confirm = 'The two new passwords do not match.';
  if (Object.keys(errors).length) return res.status(422).render('admin/password', { ...pageMeta(req, 'Change password', 'Admin'), errors, flash: null });
  db.prepare("UPDATE admins SET password_hash = ?, password_changed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?").run(await bcrypt.hash(next1, BCRYPT_COST), user.id);
  db.prepare('DELETE FROM sessions WHERE admin_id = ? AND token_hash != ?').run(user.id, sha256(req.cookies.gf_sid));
  res.redirect(303, '/admin/password?saved=1');
});

// ---------- 404 / errors ----------
app.use((req, res) => {
  res.status(404).render('error', { ...pageMeta(req, 'Page not found', 'This page does not exist.'), noindex: true, code: 404, heading: 'This page does not exist', body: 'The link may be old or mistyped. Try one of the pages below.' });
});
app.use((err, req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.too.large') return res.status(413).type('text').send('Too much data in one request.');
  res.status(500).render('error', { ...pageMeta(req, 'Something went wrong', 'Error'), noindex: true, code: 500, heading: 'Something went wrong on our side', body: 'Please try again in a minute, or reach us by phone or WhatsApp.' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => console.log(`[goforge] Listening on http://localhost:${PORT}`));
}
module.exports = app;
