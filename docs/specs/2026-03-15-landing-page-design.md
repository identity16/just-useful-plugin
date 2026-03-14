# Landing Page Design Spec

## Philosophy & Branding

**Core message:** "Predictable AI Harness Engineering for Any Repo"

The plugin helps engineers predictably set up any repo so AI agents work reliably. It starts with documentation and benchmarking because you can't improve what you can't measure. The landing page must convey this philosophy clearly.

## Hosting & Tech Stack

- **Location:** `site/` directory in this repo
- **Tech:** Pure HTML/CSS/JS, no build step
- **Deploy:** GitHub Pages
- **Style:** Minimal & dark (Vercel/Linear aesthetic), clean typography
- **Charts:** Pure CSS bars or lightweight library (Chart.js) for benchmark visuals

## Page Structure

### 1. Hero Section
- Plugin name + tagline
- One-line install command with copy button
- Dark background, large typography

### 2. Philosophy Section — "Why AI Harness?"
- Why documentation and benchmarking come first
- Visual contrast: unengineered repo vs. engineered repo (how an agent navigates each)

### 3. Skill: garden-docs
- Feature summary
- **Real benchmark data:** before/after applying garden-docs on 3 OSS repos
  - Express.js (web framework)
  - Commander.js (CLI tool)
  - Zod (utility library)
- Metrics: token usage, task time, backtracking ratio
- Displayed as bar charts or before/after comparison cards

### 4. Skill: agent-benchmark
- Feature summary (no before/after — this IS the measurement tool)
- What metrics it measures, how to use it

### 5. Installation
- Single install command for Claude Code
- Copy-to-clipboard functionality

### 6. Footer
- GitHub repo link, license

## Benchmark Measurement Plan

Before building the page, run actual benchmarks:

1. Clone Express.js, Commander.js, Zod
2. For each repo, run agent-benchmark (baseline — no garden-docs)
3. Apply garden-docs skill to each repo
4. Re-run agent-benchmark (post garden-docs)
5. Collect metrics: token usage, task completion time, backtracking ratio
6. Embed results in the landing page

## Work Order

1. Run benchmarks on 3 OSS repos (before/after garden-docs)
2. Build landing page with real data
3. Configure GitHub Pages deployment
