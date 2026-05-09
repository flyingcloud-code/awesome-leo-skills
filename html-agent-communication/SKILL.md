---
name: html-agent-communication
description: Design and generate beautiful, functional HTML documents with AI. Covers 9 categories (Exploration, Code Review, Design, Prototyping, Diagrams, Decks, Research, Reports, Custom Editors) based on Thariq's "Unreasonable Effectiveness of HTML" framework.
tags: [html, design, communication, visualization, claude-code, thariq]
---

# HTML Agent Communication Skill

Generate stunning, functional HTML documents instead of Markdown when communicating complex information. Based on Thariq's framework (https://thariqs.github.io/html-effectiveness/) with 20+ real examples.

## Why HTML > Markdown

| Aspect | Markdown | HTML ✅ |
|--------|----------|---------|
| Information density | Plain text, ASCII charts | Tables, CSS, SVG, JS interactions |
| Visual clarity | 100+ lines → nobody reads | Color-coded, responsive, annotated |
| Sharing | Download or convert required | Upload → share link, renders anywhere |
| Interactivity | None | Sliders, buttons, drag-and-drop, live preview |
| Data throughput | Manual copy-paste | Agent traverses codebase + MCP APIs |

## Design System

Every example in the framework uses this consistent design system (no external deps):

### Color Tokens
```css
:root {
  --ivory:   #FAF9F5;  /* page background */
  --slate:   #141413;  /* text, dark bg */
  --clay:    #D97757;  /* accent, attention, highlight */
  --oat:     #E3DACC;  /* secondary accent, tags */
  --olive:   #788C5D;  /* success, safe */
  --rust:    #B04A3F;  /* deletion, danger */
  --gray-150:#F0EEE6;  /* subtle bg */
  --gray-300:#D1CFC5;  /* borders */
  --gray-500:#87867F;  /* muted text, metadata */
  --gray-700:#3D3D3A;  /* body text */
  --white:   #FFFFFF;  /* card bg */
}
```

### Font Stacks
```css
--serif: ui-serif, Georgia, "Times New Roman", serif;
--sans:  system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--mono:  ui-monospace, "SF Mono", Menlo, Consolas, monospace;
```

### Spacing & Borders
```css
--radius-panel: 12px;
--radius-row: 8px;
--border: 1.5px solid var(--gray-300);
```

### CSS Reset
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: var(--ivory);
  color: var(--gray-700);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  padding: 48px 24px 80px;
}
.page { max-width: 920px; margin: 0 auto; }
```

## 9 Category Templates

### 1. Exploration & Planning
Used when exploring multiple approaches/solutions side by side.

**Pattern**: Header with eyebrow + h1 + prompt-box → 3-column grid of approach cards → recommendation panel

**CSS Grid gut check**: `.approaches { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }`

**Card structure**: approach → head (h2 + number badge + description) → code block → tradeoffs table (pro/con 2-column grid) → chips (bundle impact, testability, etc.) → optional recommendation

**Critical UI elements**:
- `.prompt-box`: Gray bg with border, shows the prompt that generated this exploration
- `.num`: Number badge (01, 02, 03) with oat bg
- `.code`: Dark panel with syntax-colored code (`.kw`, `.str`, `.cm`, `.fn`)
- `.tradeoffs`: 2-column grid, `.pro` green dot, `.con` clay dot
- `.chips`: Flex-wrap tag array
- `.reco`: Left clay border accent bar

**Prompt template**: "Generate __ approaches to solve __. Show each with code, tradeoffs table (pro/con), and a recommendation."

### 2. Code Review & Understanding
Used for PR reviews, codebase exploration, architecture docs.

**Pattern**: PR header (repo, title, author, branch, stats) → summary → risk map → file-by-file review with diff + inline comments

**Page layout**: `.page { max-width: 920px; }` (narrower for readability)

**Key components**:
- `header.pr-head`: White card with repo info, author avatar (initials circle), branch labels
- `.risk-map`: Flex-wrap chip links with color-coded severity (`.safe` olive, `.medium` oat, `.attention` clay)
- `.file-card`: Collapsible file sections with diff rendering
- `.diff`: Dark code panel with line numbers, colored rows (`.add` green tint, `.del` red tint)
- `.bubble`: Review comment with left accent border and CSS arrow
- `details.file-collapsed`: Summary/details pattern for collapsible sections
- `.checklist`: Checkbox list with accent-color styling

**Syntax highlighting classes**: `.kw` (clay keywords), `.str` (olive strings), `.cm` (gray-500 comments), `.fn` (warm identifiers)

### 3. Design
Used for design systems, component libraries, visual explorations.

**Pattern A (design system)**: Header → swatch-grid (color tokens) → type-scale (specimen rows) → spacing ruler → elevation/radius examples

**Pattern B (visual exploration)**: Sticky toolbar with background toggle → 2×2 artboard grid → each artboard has tag + stage (live mockup) + rationale

**Key components**:
- `.swatch-grid`: `grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))`
- `.type-scale`: White panel with `.type-row` rows showing specimen + metadata
- `.type-meta`: Right-aligned font family, size, weight info
- `.stage`: Live mockup area with theme support (`.stage.dark` flips CSS vars)
- `.artboard`: Card with absolute-positioned `.tag` badge
- `.seg`: Segmented button group (radio-based, CSS-only toggle)

**Theme toggle**: Use `label:has(input:checked)` CSS or simple JS to swap body/panel themes

### 4. Prototyping
Used for animation sandboxes, interactive flow prototypes.

**Pattern**: Header → bench (stage + control panel) → timeline → copy-paste CSS snippet

**Key components**:
- `.bench`: `grid-template-columns: 1fr 240px;` — stage left, controls right
- `.stage`: Centered mockup area showing the micro-interaction
- `.task/.check/.label/.due`: Individual animated elements
- CSS-only animations via class toggles (`.done`, `.active`)
- `.track` + `.key`: Visual timeline showing animation keyframes
- Easing control panel with button group
- Copy-paste CSS output section

**JS pattern**: Minimal vanilla — classList.toggle for state, dataset for configuration values

### 5. Illustrations & Diagrams
Used for architecture diagrams, flowcharts, data visualizations.

**Pattern**: Header → figure gallery (canvas → figcaption with download button) → palette reference

**Key components**:
- Inline SVG with `viewBox`, embedded `<style>` block for standalone export
- `.canvas`: Border container for SVG display
- `.dl`: Download SVG button using XMLSerializer + Blob
- `.swatch`: Color palette reference strip

**SVG rules**: 1.5px strokes, 2px for emphasized, rx=10 for rectangles, no shadows/gradients, clay for focus, olive for done

### 6. Decks (Slide Decks)
Used for presentations, status updates, weekly demos.

**Pattern**: Full-screen slides with scroll-snap, navigable by scrolling or keyboard

**Structure**: `.slide` sections with `scroll-snap-align: start; scroll-snap-type: y mandatory` on body

**Slide content types**:
- Title slide: ornament SVG, h1, subtitle, byline
- Shipped list: `.ship-item` with dot + title + description + ref
- In progress: `.prog-item` with progress bar (`.prog-track` + `.prog-fill`)
- Metrics: `.metrics` grid with label + value + delta
- Decision card: `.decision-card` with options
- Next week: ordered items with clay bar marker

**JS**: Slide counter (fixed position, updates via IntersectionObserver or scroll event)

### 7. Research & Learning
Used for explaining how features work, concept explainers.

**Pattern**: Header → main content + sidebar. Main has diagram + walkthrough steps. Sidebar has key files + gotchas.

**Layout**: `.page { display: grid; grid-template-columns: 1fr 280px; gap: 40px; }`

**Key components**:
- `.diagram-panel`: SVG flowchart with callouts
- `.step`: Numbered walkthrough with badge + location + body + collapsible snippet
- `.step.hot`: Highlighted important step
- `details.snippet`: Accordion-collapsible code reveal
- `.panel`: Sidebar information card
- `.gotchas`: Warning card with clay border + red accents
- Single-open snippet behavior (JS: close others on toggle)

### 8. Reports
Used for weekly status, incident reports.

**Pattern A (status)**: Header → metrics grid → sparkline → shipped/ongoing/blocked lists

**Pattern B (incident)**: Header → timeline (minute-by-minute) → log excerpts → follow-up checklist

**Key components**:
- `.metric`: Large value number with delta indicator (down = olive, up = clay)
- SVG sparkline chart with `preserveAspectRatio="none"`
- `.ship-list`: Items with green dot, title, description, ticket ref
- `.timeline`: Absolute-positioned event markers on a horizontal track
- `.slack-block`: Rich card with author avatar + message preview
- `.checklist`: Interactive checkbox list with labels

### 9. Custom Editing Interfaces
Used for triage boards, feature flag editors, prompt tuners.

**Pattern**: Header → sticky toolbar → interactive board → live data + export

**Key components**:
- Drag-and-drop kanban board (HTML5 drag API)
- Filter system (click tag button to filter, click again to clear)
- Live summary bar showing counts/estimates per column
- "Copy as markdown" export button
- "Reset" button for initial state
- `.col[data-col]`: Color-coded column tops (clay for Now, olive for Next, etc.)
- `.ticket.card`: Draggable card with id, tag, title, owner, estimate
- `.tag-bug`, `.tag-feat`, `.tag-chore`, `.tag-debt`: Color-coded tag pills

## How to Prompt

When generating HTML, include the specific category in your prompt:

```
Generate an HTML [category] document that [purpose]. 
Use the Birchline design system (ivory background, slate text, clay accent).
Include a [key component] and [another component].
The output should be a single self-contained HTML file.
```

## Reference Examples

20 live examples are saved in `references/examples/`:

| # | File | Category |
|---|------|----------|
| 01 | 01-exploration-code-approaches.html | Exploration - 3 code approaches side-by-side |
| 02 | 02-exploration-visual-designs.html | Exploration - 4 visual directions with light/dark toggle |
| 03 | 03-code-review-pr.html | Code Review - Annotated PR with diff + comments |
| 04 | 04-code-understanding.html | Code Understanding - Module map + call graph |
| 05 | 05-design-system.html | Design - Living design system reference |
| 06 | 06-component-variants.html | Design - Component variants matrix |
| 07 | 07-prototype-animation.html | Prototyping - Animation sandbox with easing controls |
| 08 | 08-prototype-interaction.html | Prototyping - Clickable flow prototype |
| 09 | 09-slide-deck.html | Decks - Scroll-snap slide deck |
| 10 | 10-svg-illustrations.html | Diagrams - SVG illustration gallery with download |
| 11 | 11-status-report.html | Reports - Weekly status with metrics |
| 12 | 12-incident-report.html | Reports - Incident timeline post-mortem |
| 13 | 13-flowchart-diagram.html | Diagrams - Interactive flowchart |
| 14 | 14-research-feature-explainer.html | Research - Feature walkthrough with sidebar |
| 15 | 15-research-concept-explainer.html | Research - Concept explainer with live demo |
| 16 | 16-implementation-plan.html | Planning - Implementation plan with timeline |
| 17 | 17-pr-writeup.html | Code Review - PR writeup for reviewers |
| 18 | 18-editor-triage-board.html | Custom Editor - Drag-and-drop triage board |
| 19 | 19-editor-feature-flags.html | Custom Editor - Feature flag toggle panel |
| 20 | 20-editor-prompt-tuner.html | Custom Editor - Live prompt tuner |

## Pitfalls

1. **No external dependencies**: All HTML files are 100% self-contained (no CDN, no frameworks)
2. **Vanilla JS only**: Use `querySelector`, `addEventListener`, `classList` — no React/Vue
3. **Design tokens first**: Define CSS custom properties in `:root` before anything else
4. **Single-file output**: One `.html` file with embedded `<style>` and `<script>`
5. **Responsive**: Use `@media` queries for mobile, but design at ~920px width
6. **Accessibility**: Use `aria-hidden="true"` on decorative SVGs, semantic HTML elements
7. **No Data.now() or Math.random()**: Avoid non-deterministic rendering that affects HyperFrames
8. **Scroll-behavior**: Use `html { scroll-behavior: smooth; }` for jump links
