// render-cards.cjs — Render HTML to Xiaohongshu card images using Playwright
// Usage: node render-cards.cjs <input.html> <output_dir> [width] [height]

const { chromium } = require('playwright');
const { readFileSync, mkdirSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const [htmlPath, outDir, width, height] = [
  process.argv[2] || '',
  process.argv[3] || '/tmp/xhs-cards',
  parseInt(process.argv[4]) || 1080,
  parseInt(process.argv[5]) || 1440,
];

if (!htmlPath) {
  console.error('Usage: node render-cards.cjs <input.html> <output_dir> [width] [height]');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const rawHtml = readFileSync(htmlPath, 'utf-8');

// Inject XHS card styling — works with both full HTML docs and bare HTML fragments
let styledHtml = rawHtml;

// If it's a bare HTML fragment (no <html> tag), wrap it
if (!rawHtml.includes('<html')) {
  styledHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<div class="container">
${rawHtml}
</div>
</body>
</html>`;
}

// Inject XHS styles before </head>
const xhsStyles = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${width}px;
    min-height: ${height}px;
    padding: 48px 52px !important;
    background: #faf9f5 !important;
    font-family: -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif;
    color: #222;
    line-height: 1.9;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .container { max-width: 100%; width: 100%; }
  h1 { font-size: 34px; font-weight: 700; margin: 0 0 20px; line-height: 1.3; color: #111; }
  h2 { font-size: 24px; font-weight: 600; margin: 20px 0 10px; color: #222; }
  h3 { font-size: 20px; font-weight: 600; margin: 16px 0 8px; color: #333; }
  p { font-size: 18px; margin: 12px 0; line-height: 1.8; color: #333; }
  ul, ol { margin: 10px 0 10px 28px; }
  li { font-size: 17px; margin: 6px 0; line-height: 1.7; color: #333; }
  blockquote {
    border-left: 4px solid #5b8def;
    background: #f0f4ff;
    padding: 14px 18px;
    margin: 16px 0;
    border-radius: 4px;
    font-size: 17px;
    color: #444;
  }
  pre {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 14px;
    line-height: 1.6;
    margin: 14px 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: #333;
  }
  code {
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 15px;
    color: #d63384;
  }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 15px; }
  th { background: #eee; padding: 8px 12px; text-align: left; font-weight: 600; border: 1px solid #ddd; }
  td { padding: 8px 12px; border: 1px solid #ddd; }
  tr:nth-child(even) { background: #fafafa; }
  img { max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; }
  hr { border: none; height: 1px; background: #eee; margin: 24px 0; }
  strong { color: #111; }
  a { color: #5b8def; text-decoration: none; }
  .meta { font-size: 13px; color: #999; }
  .tag {
    display: inline-block;
    background: #f0f0f0;
    color: #666;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 12px;
    margin: 2px 4px 2px 0;
  }
  @page { size: ${width}px ${height}px; margin: 0; }
</style>`;

styledHtml = styledHtml.replace('</head>', xhsStyles + '\n</head>');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ 
    viewport: { width, height }, 
    deviceScaleFactor: 2 
  });
  const page = await context.newPage();

  await page.setContent(styledHtml, { waitUntil: 'networkidle', timeout: 15000 });

  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const cardHeight = height;
  const numCards = Math.ceil(totalHeight / cardHeight);
  const actualCards = Math.min(numCards, 20);

  console.log(`  Content: ${totalHeight}px, Card: ${cardHeight}px, Pages: ${actualCards}`);

  for (let i = 0; i < actualCards; i++) {
    await page.evaluate(({ idx, ch }) => {
      document.body.style.transform = `translateY(-${idx * ch}px)`;
      document.body.style.overflow = 'hidden';
    }, { idx: i, ch: cardHeight });
    
    await page.waitForTimeout(200);

    const filename = resolve(outDir, `card-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ 
      path: filename, 
      clip: { x: 0, y: 0, width, height },
      type: 'png'
    });
    const stats = require('fs').statSync(filename);
    console.log(`  [${i + 1}/${actualCards}] card-${String(i + 1).padStart(2, '0')}.png (${(stats.size / 1024).toFixed(0)}KB)`);
  }

  await browser.close();
  console.log(`\n✅ Done! ${actualCards} images → ${outDir}`);
})();
