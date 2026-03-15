# Report Format Reference

This document defines the output formats for agent benchmark reports: terminal display, A/B comparison, JSON export, and Markdown export.

---

## 1. Terminal Output Format (Default)

### Single Run Template

```
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
```

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

```
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
```

### Ratio Calculation

```
ratio = val_A / val_B
```

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

```json
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
```

### A/B Comparison Schema

When `meta.mode` is `"comparison"`, the `comparison` field is populated:

```json
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
```

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

```
docs/benchmarks/YYYY-MM-DD-report.md
```

### Single Run Example

```markdown
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
```

### A/B Comparison Example

The Markdown report includes per-metric comparison tables and summary ratios, following the same layout as the terminal A/B comparison format.

---

## 5. History Log Format (history.jsonl)

Every benchmark run is automatically appended to `docs/benchmarks/history.jsonl`.
One JSON line per run.

### Entry Schema

```json
{
  "run_id": "2026-03-15T14:32:00Z",
  "commit": "9c9526e",
  "task_set_version": 1,
  "mode": "rerun|fresh",
  "tasks": [
    {
      "id": "task-001",
      "category": "Discovery",
      "status": "complete|failed",
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
}
```

### Notes

- Appended automatically after every run — not optional
- One line per run (JSONL format, not a JSON array)
- `run_id` is the ISO-8601 timestamp of the run start
- `commit` is the short hash of HEAD at run time
- `task_set_version` matches the version in `docs/benchmarks/tasks.json` at run time

---

## 6. Regression Warning Format

Displayed in terminal immediately before the Summary section when any metric worsens by ≥ 20% vs the previous run with the same `task_set_version`.

### Template

```
⚠️  Regression detected vs last run (2026-03-14)
──────────────────────────────────────────────────
  Metric     Previous   Current   Change
  Tokens     41,200     55,140    +34%   ← regressed
  Backtrack  0.05       0.20      +0.15  ← regressed
  Time       158.4s     167.2s    +6%    (within threshold)
──────────────────────────────────────────────────
```

### Threshold

Default: ≥ 20% increase in tokens or time, or ≥ +0.10 absolute increase in backtrack rate.

### When not shown

- First run (no previous run to compare)
- No prior run exists with the same `task_set_version`

---

## 7. Trend View Format

Displayed after the Summary section when `history.jsonl` contains 3 or more runs with the same `task_set_version` as the current run.

### Template

```
── Trend (last 5 runs, v1) ─────────────────────────────────
  Date        Commit    Tokens    Time      Backtrack
  2026-03-10  4a3b2c1   55,140    202.3s    0.07
  2026-03-11  8d4e5f2   48,320    178.1s    0.05
  2026-03-12  1f6g7h3   45,200    165.4s    0.04
  2026-03-14  9c9526e   41,200    158.4s    0.03
  2026-03-15  a1b2c3d   55,140    202.3s    0.07   ← today

  Tokens:    ↑ 34% net (higher than period low)
  Time:      ↑ 29% net (higher than period low)
  Backtrack: ↓ 57% net over 5 runs
──────────────────────────────────────────────────────────────
```

When a version boundary exists in history, show a version divider between runs:

```
── Trend (all runs) ────────────────────────────────────────
  Date        Commit    v   Tokens    Time      Backtrack
  2026-03-10  4a3b2c1   1   55,140    202.3s    0.07
  2026-03-12  8d4e5f2   1   48,320    178.1s    0.05
  ── task set updated to v2 (added Diagnosis task) ──────────
  2026-03-14  1f6g7h3   2   41,200    158.4s    0.03
  2026-03-15  9c9526e   2   55,140    202.3s    0.07   ← today
──────────────────────────────────────────────────────────────
```

### Rules

- Show up to last 10 runs (oldest first)
- "Today" marker on the current run row
- Net change line: compares first visible run of current version to current run
- Only shown for re-runs (fixed task set) — not for fresh runs with new task sets
- Version label is displayed as `v{task_set_version}` (e.g., `v1`, `v2`). When all displayed runs share the same version, show it only in the header title (e.g., `── Trend (last 5 runs, v1) ──`). When runs span multiple versions, add a `v` column per row and insert a version boundary divider line.

---

## 8. Historical Comparison Format

Used when the user selects "historical comparison" mode — comparing the current run against a specific past run.
Layout mirrors A/B comparison format (§2), but labels are dates/commits instead of condition names.

### Template

```
╔══════════════════════════════════════════════════════════╗
║           Agent Benchmark Report                         ║
║           {project} — {today_commit} vs {baseline_commit}║
║           (today) vs (baseline: 2026-03-10)              ║
╠══════════════════════════════════════════════════════════╣

── Task Comparison ────────────────────────────────────────
  (same layout as A/B comparison, §2)

── Summary ────────────────────────────────────────────────
  Avg Token Ratio:     1.34  → baseline이 효율적 (오늘 +34%)
  Avg Time Ratio:      1.28  → baseline이 효율적 (오늘 +28%)
  Avg Backtrack Ratio: 2.33  → baseline이 효율적 (오늘 +133%)

╚══════════════════════════════════════════════════════════╝
```

### Baseline selection

The user can compare against:
- `last`: most recent run in history.jsonl with same `task_set_version`
- `baseline`: a run explicitly tagged as baseline (stored in `docs/benchmarks/baseline.json`)
- `best`: run with lowest total_tokens in history.jsonl with same `task_set_version`
- A specific date: matched against `run_id` prefix

User can override version filtering to compare across versions when explicitly requested.
