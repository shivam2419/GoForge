'use strict';
// Programme overview PDF (/internship/overview.pdf): a one-document summary for students and college training cells.
// Built with pdfkit and bundled fonts (assets/fonts: Inter for text and the rupee sign, Cormorant for headings),
// so the output is the same everywhere, including Vercel. Content comes from the same data as /internship/overview.
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const LOGO = path.join(__dirname, '..', 'assets', 'gf-logo-256.png');
const C = { navy: '#1B2744', navyDeep: '#141C30', gold: '#CAA465', goldDeep: '#7C5C20', ink2: '#47526C', paper: '#F0ECE3', sheet: '#FBF8F2', line: '#DDD5C4', goldWash: '#F6EEDD' };
const M = 48; // page margin (pt)
const W = 595.28 - M * 2; // text width on A4

const rupees = n => '\u20B9' + Number(n).toLocaleString('en-IN');
const months = n => n + ' month' + (n > 1 ? 's' : '');
const cap = s => (s || '').charAt(0).toLowerCase() + (s || '').slice(1);

function programmeContent({ settings = {}, brand, tracks = [], lengths = [], batch = {} }) {
  const open = !!batch.open;
  return {
    title: 'Training + Internship Programme Overview',
    lead: 'A one-page summary for students and college training cells. Every training certificate and internship letter carries an ID that colleges and employers can verify online.',
    lengths,
    how: [
      'Training is live online. The internship is supervised and follows the training.',
      'Who can apply: BTech, BCA, MCA and similar courses, and recent graduates.',
      'Projects and internship are included in the fee.',
      open ? batch.summary + '.' : 'Next batch: dates are shared on a free counselling call.',
      ...(open ? (batch.schedules || []).map(b => b.name + ': ' + b.days + ', ' + b.time + ' (' + b.startsLabel + ').') : []),
      ...(open ? ['Only ' + batch.seatCap + ' seats per schedule.'] : []),
      'Every class is recorded. Students can pause during college exams, or switch once to a later batch at no cost.'
    ],
    receive: [
      'Skills in the chosen role, and one project the student can explain.',
      'A training certificate.',
      'An internship letter naming GoForge Digital, the student, the college and course, the role, the exact dates, that the work was online, two or three lines on the work, and ' + brand.founder + ', ' + brand.founderRole + ', with a phone and email so the letter can be checked.'
    ],
    college: [
      'Issued by an MSME-registered company (Udyam No. ' + (brand.udyam || 'UDYAM-HR-03-0170735') + '), with a signatory colleges can contact.',
      'College-specific formats, hours or an NOC prepared on request.',
      'Each college sets its own internship rules. Check the weeks or hours your college needs, then choose the matching programme.'
    ],
    project: 'The project matches your programme: real studio work or an industry-style project, reviewed by a mentor.',
    roles: tracks,
    check: [
      'Confirm your college\u2019s internship rule: weeks or hours, dates, and any NOC or format it needs.',
      'Choose the programme that matches it, and bring your deadline to the counselling call.',
      'Verify any certificate or letter with its ID at ' + brand.website + '/verify.'
    ],
    next: 'Book a free counselling call: ' + [settings.phone1, settings.phone2].filter(Boolean).join(' or ') + ', ' + (brand.email || 'info@goforgedigital.com') + ', or ' + brand.website + '/counselling.',
    address: [brand.address.line1, brand.address.line2, brand.address.region + ' ' + brand.address.postalCode].join(', '),
    website: brand.website
  };
}

function render(c) {
  const PDFDocument = require('pdfkit'); // loaded on first use, so the PDF route can never take the rest of the site down
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margins: { top: M, bottom: 58, left: M, right: M }, bufferPages: true, autoFirstPage: true, font: path.join(FONT_DIR, 'Inter-Regular.ttf'),
      info: { Title: 'GoForge Digital: ' + c.title, Author: 'GoForge Digital', Subject: 'Training + internship programme overview', Keywords: 'GoForge Digital, training, internship, Faridabad' }
    });
    const chunks = [];
    doc.on('data', d => chunks.push(d)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.registerFont('Body', path.join(FONT_DIR, 'Inter-Regular.ttf'));
    doc.registerFont('Bold', path.join(FONT_DIR, 'Inter-Bold.ttf'));
    doc.registerFont('Head', path.join(FONT_DIR, 'Cormorant-Bold.ttf'));
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const room = h => { if (doc.y + h > bottom()) { doc.addPage(); runningHead(); } };

    function runningHead() {
      doc.rect(0, 0, doc.page.width, 6).fill(C.navy);
      doc.rect(0, 6, doc.page.width, 2).fill(C.gold);
      doc.y = M - 10;
    }

    // First-page header band: navy, logo, wordmark and title.
    doc.rect(0, 0, doc.page.width, 128).fill(C.navy);
    doc.rect(0, 128, doc.page.width, 3).fill(C.gold);
    doc.image(LOGO, M, 28, { height: 34 });
    doc.font('Head').fontSize(22).fillColor('#FFFFFF').text('GoForge Digital', M + 66, 31, { lineBreak: false, characterSpacing: 1.2 });
    doc.font('Body').fontSize(8.5).fillColor(C.gold).text('SOFTWARE COMPANY \u00B7 TRAINING + INTERNSHIP \u00B7 FARIDABAD', M, 74, { characterSpacing: 1.2, width: W });
    doc.font('Head').fontSize(25).fillColor('#FFFFFF').text(c.title, M, 90, { width: W });
    doc.y = 150;

    const lead = () => { doc.font('Body').fontSize(10.5).fillColor(C.ink2).text(c.lead, M, doc.y, { width: W, lineGap: 3 }); doc.moveDown(0.9); };
    const heading = t => {
      room(60);
      doc.font('Bold').fontSize(8.5).fillColor(C.goldDeep).text(t.toUpperCase(), M, doc.y, { characterSpacing: 1.4, width: W });
      const y = doc.y + 3; doc.moveTo(M, y).lineTo(M + 28, y).lineWidth(1.5).strokeColor(C.gold).stroke();
      doc.y = y + 8;
    };
    const bullets = (items, o = {}) => items.forEach(t => {
      doc.font('Body').fontSize(9.5);
      const h = doc.heightOfString(t, { width: W - 16, lineGap: 2 });
      room(h + 6);
      const y = doc.y;
      doc.circle(M + 3, y + 4.8, 1.6).fill(C.gold);
      doc.fillColor(C.navy).text(t, M + 16, y, { width: W - 16, lineGap: 2 });
      doc.y += 3;
    });

    lead();

    // Two programme cards.
    heading('Two programmes, 3 or 6 months');
    const gap = 14, cw = (W - gap) / 2, ch = 138, top = doc.y;
    room(ch + 10);
    const y0 = doc.y;
    c.lengths.forEach((t, i) => {
      const x = M + i * (cw + gap);
      doc.roundedRect(x, y0, cw, ch, 8).fillAndStroke(C.sheet, C.line);
      doc.rect(x, y0 + 14, 3, ch - 28).fill(C.gold);
      doc.font('Bold').fontSize(8).fillColor(C.goldDeep).text(t.name.toUpperCase(), x + 18, y0 + 16, { width: cw - 30, characterSpacing: 1 });
      doc.font('Bold').fontSize(26).fillColor(C.navy).text(rupees(t.price), x + 18, y0 + 30, { width: cw - 30 });
      doc.font('Body').fontSize(8.5).fillColor(C.ink2).text('All-inclusive fee, paid once', x + 18, y0 + 64, { width: cw - 30 });
      // training / internship split bar
      const bx = x + 18, bw = cw - 36, by = y0 + 80, tw = bw * t.trainingMonths / t.months;
      doc.roundedRect(bx, by, tw - 1, 7, 2).fill(C.gold);
      doc.roundedRect(bx + tw + 1, by, bw - tw - 1, 7, 2).fill(C.navy);
      doc.font('Bold').fontSize(9).fillColor(C.navy).text(months(t.trainingMonths) + ' training + ' + months(t.internshipMonths) + ' internship', x + 18, by + 13, { width: cw - 30 });
      doc.font('Body').fontSize(8.5).fillColor(C.ink2).text('Best for ' + cap(t.bestFor), x + 18, by + 27, { width: cw - 30, lineGap: 1.5 });
    });
    doc.y = y0 + ch + 16;

    heading('How it runs'); bullets(c.how);
    doc.moveDown(0.3);
    heading('What you receive'); bullets(c.receive);
    doc.moveDown(0.3);
    heading('College support'); bullets(c.college);
    doc.moveDown(0.3);
    heading('How a project is chosen'); bullets([c.project]);
    doc.moveDown(0.3);

    heading('Programme roles');
    c.roles.forEach(r => {
      doc.font('Bold').fontSize(10.5);
      const parts = [];
      if (r.summary) parts.push(r.summary);
      if (r.tools && r.tools.length) parts.push('Tools and practice: ' + r.tools.join('; ') + '.');
      if (r.project) parts.push('Typical project: ' + r.project);
      const body = parts.join(' ');
      doc.font('Body').fontSize(9);
      const h = 15 + doc.heightOfString(body, { width: W - 14, lineGap: 1.8 });
      room(h + 8);
      const y = doc.y;
      doc.rect(M, y + 1, 3, h - 4).fill(C.gold);
      doc.font('Bold').fontSize(10.5).fillColor(C.navy).text(r.name, M + 14, y, { width: W - 14 });
      doc.font('Body').fontSize(9).fillColor(C.ink2).text(body, M + 14, y + 15, { width: W - 14, lineGap: 1.8 });
      doc.y = y + h + 5;
    });
    doc.moveDown(0.4);

    heading('Check before you join'); bullets(c.check);
    doc.moveDown(0.5);

    // Next step band
    doc.font('Body').fontSize(10);
    const nh = doc.heightOfString(c.next, { width: W - 36, lineGap: 3 }) + 40;
    room(nh + 6);
    const ny = doc.y;
    doc.roundedRect(M, ny, W, nh, 8).fill(C.navy);
    doc.font('Bold').fontSize(8.5).fillColor(C.gold).text('NEXT STEP', M + 18, ny + 14, { characterSpacing: 1.4 });
    doc.font('Body').fontSize(10).fillColor('#FFFFFF').text(c.next, M + 18, ny + 28, { width: W - 36, lineGap: 3 });
    doc.y = ny + nh;

    // Footer + page numbers on every page.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      const fy = doc.page.height - 44;
      doc.moveTo(M, fy).lineTo(M + W, fy).lineWidth(0.6).strokeColor(C.line).stroke();
      doc.font('Body').fontSize(7.8).fillColor(C.ink2).text('GoForge Digital \u00B7 ' + c.address + ' \u00B7 ' + c.website, M, fy + 9, { width: W - 40, lineBreak: false });
      doc.text((i + 1) + ' / ' + range.count, M + W - 40, fy + 9, { width: 40, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

function programmePdf(input) { return render(programmeContent(input)); }

module.exports = { programmePdf, programmeContent };
