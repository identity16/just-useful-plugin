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
