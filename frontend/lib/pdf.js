'use strict';

function escapePdf(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function programmeLines({ settings, brand, tracks }) {
  const lines = [
    '# Goforge Digital',
    'Internship programme overview',
    brand.address.line1 + ', ' + brand.address.line2 + ', ' + brand.address.region,
    'goforgedigital.com',
    '',
    'This page is a summary for students and for a college training cell.',
    'It is not a promise that a college will accept the internship.',
    '',
    '# How it runs',
    'Training: ' + settings.intern_training + ', live online.',
    'Internship: ' + settings.intern_work + ', supervised, after the training.',
    'Who can apply: BTech, BCA and similar courses.',
    'Fee: ' + settings.intern_fee + '.',
    'Batch dates are confirmed on a call. They are not printed here.',
    '',
    '# What you receive if you finish the work',
    '- Skills in the role you chose.',
    '- One project you can explain.',
    '- A training note.',
    '- An internship letter with your name, college, role, exact dates,',
    '  that the work was online, two or three lines on the work you did,',
    '  and a signatory who can be contacted to check the letter.',
    '',
    '# What you do not receive',
    '- A certificate if the work was not done.',
    '- A job guarantee.',
    '- A promise that your college will count this internship.',
    '  Ask your training and placement cell before you pay.',
    '',
    '# How a project is chosen',
    'The project matches the role. It is a small piece of studio work',
    'you are ready for, or a practice project of the same shape if there',
    'is no suitable client task. The letter does not invent a client.',
    '',
    '# Roles'
  ];
  tracks.forEach(track => {
    lines.push(track.name);
    lines.push('Tools: ' + track.tools.join(', ') + '.');
    lines.push(track.project);
    lines.push('');
  });
  lines.push('# Check before you join');
  lines.push('Show this overview to your college. If they need hours, an NOC,');
  lines.push('or a different format, say so on the call. If they say no, do not');
  lines.push('join only for the letter.');
  lines.push('');
  lines.push('Goforge Digital  |  ' + brand.website);
  return lines;
}

function programmePdf(lines) {
  const per = 42;
  const chunks = [];
  for (let i = 0; i < lines.length; i += per) chunks.push(lines.slice(i, i + per));
  const count = chunks.length;
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const kids = [];
  chunks.forEach((chunk, index) => {
    const contentId = 4 + index * 2;
    const pageId = contentId + 1;
    kids.push(pageId);
    const parts = ['BT', '/F1 10 Tf', '48 800 Td', '14 TL'];
    chunk.forEach((line, lineIndex) => {
      const heading = line.startsWith('# ');
      const text = heading ? line.slice(2) : line;
      if (heading) parts.push('/F1 14 Tf');
      parts.push('(' + escapePdf(text) + ') Tj');
      if (heading) parts.push('/F1 10 Tf');
      if (lineIndex !== chunk.length - 1) parts.push('T*');
    });
    parts.push('ET');
    const stream = parts.join('\n');
    objs[contentId] = '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream';
    objs[pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ' + contentId + ' 0 R /Resources << /Font << /F1 3 0 R >> >> >>';
  });
  objs[2] = '<< /Type /Pages /Count ' + count + ' /Kids [' + kids.map(id => id + ' 0 R').join(' ') + '] >>';
  let out = '%PDF-1.4\n';
  const offsets = [0];
  const max = 3 + count * 2;
  for (let i = 1; i <= max; i++) {
    offsets[i] = Buffer.byteLength(out);
    out += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
  }
  const xref = Buffer.byteLength(out);
  out += 'xref\n0 ' + (max + 1) + '\n';
  out += '0000000000 65535 f \n';
  for (let i = 1; i <= max; i++) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<< /Size ' + (max + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return Buffer.from(out);
}

module.exports = { programmePdf, programmeLines };
