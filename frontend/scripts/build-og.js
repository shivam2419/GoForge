'use strict';
// Builds the Open Graph share cards in public/img/og/ from scripts/og/og.html with headless Chrome.
// Usage: node scripts/build-og.js (ONLY=webinar to build one card)   (CHROME=/path/to/chrome to override). Rerun after renaming a programme or changing prices.
const { execFileSync } = require('child_process');
const path = require('path');
const { CAREER_TRACKS, TRACK_DETAILS } = require('../lib/content');
const src = 'file://' + path.join(__dirname, 'og', 'og.html');
const outDir = path.join(__dirname, '..', 'public', 'img', 'og');
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const prices = CAREER_TRACKS.map(t => t.months + '-Month ' + inr(t.price));
const foot = 'Live online · MSME-registered · Certificates you can verify · goforgedigital.com';
const cards = [
  { name: 'internship', eyebrow: 'Training + internship', title: 'Learn live. Then', em: 'intern on real work.', chips: [...prices, '3 or 6 months'], goldFirst: true, foot },
  { name: 'counselling', eyebrow: 'Free counselling call', title: 'Pick the right', em: 'programme for you.', chips: ['Free', '15 minutes', 'No obligation'], goldFirst: true, foot },
  { name: 'webinar', eyebrow: 'Free live webinar · Sat 24 Oct, 11 AM IST', title: 'College-accepted internship', em: '+ AI tools for your career.', chips: ['Free', '60 min', 'Live Q&A', 'Google Meet'], goldFirst: true, foot: 'Hosted by Rohit Sharma, Founder · Register free at goforgedigital.com/webinar' },
  { name: 'services', eyebrow: 'Software · CRM · ERP · Websites', title: 'Custom software', em: 'built around you.', chips: ['Free consultation', 'Faridabad + online'], goldFirst: true, foot: 'MSME-registered software company · Sector 81, Faridabad · goforgedigital.com' },
  ...(TRACK_DETAILS || []).map(p => ({ name: 'program-' + p.slug, eyebrow: 'Training with internship', title: p.name, em: '3 or 6 months.', chips: prices, goldFirst: true, foot }))
];
// ONLY=webinar,internship builds just those cards.
const only = (process.env.ONLY || '').split(',').filter(Boolean);
for (const c of cards.filter(x => !only.length || only.includes(x.name))) {
  const out = path.join(outDir, c.name + '.png');
  execFileSync(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1200,630', '--virtual-time-budget=3000', '--screenshot=' + out, src + '#' + encodeURIComponent(JSON.stringify(c))], { stdio: 'ignore' });
  console.log('Wrote', path.relative(process.cwd(), out));
}
