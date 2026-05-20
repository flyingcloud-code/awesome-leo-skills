// html-to-xhs.cjs — Render HTML to Xiaohongshu card images using Playwright
const { chromium } = require('playwright');
const { readFileSync, mkdirSync } = require('fs');
const { resolve } = require('path');
const [htmlPath, outDir, width, height] = [
  process.argv[2] || '', process.argv[3] || '/tmp/xhs-cards',
  parseInt(process.argv[4]) || 1080, parseInt(process.argv[5]) || 1440,
];
if (!htmlPath) { console.error('Usage: node html-to-xhs.cjs <input.html> <output_dir> [w] [h]'); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const styledHtml = readFileSync(htmlPath, 'utf-8').replace('</head>', `<style>
body{width:${width}px;min-height:${height}px;padding:48px 52px!important;margin:0;background:#faf9f5!important;
font-family:-apple-system,'PingFang SC','Noto Sans SC',sans-serif;color:#222;line-height:1.9;overflow:hidden;display:flex;flex-direction:column;}
.container{max-width:100%;padding:0;margin:0;}h1{font-size:34px;font-weight:700;margin:0 0 20px;line-height:1.3;}
h2{font-size:24px;font-weight:600;margin:16px 0 10px;}p{font-size:18px;margin:10px 0;}ul,ol{margin:10px 0 10px 24px;}
li{font-size:17px;margin:6px 0;}blockquote{font-size:17px;padding:12px 18px;margin:14px 0;}
pre{font-size:14px;padding:14px;white-space:pre-wrap;word-break:break-word;}code{font-size:15px;}
table{font-size:14px;width:100%;}th,td{padding:6px 8px;}img{max-width:100%;height:auto;border-radius:8px;margin:12px 0;}
strong{color:#000;}a{color:#5b8def;}@page{size:${width}px ${height}px;margin:0;}*{box-sizing:border-box;}
</style></head>`);
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })).newPage();
  await page.setContent(styledHtml, { waitUntil: 'networkidle', timeout: 15000 });
  const total = await page.evaluate(() => document.body.scrollHeight);
  const n = Math.min(Math.ceil(total / height), 20);
  console.log(`Content: ${total}px, Pages: ${n}`);
  for (let i = 0; i < n; i++) {
    await page.evaluate(({ idx, ch }) => { document.body.style.transform = `translateY(-${idx * ch}px)`; document.body.style.overflow = 'hidden'; }, { idx: i, ch: height });
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(outDir, `card-${String(i + 1).padStart(2, '0')}.png`), clip: { x: 0, y: 0, width, height }, type: 'png' });
    console.log(`  [${i + 1}/${n}] card-${String(i + 1).padStart(2, '0')}.png`);
  }
  await browser.close();
  console.log(`\nDone! ${n} images → ${outDir}`);
})();
