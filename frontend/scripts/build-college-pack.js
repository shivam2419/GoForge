'use strict';
// Rebuilds assets/goforge-college-pack.pdf from scripts/college-pack/college-pack.html with headless Chrome.
// Usage: node scripts/build-college-pack.js   (CHROME=/path/to/chrome to override)
const { execFileSync } = require('child_process');
const path = require('path');
const src = path.join(__dirname, 'college-pack', 'college-pack.html');
const out = path.join(__dirname, '..', 'assets', 'goforge-college-pack.pdf');
execFileSync(process.env.CHROME || 'google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
  '--print-to-pdf=' + out, 'file://' + src
], { stdio: 'inherit' });
console.log('Wrote', out);
