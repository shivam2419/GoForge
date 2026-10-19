'use strict';

function escapePdf(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function programmeLines({ settings, brand, tracks, lengths = [], batchLines = [] }) {
  const lines = [
    '# Goforge Digital',
    'Internship programme overview',
    brand.address.line1 + ', ' + brand.address.line2 + ', ' + brand.address.region,
    'goforgedigital.com',
    '',
    'A summary for students and college training cells.',
    'Every certificate and internship letter carries an ID',
    'that colleges and employers can verify online.',
    '',
    '# How it runs',
    'Two programmes, 3 or 6 months:',
    ...lengths.map(t => '- ' + t.name + ': ' + t.trainingMonths + ' month' + (t.trainingMonths > 1 ? 's' : '') + ' training + ' + t.internshipMonths + ' months internship.'),
    ...lengths.map(t => '  ' + t.name + ' festive launch price: Rs ' + Number(t.price).toLocaleString('en-IN') + ', all-inclusive.'),
    'Training is live online. The internship is supervised.',
    'Who can apply: BTech, BCA and similar courses.',
    'Projects and internship included.',
    ...batchLines,
    'Every class is recorded. Pause during college exams, or',
    'switch once to a later batch at no cost.',
    '',
    '# What you receive',
    '- Skills in the role you chose.',
    '- One project you can explain.',
    '- A training certificate.',
    '- An internship letter with your name, college, role, exact dates,',
    '  that the work was online, two or three lines on the work you did,',
    '  and a signatory who can be contacted to check the letter.',
    '',
    '# College support',
    '- Issued by an MSME-registered company.',
    '- College-specific formats, hours or an NOC on request.',
    '- Check the weeks or hours your college needs, then pick a programme.',
    '',
    '# How a project is chosen',
    'The project matches your programme: real studio work or an',
    'industry-style project, reviewed by a mentor.',
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
  lines.push('# Next step');
  lines.push('Book a free demo class and counselling call at goforgedigital.com.');
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
