'use strict';
// January 2027 batch, the real seat cap, referral and the historical webinar record.
// Every date here is real and fixed. Deadline-based items hide themselves after their date
// (checked on the server in Asia/Kolkata); there are no countdown timers anywhere.
// To run a later batch, edit this file (or add batch rows per programme in Admin > Programmes).

const IST = '+05:30';
const at = local => Date.parse(local + IST); // 'YYYY-MM-DDTHH:MM:SS' in India time

const KEY_DATES = {
  webinarEnds: at('2026-10-24T12:00:00'),
  registrationCloses: at('2027-01-05T23:59:59')
};

// A real cap: each schedule (weekday and weekend) takes at most this many students. No 'seats left' counter is shown,
// because enrolments are not tracked on the site; only the fixed cap is.
const SEAT_CAP = 25;
const REGISTRATION = { closes: 'Tue 5 Jan 2027', closesFull: '5 January 2027', closesShort: 'Tue 5 Jan' };
const REFERRAL = {
  friend: 200, referrer: 200,
  terms: 'Refer a friend: your friend gets ₹200 off, and you get ₹200 by UPI once they complete their first week.'
};
// The ended 24 Oct 2026 webinar. Kept untouched for /webinar and historical counselling validation.
const WEBINAR = {
  title: 'Free Webinar: College-Accepted Internship + AI Tools for Your Career',
  short: 'Free live webinar',
  date: 'Sat 24 Oct 2026', dateShort: 'Sat 24 Oct', time: '11:00 AM–12:00 PM IST', timeShort: '11 AM',
  mode: 'Live on Google Meet',
  startIso: '2026-10-24T11:00:00+05:30', endIso: '2026-10-24T12:00:00+05:30',
  startUtc: '20261024T053000Z', endUtc: '20261024T063000Z', // for Google Calendar and .ics
  host: 'Rohit Sharma', hostRole: 'Founder, GoForge Digital',
  interest: 'Free webinar (Sat 24 Oct, 11 AM)',
  points: ['The internship problem students face', 'How to pick a track your college accepts', 'Live mini-project demo', 'Q&A + batch details'],
  poster: { base: '/img/webinar/webinar-poster', w: 1080, h: 1350 },
  meetUrl: process.env.WEBINAR_MEET_URL || 'https://meet.google.com/dhk-pchn-zqx'
};
// Everything templates may print. No meeting link.
const WEBINAR_PUBLIC = Object.freeze(Object.fromEntries(Object.entries(WEBINAR).filter(([k]) => k !== 'meetUrl')));

const BATCH_LABEL = 'January 2027 batch';
const BATCH_STARTS = 'Fri 8 Jan 2027';
const BATCH_STARTS_FULL = '8 January 2027';
const BATCH_STARTS_SHORT = 'Fri 8 Jan';
const BATCH_SUMMARY = 'January 2027 batch — starts 8 January 2027 · choose weekday or weekend schedule · registration closes 5 January 2027';
const NEXT_AFTER = 'next';
const BATCHES = [
  {
    key: 'weekday', name: 'Weekday schedule', days: 'Mon to Fri', time: '7:30 to 9:00 PM IST',
    when: 'Mon–Fri · 7:30–9:00 PM IST',
    note: 'Starts Fri 8 Jan 2027. Mon to Fri, 7:30 to 9:00 PM IST.',
    starts: 'Fri 8 Jan 2027', startsShort: 'Fri 8 Jan', startsLabel: 'Starts Fri 8 Jan 2027',
    notes: ['First weekday class on Fri 8 Jan 2027', 'Live online with recordings shared']
  },
  {
    key: 'weekend', name: 'Weekend schedule', days: 'Sat and Sun', time: '11:00 AM to 2:00 PM IST',
    when: 'Sat–Sun · 11 AM–2 PM IST, 15-min break',
    note: 'Part of the 8 Jan batch; first weekend class Sat 9 Jan 2027. Includes a 15-min break.',
    starts: 'Sat 9 Jan 2027', startsShort: 'Sat 9 Jan', startsLabel: 'First class Sat 9 Jan 2027',
    notes: ['First weekend class on Sat 9 Jan 2027', 'Includes a 15-minute break']
  }
];
const SCHEDULE_NOTE = 'Both schedules follow the same syllabus and fee; recordings are shared for missed classes; students may switch schedule once if seats are free.';
const BATCH_PROMISES = [
  'Live online, and every class is recorded',
  'Exam-friendly: pause during your college exams, or switch once to the ' + NEXT_AFTER + ' batch at no cost'
];
const BATCH_PREFS = [
  'Weekday (Mon to Fri, 7:30 to 9:00 PM IST — starts Fri 8 Jan 2027)',
  'Weekend (Sat and Sun, 11:00 AM to 2:00 PM IST — first class Sat 9 Jan 2027)',
  'Not sure yet'
];

// Local testing only: GF_NOW=2026-12-10T10:00:00+05:30 previews the site on another date. Ignored on Vercel and in production.
function nowMs() {
  const fake = process.env.GF_NOW;
  if (fake && !process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    const t = Date.parse(fake);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

// Seats filled (a number the admin enters) against the fixed cap. Shown only when at least 1.
function seatInfo(value, cap = SEAT_CAP) {
  const maxCap = Math.max(1, parseInt(cap, 10) || SEAT_CAP);
  const n = Math.max(0, Math.min(maxCap, parseInt(value, 10) || 0));
  const pct = Math.round(100 * n / maxCap);
  return { filled: n, cap: maxCap, left: maxCap - n, show: n >= 1, full: n >= maxCap, pct, hot: pct >= 60 && n < maxCap };
}

const inr = n => '₹' + Number(n).toLocaleString('en-IN');

function offerState(now = nowMs()) {
  const registrationOpen = now <= KEY_DATES.registrationCloses;
  const webinar = now < KEY_DATES.webinarEnds;
  return { registrationOpen, webinar, priceOf: t => t.price, fromPrice: tracks => Math.min(...tracks.map(t => t.price)) };
}

// Admin batch rows ("8 Jan 2027 | Mon–Fri, 7:30–9 PM | ...") hide once their start date has passed.
function upcomingRows(rows, now = nowMs()) {
  return rows.filter(r => {
    const m = String(r.start || '').match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
    if (!m) return true;
    const t = Date.parse(`${m[1]} ${m[2]} ${m[3]} 23:59:59 GMT${IST.replace(':', '')}`);
    return Number.isNaN(t) || t >= now;
  });
}

// The January 2027 batch at a glance, oldest first. Each step is marked done once its own date has passed (server time, IST).
// Steps without a fixed date ('after month 1' etc.) are relative and never marked done.
const TIMELINE = [
  { date: 'Tue 5 Jan 2027', title: 'Registration closes', text: 'Last day to register for the January 2027 batch and choose your schedule.', ends: at('2027-01-05T23:59:59') },
  { date: 'Fri 8 Jan 2027', title: 'January 2027 batch starts', text: 'Weekday schedule (Mon to Fri, 7:30 to 9:00 PM IST) begins.', ends: at('2027-01-08T23:59:59') },
  { date: 'Sat 9 Jan 2027', title: 'First weekend class', text: 'Weekend schedule (Sat and Sun, 11:00 AM to 2:00 PM IST) begins.', ends: at('2027-01-09T23:59:59') },
  { date: 'After month 1 or 3', title: 'Internship begins', text: 'Month 2 on the 3-Month Programme, month 4 on the 6-Month.', ends: null },
  { date: 'At the end', title: 'Certificate + letter', text: 'Training certificate and an internship letter with an ID anyone can verify.', ends: null }
];
function timeline(now = nowMs()) {
  let nextMarked = false;
  return TIMELINE.map(t => {
    const done = t.ends !== null && now > t.ends;
    const next = !done && !nextMarked; if (next) nextMarked = true;
    return { ...t, done, next };
  });
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parseIstDate(str, fallbackFull, fallbackIso) {
  const s = String(str || '').trim() || fallbackFull;
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/) || s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let ms = NaN;
  if (m) {
    const dStr = m[0].includes('-') ? `${m[1]}-${m[2]}-${m[3]}T00:00:00+05:30` : `${m[1]} ${m[2]} ${m[3]} 00:00:00 GMT+0530`;
    ms = Date.parse(dStr);
  }
  if (Number.isNaN(ms)) {
    const fb = Date.parse(fallbackIso);
    return { full: s, withDay: s, short: s, endMs: Number.isNaN(fb) ? null : fb };
  }
  const dt = new Date(ms + 19800000); // shift to UTC components matching IST
  const wd = DAYS[dt.getUTCDay()];
  const day = dt.getUTCDate();
  const mon = MONTHS[dt.getUTCMonth()];
  const yr = dt.getUTCFullYear();
  return {
    full: s,
    withDay: `${wd} ${day} ${mon} ${yr}`,
    short: `${wd} ${day} ${mon}`,
    endMs: ms + 86399000 // 23:59:59 IST
  };
}

function batchView(settings = {}, now = nowMs()) {
  const label = String(settings.batch_label || '').trim() || BATCH_LABEL;
  const starts = parseIstDate(settings.batch_starts, BATCH_STARTS_FULL, '2027-01-08T00:00:00+05:30');
  const wknd = parseIstDate(settings.batch_first_weekend, '9 January 2027', '2027-01-09T00:00:00+05:30');
  const deadline = parseIstDate(settings.batch_deadline, REGISTRATION.closesFull, '2027-01-05T23:59:59+05:30');
  const weekdayTiming = String(settings.batch_weekday_timing || '').trim() || 'Mon to Fri, 7:30 to 9:00 PM IST';
  const weekendTiming = String(settings.batch_weekend_timing || '').trim() || 'Sat and Sun, 11:00 AM to 2:00 PM IST';
  const seatCap = Math.max(1, parseInt(settings.seat_cap, 10) || SEAT_CAP);
  const scheduleNote = String(settings.schedule_note || '').trim() || SCHEDULE_NOTE;
  const regClosesMs = deadline.endMs || KEY_DATES.registrationCloses;
  const offer = {
    registrationOpen: now <= regClosesMs,
    webinar: now < KEY_DATES.webinarEnds,
    priceOf: t => t.price,
    fromPrice: tracks => Math.min(...tracks.map(t => t.price))
  };
  const batches = [
    {
      key: 'weekday', name: 'Weekday schedule', days: weekdayTiming.split(',')[0] || 'Mon to Fri',
      time: weekdayTiming.split(',').slice(1).join(',').trim() || weekdayTiming,
      when: weekdayTiming,
      note: `Starts ${starts.withDay}. ${weekdayTiming}.`,
      starts: starts.withDay, startsShort: starts.short, startsLabel: 'Starts ' + starts.withDay,
      notes: ['First weekday class on ' + starts.withDay, 'Live online with recordings shared']
    },
    {
      key: 'weekend', name: 'Weekend schedule', days: weekendTiming.split(',')[0] || 'Sat and Sun',
      time: weekendTiming.split(',').slice(1).join(',').trim() || weekendTiming,
      when: weekendTiming + ', 15-min break',
      note: `Part of the ${starts.full} batch; first weekend class ${wknd.withDay}. Includes a 15-min break.`,
      starts: wknd.withDay, startsShort: wknd.short, startsLabel: 'First class ' + wknd.withDay,
      notes: ['First weekend class on ' + wknd.withDay, 'Includes a 15-minute break']
    }
  ];
  const batchPrefs = [
    `Weekday (${weekdayTiming} — starts ${starts.withDay})`,
    `Weekend (${weekendTiming} — first class ${wknd.withDay})`,
    'Not sure yet'
  ];
  const summary = `${label} — starts ${starts.full} · choose weekday or weekend schedule · registration closes ${deadline.full}`;
  const reg = { closes: deadline.withDay, closesFull: deadline.full, closesShort: deadline.short };
  const tlItems = [
    { date: deadline.withDay, title: 'Registration closes', text: `Last day to register for the ${label} and choose your schedule.`, ends: regClosesMs },
    { date: starts.withDay, title: `${label} starts`, text: `Weekday schedule (${weekdayTiming}) begins.`, ends: starts.endMs },
    { date: wknd.withDay, title: 'First weekend class', text: `Weekend schedule (${weekendTiming}) begins.`, ends: wknd.endMs },
    { date: 'After month 1 or 3', title: 'Internship begins', text: 'Month 2 on the 3-Month Programme, month 4 on the 6-Month.', ends: null },
    { date: 'At the end', title: 'Certificate + letter', text: 'Training certificate and an internship letter with an ID anyone can verify.', ends: null }
  ];
  let nextMarked = false;
  const tl = tlItems.map(t => {
    const done = t.ends !== null && now > t.ends;
    const next = !done && !nextMarked; if (next) nextMarked = true;
    return { ...t, done, next };
  });
  return {
    offer,
    SEAT_CAP: seatCap,
    SEATS: { weekday: seatInfo(settings.seats_weekday, seatCap), weekend: seatInfo(settings.seats_weekend, seatCap) },
    REGISTRATION: reg,
    BATCH_LABEL: label,
    BATCH_STARTS: starts.withDay,
    BATCH_STARTS_FULL: starts.full,
    BATCH_STARTS_SHORT: starts.short,
    BATCH_SUMMARY: summary,
    SCHEDULE_NOTE: scheduleNote,
    BATCHES: batches,
    BATCH_PREFS: batchPrefs,
    TIMELINE: tl
  };
}

module.exports = {
  timeline, seatInfo, KEY_DATES, SEAT_CAP, REGISTRATION, REFERRAL, WEBINAR, WEBINAR_PUBLIC,
  BATCH_LABEL, BATCH_STARTS, BATCH_STARTS_FULL, BATCH_STARTS_SHORT, BATCH_SUMMARY,
  NEXT_AFTER, BATCHES, BATCH_PROMISES, BATCH_PREFS, SCHEDULE_NOTE, offerState, batchView, upcomingRows, nowMs, inr
};
