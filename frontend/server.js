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
const { TECH_STACK, SERVICES, CONTACT_SERVICES, TRACKS, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, BRAND, WHY_SMALL, FAQ, OFFERS } = require('./lib/content');
const { programmePdf, programmeLines } = require('./lib/pdf');
const cms = require('./lib/cms');
const { storeImage, UPLOAD_DIR, MAX_BYTES, uploadMode } = require('./lib/uploads');
const multer = require('multer');
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
const MODES = ['Live online', 'Either is fine'];
const SOURCES = ['Instagram', 'LinkedIn', 'Google search', 'College / friend', 'Other'];
function validateApplication(body, TRACKS) {
  const errors = {}, values = {};
  field(errors, values, body, 'full_name', 'your full name', { required: true, min: 2, max: 80 });
  field(errors, values, body, 'college', 'your college', { required: true, min: 2, max: 120 });
  field(errors, values, body, 'course_year', 'your course and year', { required: true, min: 2, max: 60 });
  phoneField(errors, values, body, 'whatsapp', 'phone number');
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
      'script-src': ["'self'"].concat(GA_ID ? ['https://www.googletagmanager.com'] : [], PLAUSIBLE_DOMAIN ? [PLAUSIBLE_SRC] : []),
      'style-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'].concat(GA_ID ? ['https://www.google-analytics.com'] : []),
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

// Old cached copies of site.js (before WhatsApp was removed) navigated a new tab to data.whatsappUrl,
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
  Object.assign(res.locals, {
    PROGRAMS, TRACKS, MODES, SOURCES,
    s, BRAND, SERVICES, TRACK_DETAILS, SIMILAR_ROLE, PROCESS, STATUSES, CONTACT_SERVICES,
    WHY_SMALL, FAQ, OFFERS, TECH_STACK,
    analytics: { ga: GA_ID, plausibleDomain: PLAUSIBLE_DOMAIN, plausibleSrc: PLAUSIBLE_SRC },
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
    if (!/^\/admin\/(programs|instructors|stats|testimonials|credentials)\/(new|\d+)$/.test(req.path)) return res.status(415).type('text').send('Unsupported form type.');
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
    ...rest
  };
}

function jsonLd() {
  const s = getSettings();
  const data = {
    '@context': 'https://schema.org',
    '@type': ['ProfessionalService', 'EducationalOrganization'],
    '@id': SITE_URL + '/#organization',
    name: BRAND.name,
    description: 'MSME-registered software development company and IT training institute in Faridabad, Haryana: custom software, CRM, ERP, websites and digital marketing for businesses, and paid training with an included internship for students.',
    slogan: BRAND.tagline,
    url: SITE_URL + '/',
    logo: SITE_URL + '/img/gf-512.png',
    image: SITE_URL + '/img/og.png',
    email: s.email,
    telephone: [s.phone1, s.phone2].map(p => '+' + digits(p)),
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.address.line1 + ', Sector-81',
      addressLocality: BRAND.address.locality,
      postalCode: '121004',
      addressRegion: BRAND.address.region,
      addressCountry: BRAND.address.country
    },
    founder: { '@type': 'Person', name: BRAND.founder, jobTitle: BRAND.founderRole, sameAs: [BRAND.linkedin] },
    sameAs: [BRAND.instagram],
    areaServed: [{ '@type': 'City', name: 'Faridabad' }, { '@type': 'AdministrativeArea', name: 'Delhi NCR' }, { '@type': 'Country', name: 'India' }],
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '10:00', closes: '18:30' }],
    knowsAbout: SERVICES.map(x => x.name),
    hasOfferCatalog: {
      '@type': 'OfferCatalog', name: 'Services and training programmes',
      itemListElement: SERVICES.map(x => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: x.name, url: SITE_URL + '/services/' + x.slug } }))
    }
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function courseJsonLd(p) {
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Course', name: p.name + ' training + internship', description: p.summary,
    url: SITE_URL + '/internship/programs/' + p.slug, inLanguage: 'en-IN',
    provider: { '@type': 'Organization', '@id': SITE_URL + '/#organization', name: BRAND.name, url: SITE_URL + '/' },
    educationalCredentialAwarded: 'Training certificate and internship letter',
    teaches: p.coversList.length ? p.coversList : undefined,
    syllabusSections: p.curriculumList.map(m => ({ '@type': 'Syllabus', name: (m.label ? m.label + ': ' : '') + m.title, description: m.topics.join('; ') })),
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: p.training, location: { '@type': 'VirtualLocation', url: SITE_URL + '/internship/programs/' + p.slug } }
  }).replace(/</g, '\\u003c');
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
    'Software development company in Faridabad, Haryana: custom software, CRM and ERP development, AI automation, websites and digital marketing for growing businesses.', { jsonld: jsonLd(), seoTitle: 'Software Development Company in Faridabad | CRM & ERP | Goforge' }) });
});
app.get('/verify', async (req, res) => {
  const id = text(req.query.id).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  res.render('verify', { certId: id, ...pageMeta(req, 'Verify a certificate',
    'Verify a Goforge Digital training certificate or internship letter using the certificate ID printed on it.', { seoTitle: 'Verify a Certificate or Internship Letter | Goforge Digital' }) });
});

app.get('/services', (req, res) => res.render('services', pageMeta(req, 'Services',
  'Custom software development, CRM and ERP development, AI automation, website design and digital marketing services in Faridabad and Delhi NCR. See what each service includes.',
  { seoTitle: 'Software, CRM & ERP Development in Faridabad | Goforge Digital' })));

app.get('/services/:slug', (req, res, next) => {
  const service = SERVICES.find(item => item.slug === req.params.slug);
  if (!service) return next();
  res.render('service', pageMeta(req, service.name,
    service.name + ' from Goforge Digital in Faridabad. What it includes, the questions on a first call, and what you receive at handover.',
    { seoTitle: service.name + ' in Faridabad | Goforge Digital', service, crumbs: [['Home', '/'], ['Services', '/services'], [service.name, '/services/' + service.slug]] }));
});

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
  respondOk(req, res, 'college', 'Thanks, ' + values.name.split(' ')[0] + '. Your enquiry is saved. Our partnerships team will contact you within one working day.');
});

async function trustData() {
  const [stats, credentials, instructors, testimonials] = await Promise.all([
    cms.listPublished('stats'), cms.listPublished('credentials'), cms.listPublished('instructors'), cms.listPublished('testimonials')
  ]);
  return { stats, credentials, instructors, testimonials: testimonials.filter(t => t.kind !== 'client'), clientTestimonials: testimonials.filter(t => t.kind === 'client') };
}
const INTERNSHIP_DESC = 'Internship with training in Faridabad and online: live classes, study material, real projects and an included internship in software, AI/ML, data analytics, web development and digital marketing.';
app.get('/internship', async (req, res) => res.render('internship', {
  values: { track: (t => res.locals.TRACKS.includes(t) ? t : '')(req.query.track === 'Web Developer' ? 'Full Stack Web Development' : req.query.track) },
  ...(await trustData()),
  ...pageMeta(req, 'Training & internship', INTERNSHIP_DESC, { seoTitle: 'Internship with Training in Faridabad | Goforge Digital' })
}));

app.get('/internship/programs/web-developer', (req, res) => res.redirect(301, '/internship/programs/full-stack-web-development'));
app.get('/internship/programs/:slug', async (req, res, next) => {
  const program = await cms.programBySlug(req.params.slug, getSettings());
  if (!program) return next();
  const { instructors, credentials, stats } = await trustData();
  res.render('program', {
    program, instructors, credentials, stats,
    values: { track: program.name },
    ...pageMeta(req, program.name + ' training + internship',
      program.name + ' at Goforge Digital: ' + program.training + ' of live training, then a ' + program.internship + ' internship. Curriculum, tools, projects and batches.',
      { seoTitle: program.name + ' Course with Internship | Goforge Digital', jsonld: courseJsonLd(program), crumbs: [['Home', '/'], ['Training & internship', '/internship'], [program.name, '/internship/programs/' + program.slug]] })
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
  res.send(programmePdf(programmeLines({ settings: getSettings(), brand: BRAND, tracks: res.locals.PROGRAMS.map(p => ({ name: p.name, tools: p.toolsList, project: p.project || '' })) })));
});

app.get('/faq', (req, res) => res.render('faq', pageMeta(req, 'FAQ',
  'Answers for students and clients: how the internship works, certificates and college recognition, the letter, how projects are chosen, and how client work is priced.',
  { seoTitle: 'FAQ: Training, Internship & Projects | Goforge Digital', jsonld: faqJsonLd() })));

app.get('/about', async (req, res) => {
  const { credentials } = await trustData();
  res.render('about', { credentials, ...pageMeta(req, 'About',
    'Goforge Digital is an MSME-registered software, marketing and training company in Sector 81, Faridabad, led by Rohit Sharma, Founder and Director.',
    { seoTitle: 'About Goforge Digital | MSME IT Company, Faridabad', jsonld: jsonLd() }) });
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
  (await db.run('INSERT INTO applications (full_name, college, course_year, whatsapp, track, note, email, city, mode, source, consent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', values.full_name, values.college, values.course_year, values.whatsapp, values.track, values.note || null, values.email || null, values.city || null, values.mode || null, values.source || null, 1));
  respondOk(req, res, 'internship', 'Thanks, ' + values.full_name.split(' ')[0] + '. Your application is saved. We will contact you soon.');
});

function respondOk(req, res, kind, message) {
  if (wantsJson(req)) return res.json({ ok: true, message });
  res.render('thanks', { ...pageMeta(req, 'Sent', message), noindex: true, kind, message });
}

app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /uploads/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const pages = ['/', '/services', '/work', '/internship', '/colleges', '/verify', '/internship/overview', '/about', '/contact', '/faq', '/privacy', '/terms', '/refund']
    .concat(SERVICES.map(item => '/services/' + item.slug))
    .concat(res.locals.PROGRAMS.map(item => '/internship/programs/' + item.slug));
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
    contacts: (await db.get("SELECT COUNT(*) n FROM contacts WHERE status = 'New' AND kind <> 'college'")).n,
    colleges: (await db.get("SELECT COUNT(*) n FROM contacts WHERE status = 'New' AND kind = 'college'")).n,
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
    table: 'contacts', title: 'Project enquiries', base: "kind <> 'college'", search: ['name', 'business', 'phone', 'service', 'message']
  },
  colleges: {
    table: 'contacts', title: 'College enquiries', base: "kind = 'college'", search: ['name', 'business', 'phone', 'service', 'message', 'email']
  },
  applications: {
    table: 'applications', title: 'Internship applications', search: ['full_name', 'college', 'course_year', 'whatsapp', 'track', 'note', 'email', 'city']
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
  for (const k of ['blurb1', 'blurb2', 'blurb3', 'blurb4']) field(errors, values, req.body, k, 'the service line', { required: true, min: 10, max: 220 });
  field(errors, values, req.body, 'intern_training', 'the training length', { required: true, max: 40 });
  field(errors, values, req.body, 'intern_work', 'the internship length', { required: true, max: 40 });
  field(errors, values, req.body, 'intern_fee', 'the fee line', { required: true, max: 80 });
  if (Object.keys(errors).length) {
    return res.status(422).render('admin/settings', { ...pageMeta(req, 'Site settings', 'Admin'), values: { ...getSettings(), ...values }, errors, flash: null });
  }
  await saveSettings(values);
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
  res.status(500).render('error', { ...pageMeta(req, 'Something went wrong', 'Error'), noindex: true, code: 500, heading: 'Something went wrong on our side', body: 'Please try again in a minute, or reach us by phone or WhatsApp.' });
});

if (!process.env.VERCEL) {
  boot().catch(err => { console.error('[goforge] Database startup failed:', err); process.exit(1); });
  app.listen(PORT, '0.0.0.0', () => console.log(`[goforge] Listening on http://localhost:${PORT}`));
}
module.exports = app;
