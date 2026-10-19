'use strict';
// November 2026 batch, the real seat cap, referral and the free webinar.
// Every date here is real and fixed. Deadline-based items hide themselves after their date
// (checked on the server in Asia/Kolkata); there are no countdown timers anywhere.
// To run a later batch, edit this file (or add batch rows per programme in Admin > Programmes).

const IST = '+05:30';
const at = local => Date.parse(local + IST); // 'YYYY-MM-DDTHH:MM:SS' in India time

const KEY_DATES = {
  webinarEnds: at('2026-10-24T12:00:00'),
  registrationCloses: at('2026-10-28T23:59:59')
};

// A real cap: each batch (weekday and weekend) takes at most this many students. No 'seats left' counter is shown,
// because enrolments are not tracked on the site; only the fixed cap is.
const SEAT_CAP = 25;
const REGISTRATION = { closes: 'Wed 28 Oct 2026', closesShort: 'Wed 28 Oct' };
const REFERRAL = {
  friend: 200, referrer: 200,
  terms: 'Refer a friend: your friend gets ₹200 off, and you get ₹200 by UPI once they complete their first week.'
};
const WEBINAR = {
  title: 'Free orientation webinar',
  date: 'Sat 24 Oct 2026', time: '11:00 AM to 12:00 PM IST', mode: 'Live online',
  interest: 'Free webinar (Sat 24 Oct, 11 AM)',
  points: ['How the 3-Month and 6-Month programmes work', 'Which one fits your college internship rule', 'Batch timings, the Diwali break and exam pauses', 'Your questions, answered live']
};

const BATCH_LABEL = 'November 2026 batch';
const NEXT_AFTER = 'January 2027';
const BATCHES = [
  {
    key: 'weekday', name: 'Weekday batch', days: 'Mon to Fri', time: '7:30 to 9:00 PM IST',
    starts: 'Mon 2 Nov 2026', startsShort: 'Mon 2 Nov',
    notes: ['Fridays are doubt and project sessions', 'Diwali break 7 to 11 Nov; classes resume Thu 12 Nov']
  },
  {
    key: 'weekend', name: 'Weekend batch', days: 'Sat and Sun', time: '11:00 AM to 2:00 PM IST',
    starts: 'Sat 14 Nov 2026', startsShort: 'Sat 14 Nov',
    notes: ['Includes a 15-minute break', 'Orientation on Sun 1 Nov; classes from Sat 14 Nov']
  }
];
const BATCH_PROMISES = [
  'Live online, and every class is recorded',
  'Exam-friendly: pause during your college exams, or switch once to the ' + NEXT_AFTER + ' batch at no cost'
];
const BATCH_PREFS = ['Weekday (Mon to Fri, 7:30 to 9:00 PM)', 'Weekend (Sat and Sun, 11 AM to 2 PM)', 'Not sure yet'];

// Local testing only: GF_NOW=2026-10-26T10:00:00+05:30 previews the site on another date. Ignored on Vercel and in production.
function nowMs() {
  const fake = process.env.GF_NOW;
  if (fake && !process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    const t = Date.parse(fake);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

// Seats filled (a number the admin enters) against the fixed cap. Shown only when at least 1.
function seatInfo(value) {
  const n = Math.max(0, Math.min(SEAT_CAP, parseInt(value, 10) || 0));
  return { filled: n, cap: SEAT_CAP, show: n >= 1, full: n >= SEAT_CAP, pct: Math.round(100 * n / SEAT_CAP) };
}

const inr = n => '₹' + Number(n).toLocaleString('en-IN');

function offerState(now = nowMs()) {
  const registrationOpen = now <= KEY_DATES.registrationCloses;
  const webinar = now < KEY_DATES.webinarEnds;
  return { registrationOpen, webinar, priceOf: t => t.price, fromPrice: tracks => Math.min(...tracks.map(t => t.price)) };
}

// Admin batch rows ("2 Nov 2026 | Mon–Fri, 7:30–9 PM | ...") hide once their start date has passed.
function upcomingRows(rows, now = nowMs()) {
  return rows.filter(r => {
    const m = String(r.start || '').match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
    if (!m) return true;
    const t = Date.parse(`${m[1]} ${m[2]} ${m[3]} 23:59:59 GMT${IST.replace(':', '')}`);
    return Number.isNaN(t) || t >= now;
  });
}

module.exports = { seatInfo, KEY_DATES, SEAT_CAP, REGISTRATION, REFERRAL, WEBINAR, BATCH_LABEL, NEXT_AFTER, BATCHES, BATCH_PROMISES, BATCH_PREFS, offerState, upcomingRows, nowMs, inr };
