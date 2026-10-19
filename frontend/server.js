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

const { db, DATA_DIR, ready, loadSettings, getSettings, saveSettings } = require('./lib/db');
const { TECH_STACK, SERVICES, CONTACT_SERVICES, TRACKS, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, BRAND, WHY_SMALL, FAQ, OFFERS, CAREER_TRACKS, CAREER_TRACK_OPTIONS, TRACK_RANGE, careerTrackLabel, visibleFaq } = require('./lib/content');
const batch = require('./lib/batch');
const { toolChips } = require('./lib/tools');
const { SERVICE_PAGES, SERVICE_REDIRECTS } = require('./lib/service-pages');
const { programmePdf, programmeLines } = require('./lib/pdf');
const cms = require('./lib/cms');
const { storeImage, UPLOAD_DIR, MAX_BYTES, uploadMode } = require('./lib/uploads');
const multer = require('multer');
const { notifyLead } = require('./lib/lead-alerts');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 4, fields: 40, fieldSize: 32 * 1024 } });

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
      fs.writeFileSync(file, `Goforge Digital admin\nLogin: /admin/login\nEmail: ${ADMIN_EMAIL}\nInitial password: ${password}\n\nChange it after first login (Admin > Password), then delete this file.\n`, { mode: 0o600 });
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
function validateApplication(body, TRACKS) {
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
  const offer = batch.offerState(now);
  Object.assign(res.locals, {
    offer, now, inr: batch.inr, SEAT_CAP: batch.SEAT_CAP, SEATS: { weekday: batch.seatInfo(s.seats_weekday), weekend: batch.seatInfo(s.seats_weekend) }, REGISTRATION: batch.REGISTRATION, REFERRAL: batch.REFERRAL, WEBINAR: batch.WEBINAR,
    BATCH_LABEL: batch.BATCH_LABEL, NEXT_AFTER: batch.NEXT_AFTER, BATCHES: batch.BATCHES, BATCH_PROMISES: batch.BATCH_PROMISES, BATCH_PREFS: batch.BATCH_PREFS,
    COUNSEL_INTERESTS: counselInterests(offer), upcomingRows: rows => batch.upcomingRows(rows, now), TIMELINE: batch.timeline(now), toolChips,
    PROGRAMS, TRACKS, MODES, SOURCES,
    s, BRAND, SERVICES, SERVICE_PAGES, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, CONTACT_SERVICES,
    CAREER_TRACKS, CAREER_TRACK_OPTIONS, TRACK_RANGE, careerTrackLabel,
    WHY_SMALL, FAQ: visibleFaq(now), OFFERS, TECH_STACK, COUNSEL_TIMES: ['Morning (10 AM to 1 PM)', 'Afternoon (1 PM to 4 PM)', 'Evening (4 PM to 6:30 PM)', 'Any time'],
    analytics: { ga: GA_ID, plausibleDomain: PLAUSIBLE_DOMAIN, plausibleSrc: PLAUSIBLE_SRC, vercel: VERCEL_ANALYTICS },
    mapEmbed: 'https://maps.google.com/maps?q=' + encodeURIComponent(BRAND.mapQuery) + '&z=16&output=embed',
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
    if (!/^\/admin\/(programs|instructors|stats|testimonials|credentials|projects|gallery|samples)\/(new|\d+)$/.test(req.path)) return res.status(415).type('text').send('Unsupported form type.');
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
      ? 'Custom software and marketing studio in Faridabad | Goforge Digital'
      : `${title} | Goforge Digital`),
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
  const name = m ? 'program-' + m[1] : ({ '/internship': 'internship', '/counselling': 'counselling', '/colleges': 'internship', '/faq': 'internship', '/services': 'services', '/work': 'services', '/contact': 'services' })[p]
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

function courseJsonLd(p, offer) {
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Course', name: p.name + ' training + internship', description: p.summary,
    url: SITE_URL + '/internship/programs/' + p.slug, inLanguage: 'en-IN',
    provider: { '@type': 'Organization', '@id': SITE_URL + '/#organization', name: BRAND.name, url: SITE_URL + '/' },
    educationalCredentialAwarded: 'Training certificate and internship letter',
    teaches: p.coversList.length ? p.coversList : undefined,
    syllabusSections: p.curriculumList.map(m => ({ '@type': 'Syllabus', name: (m.label ? m.label + ': ' : '') + m.title, description: m.topics.join('; ') })),
    // One CourseInstance and one Offer per programme length (ISO 8601 durations: P3M, P6M). Prices in INR, all-inclusive.
    hasCourseInstance: CAREER_TRACKS.map(t => ({ '@type': 'CourseInstance', name: t.name, courseMode: 'Online', courseWorkload: t.iso,
      courseSchedule: { '@type': 'Schedule', duration: t.iso, repeatFrequency: 'Daily', repeatCount: 1 },
      location: { '@type': 'VirtualLocation', url: SITE_URL + '/internship/programs/' + p.slug } })),
    offers: CAREER_TRACKS.map(t => ({ '@type': 'Offer', name: t.name, category: 'Paid', price: String(offer.priceOf(t)), priceCurrency: 'INR',
      availability: offer.registrationOpen ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      url: SITE_URL + '/internship/programs/' + p.slug }))
  }).replace(/</g, '\\u003c');
}
function faqJsonLd() {
  const entities = visibleFaq(batch.nowMs()).flatMap(group => group.items.map(item => ({
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
  // Home is business-only: keep project/business metrics, leave student metrics to /internship.
  // Only business-facing stats (e.g. labels mentioning clients or businesses); student/programme stats stay on /internship.
  const stats = t.stats.filter(x => /client|business/i.test(x.label) && !/student|intern|project|instructor|success/i.test(x.label));
  res.render('home', { ...t, stats, ...pageMeta(req, 'Home',
    'Goforge Digital builds custom software, CRM & ERP systems, web apps and AI automation for businesses in Faridabad & Delhi NCR. MSME registered. Book a free consultation.', { jsonld: jsonLd(), websiteLd: websiteJsonLd(), seoTitle: 'Goforge Digital – Custom Software Development Company in Faridabad' }) });
});
app.get('/verify', async (req, res) => {
  const id = text(req.query.id).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  const { sampleDocs } = await trustData();
  res.render('verify', { certId: id, sampleDocs, ...pageMeta(req, 'Verify a certificate',
    'Verify a Goforge Digital training certificate or internship letter using the certificate ID printed on it.', { noindex: true, seoTitle: 'Verify a Certificate or Internship Letter | Goforge Digital' }) });
});

app.get('/services', (req, res) => res.render('services', pageMeta(req, 'Services',
  'Software development services in Faridabad and Delhi NCR: custom software, CRM and ERP development, AI automation, website development, digital marketing, real estate CRM and school software.',
  { seoTitle: 'Software Development Services in Faridabad | CRM, ERP & Web | Goforge Digital' })));

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
    description: 'Goforge Digital designed and built the website for Vaishnavi Associates, a real estate advisory in Faridabad.',
    image: SITE_URL + '/img/work/vaishnavi-associates.webp', inLanguage: 'en-IN', dateModified: '2026-10-18',
    creator: { '@id': SITE_URL + '/#organization' },
    about: { '@type': 'RealEstateAgent', name: 'Vaishnavi Associates', url: 'https://vaishnaviassociates.com/' }
  }).replace(/</g, '\\u003c');
}
app.get('/work/vaishnavi-associates', (req, res) => res.render('case-study', pageMeta(req, 'Vaishnavi Associates',
  'Case study: Goforge Digital designed and built the Vaishnavi Associates real estate website, with property pages, filters, an enquiry form and a responsive layout.',
  { seoTitle: 'Vaishnavi Associates Website: Case Study | Goforge Digital', jsonld: caseStudyJsonLd(), crumbs: [['Home', '/'], ['Work', '/work'], ['Vaishnavi Associates', '/work/vaishnavi-associates']] })));
app.get('/work', (req, res) => res.render('work', pageMeta(req, 'Work',
  'Portfolio of software, CRM, website and marketing projects delivered by Goforge Digital, Faridabad.',
  { seoTitle: 'Software & Website Projects | Goforge Digital, Faridabad' })));

const COLLEGES_DESC = 'Campus tie-ups and MoUs, workshops and bootcamps, faculty development programmes, bulk training and internship programmes for colleges in Faridabad, Delhi NCR and across India.';
app.get('/colleges', async (req, res) => res.render('colleges', {
  ...(await trustData()), values: {}, COLLEGE_INTERESTS, COLLEGE_SIZES,
  ...pageMeta(req, 'For colleges', COLLEGES_DESC, { seoTitle: 'College Partnerships: MoU, FDP & Internships | Goforge Digital' })
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

const COUNSEL_TIMES = ['Morning (10 AM to 1 PM)', 'Afternoon (1 PM to 4 PM)', 'Evening (4 PM to 6:30 PM)', 'Any time'];
// What a student wants from the call. The webinar option is only offered until the webinar ends,
// but older open forms may still send it, so validation accepts every option.
const COUNSEL_INTEREST_ALL = ['Joining the ' + batch.BATCH_LABEL, batch.WEBINAR.interest, 'Joining the ' + batch.NEXT_AFTER + ' batch', 'Just exploring'];
function counselInterests(offer) {
  return COUNSEL_INTEREST_ALL.filter(o => (o !== batch.WEBINAR.interest || offer.webinar) && (o !== 'Joining the ' + batch.BATCH_LABEL || offer.registrationOpen));
}
function validateCounsel(body, programs) {
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
  if (values.track && !CAREER_TRACK_OPTIONS.includes(values.track)) errors.track = 'Please choose from the list.';
  field(errors, values, body, 'college_req', 'your college requirement', { max: 160 });
  values.interest = text(body.interest);
  if (values.interest && !COUNSEL_INTEREST_ALL.includes(values.interest)) errors.interest = 'Please choose from the list.';
  values.batch = text(body.batch);
  if (values.batch && !batch.BATCH_PREFS.includes(values.batch)) errors.batch = 'Please choose from the list.';
  field(errors, values, body, 'referred_by', 'who referred you', { max: 80 });
  return { errors, values };
}
const trackFromQuery = slug => { const t = CAREER_TRACKS.find(x => x.slug === slug); return t ? careerTrackLabel(t) : ''; };
const interestFromQuery = (q, res) => q === 'webinar' && res.locals.offer.webinar ? batch.WEBINAR.interest : '';
app.get('/counselling', (req, res) => res.render('counselling', { values: { program: res.locals.TRACKS.includes(req.query.program) ? req.query.program : '', track: trackFromQuery(req.query.track), interest: interestFromQuery(req.query.interest, res) }, errors: {}, ...pageMeta(req, 'Book a free counselling call', 'Book a free counselling call with Goforge Digital about the training and internship programmes.', { noindex: true }) }));
app.post('/counselling', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'counselling', 'Thanks. Your request has been sent.');
  const { errors, values } = validateCounsel(req.body, res.locals.TRACKS);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('counselling', { errors, values, ...pageMeta(req, 'Book a free counselling call', 'Counselling', { noindex: true }) });
  }
  const msg = ['Preferred time: ' + (values.time || 'Any time'), values.interest && 'Interested in: ' + values.interest, values.batch && 'Batch: ' + values.batch].filter(Boolean).join('\n');
  await db.run("INSERT INTO contacts (name, business, phone, service, message, email, track, college_req, referred_by, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'counselling')",
    values.name, null, values.phone, values.program || 'Not sure yet', msg, values.email || null, values.track || null, values.college_req || null, values.referred_by || null);
  const isWebinar = values.interest === batch.WEBINAR.interest;
  notifyLead({ title: isWebinar ? 'free webinar sign-up' : 'counselling call request', name: values.name, adminUrl: SITE_URL + '/admin/counselling', replyTo: values.email,
    fields: [['Name', values.name], ['Phone', values.phone], ['Email', values.email], ['Interested in', values.interest], ['Programme', values.program || 'Not sure yet'], ['Preferred programme length', values.track || 'Not sure yet'],
      ['Preferred batch', values.batch], ['College requirement', values.college_req], ['Preferred time', values.time || 'Any time'], ['Referred by', values.referred_by]] });
  respondOk(req, res, 'counselling', isWebinar
    ? 'Thanks, ' + values.name.split(' ')[0] + '. Your free webinar seat is saved. We will send the joining link for ' + batch.WEBINAR.date + ', ' + batch.WEBINAR.time + ' to your phone' + (values.email ? ' and email' : '') + ' before the session.'
    : 'Thanks, ' + values.name.split(' ')[0] + '. Your counselling call request is saved. A counsellor will call you at your preferred time, usually within one working day.');
});

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
app.get('/internship/guide.pdf', (req, res) => {
  res.set('X-Robots-Tag', 'noindex');
  if (!guideTokenOk(req.query.t)) return res.redirect(303, '/internship#guide');
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Disposition', 'attachment; filename="goforge-track-picker-guide.pdf"');
  res.type('application/pdf').sendFile(GUIDE_FILE);
});

const SCHOOLS_DESC = 'NEP 2020 aligned skills programmes for Classes 5 to 12 (coding, AI, data science, robotics) and school software: websites, admission enquiry systems, ERP and parent updates. Goforge Digital, Faridabad.';
const schoolsMeta = req => pageMeta(req, 'For schools', SCHOOLS_DESC, { seoTitle: 'For Schools: NEP 2020 Skills Programmes & School Software | Goforge Digital' });
app.get('/schools', (req, res) => res.render('schools', { values: {}, errors: {}, SCHOOL_INTERESTS, SCHOOL_SIZES, ...schoolsMeta(req) }));
app.post('/schools', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'school', 'Thanks. Your enquiry has been sent.');
  const { errors, values } = validateSchool(req.body);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('schools', { errors, values, SCHOOL_INTERESTS, SCHOOL_SIZES, ...schoolsMeta(req) });
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
const INTERNSHIP_DESC = '3-Month (₹1,499) and 6-Month (₹1,999) training + internship programmes for college students and graduates, live online: software, AI/ML, data, web, business analysis and digital marketing. November 2026 batch, 25 seats per batch. Verifiable certificates.';
app.get('/internship', async (req, res) => res.render('internship', {
  values: { track: (t => res.locals.TRACKS.includes(t) ? t : '')(req.query.track === 'Web Developer' ? 'Full Stack Web Development' : req.query.track) },
  ...(await trustData()),
  ...pageMeta(req, 'Training & internship', INTERNSHIP_DESC, { seoTitle: 'Internship with Training for Students in Faridabad & Online | Goforge Digital', jsonld: eduJsonLd(), training: true })
}));

app.get('/internship/programs/web-developer', (req, res) => res.redirect(301, '/internship/programs/full-stack-web-development'));
app.get('/internship/programs/:slug', async (req, res, next) => {
  const program = await cms.programBySlug(req.params.slug, getSettings());
  if (!program) return next();
  const { instructors, credentials, stats } = await trustData();
  res.render('program', {
    program, instructors, credentials, stats, counselProgram: program.name,
    values: { track: program.name },
    ...pageMeta(req, program.name + ' training + internship',
      program.name + ' training + internship at Goforge Digital: 3-Month (₹1,499) or 6-Month (₹1,999) programme, live online. Curriculum, tools, projects, batch timings and the November 2026 batch.',
      { seoTitle: program.name + ' Training with Internship | Goforge Digital', jsonld: courseJsonLd(program, res.locals.offer), crumbs: [['Home', '/'], ['Training & internship', '/internship'], [program.name, '/internship/programs/' + program.slug]] })
  });
});
// Old role pages moved to programme pages.
app.get('/internship/roles/:slug', (req, res) => res.redirect(301, '/internship/programs/' + encodeURIComponent(req.params.slug)));

app.get('/internship/overview', (req, res) => res.render('overview', pageMeta(req, 'Programme overview',
  'Printable overview of the Goforge Digital training + internship programme for students and college training cells.',
  { seoTitle: 'Training + Internship Programme Overview | Goforge Digital', crumbs: [['Home', '/'], ['Training & internship', '/internship'], ['Programme overview', '/internship/overview']] })));

app.get('/internship/overview.pdf', (req, res) => {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', 'inline; filename="goforge-internship-overview.pdf"');
  res.send(programmePdf(programmeLines({ settings: getSettings(), brand: BRAND, lengths: CAREER_TRACKS, batchLines: res.locals.offer.registrationOpen
    ? [batch.BATCH_LABEL + ' (registration closes ' + batch.REGISTRATION.closes + '):', ...batch.BATCHES.map(b => '- ' + b.name + ': ' + b.days + ', ' + b.time + ', from ' + b.starts + '.'), 'Only ' + batch.SEAT_CAP + ' seats per batch.']
    : ['Next batch: ' + batch.NEXT_AFTER + '. Dates on the counselling call.'], tracks: res.locals.PROGRAMS.map(p => ({ name: p.name, tools: p.toolsList, project: p.project || '' })) })));
});

app.get('/faq', (req, res) => res.render('faq', pageMeta(req, 'FAQ',
  'Answers for students and clients: how the internship works, certificates and college recognition, the letter, how projects are chosen, and how client work is priced.',
  { seoTitle: 'FAQ: Training, Internship & Projects | Goforge Digital', jsonld: faqJsonLd() })));

app.get('/about', async (req, res) => {
  const { credentials, aboutGallery } = await trustData();
  res.render('about', { credentials, gallery: aboutGallery, ...pageMeta(req, 'About',
    'Goforge Digital is an MSME-registered custom software development company in Sector 81, Faridabad, building software, CRM, ERP and websites, led by Rohit Sharma, Founder & Director.',
    { seoTitle: 'About Goforge Digital | Software Development Company, Faridabad', jsonld: jsonLd() }) });
});

app.get('/contact', (req, res) => res.render('contact', { values: { service: CONTACT_SERVICES.includes(req.query.service) ? req.query.service : '' }, ...pageMeta(req, 'Contact',
  'Call, email or visit Goforge Digital at Puri Highstreet, Sector 81, Faridabad. Office hours Monday to Saturday.',
  { seoTitle: 'Contact Goforge Digital | Sector 81, Faridabad, Haryana', jsonld: jsonLd() }) }));

app.get('/privacy', (req, res) => res.render('legal', pageMeta(req, 'Privacy',
  'Privacy notice for Goforge Digital: what the enquiry and internship forms collect, why, and how to ask for a correction or deletion.',
  { seoTitle: 'Privacy notice | Goforge Digital', kind: 'privacy' })));

app.get('/terms', (req, res) => res.render('legal', pageMeta(req, 'Terms',
  'Terms for using the Goforge Digital website, asking for a project, and applying to the internship.',
  { seoTitle: 'Terms of use | Goforge Digital', kind: 'terms' })));

app.get('/refund', (req, res) => res.render('legal', pageMeta(req, 'Refunds',
  'Refund policy for Goforge Digital training programmes and client projects.',
  { seoTitle: 'Refund policy | Goforge Digital', kind: 'refund' })));

app.post('/contact', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'contact', 'Thanks. Your message has been sent.');
  const { errors, values } = validateContact(req.body);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('contact', { ...pageMeta(req, 'Contact', 'Contact Goforge Digital'), errors, values });
  }
  (await db.run('INSERT INTO contacts (name, business, phone, service, message) VALUES (?, ?, ?, ?, ?)', values.name, values.business || null, values.phone, values.service || null, values.message));
  notifyLead({ title: 'project enquiry', name: values.name, adminUrl: SITE_URL + '/admin/contacts',
    fields: [['Name', values.name], ['Business', values.business], ['Phone', values.phone], ['Service', values.service], ['Message', values.message]] });
  respondOk(req, res, 'contact', 'Thanks, ' + values.name.split(' ')[0] + '. Your message is saved and we will reply soon.');
});

app.post('/internship', formLimiter, async (req, res) => {
  if (text(req.body.website)) return respondOk(req, res, 'internship', 'Thanks. Your application has been sent.');
  if (req.body && req.body.track === 'Web Developer') req.body.track = 'Full Stack Web Development';
  const { errors, values } = validateApplication(req.body, res.locals.TRACKS);
  if (Object.keys(errors).length) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors, message: 'Please check the highlighted fields.' });
    return res.status(422).render('internship', { ...(await trustData()), ...pageMeta(req, 'Training & internship', INTERNSHIP_DESC), errors, values });
  }
  const groupUrl = await cms.whatsappGroupFor(values.track);
  (await db.run('INSERT INTO applications (full_name, college, course_year, whatsapp, track, note, email, city, mode, source, referred_by, consent, group_link_shown) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', values.full_name, values.college, values.course_year, values.phone, values.track, values.note || null, values.email || null, values.city || null, values.mode || null, values.source || null, values.referred_by || null, 1, groupUrl ? 1 : 0));
  notifyLead({ title: 'internship application', name: values.full_name, adminUrl: SITE_URL + '/admin/applications', replyTo: values.email,
    fields: [['Name', values.full_name], ['Programme', values.track], ['College', values.college], ['Course / year', values.course_year], ['Phone', values.phone], ['Email', values.email], ['City', values.city], ['Mode', values.mode], ['Heard about us', values.source], ['Referred by', values.referred_by], ['Note', values.note]] });
  // The group link is only ever sent in this response, after the application is saved.
  respondOk(req, res, 'internship', 'Thanks, ' + values.full_name.split(' ')[0] + '. Your application is saved. We will contact you soon.', groupUrl ? { url: groupUrl, program: values.track } : null);
});

function respondOk(req, res, kind, message, group = null) {
  if (group) res.set('Cache-Control', 'no-store');
  if (wantsJson(req)) {
    if (!group) return res.json({ ok: true, message });
    // Rendered server-side so no invite link or card markup sits in the public form page.
    return res.render('partials/group-card', { group }, (err, nextHtml) => res.json(err ? { ok: true, message } : { ok: true, message, nextHtml }));
  }
  res.render('thanks', { ...pageMeta(req, 'Sent', message), noindex: true, kind, message, group });
}

app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /uploads/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`));
// Priorities put the business pages first. lastmod is the date the page content last changed
// (SITE_UPDATED, bump when copy changes) rather than the request date.
const SITE_UPDATED = '2026-10-18';
// The November 2026 batch, prices and seat cap changed the training pages, home and FAQ on 2026-10-19.
// Every page changed on 2026-10-18 (address PIN in the footer, new work section), so all share SITE_UPDATED for now.
// Add a path here when only that page changes later, e.g. { '/faq': '2026-11-02' }.
const PAGE_UPDATED = { '/': '2026-10-19', '/internship': '2026-10-19', '/faq': '2026-10-19', '/colleges': '2026-10-19', '/about': '2026-10-19', '/internship/overview': '2026-10-19' };
app.get('/sitemap.xml', (req, res) => {
  const pages = [['/', '1.0'], ['/services', '0.9']]
    .concat(SERVICE_PAGES.map(item => ['/services/' + item.slug, '0.9']))
    .concat([['/work', '0.8'], ['/work/vaishnavi-associates', '0.6'], ['/about', '0.7'], ['/contact', '0.7'], ['/internship', '0.6'], ['/schools', '0.6'], ['/colleges', '0.6'], ['/faq', '0.5'], ['/internship/overview', '0.4']])
    .concat(res.locals.PROGRAMS.map(item => ['/internship/programs/' + item.slug, '0.5']))
    .concat([['/privacy', '0.3'], ['/terms', '0.3'], ['/refund', '0.3']]);
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p, pr]) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${PAGE_UPDATED[p] || (p.startsWith('/internship/programs/') ? '2026-10-19' : SITE_UPDATED)}</lastmod><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
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
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), counts, flash: req.query.saved ? 'Status updated.' : null
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

app.get('/admin/settings', requireAdmin, (req, res) => {
  res.render('admin/settings', { ...pageMeta(req, 'Site settings', 'Admin'), values: getSettings(), errors: {}, flash: req.query.saved ? 'Saved. The public site now shows these details.' : null });
});
app.post('/admin/settings', requireAdmin, async (req, res) => {
  const errors = {}, values = {};
  phoneField(errors, values, req.body, 'phone1', 'first phone number');
  phoneField(errors, values, req.body, 'phone2', 'second phone number');
  values.email = text(req.body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email) || values.email.length > 120) errors.email = 'Please enter a valid email address.';
  values.linkedin_company = text(req.body.linkedin_company);
  if (values.linkedin_company && (!/^https:\/\/(www\.)?linkedin\.com\/company\/[A-Za-z0-9_\-%.]+\/?$/.test(values.linkedin_company) || values.linkedin_company.length > 200)) errors.linkedin_company = 'Please enter a LinkedIn company page URL, for example https://www.linkedin.com/company/143989208';
  for (const k of ['blurb1', 'blurb2', 'blurb3', 'blurb4']) field(errors, values, req.body, k, 'the service line', { required: true, min: 10, max: 220 });
  field(errors, values, req.body, 'intern_training', 'the training length', { required: true, max: 40 });
  field(errors, values, req.body, 'intern_work', 'the internship length', { required: true, max: 40 });
  field(errors, values, req.body, 'intern_fee', 'the fee line', { required: true, max: 80 });
  for (const k of ['seats_weekday', 'seats_weekend']) {
    const v = text(req.body[k]) || '0';
    values[k] = v;
    if (!/^\d{1,2}$/.test(v) || Number(v) > batch.SEAT_CAP) errors[k] = 'Enter a whole number from 0 to ' + batch.SEAT_CAP + '.';
    else values[k] = String(Number(v));
  }
  if (Object.keys(errors).length) {
    return res.status(422).render('admin/settings', { ...pageMeta(req, 'Site settings', 'Admin'), values: { ...getSettings(), ...values }, errors, flash: null });
  }
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
