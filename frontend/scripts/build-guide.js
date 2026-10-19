'use strict';
// Rebuilds assets/goforge-track-picker-guide.pdf from scripts/guide/guide.html with headless Chrome.
// Usage: node scripts/build-guide.js   (CHROME=/path/to/chrome to override)
const { execFileSync } = require('child_process');
const path = require('path');
const src = path.join(__dirname, 'guide', 'guide.html');
const out = path.join(__dirname, '..', 'assets', 'goforge-track-picker-guide.pdf');
execFileSync(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
  '--print-to-pdf=' + out, 'file://' + src], { stdio: 'inherit' });
console.log('Wrote', out);
