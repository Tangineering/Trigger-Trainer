// Renders icon.svg (the source) to the PNG home-screen icons (WQ-037, D-127). Run: node scripts/render-icons.js
// Uses the dev-only Playwright Chromium; no new dependency. Re-run after any change to icon.svg and commit the PNGs
// (`git add -f`, since *.png is gitignored).
//   icon-180.png           apple-touch-icon (iOS): opaque, the corners filled with the icon's background colour,
//                          since iOS masks the icon itself and shows transparent pixels as black.
//   icon-192.png, -512.png manifest "any" icons (Android): the SVG as drawn, transparent corners.
//   icon-maskable-512.png  manifest "maskable" icon: full-bleed background, artwork scaled to MASK_SCALE about the
//                          centre so all of it sits inside the maskable safe circle (radius 40 % of the size).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BG = '#121417';          // icon.svg's background rect fill
const MASK_SCALE = 0.75;       // farthest artwork point (grip corner) is ~264 of 512 from the centre; 0.75 → ~198 < 204.8
const svg = fs.readFileSync(path.join(ROOT, 'icon.svg'), 'utf8');
const src = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const OUT = [
  { file: 'icon-180.png', size: 180, bg: BG, scale: 1 },
  { file: 'icon-192.png', size: 192, bg: null, scale: 1 },
  { file: 'icon-512.png', size: 512, bg: null, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, bg: BG, scale: MASK_SCALE },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const o of OUT) {
    const inner = Math.round(o.size * o.scale);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
      <div id="i" style="width:${o.size}px;height:${o.size}px;display:flex;align-items:center;justify-content:center;
        background:${o.bg || 'transparent'}"><img src="${src}" width="${inner}" height="${inner}"></div></body></html>`);
    await page.waitForFunction(() => document.querySelector('img').complete);
    await (await page.$('#i')).screenshot({ path: path.join(ROOT, o.file), omitBackground: !o.bg });
    console.log(`${o.file}  ${o.size}x${o.size}  ${fs.statSync(path.join(ROOT, o.file)).size} bytes`);
  }
  await browser.close();
})();
