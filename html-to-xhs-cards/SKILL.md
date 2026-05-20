---
name: html-to-xhs-cards
description: |-
  Convert HTML articles into Xiaohongshu (RedNote) image cards using Playwright
  headless browser screenshots. Handles multi-page content splitting and injects
  mobile-friendly card styling (3:4, 1080×1440, large fonts, clean spacing).
  Produces ready-to-upload PNG images for Xiaohongshu posting.
tags: [xiaohongshu, image-generation, html-to-image, social-media, creative]
---

# HTML/Markdown → 小红书图片卡片

把 HTML 文章或 Markdown 文件切成小红书风格的竖屏图片卡片（1080×1440，3:4 比例）。

## Xiaohongshu Image Specs

| Spec | Value |
|------|-------|
| Aspect ratio | 3:4 (portrait) |
| Resolution | 1080×1440 px |
| 2x retina | 2160×2880 (sharp text) |
| Format | PNG |
| Max cards | 20 pages per article |

## Prerequisites

Playwright is at `~/.hermes/hermes-agent/node_modules/`:
```bash
cd ~/.hermes/hermes-agent && node -e "require('playwright');console.log('ok')"
```

## Usage

```bash
cd ~/.hermes/hermes-agent
NODE_PATH=./node_modules node <skill_dir>/scripts/html-to-xhs.cjs \
  <input.html> \
  <output_dir> \
  [width=1080] \
  [height=1440]
```

### Examples

```bash
# HTML → XHS Cards (default 1080×1440)
NODE_PATH=./node_modules node /path/to/html-to-xhs-cards/scripts/html-to-xhs.cjs \
  /Volumes/External-HD-data/leo-universe/wechat/hermes-feishu-table-fix.html \
  /tmp/xhs-test

# Markdown → HTML → XHS Cards (via md-to-html first)
python3 scripts/md-to-html.py note.md /tmp/tmp.html
NODE_PATH=./node_modules node /path/to/html-to-xhs-cards/scripts/html-to-xhs.cjs \
  /tmp/tmp.html /tmp/xhs-test
```

## How It Works

1. Reads input HTML file
2. Injects XHS-compatible styles (large fonts, clean spacing, 3:4 viewport)
3. Launches headless Chromium via Playwright (2x retina for sharp text)
4. Measures total content height, splits into 1080×1440 page segments
5. Renders each segment as a numbered PNG: `card-01.png`, `card-02.png`, ...
6. Outputs to specified directory

## Style Injections

The script auto-injects these overrides (replaces `</head>`):
- Body: 1080px wide, 48px padding, `#faf9f5` background
- H1: 34px bold, H2: 24px, body text: 18px
- Code blocks: 14px, tables: 14px
- Generous line-height (1.9) for mobile readability
- Removes `.container` max-width constraint

## Output

| File | Description |
|------|-------------|
| `card-01.png` | First page (cover + beginning of content) |
| `card-02.png` ... | Subsequent content pages |

Each card is ~350-600KB (2x retina PNG).

## Pitfalls

- **Must run from hermes-agent dir** — Playwright modules resolve via NODE_PATH
- **External images may not load** in headless mode — prefer local/deployed URLs
- **Retina doubles file size** — ~500KB per card is normal
- **Skips more than 20 cards** — safety cap to avoid runaway rendering
- **CSS override is injective** — some custom per-element styles may not be overridden
