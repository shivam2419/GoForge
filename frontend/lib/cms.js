'use strict';
// Admin-managed content: programmes, instructors, stats, testimonials, badges.
// Each entity is described once here; the schema, admin forms and validation are built from it.
const { db } = require('./db');
const { TRACK_DETAILS } = require('./content');

const ICONS = ['code', 'spark', 'chart', 'browser', 'megaphone', 'database', 'gear', 'globe', 'user', 'tag', 'eye', 'key', 'check', 'briefcase', 'flask'];

// type: text | textarea | lines | number | select | bool | image | url | slug
const ENTITIES = {
  programs: {
    table: 'programs', title: 'Programmes', singular: 'programme', nameField: 'name',
    intro: 'Training + internship programmes shown on /internship. Each one gets its own page at /internship/programs/<slug>.',
    fields: [
      { name: 'name', label: 'Programme name', type: 'text', required: true, max: 80 },
      { name: 'slug', label: 'URL slug', type: 'slug', max: 60, hint: 'Lowercase words joined by dashes. Left empty, it is made from the name.' },
      { name: 'icon', label: 'Icon', type: 'select', options: ICONS, required: true },
      { name: 'summary', label: 'One-line summary', type: 'textarea', rows: 2, required: true, max: 220 },
      { name: 'overview', label: 'Overview paragraph', type: 'textarea', rows: 4, max: 1500 },
      { name: 'duration_training', label: 'Training length', type: 'text', max: 40, hint: 'Empty = the default from Settings.' },
      { name: 'duration_internship', label: 'Internship length', type: 'text', max: 40, hint: 'Empty = the default from Settings.' },
      { name: 'mode', label: 'Mode', type: 'text', max: 60, hint: 'For example: Live online' },
      { name: 'fee', label: 'Fee', type: 'text', max: 80, hint: 'For example: ₹4,999 + GST. Internal only; not shown on the public site.' },
      { name: 'eligibility', label: 'Who can apply', type: 'text', max: 160 },
      { name: 'covers', label: 'What you learn', type: 'lines', max: 2000, hint: 'One point per line.' },
      { name: 'curriculum', label: 'Curriculum', type: 'lines', max: 16000, hint: 'One module per line: Module 1: Title | topic; topic; topic | Hands-on: assignment. Use Capstone: for the final project.' },
      { name: 'tools', label: 'Tools', type: 'lines', max: 1000, hint: 'One per line.' },
      { name: 'project', label: 'Typical project', type: 'textarea', rows: 3, max: 800 },
      { name: 'suits', label: 'Who it suits', type: 'textarea', rows: 2, max: 500 },
      { name: 'batches', label: 'Upcoming batches', type: 'lines', max: 1000, hint: 'One per line: Start date | Timing | Seats. For example: 2 Nov 2026 | Mon–Fri, 7–9 PM IST | 20 seats' },
      { name: 'sort_order', label: 'Order', type: 'number', min: 0, max: 999 },
      { name: 'published', label: 'Show on the site', type: 'bool' }
    ]
  },
  instructors: {
    table: 'instructors', title: 'Mentors & instructors', singular: 'mentor', nameField: 'name',
    intro: 'The mentors section on the internship and programme pages stays hidden until at least one mentor is published. Publish only real people, with their permission.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 80 },
      { name: 'title', label: 'Title / role', type: 'text', max: 100, hint: 'For example: Full-stack developer, 6 years' },
      { name: 'company', label: 'Company', type: 'text', max: 100, hint: 'Where they work now. Optional.' },
      { name: 'photo_url', label: 'Photo', type: 'image' },
      { name: 'bio', label: 'Short bio', type: 'textarea', rows: 3, max: 600 },
      { name: 'skills', label: 'Skills', type: 'text', max: 200, hint: 'Comma separated.' },
      { name: 'linkedin', label: 'LinkedIn URL', type: 'url', max: 300 },
      { name: 'sort_order', label: 'Order', type: 'number', min: 0, max: 999 },
      { name: 'published', label: 'Show on the site', type: 'bool' }
    ]
  },
  stats: {
    table: 'stats', title: 'Stats counters', singular: 'stat', nameField: 'label',
    intro: 'The counters in the trust strip. Keep each one true and give it a short definition.',
    fields: [
      { name: 'value', label: 'Number', type: 'number', required: true, min: 0, max: 100000000 },
      { name: 'suffix', label: 'Suffix', type: 'text', max: 4, hint: 'For example: + or %' },
      { name: 'label', label: 'Label', type: 'text', required: true, max: 60 },
      { name: 'note', label: 'Definition (small print)', type: 'text', max: 200 },
      { name: 'sort_order', label: 'Order', type: 'number', min: 0, max: 999 },
      { name: 'published', label: 'Show on the site', type: 'bool' }
    ]
  },
  testimonials: {
    table: 'testimonials', title: 'Testimonials', singular: 'testimonial', nameField: 'name',
    intro: 'Real words from real students or clients, with their permission. The section hides itself when none are published.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, max: 80 },
      { name: 'role', label: 'Programme / company', type: 'text', max: 120, hint: 'For example: Web Developer intern, 2026' },
      { name: 'kind', label: 'Type', type: 'select', options: ['student', 'client'], required: true },
      { name: 'quote', label: 'Quote', type: 'textarea', rows: 4, required: true, max: 800 },
      { name: 'photo_url', label: 'Photo', type: 'image' },
      { name: 'rating', label: 'Rating (1–5)', type: 'number', min: 0, max: 5, hint: '0 or empty hides stars.' },
      { name: 'sort_order', label: 'Order', type: 'number', min: 0, max: 999 },
      { name: 'published', label: 'Show on the site', type: 'bool' }
    ]
  },
  projects: {
    table: 'projects', title: 'Student work', singular: 'project', nameField: 'title',
    intro: 'Real projects by students, shown on /internship. Ask the student first. The section hides itself when none are published.',
    fields: [
      { name: 'title', label: 'Project title', type: 'text', required: true, max: 100 },
      { name: 'image_url', label: 'Screenshot', type: 'image' },
      { name: 'summary', label: 'One-line description', type: 'textarea', rows: 2, max: 240 },
      { name: 'student', label: 'Student first name', type: 'text', max: 60 },
      { name: 'college', label: 'College', type: 'text', max: 120 },
      { name: 'program', label: 'Programme', type: 'text', max: 80, hint: 'For example: Data Analyst' },
      { name: 'github_url', label: 'GitHub link', type: 'url', max: 300 },
      { name: 'demo_url', label: 'Live demo link', type: 'url', max: 300 },
      { name: 'sort_order', label: 'Order', type: 'number', min: 0, max: 999 },
      { name: 'published', label: 'Show on the site', type: 'bool' }
    ]
  },
  gallery: {
    table: 'gallery', title: 'Photos', singular: 'photo', nameField: 'caption',
    intro: 'Real photos of the office, team and classes. Shown on /internship and About. The section hides itself when none are published.',
    fields: [
      { name: 'caption', label: 'Caption', type: 'text', required: true, max: 120, hint: 'For example: Our office at Puri Highstreet, Sector 81' },
      { name: 'image_url', label: 'Photo', type: 'image', required: true },
      { name: 'placement', label: 'Show on', type: 'select', options: ['Internship and About', 'Internship only', 'About only'], required: true },
      { name: 'sort_order', label: 'Order', type: 'number', min: 0, max: 999 },
      { name: 'published', label: 'Show on the site', type: 'bool' }
    ]
  },
  samples: {
    table: 'samples', title: 'Sample certificate & letter', singular: 'sample', nameField: 'title',
    intro: 'Replaces the built-in sample certificate or internship letter shown on /internship and /verify. Upload a watermarked SAMPLE, never a real student document.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 80 },
      { name: 'kind', label: 'Type', type: 'select', options: ['certificate', 'letter'], required: true },
      { name: 'image_url', label: 'Image', type: 'image', required: true },
      { name: 'sort_order', label: 'Order', type: 'number', min: 0, max: 999 },
      { name: 'published', label: 'Show on the site', type: 'bool' }
    ]
  },
  credentials: {
    table: 'credentials', title: 'Certificates & badges', singular: 'badge', nameField: 'title',
    intro: 'Registrations and recognitions, for example the MSME (Udyam) certificate. Add the certificate number and an image when you have them.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 80 },
      { name: 'number', label: 'Registration / certificate number', type: 'text', max: 80 },
      { name: 'issuer', label: 'Issued by', type: 'text', max: 120 },
      { name: 'image_url', label: 'Image or scan', type: 'image' },
      { name: 'link_url', label: 'Verification link', type: 'url', max: 300 },
      { name: 'sort_order', label: 'Order', type: 'number', min: 0, max: 999 },
      { name: 'published', label: 'Show on the site', type: 'bool' }
    ]
  }
};

const colType = f => (f.type === 'number' || f.type === 'bool') ? 'INTEGER' : 'TEXT';
function schemaSql() {
  return Object.values(ENTITIES).map(e => {
    const cols = e.fields.map(f => {
      if (f.name === 'slug') return 'slug TEXT UNIQUE';
      if (f.name === 'published') return 'published INTEGER NOT NULL DEFAULT 1';
      if (f.name === 'sort_order') return 'sort_order INTEGER NOT NULL DEFAULT 0';
      return `${f.name} ${colType(f)}${f.required ? ' NOT NULL' : ''}`;
    });
    return `CREATE TABLE IF NOT EXISTS ${e.table} (\n  id INTEGER PRIMARY KEY,\n  ${cols.join(',\n  ')},\n  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),\n  updated_at TEXT\n)`;
  });
}

const { CURRICULUM, LEGACY } = require('./curriculum');
// Short starter syllabi shipped earlier; rows still holding these exact values are upgraded to CURRICULUM.
const OLD_CURRICULUM = {
  'software-engineering': ['Week 1: Foundations | Git and GitHub, the command line, how a codebase is laid out', 'Week 2: Back end | Routes, APIs, a relational database and SQL', 'Week 3: Front end | Forms, lists and filters that talk to the API', 'Week 4: Quality | Debugging, simple tests, code review', 'Week 5: Mini project | One feature end to end, with a written test note', 'Week 6: Capstone prep | Breaking down the internship task and reporting progress'],
  'ai-ml-engineer': ['Week 1: Python for data | Lists, files, Pandas tables', 'Week 2: Cleaning data | Missing values, joins, simple checks', 'Week 3: Models in practice | Calling AI APIs, prompts that are written down', 'Week 4: Small tools | A script or app that drafts or sorts records', 'Week 5: Checking output | A check sheet of where the model is wrong', 'Week 6: Capstone prep | Planning the internship tool and its test cases'],
  'data-analyst': ['Week 1: Spreadsheets | Formulas, pivots, clean tables', 'Week 2: SQL | Select, filter, join, group', 'Week 3: Cleaning | Joining sources, checks before a chart is trusted', 'Week 4: Dashboards | Power BI or a similar tool', 'Week 5: Writing findings | A one-page note in plain language', 'Week 6: Capstone prep | Scoping the internship dataset'],
  'web-developer': ['Week 1: HTML and CSS | Structure, layout, typography', 'Week 2: Responsive design | Layouts that work on a phone', 'Week 3: JavaScript | The DOM, events, fetching data', 'Week 4: Forms and back end | Validation and saving a record', 'Week 5: Speed and accessibility | Checks before a page ships', 'Week 6: Capstone prep | Planning the internship page'],
  'digital-marketing': ['Week 1: Search basics | SEO and Google Business Profile', 'Week 2: Content | Planning a social media calendar', 'Week 3: Ads | Google or Meta campaigns with a visible budget', 'Week 4: Measuring | Search Console and campaign reports', 'Week 5: Mini project | A four-week plan for a sample business', 'Week 6: Capstone prep | Scoping the internship campaign']
};

async function seed() {
  const progCount = (await db.get('SELECT COUNT(*) n FROM programs')).n;
  const statCount = (await db.get('SELECT COUNT(*) n FROM stats')).n;
  const credCount = (await db.get('SELECT COUNT(*) n FROM credentials')).n;
  const stmts = [];
  if (!progCount) {
    TRACK_DETAILS.forEach((t, i) => stmts.push([
      `INSERT OR IGNORE INTO programs (name, slug, icon, summary, mode, eligibility, covers, curriculum, tools, project, suits, sort_order, published)
       VALUES (?, ?, ?, ?, 'Live online', 'BTech, BCA, MCA and similar students', ?, ?, ?, ?, ?, ?, 1)`,
      t.name, t.slug, t.icon, t.summary, t.covers.join('\n'), (CURRICULUM[t.slug] || []).join('\n'), t.tools.join('\n'), t.project, t.suits, (i + 1) * 10
    ]));
  }
  if (!statCount) {
    [
      [100, '+', 'Students trained', 'Students who completed a Goforge Digital training programme.'],
      [150, '+', 'Projects completed', 'Projects completed by our students during training and internships.'],
      [98, '%', 'Success rate', 'Share of students who finished training and went on to complete their internship project.'],
      [10, '+', 'Instructors', 'Trainers and mentors who teach or review student work.']
    ].forEach(([v, s, l, n], i) => stmts.push(['INSERT INTO stats (value, suffix, label, note, sort_order, published) VALUES (?, ?, ?, ?, ?, 1)', v, s, l, n, (i + 1) * 10]));
  }
  if (!credCount) {
    stmts.push(['INSERT INTO credentials (title, issuer, sort_order, published) VALUES (?, ?, 10, 1)', 'MSME Registered', 'Ministry of MSME, Government of India (Udyam)']);
  }
  for (const [slug, old] of Object.entries(OLD_CURRICULUM)) {
    if (!CURRICULUM[slug]) continue;
    stmts.push([`UPDATE programs SET curriculum = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
      WHERE slug = ? AND (curriculum IS NULL OR curriculum = '' OR curriculum = ?)`, CURRICULUM[slug].join('\n'), slug, old.join('\n')]);
  }
  // v2 programmes: rename Web Developer to Full Stack Web Development and add Business Analyst + Data Science, once.
  stmts.push(['CREATE TABLE IF NOT EXISTS seed_marks (key TEXT PRIMARY KEY, done_at TEXT)']);
  // MSME certificate details (from the Udyam certificate) on the seeded badge, only where still empty.
  stmts.push(["UPDATE credentials SET number = 'UDYAM-HR-03-0170735' WHERE title = 'MSME Registered' AND (number IS NULL OR number = '')"]);
  stmts.push(["UPDATE credentials SET link_url = 'https://udyamregistration.gov.in/Udyam_Verify.aspx' WHERE title = 'MSME Registered' AND (link_url IS NULL OR link_url = '')"]);
  // 150+ is a student-projects figure; relabel the old seeded row if the admin has not changed it.
  stmts.push(["UPDATE stats SET note = 'Projects completed by our students during training and internships.' WHERE label = 'Projects delivered' AND note = 'Client and studio projects completed by the team.'"]);
  stmts.push(["UPDATE stats SET label = 'Projects completed', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE label = 'Projects delivered'"]);
  if (stmts.length) await db.batch(stmts);
  await seedProgramsV2();
}

const OLD_WEB = {
  name: 'Web Developer', summary: 'Building pages and forms that load quickly and work well on a phone.',
  covers: "HTML, CSS and JavaScript\nResponsive layouts\nForms and basic back-end\nSpeed and accessibility basics",
  tools: "HTML, CSS and JavaScript\nResponsive layout\nA form that validates\nBasic accessibility checks\nReact for interactive apps",
  project: "A small business page with a working enquiry form, checked on a phone, with the fields saved somewhere the studio can read.",
  suits: "Students who want to ship pages people can use. React is taught when the project needs it, not as a badge."
};
async function seedProgramsV2() {
  if (await db.get("SELECT 1 FROM seed_marks WHERE key = 'programs_v2'")) return;
  const fs = TRACK_DETAILS.find(t => t.slug === 'full-stack-web-development');
  const stmts = [];
  const old = await db.get("SELECT * FROM programs WHERE slug = 'web-developer'");
  const taken = await db.get("SELECT 1 FROM programs WHERE slug = 'full-stack-web-development'");
  if (old && !taken) {
    stmts.push([`UPDATE programs SET slug = 'full-stack-web-development',
      name = CASE WHEN name = ? THEN ? ELSE name END,
      summary = CASE WHEN summary = ? THEN ? ELSE summary END,
      covers = CASE WHEN covers = ? THEN ? ELSE covers END, tools = CASE WHEN tools = ? THEN ? ELSE tools END,
      project = CASE WHEN project = ? THEN ? ELSE project END, suits = CASE WHEN suits = ? THEN ? ELSE suits END,
      curriculum = CASE WHEN curriculum IS NULL OR curriculum = '' OR curriculum IN (?, ?) THEN ? ELSE curriculum END,
      updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`,
      OLD_WEB.name, fs.name, OLD_WEB.summary, fs.summary, OLD_WEB.covers, fs.covers.join('\n'), OLD_WEB.tools, fs.tools.join('\n'), OLD_WEB.project, fs.project, OLD_WEB.suits, fs.suits,
      LEGACY['web-developer-v1'].join('\n'), OLD_CURRICULUM['web-developer'].join('\n'), CURRICULUM[fs.slug].join('\n'), old.id]);
  }
  const max = (await db.get('SELECT COALESCE(MAX(sort_order), 0) m FROM programs')).m;
  ['business-analyst', 'data-science'].forEach((slug, i) => {
    const t = TRACK_DETAILS.find(x => x.slug === slug);
    stmts.push([`INSERT OR IGNORE INTO programs (name, slug, icon, summary, mode, eligibility, covers, curriculum, tools, project, suits, sort_order, published)
       VALUES (?, ?, ?, ?, 'Live online', 'BTech, BCA, MCA and similar students', ?, ?, ?, ?, ?, ?, 1)`,
      t.name, t.slug, t.icon, t.summary, t.covers.join('\n'), CURRICULUM[slug].join('\n'), t.tools.join('\n'), t.project, t.suits, max + (i + 1) * 10]);
  });
  stmts.push(["INSERT OR IGNORE INTO seed_marks (key, done_at) VALUES ('programs_v2', strftime('%Y-%m-%dT%H:%M:%SZ','now'))"]);
  await db.batch(stmts);
}

// Applications table gained columns; add them to existing databases.
const APPLICATION_COLUMNS = { email: 'TEXT', city: 'TEXT', mode: 'TEXT', source: 'TEXT', consent: 'INTEGER', group_link_shown: 'INTEGER NOT NULL DEFAULT 0' };
async function migrate() {
  await db.batch(schemaSql().map(sql => [sql]));
  const have = new Set((await db.all('PRAGMA table_info(applications)')).map(r => r.name));
  const add = Object.entries(APPLICATION_COLUMNS).filter(([c]) => !have.has(c)).map(([c, t]) => [`ALTER TABLE applications ADD COLUMN ${c} ${t}`]);
  if (add.length) await db.batch(add);
  const contactCols = new Set((await db.all('PRAGMA table_info(contacts)')).map(r => r.name));
  if (!contactCols.has('kind')) await db.run("ALTER TABLE contacts ADD COLUMN kind TEXT NOT NULL DEFAULT 'client'");
  if (!contactCols.has('email')) await db.run('ALTER TABLE contacts ADD COLUMN email TEXT');
  // Counselling: chosen programme length and the college's own rule (weeks or hours, deadline). Nullable, so old rows are untouched.
  if (!contactCols.has('track')) await db.run('ALTER TABLE contacts ADD COLUMN track TEXT');
  if (!contactCols.has('college_req')) await db.run('ALTER TABLE contacts ADD COLUMN college_req TEXT');
  const insCols = new Set((await db.all('PRAGMA table_info(instructors)')).map(r => r.name));
  if (!insCols.has('company')) await db.run('ALTER TABLE instructors ADD COLUMN company TEXT');
  await db.run(`CREATE TABLE IF NOT EXISTS whatsapp_groups (
    program TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`);
  await seed();
}

// ---------- programme WhatsApp groups (only revealed after a saved application) ----------
const WA_GROUP_RE = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,40}\/?(\?[A-Za-z0-9_=&.-]*)?$/;
async function whatsappGroups() {
  const out = {};
  for (const r of await db.all('SELECT program, url FROM whatsapp_groups')) out[r.program] = r.url;
  return out;
}
async function whatsappGroupFor(program) {
  const r = await db.get('SELECT url FROM whatsapp_groups WHERE program = ?', program);
  return r && WA_GROUP_RE.test(r.url) ? r.url : null;
}
async function saveWhatsappGroups(map) {
  const stmts = Object.entries(map).map(([program, url]) => url
    ? ["INSERT INTO whatsapp_groups (program, url, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now')) ON CONFLICT(program) DO UPDATE SET url = excluded.url, updated_at = excluded.updated_at", program, url]
    : ['DELETE FROM whatsapp_groups WHERE program = ?', program]);
  if (stmts.length) await db.batch(stmts);
}

// ---------- reads ----------
const ORDER = 'ORDER BY sort_order, id';
const listAll = e => db.all(`SELECT * FROM ${ENTITIES[e].table} ${ORDER}`);
const listPublished = e => db.all(`SELECT * FROM ${ENTITIES[e].table} WHERE published = 1 ${ORDER}`);
const getById = (e, id) => db.get(`SELECT * FROM ${ENTITIES[e].table} WHERE id = ?`, id);
const lines = v => String(v || '').split('\n').map(s => s.trim()).filter(Boolean);

function shapeProgram(p, s) {
  return {
    ...p,
    coversList: lines(p.covers),
    toolsList: lines(p.tools),
    curriculumList: lines(p.curriculum).map(l => {
      const [head, topics = '', task = ''] = l.split('|');
      const m = head.match(/^\s*([^:]+):\s*(.*)$/);
      const sep = topics.includes(';') ? ';' : ',';
      const t = task.trim().match(/^([^:]{2,24}):\s*(.+)$/);
      return { label: m ? m[1].trim() : '', title: (m ? m[2] : head).trim(), topics: topics.split(sep).map(x => x.trim()).filter(Boolean),
        taskLabel: t ? t[1].trim() : (task.trim() ? 'Hands-on' : ''), task: t ? t[2].trim() : task.trim() };
    }),
    batchesList: lines(p.batches).map(l => { const [start = '', timing = '', seats = ''] = l.split('|').map(x => x.trim()); return { start, timing, seats }; }),
    training: p.duration_training || s.intern_training,
    internship: p.duration_internship || s.intern_work,
    feeText: p.fee || 'Contact for fees',
    modeText: p.mode || 'Live online'
  };
}
async function publishedPrograms(s) { return (await listPublished('programs')).map(p => shapeProgram(p, s)); }
async function programBySlug(slug, s) {
  const p = await db.get('SELECT * FROM programs WHERE slug = ? AND published = 1', slug);
  return p ? shapeProgram(p, s) : null;
}

// ---------- writes ----------
const slugify = v => String(v || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
function isSafeUrl(v, { allowRelative = false } = {}) {
  if (allowRelative && /^\/[A-Za-z0-9/_\-.]+$/.test(v)) return true;
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; } catch (_) { return false; }
}
function validate(entity, body, clean) {
  const errors = {}, values = {};
  for (const f of ENTITIES[entity].fields) {
    let v = clean(body[f.name]);
    if (f.type === 'bool') { values[f.name] = body[f.name] ? 1 : 0; continue; }
    if (f.type === 'number') {
      if (v === '') { if (f.required) errors[f.name] = `Please enter ${f.label.toLowerCase()}.`; values[f.name] = f.required ? '' : 0; continue; }
      const n = Number(v);
      if (!Number.isInteger(n) || n < (f.min || 0) || n > f.max) errors[f.name] = `Use a whole number from ${f.min || 0} to ${f.max}.`;
      values[f.name] = Number.isInteger(n) ? n : v; continue;
    }
    if (f.type === 'slug') v = slugify(v || body.name);
    values[f.name] = v;
    if (!v) { if (f.required) errors[f.name] = `Please enter ${f.label.toLowerCase()}.`; continue; }
    const max = f.max || 500;
    if (v.length > max) errors[f.name] = `Please keep this under ${max} characters.`;
    if (f.type === 'select' && !f.options.includes(v)) errors[f.name] = 'Please choose from the list.';
    if ((f.type === 'url' || f.type === 'image') && !isSafeUrl(v, { allowRelative: f.type === 'image' })) errors[f.name] = 'Please enter a full link starting with https://';
  }
  if (entity === 'programs' && !values.slug) errors.slug = 'Please enter a slug.';
  return { errors, values };
}
async function save(entity, id, values) {
  const e = ENTITIES[entity];
  const cols = e.fields.map(f => f.name);
  const args = cols.map(c => values[c] === '' ? null : values[c]);
  if (id) {
    await db.run(`UPDATE ${e.table} SET ${cols.map(c => c + ' = ?').join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`, ...args, id);
    return id;
  }
  const r = await db.run(`INSERT INTO ${e.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...args);
  return Number(r.lastInsertRowid);
}
const remove = (entity, id) => db.run(`DELETE FROM ${ENTITIES[entity].table} WHERE id = ?`, id);

module.exports = { WA_GROUP_RE, whatsappGroups, whatsappGroupFor, saveWhatsappGroups, ENTITIES, migrate, listAll, listPublished, getById, publishedPrograms, programBySlug, validate, save, remove, slugify };
