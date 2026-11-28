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

const { db, DATA_DIR, ready, loadSettings, getSettings, saveSettings, getFile, saveFile, deleteFile, listFileKeys } = require('./lib/db');
const { TECH_STACK, SERVICES, CONTACT_SERVICES, TRACKS, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, BRAND, WHY_SMALL, FAQ, OFFERS, CAREER_TRACKS, CAREER_TRACK_OPTIONS, TRACK_RANGE, careerTrackLabel, careerTracksFrom, careerTrackOptionsFrom, visibleFaq } = require('./lib/content');
const batch = require('./lib/batch');
const GREVIEWS = require('./lib/reviews');
const { toolChips } = require('./lib/tools');
const { SERVICE_PAGES, SERVICE_REDIRECTS } = require('./lib/service-pages');
const { programmePdf } = require('./lib/pdf');
const blog = require('./lib/blog');
const cms = require('./lib/cms');
const { storeImage, storePdf, UPLOAD_DIR, MAX_BYTES, MAX_PDF_BYTES, uploadMode } = require('./lib/uploads');
const multer = require('multer');
const { notifyLead } = require('./lib/lead-alerts');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 4, fields: 40, fieldSize: 32 * 1024 } });
const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PDF_BYTES, files: 4, fields: 80, fieldSize: 64 * 1024 } });

const PORT = Number(process.env.PORT) || 3000;
// Canonical base URL. Vercel serves the site on www (the apex 308-redirects to it), so an apex SITE_URL is
// normalised to www; CANONICAL_URL overrides this if the primary domain ever changes.
const SITE_URL = (process.env.CANONICAL_URL || (process.env.SITE_URL || 'https://www.goforgedigital.com')
  .replace(/^https?:\/\/goforgedigital\.com/i, 'https://www.goforgedigital.com')).replace(/\/+$/, '');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'goforgedigital@gmail.com').toLowerCase();
const SESSION_DAYS = 7;
const BCRYPT_COST = 12;
const GA_ID = /^G-[A-Z0-9]+$/.test(process.env.GA_MEASUREMENT_ID || '') ? process.env.GA_MEASUREMENT_ID : '';
const PLAUSIBLE_DOMAIN = (process.env.PLAUSIBLE_DOMAIN || '').replace(/[^a-z0-9.-]/gi, '');
const PLAUSIBLE_SRC = process.env.PLAUSIBLE_SRC || 'https://plausible.io';
// Vercel Web Analytics (cookie-free). Served same-origin from /_vercel/insights/*, so the CSP 'self' already allows it.
// Only meaningful on Vercel with Web Analytics enabled in the project dashboard.
const VERCEL_ANALYTICS = process.env.ENABLE_VERCEL_ANALYTICS === '1' && Boolean(process.env.VERCEL);

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
async function seedAdmin() {
  const count = (await db.get('SELECT COUNT(*) AS n FROM admins')).n;
  if (count > 0) return;
  const password = process.env.ADMIN_INITIAL_PASSWORD || generatePassword();
  (await db.run('INSERT OR IGNORE INTO admins (email, password_hash) VALUES (?, ?)', ADMIN_EMAIL, bcrypt.hashSync(password, BCRYPT_COST)));
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    const file = process.env.ADMIN_PASSWORD_FILE || path.join(DATA_DIR, 'ADMIN_INITIAL_PASSWORD.txt');
    try {
      fs.writeFileSync(file, `GoForge Digital admin\nLogin: /admin/login\nEmail: ${ADMIN_EMAIL}\nInitial password: ${password}\n\nChange it after first login (Admin > Password), then delete this file.\n`, { mode: 0o600 });
      console.log(`[goforge] Admin account created for ${ADMIN_EMAIL}. Initial password written to ${file}`);
    } catch (err) {
      console.log(`[goforge] Admin account created for ${ADMIN_EMAIL}. Password file was not written (${err.message}). Set ADMIN_INITIAL_PASSWORD to choose it.`);
    }
  }
}

// ---------- helpers ----------
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const digits = s => String(s || '').replace(/\D/g, '');
const telHref = p => 'tel:+' + digits(p);
const fmtTime = iso => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' IST';

function assetVersion() {
  const h = crypto.createHash('md5');
  for (const f of ['public/css/site.css', 'public/css/admin.css', 'public/js/site.js']) {
    try { h.update(fs.readFileSync(path.join(__dirname, f))); } catch (_) { /* optional */ }
  }
  // Include the deploy's commit so cached HTML/JS from an older deploy is never paired with a newer server.
  h.update(process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || '');
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
const COLLEGE_INTERESTS = ['Campus tie-up / MoU', 'Workshop or bootcamp', 'Faculty development programme', 'Bulk training for a batch', 'Internship programme for students', 'Something else'];
const COLLEGE_SIZES = ['Under 50 students', '50–150 students', '150–500 students', '500+ students'];
function validateCollege(body) {
  const errors = {}, values = {};
  field(errors, values, body, 'name', 'your name', { required: true, min: 2, max: 80 });
  field(errors, values, body, 'designation', 'your designation', { max: 80 });
  field(errors, values, body, 'institution', 'the college or university name', { required: true, min: 3, max: 160 });
  field(errors, values, body, 'city', 'the city', { max: 60 });
  phoneField(errors, values, body, 'phone', 'phone number');
  values.email = text(body.email);
  if (values.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email) || values.email.length > 120)) errors.email = 'Please enter a valid email address.';
  values.interest = text(body.interest);
  if (!COLLEGE_INTERESTS.includes(values.interest)) errors.interest = 'Please choose what you are interested in.';
  values.size = text(body.size);
  if (values.size && !COLLEGE_SIZES.includes(values.size)) errors.size = 'Please choose from the list.';
  field(errors, values, body, 'message', 'a short message', { max: 2000 });
  return { errors, values };
}
const SCHOOL_INTERESTS = ['Skills programme for students', 'School software', 'Both'];
const SCHOOL_SIZES = ['Under 300 students', '300–800 students', '800–1,500 students', '1,500+ students'];
function validateSchool(body) {
  const errors = {}, values = {};
  field(errors, values, body, 'school', 'the school name', { required: true, min: 3, max: 160 });
  field(errors, values, body, 'name', 'the contact person', { required: true, min: 2, max: 80 });
  field(errors, values, body, 'role', 'your role', { max: 80 });
  phoneField(errors, values, body, 'phone', 'phone number');
  values.email = text(body.email);
  if (values.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email) || values.email.length > 120)) errors.email = 'Please enter a valid email address.';
  field(errors, values, body, 'city', 'the city', { max: 60 });
  values.size = text(body.size);
  if (values.size && !SCHOOL_SIZES.includes(values.size)) errors.size = 'Please choose from the list.';
  values.interest = text(body.interest);
  if (!SCHOOL_INTERESTS.includes(values.interest)) errors.interest = 'Please choose what you are interested in.';
  field(errors, values, body, 'message', 'a short message', { max: 2000 });
  return { errors, values };
}
const MODES = ['Live online', 'Either is fine'];
const SOURCES = ['Instagram', 'LinkedIn', 'Google search', 'College / friend', 'Other'];
// Snapshot the fee shown at the time of submission so later price changes do not rewrite past quotes.
// Applications do not collect programme length, so they store both current prices; counselling stores the chosen length's price (or both if unset).
function quotedFeeFor(trackLabel, tracks = CAREER_TRACKS) {
  const list = Array.isArray(tracks) && tracks.length ? tracks : CAREER_TRACKS;
  const both = list.map(t => batch.inr(t.price) + ' (' + t.name + ')').join(' / ');
  if (!trackLabel) return both;
  const t = list.find(x => trackLabel === careerTrackLabel(x) || trackLabel === x.name || String(trackLabel).startsWith(x.name + ' '));
  return t ? batch.inr(t.price) : both;
}

function validateApplication(body, TRACKS, batchPrefs = batch.BATCH_PREFS) {
  const errors = {}, values = {};
  field(errors, values, body, 'full_name', 'your full name', { required: true, min: 2, max: 80 });
  field(errors, values, body, 'college', 'your college', { required: true, min: 2, max: 120 });
  field(errors, values, body, 'course_year', 'your course and year', { required: true, min: 2, max: 60 });
  if (body.phone === undefined && body.whatsapp !== undefined) body.phone = body.whatsapp; // older cached forms
  phoneField(errors, values, body, 'phone', 'phone number');
  values.track = text(body.track);
  if (!values.track) errors.track = 'Please choose a role.';
  else if (!TRACKS.includes(values.track)) errors.track = 'Please choose a role from the list.';
  field(errors, values, body, 'note', 'the note', { max: 1000 });
  if (values.track === SIMILAR_ROLE && !errors.note && (values.note || '').length < 5) errors.note = 'Please name the role you want in the note.';
  values.email = text(body.email).slice(0, 200);
  if (values.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email) || values.email.length > 120)) errors.email = 'Please enter a valid email address.';
  field(errors, values, body, 'city', 'your city', { max: 80 });
  values.mode = text(body.mode);
  if (values.mode && !MODES.includes(values.mode)) errors.mode = 'Please choose from the list.';
  values.schedule = text(body.schedule);
  if (values.schedule && !batchPrefs.includes(values.schedule)) errors.schedule = 'Please choose from the list.';
  values.source = text(body.source);
  if (values.source && !SOURCES.includes(values.source)) errors.source = 'Please choose from the list.';
  field(errors, values, body, 'referred_by', 'who referred you', { max: 80 });
  values.consent = body.consent ? 'yes' : '';
  if (!values.consent) errors.consent = 'Please agree so we can contact you about your application.';
  return { errors, values };
}


// ---------- app ----------
const app = express();

// Make sure the schema, default settings and first admin exist before any request is handled,
// and keep the settings cache fresh (it is shared by every render).
let bootPromise = null;
function boot() {
  if (!bootPromise) bootPromise = ready().then(cms.migrate).then(seedAdmin).catch(err => { bootPromise = null; throw err; });
  return bootPromise;
}
app.use(async (req, res, next) => {
  if (req.path === '/healthz') return next();
  await boot();
  await loadSettings();
  next();
});
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
      'script-src': ["'self'"].concat(GA_ID ? ['https://*.googletagmanager.com'] : [], PLAUSIBLE_DOMAIN ? [PLAUSIBLE_SRC] : []),
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'].concat(GA_ID ? ['https://www.google-analytics.com'] : []),
      'font-src': ["'self'"],
      'connect-src': ["'self'"].concat(
        GA_ID ? ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'] : [],
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

// Old cached copies of site.js navigated a new tab to a legacy redirect URL,
// which newer servers no longer send, giving /undefined. Send such tabs home instead of a 404.
app.get(['/undefined', '/null'], (req, res) => res.redirect(302, '/'));
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  setHeaders(res, file) {
    if (/\.(woff2|png|svg|ico|webp|jpg)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=2592000');
    else if (/\.(css|js)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Shared locals
app.use(async (req, res, next) => {
  const s = getSettings();
  const PROGRAMS = await cms.publishedPrograms(s);
  const TRACKS = PROGRAMS.map(p => p.name).concat([SIMILAR_ROLE]);
  const now = batch.nowMs();
  const bv = batch.batchView(s, now);
  const offer = bv.offer;
  const tracks = careerTracksFrom(s);
  const trackOptions = careerTrackOptionsFrom(tracks);
  const cmsFaqs = await cms.faqGroups();
  const faqList = cmsFaqs.some(g => g.items.length) ? cmsFaqs : visibleFaq(now);
  Object.assign(res.locals, {
    offer, now, inr: batch.inr, SEAT_CAP: bv.SEAT_CAP, SEATS: bv.SEATS, REGISTRATION: bv.REGISTRATION, REFERRAL: batch.REFERRAL, WEBINAR: batch.WEBINAR_PUBLIC, showAnn: offer.webinar && req.path !== '/counselling' && req.path !== '/webinar',
    BATCH_LABEL: bv.BATCH_LABEL, BATCH_STARTS: bv.BATCH_STARTS, BATCH_STARTS_FULL: bv.BATCH_STARTS_FULL, BATCH_STARTS_SHORT: bv.BATCH_STARTS_SHORT, BATCH_SUMMARY: bv.BATCH_SUMMARY, SCHEDULE_NOTE: bv.SCHEDULE_NOTE, NEXT_AFTER: batch.NEXT_AFTER, BATCHES: bv.BATCHES, BATCH_PROMISES: batch.BATCH_PROMISES, BATCH_PREFS: bv.BATCH_PREFS,
    COUNSEL_INTERESTS: counselInterests(offer, bv.BATCH_LABEL), upcomingRows: rows => batch.upcomingRows(rows, now), TIMELINE: bv.TIMELINE, toolChips,
    PROGRAMS, TRACKS, MODES, SOURCES, GREVIEWS,
    s, BRAND, SERVICES, SERVICE_PAGES, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, CONTACT_SERVICES,
    CAREER_TRACKS: tracks, CAREER_TRACK_OPTIONS: trackOptions, TRACK_RANGE, careerTrackLabel,
    WHY_SMALL, FAQ: faqList, OFFERS, TECH_STACK, COUNSEL_TIMES: ['Morning (10 AM to 1 PM)', 'Afternoon (1 PM to 4 PM)', 'Evening (4 PM to 6:30 PM)', 'Any time'],
    analytics: { ga: GA_ID, plausibleDomain: PLAUSIBLE_DOMAIN, plausibleSrc: PLAUSIBLE_SRC, vercel: VERCEL_ANALYTICS },
    mapEmbed: 'https://maps.google.com/maps?q=' + encodeURIComponent(BRAND.mapQuery) + '&z=17&output=embed',
    siteUrl: SITE_URL, assetV: ASSET_V, path: req.path, year: new Date().getFullYear(),
    telHref, digits, fmtTime, errors: {}, values: {}
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
  if (req.method === 'POST' && req.is('multipart/form-data')) {
    // Body is parsed later by multer on the admin content routes, which then call csrfAfterUpload.
    if (!/^\/admin\/((programs|instructors|stats|testimonials|credentials|projects|gallery|samples|faqs)\/(new|\d+)|settings)$/.test(req.path)) return res.status(415).type('text').send('Unsupported form type.');
    return next();
  }
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

function csrfAfterUpload(req, res, next) {
  const origin = req.get('origin');
  if (origin && origin !== 'null') {
    let host = '';
    try { host = new URL(origin).host; } catch (_) { /* invalid */ }
    if (![req.get('host'), req.get('x-forwarded-host')].filter(Boolean).includes(host)) return res.status(403).type('text').send('Cross-site request refused.');
  }
  const sent = String((req.body && req.body._csrf) || '');
  const ok = req.cookies.gf_csrf && sent.length === 64 &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(hmac('csrf:' + req.cookies.gf_csrf)));
  if (!ok) return res.status(403).render('error', { ...pageMeta(req, 'Session expired', 'Session expired'), code: 403, heading: 'This form has expired', body: 'Please go back, reload the page, and send it again.' });
  next();
}
function wantsJson(req) { return (req.get('accept') || '').includes('application/json'); }

function pageMeta(req, title, desc, extra = {}) {
  const seoTitle = extra.seoTitle;
  const rest = { ...extra };
  delete rest.seoTitle; delete rest.crumbs;
  const canonicalPath = req.path === '/' ? '/' : req.path.replace(/\/+$/, '');
  const crumbs = extra.crumbs || (canonicalPath === '/' ? [] : [['Home', '/'], [title, canonicalPath]]);
  const breadcrumbLd = crumbs.length > 1 && !extra.noindex ? JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + p }))
  }).replace(/</g, '\\u003c') : null;
  return {
    breadcrumbLd,
    pageTitle: seoTitle || (title === 'Home'
      ? 'Custom software and marketing studio in Faridabad | GoForge Digital'
      : `${title} | GoForge Digital`),
    pageDesc: desc,
    canonicalPath: req.path === '/' ? '/' : req.path.replace(/\/+$/, ''),
    ogImage: ogImageFor(canonicalPath),
    ...rest
  };
}

// Page-specific Open Graph cards (built by scripts/build-og.js into public/img/og/). Falls back to the brand card.
const OG_DIR = path.join(__dirname, 'public', 'img', 'og');
const ogCache = new Map();
function ogImageFor(p) {
  const m = p.match(/^\/internship\/programs\/([a-z0-9-]+)$/);
  const name = m ? 'program-' + m[1] : ({ '/internship': 'internship', '/counselling': 'counselling', '/webinar': 'webinar', '/colleges': 'internship', '/faq': 'internship', '/services': 'services', '/work': 'services', '/contact': 'services' })[p]
    || (p.startsWith('/services/') ? 'services' : '');
  if (!name) return null;
  if (!ogCache.has(name)) ogCache.set(name, fs.existsSync(path.join(OG_DIR, name + '.png')));
  return ogCache.get(name) ? '/img/og/' + name + '.png' : (m ? (ogImageFor('/internship')) : null);
}

function orgBase(s) {
  return {
    name: BRAND.name,
    url: SITE_URL + '/',
    logo: SITE_URL + '/img/gf-512.png',
    image: SITE_URL + '/img/og.png',
    email: s.email,
    telephone: [s.phone1, s.phone2].map(p => '+' + digits(p)),
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'D125b, 1st Floor, Puri Highstreet, Sector 81',
      addressLocality: BRAND.address.locality,
      postalCode: BRAND.address.postalCode,
      addressRegion: BRAND.address.region,
      addressCountry: BRAND.address.country
    },
    sameAs: [BRAND.instagram, s.linkedin_company || BRAND.linkedinCompany, BRAND.googleProfile].filter(Boolean)
  };
}
// Home, About and Contact describe the business as a software company (ProfessionalService + LocalBusiness).
function jsonLd() {
  const s = getSettings();
  const data = {
    '@context': 'https://schema.org',
    '@type': ['ProfessionalService', 'LocalBusiness'],
    '@id': SITE_URL + '/#organization',
    ...orgBase(s),
    alternateName: BRAND_ALT_NAMES,
    description: 'MSME-registered custom software development company in Faridabad, Haryana: custom software, CRM and ERP development, AI automation, website development and digital marketing for businesses in Faridabad, Delhi NCR and across India.',
    slogan: BRAND.tagline,
    priceRange: 'Shared on a call',
    hasMap: 'https://maps.google.com/?q=' + encodeURIComponent(BRAND.mapQuery),
    founder: { '@type': 'Person', name: BRAND.founder, jobTitle: BRAND.founderRole, sameAs: [BRAND.linkedin] },
    areaServed: [{ '@type': 'City', name: 'Faridabad' }, { '@type': 'AdministrativeArea', name: 'Delhi NCR' }, { '@type': 'Country', name: 'India' }],
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '10:00', closes: '18:30' }],
    knowsAbout: SERVICE_PAGES.map(x => x.name),
    hasOfferCatalog: {
      '@type': 'OfferCatalog', name: 'Software development and digital services',
      itemListElement: SERVICE_PAGES.map(x => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: x.name, url: SITE_URL + '/services/' + x.slug } }))
    }
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
// WebSite schema (homepage only) tells Google the site name and its spelling variants.
const BRAND_ALT_NAMES = ['GoForge Digital', 'Go Forge Digital', 'Goforge'];
function websiteJsonLd() {
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE_URL + '/#website',
    name: BRAND.name, alternateName: [...BRAND_ALT_NAMES, 'goforgedigital.com'], url: SITE_URL + '/',
    publisher: { '@id': SITE_URL + '/#organization' }
  }).replace(/</g, '\\u003c');
}
// Training schema lives on /internship only.
function eduJsonLd() {
  const s = getSettings();
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'EducationalOrganization',
    '@id': SITE_URL + '/internship#training', ...orgBase(s), url: SITE_URL + '/internship',
    name: BRAND.name + ' Training & Internship',
    parentOrganization: { '@id': SITE_URL + '/#organization' },
    description: 'Live online training with an included internship in software engineering, AI/ML, data analytics, data science, full stack web development, business analysis and digital marketing.'
  }).replace(/</g, '\\u003c');
}
function serviceJsonLd(sp) {
  const url = SITE_URL + '/services/' + sp.slug;
  return JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'Service', name: sp.name, serviceType: sp.name, description: sp.desc, url,
      provider: { '@type': ['ProfessionalService', 'LocalBusiness'], '@id': SITE_URL + '/#organization', name: BRAND.name, url: SITE_URL + '/' },
      areaServed: [{ '@type': 'City', name: 'Faridabad' }, { '@type': 'AdministrativeArea', name: 'Delhi NCR' }, { '@type': 'Country', name: 'India' }],
      hasOfferCatalog: { '@type': 'OfferCatalog', name: sp.name, itemListElement: sp.modules.map(([n, d]) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n, description: d } })) } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: sp.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
  ]).replace(/</g, '\\u003c');
}

function courseJsonLd(p, offer, tracks = CAREER_TRACKS) {
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Course', name: p.name + ' training + internship', description: p.summary,
    url: SITE_URL + '/internship/programs/' + p.slug, inLanguage: 'en-IN',
    provider: { '@type': 'Organization', '@id': SITE_URL + '/#organization', name: BRAND.name, url: SITE_URL + '/' },
    educationalCredentialAwarded: 'Training certificate and internship letter',
    teaches: p.coversList.length ? p.coversList : undefined,
    syllabusSections: p.curriculumList.map(m => ({ '@type': 'Syllabus', name: (m.label ? m.label + ': ' : '') + m.title, description: m.topics.join('; ') })),
    // One CourseInstance and one Offer per programme length (ISO 8601 durations: P3M, P6M). Prices in INR, all-inclusive.
    hasCourseInstance: tracks.map(t => ({ '@type': 'CourseInstance', name: t.name, courseMode: 'Online', courseWorkload: t.iso,
      courseSchedule: { '@type': 'Schedule', duration: t.iso, repeatFrequency: 'Daily', repeatCount: 1 },
      location: { '@type': 'VirtualLocation', url: SITE_URL + '/internship/programs/' + p.slug } })),
    offers: tracks.map(t => ({ '@type': 'Offer', name: t.name, category: 'Paid', price: String(offer.priceOf(t)), priceCurrency: 'INR',
      availability: offer.registrationOpen ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      url: SITE_URL + '/internship/programs/' + p.slug }))
  }).replace(/</g, '\\u003c');
}
function faqJsonLd(faqList = visibleFaq(batch.nowMs())) {
  const entities = faqList.flatMap(group => group.items.map(item => ({
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
    const msg = 'Too many messages from this connection. Please try again in an hour. You can also call us.';
    if (wantsJson(req)) return res.status(429).json({ ok: false, message: msg });
    res.status(429).render('error', { ...pageMeta(req, 'Please wait', msg), code: 429, heading: 'Please wait a little', body: msg });
  }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false, skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).render('admin/login', { ...pageMeta(req, 'Admin login', 'Admin'), noindex: true, error: 'Too many attempts. Please wait 15 minutes and try again.', email: '' })
});

// ---------- public pages ----------
app.get('/', async (req, res) => {
  const t = await trustData();
  // Show the 100+/150+/98%/10+ stats block on the home page only.
  const stats = getSettings().show_home_stats === '0' ? [] : t.stats;
  res.render('home', { ...t, stats, ...pageMeta(req, 'Home',
    'Custom software, websites, CRM & ERP for businesses across Delhi NCR: Delhi, Noida, Gurugram, Ghaziabad and Faridabad. MSME registered, Sector 81 Faridabad.', { jsonld: jsonLd(), websiteLd: websiteJsonLd(), eventLd: res.locals.offer.webinar ? webinarJsonLd() : null, seoTitle: 'GoForge Digital – Custom Software Development Company in Delhi NCR | Faridabad' }), heroPhoto: true, scrollBanner: true });
});
app.get('/verify', async (req, res) => {
  const id = text(req.query.id).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  const { sampleDocs } = await trustData();
  res.render('verify', { certId: id, sampleDocs, ...pageMeta(req, 'Verify a certificate',
    'Verify a GoForge Digital training certificate or internship letter using the certificate ID printed on it.', { noindex: Boolean(id), seoTitle: 'Verify a Certificate or Internship Letter | GoForge Digital' }) });
});

app.get('/services', (req, res) => res.render('services', pageMeta(req, 'Services',
  'Software development services in Faridabad and Delhi NCR: custom software, CRM and ERP development, AI automation, website development, digital marketing, real estate CRM and school software.',
  { seoTitle: 'Software Development Services in Faridabad | CRM, ERP & Web | GoForge Digital' })));

app.get('/services/:slug', (req, res, next) => {
  const to = SERVICE_REDIRECTS[req.params.slug];
  if (to) return res.redirect(301, '/services/' + to);
  const service = SERVICE_PAGES.find(item => item.slug === req.params.slug);
  if (!service) return next();
  res.render('service', pageMeta(req, service.name, service.desc,
    { seoTitle: service.seoTitle, service, jsonld: serviceJsonLd(service), crumbs: [['Home', '/'], ['Services', '/services'], [service.name, '/services/' + service.slug]] }));
});

// Case study: factual description of the live site; no invented metrics or quotes.
function caseStudyJsonLd() {
  const url = SITE_URL + '/work/vaishnavi-associates';
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CreativeWork', '@id': url + '#work', url,
    name: 'Vaishnavi Associates website', headline: 'Vaishnavi Associates website: case study',
    description: 'GoForge Digital designed and built the website for Vaishnavi Associates, a real estate advisory in Faridabad.',
    image: SITE_URL + '/img/work/vaishnavi-associates.webp', inLanguage: 'en-IN', dateModified: '2026-10-18',
    creator: { '@id': SITE_URL + '/#organization' },
    about: { '@type': 'RealEstateAgent', name: 'Vaishnavi Associates', url: 'https://vaishnaviassociates.com/' }
  }).replace(/</g, '\\u003c');
}
app.get('/work/vaishnavi-associates', (req, res) => res.render('case-study', pageMeta(req, 'Vaishnavi Associates',
  'Case study: GoForge Digital designed and built the Vaishnavi Associates real estate website, with property pages, filters, an enquiry form and a responsive layout.',
  { seoTitle: 'Vaishnavi Associates Website: Case Study | GoForge Digital', jsonld: caseStudyJsonLd(), crumbs: [['Home', '/'], ['Work', '/work'], ['Vaishnavi Associates', '/work/vaishnavi-associates']] })));
app.get('/work', (req, res) => res.render('work', pageMeta(req, 'Work',
  'Portfolio of software, CRM, website and marketing projects delivered by GoForge Digital, Faridabad.',
  { seoTitle: 'Software & Website Projects | GoForge Digital, Faridabad' })));

const COLLEGES_DESC = 'Campus tie-ups and MoUs, workshops and bootcamps, faculty development programmes, bulk training and internship programmes for colleges in Faridabad, Delhi NCR and across India.';
app.get('/colleges', async (req, res) => res.render('colleges', {
  ...(await trustData()), values: {}, COLLEGE_INTERESTS, COLLEGE_SIZES,
  ...pageMeta(req, 'For colleges', COLLEGES_DESC, { seoTitle: 'College Partnerships: MoU, FDP & Internships | GoForge Digital' })
}));
app.post('/colleges', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'college', 'Thanks. Your enquiry has been sent.');
  const { errors, values } = validateCollege(req.body);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('colleges', { ...(await trustData()), errors, values, COLLEGE_INTERESTS, COLLEGE_SIZES, ...pageMeta(req, 'For colleges', COLLEGES_DESC) });
  }
  const msg = [values.designation && 'Designation: ' + values.designation, values.city && 'City: ' + values.city, values.size && 'Students: ' + values.size, values.message].filter(Boolean).join('\n') || '(no message)';
  await db.run("INSERT INTO contacts (name, business, phone, service, message, email, kind) VALUES (?, ?, ?, ?, ?, ?, 'college')",
    values.name, values.institution, values.phone, values.interest, msg, values.email || null);
  notifyLead({ title: 'college enquiry', name: values.name, adminUrl: SITE_URL + '/admin/colleges', replyTo: values.email,
    fields: [['Name', values.name], ['Institution', values.institution], ['Designation', values.designation], ['Phone', values.phone], ['Email', values.email], ['Interested in', values.interest], ['City', values.city], ['Students', values.size], ['Message', values.message]] });
  respondOk(req, res, 'college', 'Thanks, ' + values.name.split(' ')[0] + '. Your enquiry is saved. Our partnerships team will contact you within one working day.');
});

const COLLEGE_PACK_FILE = path.join(__dirname, 'assets', 'goforge-college-pack.pdf');
app.get('/colleges/pack.pdf', async (req, res) => {
  const s = getSettings();
  if (s.college_pack_pdf_url && /^https:\/\//.test(s.college_pack_pdf_url)) return res.redirect(302, s.college_pack_pdf_url);
  const f = await getFile('college_pack_pdf');
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'attachment; filename="goforge-college-pack.pdf"');
  if (f && f.data) return res.send(Buffer.from(f.data));
  res.sendFile(COLLEGE_PACK_FILE);
});

const COUNSEL_TIMES = ['Morning (10 AM to 1 PM)', 'Afternoon (1 PM to 4 PM)', 'Evening (4 PM to 6:30 PM)', 'Any time'];
// What a student wants from the call. The webinar option is only offered until the webinar ends,
// but older open forms may still send it, so validation accepts every option.
const COUNSEL_INTEREST_ALL = ['Joining the ' + batch.BATCH_LABEL, batch.WEBINAR.interest, 'Joining a later batch', 'Just exploring'];
function counselInterests(offer, batchLabel = batch.BATCH_LABEL) {
  const all = ['Joining the ' + batchLabel, batch.WEBINAR.interest, 'Joining a later batch', 'Just exploring'];
  return all.filter(o => (o !== batch.WEBINAR.interest || offer.webinar) && (o !== 'Joining the ' + batchLabel || offer.registrationOpen));
}
function validateCounsel(body, programs, { batchPrefs = batch.BATCH_PREFS, trackOptions = CAREER_TRACK_OPTIONS, interests = COUNSEL_INTEREST_ALL } = {}) {
  const errors = {}, values = {};
  field(errors, values, body, 'name', 'your name', { required: true, min: 2, max: 80 });
  phoneField(errors, values, body, 'phone', 'phone number');
  values.email = text(body.email);
  if (values.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email) || values.email.length > 120)) errors.email = 'Please enter a valid email address.';
  values.program = text(body.program);
  if (values.program && !programs.includes(values.program)) errors.program = 'Please choose from the list.';
  values.time = text(body.time);
  if (values.time && !COUNSEL_TIMES.includes(values.time)) errors.time = 'Please choose from the list.';
  values.track = text(body.track);
  if (values.track && !trackOptions.includes(values.track)) errors.track = 'Please choose from the list.';
  field(errors, values, body, 'college_req', 'your college requirement', { max: 160 });
  values.interest = text(body.interest);
  if (values.interest && !interests.includes(values.interest)) errors.interest = 'Please choose from the list.';
  values.batch = text(body.batch);
  if (values.batch && !batchPrefs.includes(values.batch)) errors.batch = 'Please choose from the list.';
  field(errors, values, body, 'referred_by', 'who referred you', { max: 80 });
  return { errors, values };
}
const trackFromQuery = slug => { const t = CAREER_TRACKS.find(x => x.slug === slug); return t ? careerTrackLabel(t) : ''; };
const interestFromQuery = (q, res) => q === 'webinar' && res.locals.offer.webinar ? batch.WEBINAR.interest : '';
app.get('/counselling', (req, res) => res.render('counselling', { values: { program: res.locals.TRACKS.includes(req.query.program) ? req.query.program : '', track: trackFromQuery(req.query.track), interest: interestFromQuery(req.query.interest, res) }, errors: {}, ...pageMeta(req, 'Book a free counselling call', 'Book a free counselling call with GoForge Digital about the training and internship programmes.') }));
app.post('/counselling', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'counselling', 'Thanks. Your request has been sent.');
  const { errors, values } = validateCounsel(req.body, res.locals.TRACKS, { batchPrefs: res.locals.BATCH_PREFS, trackOptions: res.locals.CAREER_TRACK_OPTIONS, interests: ['Joining the ' + res.locals.BATCH_LABEL, batch.WEBINAR.interest, 'Joining a later batch', 'Just exploring'] });
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    if (req.body.from === 'webinar') return res.status(422).render('webinar', { errors, values, ...pageMeta(req, 'Free webinar', 'Free webinar', { noindex: true }) });
    return res.status(422).render('counselling', { errors, values, ...pageMeta(req, 'Book a free counselling call', 'Counselling', { noindex: true }) });
  }
  const msg = ['Preferred time: ' + (values.time || 'Any time'), values.interest && 'Interested in: ' + values.interest, values.batch && 'Batch: ' + values.batch].filter(Boolean).join('\n');
  const quotedFee = quotedFeeFor(values.track, res.locals.CAREER_TRACKS);
  await db.run("INSERT INTO contacts (name, business, phone, service, message, email, track, college_req, referred_by, quoted_fee, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'counselling')",
    values.name, null, values.phone, values.program || 'Not sure yet', msg, values.email || null, values.track || null, values.college_req || null, values.referred_by || null, quotedFee);
  // A webinar sign-up only counts as one while the webinar is still ahead (older open forms may send it later).
  const isWebinar = values.interest === batch.WEBINAR.interest && res.locals.offer.webinar;
  notifyLead({ title: isWebinar ? 'free webinar sign-up' : 'counselling call request', name: values.name, adminUrl: SITE_URL + '/admin/counselling', replyTo: values.email,
    fields: [['Name', values.name], ['Phone', values.phone], ['Email', values.email], ['Interested in', values.interest], ['Programme', values.program || 'Not sure yet'], ['Preferred programme length', values.track || 'Not sure yet'],
      ['Preferred batch', values.batch], ['College requirement', values.college_req], ['Preferred time', values.time || 'Any time'], ['Referred by', values.referred_by], ['Quoted fee', quotedFee]] });
  if (isWebinar) return respondOk(req, res, 'counselling',
    'Thanks, ' + values.name.split(' ')[0] + '. Your free seat is saved for ' + batch.WEBINAR.date + ', ' + batch.WEBINAR.time + '. Join with the Google Meet link below.',
    null, { title: "You're registered", webinar: webinarReg() });
  respondOk(req, res, 'counselling', 'Thanks, ' + values.name.split(' ')[0] + '. Your counselling call request is saved. A counsellor will call you at your preferred time, usually within one working day.');
});

// ---------- free webinar: joining details for registrants only ----------
// The Meet link is never in res.locals or any public page. It is rendered only into the thank-you state of a
// successful webinar sign-up, and into a .ics served behind a signed, expiring link handed out in that same state.
const W = batch.WEBINAR;
const ICS_DAYS = 14;
const icsSig = ts => hmac('webinar-ics:' + ts).slice(0, 32);
function icsTokenOk(tok) {
  const m = String(tok || '').match(/^([a-z0-9]{6,12})\.([a-f0-9]{32})$/);
  if (!m) return false;
  const t = parseInt(m[1], 36), now = Date.now();
  if (!t || now - t > ICS_DAYS * 864e5 || t - now > 6e4) return false;
  return crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(icsSig(m[1])));
}
const webinarDetails = () => `Join on Google Meet: ${W.meetUrl}\n\n${W.points.map((p, i) => (i + 1) + '. ' + p).join('\n')}\n\nHost: ${W.host}, ${W.hostRole}. Free, live, about one hour.\n${SITE_URL}/webinar`;
function webinarReg() {
  const ts = Date.now().toString(36);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: W.title, dates: W.startUtc + '/' + W.endUtc, details: webinarDetails(), location: W.meetUrl, ctz: 'Asia/Kolkata' });
  return { meetUrl: W.meetUrl, gcal: 'https://calendar.google.com/calendar/render?' + q.toString(), ics: '/webinar.ics?t=' + ts + '.' + icsSig(ts) };
}
function webinarIcs() {
  const esc = v => String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = line => { const out = []; let rest = line; while (Buffer.byteLength(rest) > 74) { let n = 74; while (Buffer.byteLength(rest.slice(0, n)) > 74) n--; out.push(rest.slice(0, n)); rest = ' ' + rest.slice(n); } out.push(rest); return out.join('\r\n'); };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GoForge Digital//Webinar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:webinar-' + W.startUtc + '@goforgedigital.com', 'DTSTAMP:' + stamp, 'DTSTART:' + W.startUtc, 'DTEND:' + W.endUtc,
    'SUMMARY:' + esc(W.title), 'DESCRIPTION:' + esc(webinarDetails()), 'LOCATION:' + esc(W.meetUrl), 'URL:' + W.meetUrl,
    'ORGANIZER;CN=GoForge Digital:mailto:info@goforgedigital.com', 'STATUS:CONFIRMED', 'TRANSP:OPAQUE',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(W.title + ' starts in 30 minutes'), 'TRIGGER:-PT30M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
const WEBINAR_DESC = 'Free live webinar for college students, Sat 24 Oct 2026, 11 AM–12 PM IST on Google Meet: how to get an internship your college accepts, a live mini-project demo with AI tools, and Q&A. Hosted by Rohit Sharma, Founder, GoForge Digital.';
app.get('/webinar', (req, res) => res.render('webinar', { values: {}, errors: {}, ...pageMeta(req, 'Free webinar', WEBINAR_DESC, {
  seoTitle: 'Free Webinar: College-Accepted Internship + AI Tools for Your Career | GoForge Digital',
  eventLd: res.locals.offer.webinar ? webinarJsonLd() : null, noindex: !res.locals.offer.webinar,
  crumbs: [['Home', '/'], ['Training & internship', '/internship'], ['Free webinar', '/webinar']] }) }));
app.get('/webinar.ics', (req, res) => {
  res.set('X-Robots-Tag', 'noindex');
  if (!icsTokenOk(req.query.t)) return res.redirect(303, '/webinar');
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Disposition', 'attachment; filename="goforge-webinar-24-oct.ics"');
  res.type('text/calendar; charset=utf-8').send(webinarIcs());
});
// schema.org Event for home, /internship and /webinar, only while the webinar is ahead. The location and url are the
// public registration page (/webinar), never the meeting link.
function webinarJsonLd() {
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Event', name: W.title,
    description: 'A free, live one-hour webinar for college students: ' + W.points.join('; ') + '. Hosted by ' + W.host + ', ' + W.hostRole + '.',
    startDate: W.startIso, endDate: W.endIso,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', url: SITE_URL + '/webinar' },
    image: [SITE_URL + W.poster.base + '.jpg'],
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'INR', availability: 'https://schema.org/InStock', url: SITE_URL + '/webinar', validFrom: '2026-10-01T00:00:00+05:30' },
    organizer: { '@type': 'Organization', name: BRAND.name, url: SITE_URL + '/' },
    performer: { '@type': 'Person', name: W.host },
    url: SITE_URL + '/webinar', inLanguage: 'en-IN'
  }).replace(/</g, '\\u003c');
}

// ---------- lead magnet: track picker + college internship guide (PDF, gated by name + phone) ----------
// The PDF lives outside public/, so it is only served with a signed link that expires after GUIDE_DAYS.
// Source: scripts/guide/guide.html (rebuild with: node scripts/build-guide.js).
const GUIDE_FILE = path.join(__dirname, 'assets', 'goforge-track-picker-guide.pdf');
const GUIDE_NAME = 'Track picker + college internship guide';
const GUIDE_DAYS = 7;
const guideSig = ts => hmac('guide:' + ts).slice(0, 32);
const guideUrl = () => { const ts = Date.now().toString(36); return '/internship/guide.pdf?t=' + ts + '.' + guideSig(ts); };
function guideTokenOk(tok) {
  const m = String(tok || '').match(/^([a-z0-9]{6,12})\.([a-f0-9]{32})$/);
  if (!m) return false;
  const t = parseInt(m[1], 36), now = Date.now();
  if (!t || now - t > GUIDE_DAYS * 864e5 || t - now > 6e4) return false;
  return crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(guideSig(m[1])));
}
function validateGuide(body) {
  const errors = {}, values = {};
  field(errors, values, body, 'name', 'your name', { required: true, min: 2, max: 80 });
  phoneField(errors, values, body, 'phone', 'phone number');
  values.email = text(body.email);
  if (values.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email) || values.email.length > 120)) errors.email = 'Please enter a valid email address.';
  values.consent = body.consent ? 'yes' : '';
  if (!values.consent) errors.consent = 'Please agree so we can send the guide and contact you about it.';
  return { errors, values };
}
app.post('/guide', formLimiter, async (req, res) => {
  const ok = (message, url) => {
    if (wantsJson(req)) return res.render('partials/guide-next', { url }, (err, nextHtml) => res.json(err ? { ok: true, message } : { ok: true, message, nextHtml }));
    res.render('thanks', { ...pageMeta(req, 'Your guide', message), noindex: true, kind: 'guide', message, download: url });
  };
  res.set('Cache-Control', 'no-store');
  if (text(req.body.website)) return ok('Thanks. Your guide is ready.', guideUrl());
  const { errors, values } = validateGuide(req.body);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('error', { ...pageMeta(req, 'Please check the form', 'Guide'), noindex: true, code: 422, heading: 'Please check the form', body: Object.values(errors).join(' ') + ' Go back and try again.' });
  }
  await db.run("INSERT INTO contacts (name, business, phone, service, message, email, kind) VALUES (?, ?, ?, ?, ?, ?, 'guide')",
    values.name, null, values.phone, GUIDE_NAME, 'Downloaded the ' + GUIDE_NAME + ' (source: guide).', values.email || null);
  notifyLead({ title: 'guide download', name: values.name, adminUrl: SITE_URL + '/admin/guides', replyTo: values.email,
    fields: [['Name', values.name], ['Phone', values.phone], ['Email', values.email], ['Source', 'guide'], ['Downloaded', GUIDE_NAME]] });
  ok('Thanks, ' + values.name.split(' ')[0] + '. Your guide is ready to download.', guideUrl());
});
app.get('/internship/guide.pdf', async (req, res) => {
  const s = getSettings();
  if (s.guide_pdf_url && /^https:\/\//.test(s.guide_pdf_url)) return res.redirect(302, s.guide_pdf_url);
  const f = await getFile('guide_pdf');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('Content-Disposition', 'attachment; filename="goforge-track-picker-guide.pdf"');
  res.type('application/pdf');
  if (f && f.data) return res.send(Buffer.from(f.data));
  res.sendFile(GUIDE_FILE);
});

const SCHOOLS_DESC = 'GoForge Digital builds websites and school software for school offices.';
const schoolsMeta = req => pageMeta(req, 'For schools', SCHOOLS_DESC, { seoTitle: 'For schools | GoForge Digital', noindex: true, robots: 'noindex, follow' });
app.get('/schools', (req, res) => res.render('schools', { ...schoolsMeta(req) }));
app.post('/schools', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'school', 'Thanks. Your enquiry has been sent.');
  const { errors, values } = validateSchool(req.body);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('schools', { errors, values, ...schoolsMeta(req) });
  }
  const msg = [values.role && 'Role: ' + values.role, values.city && 'City: ' + values.city, values.size && 'Students: ' + values.size, values.message].filter(Boolean).join('\n') || '(no message)';
  await db.run("INSERT INTO contacts (name, business, phone, service, message, email, kind) VALUES (?, ?, ?, ?, ?, ?, 'school')",
    values.name, values.school, values.phone, values.interest, msg, values.email || null);
  notifyLead({ title: 'school enquiry', name: values.name, adminUrl: SITE_URL + '/admin/schools', replyTo: values.email,
    fields: [['Name', values.name], ['School', values.school], ['Role', values.role], ['Phone', values.phone], ['Email', values.email], ['Interested in', values.interest], ['City', values.city], ['Students', values.size], ['Message', values.message]] });
  respondOk(req, res, 'school', 'Thanks, ' + values.name.split(' ')[0] + '. Your enquiry is saved. Our schools team will contact you within one working day.');
});

async function trustData() {
  const [stats, credentials, instructors, testimonials, projects, gallery, samples] = await Promise.all([
    cms.listPublished('stats'), cms.listPublished('credentials'), cms.listPublished('instructors'), cms.listPublished('testimonials'),
    cms.listPublished('projects'), cms.listPublished('gallery'), cms.listPublished('samples')
  ]);
  const pick = kind => (samples.find(x => x.kind === kind) || {}).image_url;
  const sampleDocs = {
    certificate: pick('certificate') || '/img/samples/sample-certificate.webp',
    letter: pick('letter') || '/img/samples/sample-internship-letter.webp'
  };
  return { stats, credentials, instructors, projects, sampleDocs,
    gallery: gallery.filter(g => g.placement !== 'About only'), aboutGallery: gallery.filter(g => g.placement !== 'Internship only'), testimonials: testimonials.filter(t => t.kind !== 'client'), clientTestimonials: testimonials.filter(t => t.kind === 'client') };
}
const INTERNSHIP_DESC = '3-Month (₹2,999) and 6-Month (₹4,999) training + internship programmes for college students and graduates, live online: software, AI/ML, data, web, business analysis and digital marketing. ' + batch.BATCH_SUMMARY + '. Verifiable certificates.';
app.get('/internship', async (req, res) => res.render('internship', {
  heroPhoto: true,
  values: { track: (t => res.locals.TRACKS.includes(t) ? t : '')(req.query.track === 'Web Developer' ? 'Full Stack Web Development' : req.query.track) },
  ...(await trustData()),
  ...pageMeta(req, 'Training & internship', res.locals.CAREER_TRACKS[0].name + ' (' + batch.inr(res.locals.CAREER_TRACKS[0].price) + ') and ' + res.locals.CAREER_TRACKS[1].name + ' (' + batch.inr(res.locals.CAREER_TRACKS[1].price) + ') training + internship programmes, live online. ' + res.locals.BATCH_SUMMARY + '. Verifiable certificates.', { seoTitle: 'Internship with Training for Students — ' + res.locals.BATCH_LABEL.replace(/^./, c => c.toUpperCase()) + ' | GoForge Digital', jsonld: eduJsonLd(), eventLd: res.locals.offer.webinar ? webinarJsonLd() : null, training: true })
}));

app.get('/internship/programs/web-developer', (req, res) => res.redirect(301, '/internship/programs/full-stack-web-development'));
app.get('/internship/programs/:slug', async (req, res, next) => {
  const program = await cms.programBySlug(req.params.slug, getSettings());
  if (!program) return next();
  const { instructors, credentials, stats } = await trustData();
  const t0 = res.locals.CAREER_TRACKS[0], t1 = res.locals.CAREER_TRACKS[1];
  res.render('program', {
    program, instructors, credentials, stats, counselProgram: program.name,
    values: { track: program.name },
    ...pageMeta(req, program.name + ' training + internship',
      program.name + ' training + internship at GoForge Digital: ' + t0.name + ' (' + batch.inr(t0.price) + ') or ' + t1.name + ' (' + batch.inr(t1.price) + '), live online. Curriculum, tools, projects and the ' + res.locals.BATCH_SUMMARY + '.',
      { seoTitle: program.name + ' Training with Internship — ' + res.locals.BATCH_LABEL + ' | GoForge Digital', jsonld: courseJsonLd(program, res.locals.offer, res.locals.CAREER_TRACKS), crumbs: [['Home', '/'], ['Training & internship', '/internship'], [program.name, '/internship/programs/' + program.slug]] })
  });
});
// Old role pages moved to programme pages.
app.get('/internship/roles/:slug', (req, res) => res.redirect(301, '/internship/programs/' + encodeURIComponent(req.params.slug)));

app.get('/internship/overview', (req, res) => res.render('overview', pageMeta(req, 'Programme overview',
  'Printable overview of the GoForge Digital training + internship programme for students and college training cells.',
  { seoTitle: 'Training + Internship Programme Overview | GoForge Digital', crumbs: [['Home', '/'], ['Training & internship', '/internship'], ['Programme overview', '/internship/overview']] })));

app.get('/internship/overview.pdf', async (req, res, next) => {
  try {
    const L = res.locals;
    const creds = await cms.listPublished('credentials');
    const msme = creds.find(c => /msme|udyam/i.test(c.title + ' ' + (c.issuer || '')) && c.number);
    const buf = await programmePdf({
      settings: getSettings(),
      brand: { ...BRAND, email: getSettings().email, udyam: msme ? msme.number : '' },
      lengths: L.CAREER_TRACKS,
      batch: { open: !!L.offer.registrationOpen, summary: L.BATCH_SUMMARY, schedules: L.BATCHES, seatCap: L.SEAT_CAP },
      tracks: L.PROGRAMS.map(p => ({ name: p.name, summary: p.summary, tools: p.toolsList, project: p.project || '' }))
    });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="goforge-internship-overview.pdf"');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buf);
  } catch (err) {
    console.error('[overview.pdf]', err);
    res.set('X-Pdf-Error', String(err && err.message || err).replace(/[^\x20-\x7e]/g, ' ').slice(0, 160));
    next(err);
  }
});

// Mentors (from Admin > Mentors) and a short blog (lib/blog.js).
app.get('/mentors', async (req, res) => res.render('mentors', {
  instructors: await cms.listPublished('instructors'),
  ...pageMeta(req, 'Mentors', 'Meet the mentors who teach and review student work in the GoForge Digital training and internship programmes.',
    { seoTitle: 'Mentors: Learn from People Who Do the Work | GoForge Digital', crumbs: [['Home', '/'], ['Training & internship', '/internship'], ['Mentors', '/mentors']] })
}));
app.get('/blog', (req, res) => res.render('blog', {
  POSTS: blog.POSTS,
  ...pageMeta(req, 'Blog', 'Short, practical guides for students and colleges: Git basics, verifiable internship letters, and choosing a programme or track.',
    { seoTitle: 'Blog: Guides for Students and Colleges | GoForge Digital' })
}));
app.get('/blog/:slug', (req, res, next) => {
  const post = blog.bySlug(req.params.slug);
  if (!post) return next();
  res.render('post', {
    post,
    ...pageMeta(req, post.title, post.summary, { seoTitle: post.title + ' | GoForge Digital', crumbs: [['Home', '/'], ['Blog', '/blog'], [post.title, '/blog/' + post.slug]] })
  });
});

app.get('/faq', (req, res) => res.render('faq', pageMeta(req, 'FAQ',
  'Answers for students and clients: how the internship works, certificates and college recognition, the letter, how projects are chosen, and how client work is priced.',
  { seoTitle: 'FAQ: Training, Internship & Projects | GoForge Digital', jsonld: faqJsonLd(res.locals.FAQ) })));

app.get('/about', async (req, res) => {
  const { credentials, aboutGallery } = await trustData();
  res.render('about', { credentials, gallery: aboutGallery, ...pageMeta(req, 'About',
    'GoForge Digital is an MSME-registered custom software development company in Sector 81, Faridabad, building software, CRM, ERP and websites, led by Rohit Sharma, Founder & Director.',
    { seoTitle: 'About GoForge Digital | Software Development Company, Faridabad', jsonld: jsonLd() }) });
});

app.get('/contact', (req, res) => res.render('contact', { values: { service: CONTACT_SERVICES.includes(req.query.service) ? req.query.service : '' }, ...pageMeta(req, 'Contact',
  'Call, email or visit GoForge Digital at Puri Highstreet, Sector 81, Faridabad. Office hours Monday to Saturday.',
  { seoTitle: 'Contact GoForge Digital | Sector 81, Faridabad, Haryana', jsonld: jsonLd() }) }));

app.get('/privacy', (req, res) => res.render('legal', pageMeta(req, 'Privacy',
  'Privacy notice for GoForge Digital: what the enquiry and internship forms collect, why, and how to ask for a correction or deletion.',
  { seoTitle: 'Privacy notice | GoForge Digital', kind: 'privacy' })));

app.get('/terms', (req, res) => res.render('legal', pageMeta(req, 'Terms',
  'Terms for using the GoForge Digital website, asking for a project, and applying to the internship.',
  { seoTitle: 'Terms of use | GoForge Digital', kind: 'terms' })));

app.get('/refund', (req, res) => res.render('legal', pageMeta(req, 'Refunds',
  'Refund policy for GoForge Digital training programmes and client projects.',
  { seoTitle: 'Refund policy | GoForge Digital', kind: 'refund' })));

app.post('/contact', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'contact', 'Thanks. Your message has been sent.');
  const { errors, values } = validateContact(req.body);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('contact', { ...pageMeta(req, 'Contact', 'Contact GoForge Digital'), errors, values });
  }
  (await db.run('INSERT INTO contacts (name, business, phone, service, message) VALUES (?, ?, ?, ?, ?)', values.name, values.business || null, values.phone, values.service || null, values.message));
  notifyLead({ title: 'project enquiry', name: values.name, adminUrl: SITE_URL + '/admin/contacts',
    fields: [['Name', values.name], ['Business', values.business], ['Phone', values.phone], ['Service', values.service], ['Message', values.message]] });
  respondOk(req, res, 'contact', 'Thanks, ' + values.name.split(' ')[0] + '. Your message is saved and we will reply soon.');
});

app.post('/internship', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'internship', 'Thanks. Your application has been sent.');
  if (req.body && req.body.track === 'Web Developer') req.body.track = 'Full Stack Web Development';
  const { errors, values } = validateApplication(req.body, res.locals.TRACKS, res.locals.BATCH_PREFS);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('internship', { ...(await trustData()), ...pageMeta(req, 'Training & internship', INTERNSHIP_DESC), errors, values });
  }
  const groupUrl = await cms.whatsappGroupFor(values.track);
  const quotedFee = quotedFeeFor(null, res.locals.CAREER_TRACKS);
  (await db.run('INSERT INTO applications (full_name, college, course_year, whatsapp, track, note, email, city, mode, schedule, source, referred_by, consent, group_link_shown, quoted_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', values.full_name, values.college, values.course_year, values.phone, values.track, values.note || null, values.email || null, values.city || null, values.mode || null, values.schedule || null, values.source || null, values.referred_by || null, 1, groupUrl ? 1 : 0, quotedFee));
  notifyLead({ title: 'internship application', name: values.full_name, adminUrl: SITE_URL + '/admin/applications', replyTo: values.email,
    fields: [['Name', values.full_name], ['Programme', values.track], ['College', values.college], ['Course / year', values.course_year], ['Phone', values.phone], ['Email', values.email], ['City', values.city], ['Mode', values.mode], ['Schedule', values.schedule], ['Heard about us', values.source], ['Referred by', values.referred_by], ['Quoted fee', quotedFee], ['Note', values.note]] });
  // The group link is only ever sent in this response, after the application is saved.
  respondOk(req, res, 'internship', 'Thanks, ' + values.full_name.split(' ')[0] + '. Your application is saved. We will contact you soon.', groupUrl ? { url: groupUrl, program: values.track } : null);
});

function respondOk(req, res, kind, message, group = null, opts = {}) {
  if (group || opts.webinar) res.set('Cache-Control', 'no-store');
  if (wantsJson(req)) {
    if (opts.webinar) return res.render('partials/webinar-next', { reg: opts.webinar }, (err, nextHtml) => res.json(err ? { ok: true, message, title: opts.title } : { ok: true, message, title: opts.title, nextHtml }));
    if (!group) return res.json({ ok: true, message });
    // Rendered server-side so no invite link or card markup sits in the public form page.
    return res.render('partials/group-card', { group }, (err, nextHtml) => res.json(err ? { ok: true, message } : { ok: true, message, nextHtml }));
  }
  res.render('thanks', { ...pageMeta(req, opts.title || 'Sent', message), noindex: true, kind, message, group, heading: opts.title, reg: opts.webinar });
}

app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /uploads/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`));
// Priorities put the business pages first. lastmod is the date the page content last changed
// (SITE_UPDATED, bump when copy changes) rather than the request date.
const SITE_UPDATED = '2026-11-28';
// The January 2027 batch update changed training pages, home, FAQ, colleges and verify on 2026-11-25.
// Every page changed on 2026-10-18 (address PIN in the footer, new work section), so unchanged pages share SITE_UPDATED.
// Add a path here when only that page changes later, e.g. { '/faq': '2026-12-01' }.
const PAGE_UPDATED = { '/counselling': '2026-11-28', '/mentors': '2026-11-28', '/blog': '2026-11-28', '/contact': '2026-11-28', '/': '2026-11-25', '/internship': '2026-11-25', '/faq': '2026-11-25', '/colleges': '2026-11-25', '/about': '2026-10-19', '/internship/overview': '2026-11-25', '/verify': '2026-11-25' };
app.get('/sitemap.xml', (req, res) => {
  const pages = [['/', '1.0'], ['/services', '0.9']]
    .concat(SERVICE_PAGES.map(item => ['/services/' + item.slug, '0.9']))
    .concat([['/work', '0.8'], ['/work/vaishnavi-associates', '0.6'], ['/about', '0.7'], ['/contact', '0.7'], ['/counselling', '0.7'], ['/mentors', '0.5'], ['/blog', '0.5'], ['/internship', '0.6'], ['/colleges', '0.6'], ['/faq', '0.5'], ['/verify', '0.5'], ['/internship/overview', '0.4']])
    .concat(blog.POSTS.map(item => ['/blog/' + item.slug, '0.4']))
    .concat(res.locals.PROGRAMS.map(item => ['/internship/programs/' + item.slug, '0.5']))
    .concat(res.locals.offer.webinar ? [['/webinar', '0.6']] : [])
    .concat([['/privacy', '0.3'], ['/terms', '0.3'], ['/refund', '0.3']]);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p, pr]) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${PAGE_UPDATED[p] || (p.startsWith('/blog/') ? '2026-11-28' : p.startsWith('/internship/programs/') ? '2026-11-25' : SITE_UPDATED)}</lastmod><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
});
app.get('/js/analytics.js', (req, res) => {
  if (!GA_ID) return res.status(404).type('text').send('');
  res.type('application/javascript').set('Cache-Control', 'public, max-age=3600').send(
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{anonymize_ip:true});`
  );
});
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'favicon-32.png')));
if (uploadMode === 'local') {
  app.use('/uploads', express.static(UPLOAD_DIR, { index: false, maxAge: '30d', setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); } }));
}
app.get('/healthz', (req, res) => res.type('text').send('ok'));

// ---------- admin ----------
async function clearSession(req, res) {
  if (req.cookies.gf_sid) (await db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(req.cookies.gf_sid)));
  res.clearCookie('gf_sid', { path: '/' });
}
async function loadAdmin(req, res, next) {
  const token = req.cookies.gf_sid;
  if (token) {
    const row = (await db.get('SELECT a.id, a.email, s.expires_at FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?', sha256(token)));
    if (row && row.expires_at > Date.now()) { req.admin = row; res.locals.admin = row; }
  }
  next();
}
async function requireAdmin(req, res, next) {
  if (!req.admin) return res.redirect(303, '/admin/login');
  res.set('Cache-Control', 'no-store');
  res.locals.noindex = true;
  res.locals.newCounts = {
    contacts: (await db.get("SELECT COUNT(*) n FROM contacts WHERE status = 'New' AND kind NOT IN ('college', 'school', 'counselling', 'guide')")).n,
    guides: (await db.get("SELECT COUNT(*) n FROM contacts WHERE status = 'New' AND kind = 'guide'")).n,
    schools: (await db.get("SELECT COUNT(*) n FROM contacts WHERE status = 'New' AND kind = 'school'")).n,
    colleges: (await db.get("SELECT COUNT(*) n FROM contacts WHERE status = 'New' AND kind = 'college'")).n,
    counselling: (await db.get("SELECT COUNT(*) n FROM contacts WHERE status = 'New' AND kind = 'counselling'")).n,
    applications: (await db.get("SELECT COUNT(*) n FROM applications WHERE status = 'New'")).n
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
  const user = (await db.get('SELECT * FROM admins WHERE email = ?', email));
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !valid) {
    res.status(401);
    return res.render('admin/login', { ...pageMeta(req, 'Admin login', 'Admin'), noindex: true, error: 'That email and password do not match.', email });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  (await db.run('DELETE FROM sessions WHERE expires_at < ?', now));
  (await db.run('INSERT INTO sessions (token_hash, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)', sha256(token), user.id, now, now + SESSION_DAYS * 864e5));
  (await db.run("UPDATE admins SET last_login_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?", user.id));
  res.cookie('gf_sid', token, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/', maxAge: SESSION_DAYS * 864e5 });
  res.redirect(303, '/admin');
});
app.post('/admin/logout', async (req, res) => { await clearSession(req, res); res.redirect(303, '/admin/login'); });

app.get('/admin', requireAdmin, (req, res) => res.redirect(303, '/admin/contacts'));

const INBOXES = {
  contacts: {
    table: 'contacts', title: 'Project enquiries', base: "kind NOT IN ('college', 'school', 'counselling', 'guide')", search: ['name', 'business', 'phone', 'service', 'message']
  },
  colleges: {
    table: 'contacts', title: 'College enquiries', base: "kind = 'college'", search: ['name', 'business', 'phone', 'service', 'message', 'email']
  },
  schools: {
    table: 'contacts', title: 'School enquiries', base: "kind = 'school'", search: ['name', 'business', 'phone', 'service', 'message', 'email']
  },
  counselling: {
    table: 'contacts', title: 'Counselling calls', base: "kind = 'counselling'", search: ['name', 'phone', 'service', 'message', 'email', 'track', 'college_req', 'referred_by']
  },
  guides: {
    table: 'contacts', title: 'Guide downloads', base: "kind = 'guide'", search: ['name', 'phone', 'email', 'message']
  },
  applications: {
    table: 'applications', title: 'Internship applications', search: ['full_name', 'college', 'course_year', 'whatsapp', 'track', 'note', 'email', 'city', 'referred_by']
  }
};
const PAGE_SIZE = 25;
for (const [slug, cfg] of Object.entries(INBOXES)) {
  app.get(`/admin/${slug}`, requireAdmin, async (req, res) => {
    const q = text(req.query.q).slice(0, 100);
    const status = STATUSES.includes(req.query.status) ? req.query.status : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const where = cfg.base ? [cfg.base] : [], params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (q) {
      const like = '%' + q.replace(/[\\%_]/g, m => '\\' + m) + '%';
      where.push('(' + cfg.search.map(c => `${c} LIKE ? ESCAPE '\\'`).join(' OR ') + ')');
      cfg.search.forEach(() => params.push(like));
    }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (await db.get(`SELECT COUNT(*) n FROM ${cfg.table} ${w}`, ...params)).n;
    const rows = (await db.all(`SELECT * FROM ${cfg.table} ${w} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, ...params, PAGE_SIZE, (page - 1) * PAGE_SIZE));
    const counts = Object.fromEntries(await Promise.all(STATUSES.map(async st => [st, (await db.get(`SELECT COUNT(*) n FROM ${cfg.table} WHERE status = ?${cfg.base ? ' AND ' + cfg.base : ''}`, st)).n])));
    res.render('admin/inbox', {
      ...pageMeta(req, cfg.title, 'Admin'), slug, cfg, rows, q, status, page, total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), counts, flash: req.query.saved === 'fee' ? 'Quoted fee saved.' : (req.query.saved ? 'Status updated.' : null)
    });
  });
  app.post(`/admin/${slug}/:id/status`, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const st = req.body.status;
    if (!STATUSES.includes(st) || !id) return res.status(400).type('text').send('Invalid status.');
    (await db.run(`UPDATE ${cfg.table} SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`, st, id));
    const back = new URLSearchParams();
    if (req.body.q) back.set('q', text(req.body.q).slice(0, 100));
    if (STATUSES.includes(req.body.f)) back.set('status', req.body.f);
    if (parseInt(req.body.page, 10) > 1) back.set('page', String(parseInt(req.body.page, 10)));
    back.set('saved', '1');
    res.redirect(303, `/admin/${slug}?${back}#item-${id}`);
  });
}

for (const [slug, cfg] of Object.entries(INBOXES)) {
  if (cfg.table !== 'applications' && slug !== 'counselling') continue;
  app.post(`/admin/${slug}/:id/quoted-fee`, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).type('text').send('Invalid item.');
    const quoted = text(req.body.quoted_fee).slice(0, 80);
    if (quoted && quoted.length > 80) return res.status(400).type('text').send('Quoted fee is too long.');
    const where = cfg.base ? ' AND ' + cfg.base : '';
    await db.run(`UPDATE ${cfg.table} SET quoted_fee = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?${where}`, quoted || null, id);
    const back = new URLSearchParams();
    if (req.body.q) back.set('q', text(req.body.q).slice(0, 100));
    if (STATUSES.includes(req.body.f)) back.set('status', req.body.f);
    if (parseInt(req.body.page, 10) > 1) back.set('page', String(parseInt(req.body.page, 10)));
    back.set('saved', 'fee');
    res.redirect(303, `/admin/${slug}?${back}#item-${id}`);
  });
}

const pdfUploadFields = pdfUpload.fields([{ name: 'guide_pdf_file', maxCount: 1 }, { name: 'college_pack_pdf_file', maxCount: 1 }]);
function maybeUploadSettings(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  return pdfUploadFields(req, res, err => {
    if (err) { req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'Please upload a PDF under 4 MB.' : 'The PDF upload could not be read.'; req.body = req.body || {}; }
    csrfAfterUpload(req, res, next);
  });
}
async function settingsPdfStatus(s) {
  const keys = await listFileKeys();
  const label = (url, dbKey) => (url && /^https:\/\//.test(url)) ? 'Custom URL' : (keys.has(dbKey) ? 'Uploaded PDF (DB)' : 'Built-in PDF');
  return { guide: label(s.guide_pdf_url, 'guide_pdf'), collegePack: label(s.college_pack_pdf_url, 'college_pack_pdf') };
}
app.get('/admin/settings', requireAdmin, async (req, res) => {
  const cur = getSettings();
  res.render('admin/settings', { ...pageMeta(req, 'Site settings', 'Admin'), values: cur, errors: {}, pdfStatus: await settingsPdfStatus(cur), uploadMode, flash: req.query.saved ? 'Saved. The public site now shows these details.' : null });
});
app.post('/admin/settings', requireAdmin, maybeUploadSettings, async (req, res) => {
  const cur = getSettings();
  const body = req.body || {};
  const errors = {}, values = {};
  const isV2 = Boolean(body._settings_v2);
  phoneField(errors, values, body, 'phone1', 'first phone number');
  phoneField(errors, values, body, 'phone2', 'second phone number');
  values.email = text(body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email) || values.email.length > 120) errors.email = 'Please enter a valid email address.';
  values.linkedin_company = text(body.linkedin_company);
  if (values.linkedin_company && (!/^https:\/\/(www\.)?linkedin\.com\/company\/[A-Za-z0-9_\-%.]+\/?$/.test(values.linkedin_company) || values.linkedin_company.length > 200)) errors.linkedin_company = 'Please enter a LinkedIn company page URL, for example https://www.linkedin.com/company/143989208';
  for (const k of ['blurb1', 'blurb2', 'blurb3', 'blurb4']) field(errors, values, body, k, 'the service line', { required: true, min: 10, max: 220 });
  field(errors, values, body, 'intern_training', 'the training length', { required: true, max: 40 });
  field(errors, values, body, 'intern_work', 'the internship length', { required: true, max: 40 });
  field(errors, values, body, 'intern_fee', 'the fee line', { required: true, max: 80 });

  // Seat cap (optional on legacy posts)
  let cap = Math.max(1, parseInt(cur.seat_cap, 10) || batch.SEAT_CAP);
  if (body.seat_cap !== undefined) {
    const sc = text(body.seat_cap);
    if (!/^\d{1,3}$/.test(sc) || Number(sc) < 1 || Number(sc) > 999) errors.seat_cap = 'Enter a whole number from 1 to 999.';
    else { cap = Number(sc); values.seat_cap = String(cap); }
  }
  for (const k of ['seats_weekday', 'seats_weekend']) {
    const v = text(body[k]) || '0';
    values[k] = v;
    if (!/^\d{1,3}$/.test(v) || Number(v) > cap) errors[k] = 'Enter a whole number from 0 to ' + cap + '.';
    else values[k] = String(Number(v));
  }

  // New text fields (preserve current value when omitted by legacy API/smoke POSTs)
  const textDefs = [
    ['batch_label', 'batch name', 60, true],
    ['batch_starts', 'batch start date', 60, true],
    ['batch_first_weekend', 'first weekend class date', 60, true],
    ['batch_deadline', 'registration deadline', 60, true],
    ['batch_weekday_timing', 'weekday timings', 100, true],
    ['batch_weekend_timing', 'weekend timings', 100, true],
    ['schedule_note', 'schedule note', 300, true],
    ['track_3m_label', '3-month label', 60, true],
    ['track_6m_label', '6-month label', 60, true],
    ['fee_note', 'fee note', 300, true],
    ['price_value_line', 'price value line', 160, false],
    ['scroll_banner_text', 'scroll banner text', 90, false],
    ['tax_note', 'tax note', 80, false],
    ['google_rating', 'Google rating', 10, true],
    ['google_badge_text', 'Google badge text', 80, true],
    ['kit_heading', 'kit heading', 120, true],
    ['kit_intro', 'kit intro', 300, true],
    ['proof_heading', 'proof heading', 120, true],
    ['proof_intro', 'proof intro', 360, true]
  ];
  for (const [k, label, max, reqd] of textDefs) {
    if (body[k] !== undefined) field(errors, values, body, k, label, { required: reqd, max });
  }
  for (const pk of ['track_3m_price', 'track_6m_price']) {
    if (body[pk] !== undefined) {
      const pv = text(body[pk]);
      values[pk] = pv;
      if (!/^\d{1,6}$/.test(pv) || Number(pv) < 1) errors[pk] = 'Enter a positive whole rupee amount.';
      else values[pk] = String(Number(pv));
    }
  }
  const boolKeys = ['show_home_stats', 'show_google_badge', 'prog_show_curriculum', 'prog_show_tools', 'prog_show_batches', 'prog_show_fees'];
  if (isV2) {
    for (const bk of boolKeys) values[bk] = body[bk] ? '1' : '0';
  }

  // Optional PDF URL overrides
  for (const uk of ['guide_pdf_url', 'college_pack_pdf_url']) {
    if (body[uk] !== undefined) {
      const uv = text(body[uk]);
      values[uk] = uv;
      if (uv && (!/^https:\/\//.test(uv) || uv.length > 400)) errors[uk] = 'Paste a full https:// PDF link, or leave empty.';
    }
  }
  // Optional PDF uploads (Vercel Blob if configured, else Turso files table)
  const pdfJobs = [];
  for (const [fieldKey, dbKey, urlKey, defName] of [
    ['guide_pdf_file', 'guide_pdf', 'guide_pdf_url', 'goforge-track-picker-guide.pdf'],
    ['college_pack_pdf_file', 'college_pack_pdf', 'college_pack_pdf_url', 'goforge-college-pack.pdf']
  ]) {
    const resetKey = dbKey + '_reset';
    if (body[resetKey]) {
      values[urlKey] = '';
      pdfJobs.push(() => deleteFile(dbKey));
    }
    const f = req.files && req.files[fieldKey] && req.files[fieldKey][0];
    if (req.uploadError && !f) errors[fieldKey] = req.uploadError;
    if (f) {
      const out = await storePdf(f, dbKey, defName);
      if (out.error) errors[fieldKey] = out.error;
      else if (out.url) { values[urlKey] = out.url; pdfJobs.push(() => deleteFile(dbKey)); }
      else if (out.buffer) { values[urlKey] = ''; pdfJobs.push(() => saveFile(dbKey, defName, 'application/pdf', out.buffer)); }
    }
  }

  if (Object.keys(errors).length) {
    return res.status(422).render('admin/settings', { ...pageMeta(req, 'Site settings', 'Admin'), values: { ...cur, ...values }, errors, pdfStatus: await settingsPdfStatus(cur), uploadMode, flash: null });
  }
  for (const job of pdfJobs) await job();
  await saveSettings(values);
  res.redirect(303, '/admin/settings?saved=1');
});

// ---------- admin: programme WhatsApp groups ----------
function groupPrograms(res) { return res.locals.PROGRAMS.map(p => p.name); }
app.get('/admin/whatsapp-groups', requireAdmin, async (req, res) => {
  res.render('admin/whatsapp-groups', { ...pageMeta(req, 'WhatsApp groups', 'Admin'), programs: groupPrograms(res), values: await cms.whatsappGroups(), errors: {}, flash: req.query.saved ? 'Saved. New applicants now see these links after they apply.' : null });
});
app.post('/admin/whatsapp-groups', requireAdmin, async (req, res) => {
  const programs = groupPrograms(res);
  const errors = {}, values = {};
  programs.forEach((name, i) => {
    const url = text(req.body['g' + i]).slice(0, 300);
    values[name] = url;
    if (url && !cms.WA_GROUP_RE.test(url)) errors['g' + i] = 'Paste a WhatsApp group invite link that starts with https://chat.whatsapp.com/';
  });
  if (Object.keys(errors).length) {
    return res.status(422).render('admin/whatsapp-groups', { ...pageMeta(req, 'WhatsApp groups', 'Admin'), programs, values, errors, flash: null });
  }
  await cms.saveWhatsappGroups(values);
  res.redirect(303, '/admin/whatsapp-groups?saved=1');
});

app.get('/admin/password', requireAdmin, (req, res) => {
  res.render('admin/password', { ...pageMeta(req, 'Change password', 'Admin'), errors: {}, flash: req.query.saved ? 'Password changed. Other sessions were signed out.' : null });
});
app.post('/admin/password', requireAdmin, async (req, res) => {
  const errors = {};
  const current = String(req.body.current || '').slice(0, 200);
  const next1 = String(req.body.new_password || '').slice(0, 200);
  const next2 = String(req.body.confirm || '').slice(0, 200);
  const user = (await db.get('SELECT * FROM admins WHERE id = ?', req.admin.id));
  if (!(await bcrypt.compare(current, user.password_hash))) errors.current = 'The current password is not correct.';
  if (next1.length < 12) errors.new_password = 'Use at least 12 characters.';
  else if (next1 === current) errors.new_password = 'Choose a password different from the current one.';
  if (next1 !== next2) errors.confirm = 'The two new passwords do not match.';
  if (Object.keys(errors).length) return res.status(422).render('admin/password', { ...pageMeta(req, 'Change password', 'Admin'), errors, flash: null });
  (await db.run("UPDATE admins SET password_hash = ?, password_changed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?", await bcrypt.hash(next1, BCRYPT_COST), user.id));
  (await db.run('DELETE FROM sessions WHERE admin_id = ? AND token_hash != ?', user.id, sha256(req.cookies.gf_sid)));
  res.redirect(303, '/admin/password?saved=1');
});

// ---------- admin: content (programmes, instructors, stats, testimonials, badges) ----------
function entityOf(req, res, next) {
  const cfg = cms.ENTITIES[req.params.entity];
  if (!cfg) return next('route');
  req.entity = req.params.entity; req.cfg = cfg;
  next();
}
const imageFields = cfg => cfg.fields.filter(f => f.type === 'image');
function renderEdit(req, res, { item, values, errors = {}, status = 200 }) {
  res.status(status).render('admin/cms-edit', {
    ...pageMeta(req, (item ? 'Edit ' : 'New ') + req.cfg.singular, 'Admin'),
    entity: req.entity, cfg: req.cfg, item, values, errors, uploadMode,
    flash: req.query.saved ? 'Saved.' : null
  });
}
app.get('/admin/:entity', requireAdmin, entityOf, async (req, res) => {
  res.render('admin/cms-list', {
    ...pageMeta(req, req.cfg.title, 'Admin'), entity: req.entity, cfg: req.cfg, rows: await cms.listAll(req.entity),
    flash: req.query.deleted ? 'Deleted.' : (req.query.saved ? 'Saved.' : null)
  });
});
app.get('/admin/:entity/new', requireAdmin, entityOf, (req, res) => {
  const values = { published: 1, sort_order: 100 };
  renderEdit(req, res, { item: null, values });
});
app.get('/admin/:entity/:id', requireAdmin, entityOf, async (req, res, next) => {
  const item = await cms.getById(req.entity, parseInt(req.params.id, 10) || 0);
  if (!item) return next();
  renderEdit(req, res, { item, values: item });
});
const uploadFields = upload.fields(['photo_url', 'image_url'].map(name => ({ name: name + '_file', maxCount: 1 })));
function runUpload(req, res, next) {
  uploadFields(req, res, err => {
    if (err) { req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'Please use an image under 2 MB.' : 'The upload could not be read.'; req.body = req.body || {}; }
    next();
  });
}
async function saveEntity(req, res, id) {
  const item = id ? await cms.getById(req.entity, id) : null;
  if (id && !item) return res.status(404).type('text').send('Not found.');
  const { errors, values } = cms.validate(req.entity, req.body || {}, text);
  for (const f of imageFields(req.cfg)) {
    if (req.uploadError) { errors[f.name] = req.uploadError; continue; }
    const file = req.files && req.files[f.name + '_file'] && req.files[f.name + '_file'][0];
    if (file) {
      try {
        const out = await storeImage(file, req.entity);
        if (out.error) errors[f.name] = out.error; else if (out.url) { values[f.name] = out.url; delete errors[f.name]; }
      } catch (e) { console.error('[goforge] upload failed', e); errors[f.name] = 'The upload failed. Try again, or paste an image link.'; }
    }
    if (req.body[f.name + '_remove']) values[f.name] = '';
  }
  if (Object.keys(errors).length) return renderEdit(req, res, { item, values, errors, status: 422 });
  try {
    const newId = await cms.save(req.entity, id, values);
    res.redirect(303, `/admin/${req.entity}/${newId}?saved=1`);
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) return renderEdit(req, res, { item, values, errors: { slug: 'Another programme already uses this slug.' }, status: 422 });
    throw e;
  }
}
app.post('/admin/:entity/new', requireAdmin, entityOf, runUpload, csrfAfterUpload, (req, res) => saveEntity(req, res, 0));
app.post('/admin/:entity/:id/delete', requireAdmin, entityOf, async (req, res) => {
  await cms.remove(req.entity, parseInt(req.params.id, 10) || 0);
  res.redirect(303, `/admin/${req.entity}?deleted=1`);
});
app.post('/admin/:entity/:id', requireAdmin, entityOf, runUpload, csrfAfterUpload, (req, res) => saveEntity(req, res, parseInt(req.params.id, 10) || 0));

// ---------- 404 / errors ----------
app.use((req, res) => {
  res.status(404).render('error', { ...pageMeta(req, 'Page not found', 'This page does not exist.'), noindex: true, code: 404, heading: 'This page does not exist', body: 'The link may be old or mistyped. Try one of the pages below.' });
});
app.use((err, req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.too.large') return res.status(413).type('text').send('Too much data in one request.');
  res.status(500).render('error', { ...pageMeta(req, 'Something went wrong', 'Error'), noindex: true, code: 500, heading: 'Something went wrong on our side', body: 'Please try again in a minute, or reach us by phone or email.' });
});

if (!process.env.VERCEL) {
  boot().catch(err => { console.error('[goforge] Database startup failed:', err); process.exit(1); });
  app.listen(PORT, '0.0.0.0', () => console.log(`[goforge] Listening on http://localhost:${PORT}`));
}
module.exports = app;
