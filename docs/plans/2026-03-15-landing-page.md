# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a marketing landing page for just-useful-plugin with real benchmark data showing garden-docs effectiveness on 3 OSS repos.

**Architecture:** Two-phase approach — first run benchmarks on Express, Commander, Zod (baseline vs. garden-docs applied), then build a static HTML/CSS/JS landing page in `site/` with the collected data. Deploy via GitHub Pages using GitHub Actions (since Pages only supports `/` or `/docs` as source paths, and `docs/` is already used for project documentation).

**Tech Stack:** Pure HTML/CSS/JS (no build step), GitHub Pages (Actions workflow), Chart.js v4.4.x for benchmark visualizations.

**Note on Chunk 1 (Benchmarks):** Each benchmark and garden-docs run is a full skill invocation (10-30+ min each). Chunk 1 will take substantially longer than Chunk 2. Tasks in Chunk 1 are heavyweight operations, not 2-5 minute steps.

**Note on Benchmark Reproducibility:** agent-benchmark generates tasks dynamically from repo analysis. Baseline and post-garden-docs runs will have different task sets. This is acceptable — we are measuring overall agent efficiency in the environment, not per-task comparison. The summary metrics (total tokens, total time, avg backtrack) across a diverse task set provide a valid signal.

---

## Chunk 1: Benchmark Measurement

Run agent-benchmark in A/B mode on 3 OSS repos. For each repo: condition A = vanilla repo, condition B = after garden-docs applied.

### Task 1: Set Up Benchmark Workspace

**Files:**
- Create: `benchmarks/` directory (temporary working area, gitignored)

- [ ] **Step 1: Create benchmarks directory and gitignore it**

```bash
mkdir -p benchmarks
echo "benchmarks/" >> .gitignore
```

- [ ] **Step 2: Clone the 3 target repos**

```bash
cd benchmarks
git clone --depth 1 https://github.com/expressjs/express.git
git clone --depth 1 https://github.com/tj/commander.js.git
git clone --depth 1 https://github.com/colinhacks/zod.git
```

- [ ] **Step 3: Commit the .gitignore update**

```bash
git add .gitignore
git commit -m "chore: gitignore benchmarks directory"
```

### Task 2: Benchmark Express.js (Baseline)

Run agent-benchmark in basic mode on vanilla Express repo.

- [ ] **Step 1: Run agent-benchmark on Express (baseline)**

Invoke the agent-benchmark skill targeting `benchmarks/express/`. Select basic mode, 4-6 tasks, mixed categories. Let the skill handle repo analysis, task generation, hook setup, and execution.

- [ ] **Step 2: Export results to JSON**

When prompted for export format, choose JSON. Save to `benchmarks/express-baseline.json`.

- [ ] **Step 3: Verify the JSON contains valid metrics**

Read `benchmarks/express-baseline.json` and confirm it has task results with tokens, time, and backtrack_rate fields.

### Task 3: Apply garden-docs to Express.js

- [ ] **Step 1: Run garden-docs on Express repo**

Invoke the garden-docs skill targeting `benchmarks/express/`. Let the full 5-step workflow run (SubA, SubB, SubC dispatch, synthesis, fixes, re-verification).

- [ ] **Step 2: Verify garden-docs applied changes**

Check that `benchmarks/express/CLAUDE.md` now has conditional triggers and `benchmarks/express/docs/` has been structured according to garden-docs principles.

### Task 4: Benchmark Express.js (After garden-docs)

- [ ] **Step 1: Run agent-benchmark on Express (post garden-docs)**

Same configuration as Task 2 (same task count and categories if possible). Basic mode.

- [ ] **Step 2: Export results to JSON**

Save to `benchmarks/express-after.json`.

### Task 5: Benchmark Commander.js (Baseline)

- [ ] **Step 1: Run agent-benchmark on Commander.js (baseline)**

Basic mode, 4-6 tasks, mixed categories.

- [ ] **Step 2: Export results to JSON**

Save to `benchmarks/commander-baseline.json`.

### Task 6: Apply garden-docs to Commander.js

- [ ] **Step 1: Run garden-docs on Commander.js repo**

Full 5-step workflow.

- [ ] **Step 2: Verify garden-docs applied changes**

### Task 7: Benchmark Commander.js (After garden-docs)

- [ ] **Step 1: Run agent-benchmark on Commander.js (post garden-docs)**

- [ ] **Step 2: Export results to JSON**

Save to `benchmarks/commander-after.json`.

### Task 8: Benchmark Zod (Baseline)

- [ ] **Step 1: Run agent-benchmark on Zod (baseline)**

Basic mode, 4-6 tasks, mixed categories.

- [ ] **Step 2: Export results to JSON**

Save to `benchmarks/zod-baseline.json`.

### Task 9: Apply garden-docs to Zod

- [ ] **Step 1: Run garden-docs on Zod repo**

Full 5-step workflow.

- [ ] **Step 2: Verify garden-docs applied changes**

### Task 10: Benchmark Zod (After garden-docs)

- [ ] **Step 1: Run agent-benchmark on Zod (post garden-docs)**

- [ ] **Step 2: Export results to JSON**

Save to `benchmarks/zod-after.json`.

### Task 11: Compile Benchmark Summary

**Files:**
- Create: `site/data/benchmarks.json`

- [ ] **Step 1: Create site data directory**

```bash
mkdir -p site/data
```

- [ ] **Step 2: Compile all 6 JSON files into one summary**

Read all baseline and after JSON files. Extract per-repo summary metrics:
- Total tokens (baseline vs after)
- Total time (baseline vs after)
- Average backtrack rate (baseline vs after)
- Calculate improvement percentages

Write compiled data to `site/data/benchmarks.json` with this structure:

```json
{
  "repos": [
    {
      "name": "Express.js",
      "category": "Web Framework",
      "github": "expressjs/express",
      "baseline": {
        "total_tokens": 0,
        "total_time": 0,
        "avg_backtrack": 0,
        "tasks_successful": 0,
        "tasks_total": 0
      },
      "after": {
        "total_tokens": 0,
        "total_time": 0,
        "avg_backtrack": 0,
        "tasks_successful": 0,
        "tasks_total": 0
      },
      "improvement": {
        "tokens_pct": 0,
        "time_pct": 0,
        "backtrack_pct": 0
      }
    }
  ],
  "measured_at": "2026-03-15",
  "plugin_version": "0.2.7"  // version at time of measurement, not current version
}
```

- [ ] **Step 3: Commit benchmark data**

```bash
git add site/data/benchmarks.json
git commit -m "data: add benchmark results for Express, Commander, Zod"
```

---

## Chunk 2: Landing Page Implementation

### Task 12: Page Skeleton & Hero Section

**Files:**
- Create: `site/index.html`
- Create: `site/css/style.css`
- Create: `site/js/main.js`

- [ ] **Step 1: Create the HTML skeleton**

Create `site/index.html` with:
- `<head>`: meta tags (charset, viewport, description, og tags), link to style.css, Chart.js v4.4.x CDN (pin version)
- `<body>`: section containers for hero, philosophy, garden-docs, agent-benchmark, platforms, install, footer
- `<script>` tags for main.js at end of body

- [ ] **Step 2: Create the base CSS**

Create `site/css/style.css` with:
- CSS reset / normalize
- Dark theme variables: `--bg: #0a0a0a`, `--surface: #141414`, `--border: #262626`, `--text: #ededed`, `--text-muted: #888`, `--accent: #3b82f6` (or similar)
- Typography: system sans-serif stack, monospace for code
- Container max-width ~1100px, centered
- Section padding/spacing

- [ ] **Step 3: Build Hero section**

In `index.html` hero section:
- Plugin name "just-useful-plugin" in large heading
- Tagline: "Predictable AI Harness Engineering for Any Repo"
- Sub-text: brief one-liner about what it does
- Install command with copy button: `claude plugin add just-useful-plugin`
- Style: centered, large type, dark background, accent on CTA

- [ ] **Step 4: Add copy-to-clipboard JS**

In `site/js/main.js`, add click handler for copy buttons that copies the command text and shows brief "Copied!" feedback.

- [ ] **Step 5: Open in browser and verify**

```bash
open site/index.html
```

Verify: dark theme, readable typography, copy button works.

- [ ] **Step 6: Commit**

```bash
git add site/
git commit -m "feat: add landing page skeleton with hero section"
```

### Task 13: Philosophy Section

**Files:**
- Modify: `site/index.html`
- Modify: `site/css/style.css`

- [ ] **Step 1: Add Philosophy section HTML**

Section title: "Why AI Harness?"

Content conveying:
- AI agents are only as good as the repo environment they work in
- Without engineered context, agents waste tokens guessing, backtrack, and produce inconsistent results
- Measuring first (benchmarks) → then improving (documentation) → then measuring again = predictable improvement
- Visual contrast element: two columns or cards showing "Without AI Harness" (scattered files, no docs, agent confusion) vs "With AI Harness" (structured docs, conditional triggers, agent efficiency)

- [ ] **Step 2: Style the Philosophy section**

Two-column comparison layout. Use subtle border/card styling. Icons or simple ASCII/emoji indicators for contrast (no images needed).

- [ ] **Step 3: Verify in browser**

- [ ] **Step 4: Commit**

```bash
git add site/
git commit -m "feat: add philosophy section to landing page"
```

### Task 14: garden-docs Skill Section with Benchmarks

**Files:**
- Modify: `site/index.html`
- Modify: `site/css/style.css`
- Modify: `site/js/main.js`

- [ ] **Step 1: Add garden-docs feature summary HTML**

Section title: "garden-docs"
- Brief description of what it does (document-code sync, knowledge base structure, 4-layer verification)
- Key capabilities as short bullet list or icon grid

- [ ] **Step 2: Add benchmark charts HTML structure**

For each of the 3 repos (Express, Commander, Zod):
- Repo name + category badge
- Three metric comparisons (tokens, time, backtrack rate) as horizontal bar pairs (before/after)
- Improvement percentage highlighted

Use `<canvas>` elements for Chart.js or pure CSS bar charts.

- [ ] **Step 3: Add benchmark chart rendering JS**

In `main.js`:
- Fetch `data/benchmarks.json`
- Render bar charts for each repo showing before/after metrics
- Use Chart.js horizontal bar chart or pure CSS if data is simple enough
- Color scheme: muted color for baseline, accent color for after

- [ ] **Step 4: Style the benchmark section**

Cards for each repo. Charts inside cards. Responsive layout (stack on mobile).

- [ ] **Step 5: Verify charts render with real data**

- [ ] **Step 6: Commit**

```bash
git add site/
git commit -m "feat: add garden-docs section with benchmark charts"
```

### Task 15: agent-benchmark Skill Section

**Files:**
- Modify: `site/index.html`
- Modify: `site/css/style.css`

- [ ] **Step 1: Add agent-benchmark section HTML**

Section title: "agent-benchmark"
- Description: the measurement tool itself
- What it measures: 3 metrics (tokens, time, backtrack rate)
- How it works: repo analysis → dynamic task generation → parallel execution → metrics collection
- Visual: styled terminal-like block showing sample report output (use the format from report-format.md)

- [ ] **Step 2: Style the section**

Terminal-style code block for sample output. Monospace font, subtle green/white text on dark.

- [ ] **Step 3: Commit**

```bash
git add site/
git commit -m "feat: add agent-benchmark section to landing page"
```

### Task 16: Platform Support Section

**Files:**
- Modify: `site/index.html`
- Modify: `site/css/style.css`

- [ ] **Step 1: Add platforms section HTML**

Section title: "Built for Claude Code"
- Single Claude Code badge
- No external images needed — use text/CSS-styled badge

- [ ] **Step 2: Style as horizontal badge row**

Flexbox row, wrap on mobile. Subtle border cards with platform names.

- [ ] **Step 3: Commit**

```bash
git add site/
git commit -m "feat: add platform support section"
```

### Task 17: Installation Section

**Files:**
- Modify: `site/index.html`
- Modify: `site/css/style.css`
- Modify: `site/js/main.js`

- [ ] **Step 1: Add installation section HTML**

Section title: "Get Started"
- Tab buttons for each platform
- Tab content panels with platform-specific install commands
- Each command has a copy button

Install command:
- Claude Code: `claude plugin install just-useful-plugin`

- [ ] **Step 2: Add tab switching JS**

In `main.js`, add click handlers for tab buttons. Show/hide corresponding panels. Active tab styling.

- [ ] **Step 3: Style tabs**

Tab buttons in a row, active state highlighted. Code blocks with monospace, copy button aligned right.

- [ ] **Step 4: Commit**

```bash
git add site/
git commit -m "feat: add installation section with platform tabs"
```

### Task 18: Footer & Final Polish

**Files:**
- Modify: `site/index.html`
- Modify: `site/css/style.css`

- [ ] **Step 1: Add footer HTML**

- GitHub repo link
- License info
- Version number (from plugin.json)

- [ ] **Step 2: Add responsive breakpoints**

Review all sections at mobile widths (~375px, ~768px). Add media queries:
- Stack two-column layouts vertically on mobile
- Reduce font sizes on small screens
- Ensure charts are readable on mobile

- [ ] **Step 3: Add smooth scroll for any internal nav links**

```css
html { scroll-behavior: smooth; }
```

- [ ] **Step 4: Final browser review**

Open `site/index.html`, check:
- All sections render correctly
- Charts load with real data
- Copy buttons work
- Tabs switch correctly
- Responsive layout works
- No console errors

- [ ] **Step 5: Commit**

```bash
git add site/
git commit -m "feat: complete landing page with footer and responsive design"
```

---

## Chunk 3: Deployment

### Task 19: GitHub Pages Setup

**Files:**
- Modify: Repository settings (via GitHub)

- [ ] **Step 1: Verify site/ structure is complete**

```bash
ls -la site/
ls -la site/css/
ls -la site/js/
ls -la site/data/
```

Confirm: `index.html`, `css/style.css`, `js/main.js`, `data/benchmarks.json` all present.

- [ ] **Step 2: Push to remote**

```bash
git push origin main
```

- [ ] **Step 3: Create GitHub Actions workflow for Pages deployment**

GitHub Pages only supports `/` or `/docs` as source paths. Since `docs/` is used for project documentation, use a GitHub Actions workflow to deploy from `site/`.

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy Landing Page

on:
  push:
    branches: [main]
    paths: [site/**]

permissions:
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Enable GitHub Pages in repo settings**

```bash
gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow
```

- [ ] **Step 5: Commit the workflow file**

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "ci: add GitHub Pages deployment workflow for landing page"
```

- [ ] **Step 6: Verify deployment**

Push to main, wait for Actions workflow to complete, then open the published URL and verify the page loads correctly.

### Task 20: Version Bump

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Bump version to 0.3.0**

This is a new feature (landing page with benchmark data), warranting a minor bump. Update version in both files from `0.2.7` to `0.3.0`.

- [ ] **Step 2: Commit version bump**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore: bump version to 0.3.0"
```
