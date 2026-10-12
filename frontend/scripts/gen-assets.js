// Generates favicon / OG images from the GF mark using headless Chrome.
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright-core');
const ejs = require('ejs');
const mark = (uid) => ejs.render(fs.readFileSync(path.join(__dirname, '..', 'views/partials/mark.ejs'), 'utf8'), { uid, decorative: true, cls: 'm' });
const pub = p => path.join(__dirname, '..', 'public', p);
const markPaths = mark('').match(/<g[\s\S]*<\/g>/)[0];
const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="gfg" x1="0" y1="0" x2="152" y2="102" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#D9BC7C"/><stop offset=".5" stop-color="#C6A15B"/><stop offset="1" stop-color="#A57F3C"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#1B2744"/><g transform="translate(7 15) scale(.33)">${markPaths}</g></svg>`;
fs.writeFileSync(pub('favicon.svg'), fav);
fs.mkdirSync(pub('img'), { recursive: true });
fs.writeFileSync(pub('site.webmanifest'), JSON.stringify({ name: 'Goforge Digital', short_name: 'Goforge', icons: [{ src: '/img/gf-192.png', sizes: '192x192', type: 'image/png' }, { src: '/img/gf-512.png', sizes: '512x512', type: 'image/png' }], theme_color: '#F4EFE6', background_color: '#F4EFE6', display: 'browser' }));
const b64 = f => 'data:font/woff2;base64,' + fs.readFileSync(pub('fonts/' + f)).toString('base64');
const fontCss = `@font-face{font-family:C;src:url(${b64('cormorant-700.woff2')})}@font-face{font-family:M;src:url(${b64('manrope.woff2')});font-weight:200 800}`;
const corner = `<svg viewBox="0 0 64 64" fill="none" stroke="#C6A15B" stroke-width="1"><path d="M0 26 26 0M0 38 38 0M0 50 50 0"/></svg>`;
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  async function shot(html, w, h, out) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><head><style>${fontCss}*{margin:0}body{width:${w}px;height:${h}px;overflow:hidden}</style></head><body>${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out, omitBackground: true });
  }
  const iconHtml = s => `<div style="width:${s}px;height:${s}px">${fav.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div>`;
  const squareHtml = s => `<div style="width:${s}px;height:${s}px;background:#1B2744;display:grid;place-items:center">${mark('x').replace('class="m"', `width="${Math.round(s * .66)}"`)}</div>`;
  await shot(iconHtml(32), 32, 32, pub('favicon-32.png'));
  await shot(squareHtml(180), 180, 180, pub('apple-touch-icon.png'));
  await shot(squareHtml(192), 192, 192, pub('img/gf-192.png'));
  await shot(squareHtml(512), 512, 512, pub('img/gf-512.png'));
  const og = `<div style="position:relative;width:1200px;height:630px;background:#F4EFE6;font-family:M;color:#1B2744;display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div style="position:absolute;left:0;top:0;width:150px;height:150px">${corner}</div>
    <div style="position:absolute;right:0;bottom:0;width:150px;height:150px;transform:rotate(180deg)">${corner}</div>
    ${mark('og').replace('class="m"', 'width="250"')}
    <div style="font-family:C;font-weight:700;font-size:92px;letter-spacing:.04em;margin-top:36px;line-height:1">GOFORGE DIGITAL</div>
    <div style="font-size:26px;letter-spacing:.16em;margin-top:26px;font-weight:600;color:#44506B">DIGITAL SOLUTIONS &amp; GROWTH</div>
  </div>`;
  await shot(og, 1200, 630, pub('img/og.png'));
  await browser.close();
  console.log('assets ok');
})();
