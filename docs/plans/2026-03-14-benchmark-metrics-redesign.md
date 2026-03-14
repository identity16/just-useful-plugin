# Benchmark Metrics Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-dimension 11-metric benchmark scoring system with 3 flat metrics (Total Tokens, Elapsed Time, Backtrack Rate) that measure resource efficiency without read/write bias.

**Architecture:** Rewrite `metrics.md` and `report-format.md` reference docs to match the redesign spec. Update `SKILL.md` Phase 3 sections to reference the new metric structure. No new files created — all changes are edits to existing reference documents.

**Tech Stack:** Markdown documentation (no code — this plugin is a skill-only plugin with no runtime code)

---

## Chunk 1: Metrics Reference Rewrite

### Task 1: Rewrite metrics.md

**Files:**
- Modify: `skills/agent-benchmark/references/metrics.md` (full rewrite)

- [ ] **Step 1: Replace entire metrics.md content**

Replace the full content of `metrics.md` with the new 3-metric definition:

```markdown
# Metrics Reference

This document defines the metrics used by the agent-benchmark skill to evaluate Claude Code agent performance. Three independent metrics measure resource efficiency for successful tasks.

---

## 1. Metrics

### 1.1 Total Tokens

**Direction:** lower is better (count)

Total tokens consumed during task execution, including both input and output tokens. Subagent tokens are summed into the parent task.

**Scope:**
- System prompt tokens
- Agent reasoning tokens
- Tool call input/output tokens
- Subagent tokens (recursively summed)

### 1.2 Elapsed Time

**Direction:** lower is better (seconds)

Wall clock time from the first tool call to the last tool call of a task.

**Formula:**

\`\`\`
elapsed_time = last_tool_call_timestamp - first_tool_call_timestamp
\`\`\`

### 1.3 Backtrack Rate

**Direction:** lower is better (0–1)

Proportion of file accesses that are redundant revisits to previously accessed files.

**Variables:**
- `N` = number of unique files accessed
- `S` = total file accesses (including revisits to the same file)

**Formula:**

\`\`\`
backtrack_rate = (S - N) / S
\`\`\`

- A rate of 0 means every file was accessed exactly once.
- A rate of 0.5 means half of all file accesses were revisits.

---

## 2. Task Success: Precondition

Task success is not a metric — it is a **precondition** for efficiency comparison. Only successful tasks are included in metric reporting and A/B ratio calculations. Failed tasks are displayed separately in the report but excluded from summary statistics.

A task is "successful" if it passes all validation checks defined in the task answer key.

---

## 3. Scoring

### 3.1 Single Run

No scores are calculated. Per-task raw values for all 3 metrics are recorded and displayed.

### 3.2 A/B Comparison

For each successful task, compute per-metric ratios:

\`\`\`
token_ratio     = tokens_A / tokens_B
time_ratio      = time_A / time_B
backtrack_ratio = backtrack_A / backtrack_B
\`\`\`

**Interpretation:**
- ratio > 1 → B is more efficient
- ratio < 1 → A is more efficient
- ratio = 1 → equal

**Edge cases for Backtrack Rate ratio:**
- Both sides 0: ratio = 1.0 (equal — neither backtracked)
- Only one side 0: the side with 0 wins (display `← A` or `← B` without a numeric ratio)

**Summary:** Display the mean ratio across successful tasks for each metric independently. No combined score.

---

## 4. Summary Table

| # | Metric | Direction | Unit | Scope |
|---|--------|-----------|------|-------|
| 1 | Total Tokens | lower is better | count | input + output, subagents included |
| 2 | Elapsed Time | lower is better | seconds | first tool call to last tool call |
| 3 | Backtrack Rate | lower is better | 0–1 | (S - N) / S |
```

- [ ] **Step 2: Review the rewrite against the spec**

Verify that the new metrics.md:
- Contains exactly 3 metrics (Total Tokens, Elapsed Time, Backtrack Rate)
- Has no dimension groupings or weights
- Has no grading thresholds (Excellent/Good/Fair/Poor)
- Has no Tool Classification section
- Has no Agent Readiness Score
- Documents A/B ratio calculation and edge cases
- Documents task success as precondition

- [ ] **Step 3: Commit**

```bash
git add skills/agent-benchmark/references/metrics.md
git commit -m "refactor: replace 11-metric scoring with 3 flat efficiency metrics"
```

---

## Chunk 2: Report Format Rewrite

### Task 2: Rewrite report-format.md

**Files:**
- Modify: `skills/agent-benchmark/references/report-format.md` (full rewrite)

- [ ] **Step 1: Replace entire report-format.md content**

Replace with new format definitions matching the redesign spec:

```markdown
# Report Format Reference

This document defines the output formats for agent benchmark reports: terminal display, A/B comparison, JSON export, and Markdown export.

---

## 1. Terminal Output Format (Default)

### Single Run Template

\`\`\`
╔══════════════════════════════════════════════════╗
║           Agent Benchmark Report                 ║
║           {project_name} @ {commit_hash}         ║
╠══════════════════════════════════════════════════╣

── Task Results ───────────────────────────────────
  #   Category        Status   Tokens    Time    Backtrack
  1   Discovery       ✓        12,340    42.0s   0.08
  2   Comprehension   ✓        28,100   107.3s   0.15
  3   Diagnosis       ✓         8,200    26.1s   0.00
  4   Modification    ✓         6,500    26.9s   0.03

── Summary ────────────────────────────────────────
  Successful: 4/4
  Total Tokens: 55,140
  Total Time: 202.3s
  Avg Backtrack: 0.07

╚══════════════════════════════════════════════════╝
\`\`\`

### Status Indicators

| Symbol | Meaning |
|--------|---------|
| ✓ | Task completed successfully (included in metrics) |
| ✗ | Task failed (excluded from summary metrics) |

### Formatting Rules

- **Tokens**: Displayed with comma separators (e.g., `12,340`)
- **Time**: Displayed in seconds with 1 decimal (e.g., `42.0s`)
- **Backtrack**: Displayed as decimal 0–1 with 2 decimals (e.g., `0.08`)
- **Summary totals**: Sum of all tasks (successful + failed) for tokens/time; average of successful tasks only for backtrack

---

## 2. A/B Comparison Output Format

### Template

\`\`\`
╔══════════════════════════════════════════════════════════╗
║           Agent Benchmark Report                         ║
║           {project} @ {commit_a} vs {commit_b}           ║
║           ({label_a}) vs ({label_b})                     ║
╠══════════════════════════════════════════════════════════╣

── Task Comparison (successful only) ──────────────────────
  #   Category        A Tokens   B Tokens   Ratio
  1   Discovery        12,340     10,200     1.21  ← B
  2   Comprehension    28,100     32,500     0.86  ← A
  3   Diagnosis         8,200     24,800     0.33  ← A
  4   Modification      6,500      6,800     0.96  ← A

  #   Category        A Time     B Time     Ratio
  1   Discovery        42.0s      43.1s     0.98  ← A
  2   Comprehension   107.3s      96.6s     1.11  ← B
  3   Diagnosis        26.1s      50.3s     0.52  ← A
  4   Modification     26.9s      27.3s     0.99  ← A

  #   Category        A BT       B BT       Ratio
  1   Discovery        0.08       0.05      1.60  ← B
  2   Comprehension    0.15       0.10      1.50  ← B
  3   Diagnosis        0.00       0.12      0.00  ← A
  4   Modification     0.03       0.04      0.75  ← A

── Summary ──────────────────────────────────────────
  Avg Token Ratio:     0.72  → A가 효율적
  Avg Time Ratio:      0.88  → A가 효율적
  Avg Backtrack Ratio: 1.22  → B가 효율적

╚══════════════════════════════════════════════════════════╝
\`\`\`

### Ratio Calculation

\`\`\`
ratio = val_A / val_B
\`\`\`

- ratio > 1: B is more efficient (display `← B`)
- ratio < 1: A is more efficient (display `← A`)
- ratio = 1: equal

### Winner Indicator

Each task row ends with `← A` or `← B` indicating which condition was more efficient for that task. The arrow points to the winner.

### Summary Interpretation

Each summary line shows direction:
- `→ A가 효율적`: A consumed fewer resources on average
- `→ B가 효율적`: B consumed fewer resources on average

### Edge Cases

- If a task succeeded in one condition but failed in the other, exclude it from comparison (note in report)
- If both backtrack rates are 0, ratio = 1.0
- If only one backtrack rate is 0, display `← A` or `← B` without numeric ratio

---

## 3. JSON Export Schema

Triggered when the user requests `--json` or asks for JSON output.

### Single-Run Schema

\`\`\`json
{
  "meta": {
    "project": "{project_name}",
    "commit": "{commit_hash}",
    "timestamp": "{ISO-8601}",
    "mode": "single|comparison",
    "task_count": 4
  },
  "tasks": [
    {
      "id": "task-001",
      "category": "Discovery|Comprehension|Modification|Diagnosis",
      "prompt": "{task description}",
      "difficulty": "easy|medium|hard",
      "status": "complete|failed",
      "metrics": {
        "total_tokens": 12340,
        "elapsed_time": 42.0,
        "backtrack_rate": 0.08
      },
      "detail": {
        "files_accessed": ["{file_paths}"],
        "unique_files": 5,
        "total_accesses": 8
      }
    }
  ],
  "summary": {
    "successful": 4,
    "total": 4,
    "total_tokens": 55140,
    "total_time": 202.3,
    "avg_backtrack": 0.07
  },
  "comparison": null
}
\`\`\`

### A/B Comparison Schema

When `meta.mode` is `"comparison"`, the `comparison` field is populated:

\`\`\`json
{
  "condition_a": {
    "label": "...",
    "commit": "{commit_hash}",
    "tasks": [
      {
        "id": "task-001",
        "category": "Discovery",
        "status": "complete",
        "metrics": {
          "total_tokens": 12340,
          "elapsed_time": 42.0,
          "backtrack_rate": 0.08
        }
      }
    ],
    "summary": {
      "successful": 4,
      "total": 4,
      "total_tokens": 55140,
      "total_time": 202.3,
      "avg_backtrack": 0.07
    }
  },
  "condition_b": {
    "label": "...",
    "commit": "{commit_hash}",
    "tasks": [ "..." ],
    "summary": { "..." }
  },
  "ratios": {
    "per_task": [
      {
        "id": "task-001",
        "category": "Discovery",
        "token_ratio": 1.21,
        "time_ratio": 0.98,
        "backtrack_ratio": 1.60,
        "winner": {
          "tokens": "B",
          "time": "A",
          "backtrack": "B"
        }
      }
    ],
    "averages": {
      "token_ratio": 0.72,
      "time_ratio": 0.88,
      "backtrack_ratio": 1.22
    }
  }
}
\`\`\`

### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `meta.project` | string | Name of the benchmarked project |
| `meta.commit` | string | Git commit hash (single run) or omitted (comparison) |
| `meta.timestamp` | string | ISO-8601 timestamp of the run |
| `meta.mode` | string | `"single"` for standard runs, `"comparison"` for A/B |
| `meta.task_count` | integer | Number of tasks executed |
| `tasks[].status` | string | `"complete"` or `"failed"` |
| `tasks[].metrics.total_tokens` | integer | Total tokens consumed |
| `tasks[].metrics.elapsed_time` | number | Seconds from first to last tool call |
| `tasks[].metrics.backtrack_rate` | number | 0–1 revisit proportion |
| `summary.successful` | integer | Number of successful tasks |
| `summary.avg_backtrack` | number | Mean backtrack rate of successful tasks |
| `ratios.per_task[].winner` | object | Per-metric winner (`"A"` or `"B"`) |
| `ratios.averages` | object | Mean ratios across successful tasks |

---

## 4. Markdown Export Format

Triggered when the user requests `--report` or asks for a Markdown report.

### Output Location

\`\`\`
docs/benchmarks/YYYY-MM-DD-report.md
\`\`\`

### Single Run Example

\`\`\`markdown
# Agent Benchmark Report

**Project:** {project_name}
**Commit:** {commit_hash}
**Date:** {YYYY-MM-DD}

## Task Results

| # | Category | Status | Tokens | Time | Backtrack |
|---|----------|--------|--------|------|-----------|
| 1 | Discovery | ✓ | 12,340 | 42.0s | 0.08 |
| 2 | Comprehension | ✓ | 28,100 | 107.3s | 0.15 |
| 3 | Diagnosis | ✓ | 8,200 | 26.1s | 0.00 |
| 4 | Modification | ✓ | 6,500 | 26.9s | 0.03 |

## Summary

- **Successful:** 4/4
- **Total Tokens:** 55,140
- **Total Time:** 202.3s
- **Avg Backtrack:** 0.07

<details>
<summary>Raw JSON Data</summary>

json
{ ... full JSON export ... }

</details>
\`\`\`

### A/B Comparison Example

The Markdown report includes per-metric comparison tables and summary ratios, following the same layout as the terminal A/B comparison format.
```

- [ ] **Step 2: Review the rewrite against the spec**

Verify that the new report-format.md:
- Single run format shows only 3 metrics per task (Tokens, Time, Backtrack)
- No bar charts, grades, or dimension scores
- A/B format shows per-task ratios with winner indicators
- Summary shows 3 independent average ratios (no combined score)
- JSON schema matches new metric structure
- Markdown export matches terminal format

- [ ] **Step 3: Commit**

```bash
git add skills/agent-benchmark/references/report-format.md
git commit -m "refactor: simplify report format to match 3-metric structure"
```

---

## Chunk 3: SKILL.md Phase 3 Update

### Task 3: Update SKILL.md Phase 3 sections

**Files:**
- Modify: `skills/agent-benchmark/SKILL.md:208-273`

- [ ] **Step 1: Replace Phase 3 sections [7] through [10] and Cleanup**

Replace lines 208–273 (from `### [7] Log Parsing` through `3. **Preserve logs**...`) with:

```markdown
### [7] Log Parsing

Read the JSONL log file(s) and extract per-task data:

- Total tokens consumed (input + output, subagents summed into parent)
- Files accessed and access counts (for Backtrack Rate: unique files N, total accesses S)
- Task completion status (correct/incorrect)
- Timestamps (first and last tool call per task, for Elapsed Time)

### [8] Metric Calculation

Calculate metrics as defined in `references/metrics.md`:

- **Total Tokens** per task: sum of all tokens consumed during task execution
- **Elapsed Time** per task: `last_tool_call_timestamp - first_tool_call_timestamp`
- **Backtrack Rate** per task: `(S - N) / S`

Only successful tasks are included in summary statistics.

### [9] A/B Ratio Calculation (Comparison Mode Only)

For each successful task present in both conditions, compute per-metric ratios:

```
token_ratio     = tokens_A / tokens_B
time_ratio      = time_A / time_B
backtrack_ratio = backtrack_A / backtrack_B
```

Compute mean ratios across tasks for the summary. See `references/metrics.md` §3.2 for edge cases.

### [10] Terminal Output

Generate the report in terminal using the format defined in `references/report-format.md`.

**Report sections:**
- Header with repo name, commit hash, task count
- Per-task results table (category, status, tokens, time, backtrack)
- Summary (successful count, total tokens, total time, avg backtrack)
- A/B comparison tables and summary ratios (comparison mode only)

**Optional export** (only on user request):
- **JSON**: Machine-readable full results
- **Markdown**: Human-readable report file
```

- [ ] **Step 2: Update the overview description in lines 7-8**

Replace the skill description (line 8):
```
Measure how well a codebase environment supports AI agent task performance. Uses the Lostness Metric (Smith, 1996) and DevEx Framework (Noda & Storey, 2023) to quantify agent navigability, cognitive load, and task effectiveness.
```

With:
```
Measure how well a codebase environment supports AI agent task performance. Compares resource efficiency (tokens, time, backtracking) across environment configurations using A/B benchmarking.
```

- [ ] **Step 3: Update the R value reference in task generation (line 89)**

Replace:
```
- Expected optimal tool call count (**R** value for Lostness calculation)
```

With:
```
- Expected relevant files list (for Backtrack Rate calculation)
```

- [ ] **Step 4: Update [9] Grading section header reference (lines 231-251)**

The old [9] section references Lostness grading and Agent Readiness Score. This is fully replaced by the new [9] in Step 1. Verify the old content is gone after the replacement.

- [ ] **Step 5: Review the full SKILL.md**

Read through the complete file and verify:
- No references to Lostness, Agent Readiness Score, or 11 metrics remain
- No references to Navigability, Cognitive Load, or Task Effectiveness dimensions
- Phase 3 flows correctly: [7] Parse → [8] Calculate → [9] A/B Ratios → [10] Output
- All `references/` pointers are still valid

- [ ] **Step 6: Commit**

```bash
git add skills/agent-benchmark/SKILL.md
git commit -m "refactor: update SKILL.md Phase 3 for new metric structure"
```

---

## Chunk 4: Design Spec Update

### Task 4: Update original design spec to reference redesign

**Files:**
- Modify: `docs/specs/2026-03-14-agent-benchmark-design.md:47-77`

- [ ] **Step 1: Add superseded notice to the measurement framework section**

Add at the top of the `## 측정 프레임워크` section (before line 48):

```markdown
> **Note:** The measurement framework below has been superseded by `docs/specs/2026-03-14-benchmark-metrics-redesign.md`. The new framework uses 3 flat metrics (Total Tokens, Elapsed Time, Backtrack Rate) instead of the 3-dimension 11-metric structure described here.
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/2026-03-14-agent-benchmark-design.md
git commit -m "docs: mark measurement framework as superseded in design spec"
```

---

## Chunk 5: CLAUDE.md Reference Update

### Task 5: Update CLAUDE.md reference description

**Files:**
- Modify: `CLAUDE.md:9`

- [ ] **Step 1: Update the metrics reference description**

Replace:
```markdown
- When working on agent-benchmark metrics or scoring → read `skills/agent-benchmark/references/metrics.md`
```

With:
```markdown
- When working on agent-benchmark metrics (tokens, time, backtracking) → read `skills/agent-benchmark/references/metrics.md`
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md metrics reference description"
```
