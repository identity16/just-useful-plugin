# Report Format Reference

This document defines the output formats for agent benchmark reports: terminal display, A/B comparison, JSON export, and Markdown export.

---

## 1. Terminal Output Format (Default)

The default report renders directly in the terminal using box-drawing characters and visual bar charts.

### Template

```
╔══════════════════════════════════════════════════╗
║           Agent Benchmark Report                 ║
║           {project_name} @ {commit_hash}         ║
╠══════════════════════════════════════════════════╣

── Navigability (40%) ─────────────────────────────
  Pathfinding Score     {value}  {bar}  {grade}
  First Touch Rate      {value}  {bar}  {grade}
  Revisit Waste Rate    {value}  {bar}  {grade}

── Cognitive Load (35%) ───────────────────────────
  Focus Ratio           {value}  {bar}  {grade}
  Warmup Cost           {value}  {bar}  {grade}
  Token Efficiency Rate {value}  {bar}  {grade}

── Task Effectiveness (25%) ───────────────────────
  Task Success Rate     {value}  {bar}  {grade}
  Tool Call Count       {value}  {bar}  {grade}
  Speed Score           {value}  {bar}  {grade}

── Overall ────────────────────────────────────────
  Agent Readiness Score:  {score} / 100  {bar}

── Task Breakdown ─────────────────────────────────
  #1 [{category}]  PS={pathfinding}  {status}  {calls} calls
  #2 [{category}]  PS={pathfinding}  {status}  {calls} calls
  ...

╚══════════════════════════════════════════════════╝
```

### Bar Chart Rendering Rules

Bar charts are 10 characters wide using filled (`█`) and empty (`░`) blocks.

| Metric type | Conversion to fill ratio | Example |
|---|---|---|
| 0-1 scale (e.g., Pathfinding Score, Focus Ratio) | Use value directly as proportion | 0.7 → `███████░░░` |
| Percentage metrics (e.g., Task Success Rate displayed as %) | Divide by 100 | 70% → `███████░░░` |
| Count metrics (Warmup Cost, Tool Call Count) | Invert and normalize against grade thresholds | See below |

**Count metric normalization:**

For count-based metrics where lower is better (Warmup Cost, Tool Call Count), the bar fill is calculated by inverting relative to grade thresholds:

```
fill = 1 - (value - excellent_threshold) / (poor_threshold - excellent_threshold)
fill = clamp(fill, 0, 1)
```

For example, if Warmup Cost has Excellent <= 3 and Poor >= 12:
- Value 3 → fill = 1.0 → `██████████`
- Value 6 → fill ≈ 0.67 → `███████░░░`
- Value 12 → fill = 0.0 → `░░░░░░░░░░`

**Rendering formula:**

```
filled_count = round(fill_ratio * 10)
empty_count  = 10 - filled_count
bar = '█' * filled_count + '░' * empty_count
```

### Status Indicators

Each task in the breakdown section uses one of these status markers:

| Symbol | Meaning |
|---|---|
| `✓ Complete` | Task finished successfully |
| `✗ Failed` | Task did not complete |
| `~ Partial` | Task partially completed |

---

## 2. A/B Comparison Output Format

When running in comparison mode (two conditions side by side), the report appends an A/B comparison section.

### Template

```
── A/B Comparison ─────────────────────────────────
                       Condition A     Condition B
                       ({label_a})     ({label_b})
  Pathfinding Score    {val_a}         {val_b}  ({delta}%)
  Focus Ratio          {val_a}         {val_b}  ({delta}%)
  Task Success Rate    {val_a}         {val_b}  ({delta}%)
  Agent Readiness      {score_a}       {score_b} ({delta}%)
```

### Delta Calculation

```
delta = ((val_b - val_a) / val_a) * 100
```

- Positive deltas are prefixed with `+` (e.g., `+15%`), indicating Condition B improved over A.
- Negative deltas are prefixed with `-` (e.g., `-23%`), indicating Condition B regressed.
- If `val_a` is zero, display `N/A` instead of a percentage.

---

## 3. JSON Export Schema

Triggered when the user requests `--json` or asks for JSON output. The full schema is defined below.

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
      "expected": {
        "files": ["{file_paths}"],
        "r_value": 3
      },
      "actual": {
        "status": "complete|failed|partial",
        "files_accessed": ["{file_paths}"],
        "unique_files": 5,
        "total_accesses": 8,
        "tool_calls": [
          {"tool": "Read", "params": {}, "timestamp": "{ISO-8601}"}
        ]
      }
    }
  ],
  "metrics": {
    "navigability": {
      "pathfinding_score": {"value": 0.77, "grade": "Good"},
      "first_touch_rate": {"value": 0.67, "grade": "Good"},
      "revisit_waste_rate": {"value": 0.12, "grade": "Excellent"}
    },
    "cognitive_load": {
      "focus_ratio": {"value": 0.48, "grade": "Fair"},
      "warmup_cost": {"value": 6, "grade": "Good"},
      "token_efficiency_rate": {"value": 0.66, "grade": "Good"}
    },
    "task_effectiveness": {
      "task_success_rate": {"value": 1.0, "grade": "Excellent"},
      "tool_call_count": {"value": 24, "grade": "Fair"},
      "speed_score": {"value": 0.82, "grade": "Excellent"}
    }
  },
  "score": {
    "agent_readiness": 72,
    "grade": "Good"
  },
  "comparison": null
}
```

### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `meta.project` | string | Name of the benchmarked project |
| `meta.commit` | string | Git commit hash at time of benchmark |
| `meta.timestamp` | string | ISO-8601 timestamp of the run |
| `meta.mode` | string | `"single"` for standard runs, `"comparison"` for A/B |
| `meta.task_count` | integer | Number of tasks executed |
| `tasks[].id` | string | Unique task identifier (e.g., `"task-001"`) |
| `tasks[].category` | string | One of: `Discovery`, `Comprehension`, `Modification`, `Diagnosis` |
| `tasks[].difficulty` | string | One of: `easy`, `medium`, `hard` |
| `tasks[].expected.files` | string[] | Files the agent should access to solve the task |
| `tasks[].expected.r_value` | integer | Minimum relevant files needed (R value) |
| `tasks[].actual.status` | string | One of: `complete`, `failed`, `partial` |
| `tasks[].actual.files_accessed` | string[] | All file paths the agent accessed |
| `tasks[].actual.unique_files` | integer | Count of distinct files accessed |
| `tasks[].actual.total_accesses` | integer | Total file access operations (including revisits) |
| `tasks[].actual.tool_calls` | object[] | Ordered list of tool invocations with timestamps |
| `metrics.*` | object | Each metric contains `value` (number) and `grade` (string) |
| `score.agent_readiness` | integer | Composite score from 0-100 |
| `score.grade` | string | One of: `Excellent`, `Good`, `Fair`, `Poor` |
| `comparison` | object\|null | Null for single runs; populated for A/B comparisons |

### A/B Comparison Schema

When `meta.mode` is `"comparison"`, the `comparison` field is populated:

```json
{
  "condition_a": {
    "label": "...",
    "score": 72,
    "metrics": {
      "pathfinding_score": 0.77,
      "first_touch_rate": 0.67,
      "revisit_waste_rate": 0.12,
      "focus_ratio": 0.48,
      "warmup_cost": 6,
      "token_efficiency_rate": 0.66,
      "task_success_rate": 1.0,
      "tool_call_count": 24,
      "speed_score": 0.82
    }
  },
  "condition_b": {
    "label": "...",
    "score": 38,
    "metrics": {
      "pathfinding_score": 0.39,
      "first_touch_rate": 0.33,
      "revisit_waste_rate": 0.35,
      "focus_ratio": 0.21,
      "warmup_cost": 14,
      "token_efficiency_rate": 0.31,
      "task_success_rate": 0.75,
      "tool_call_count": 52,
      "speed_score": 0.41
    }
  },
  "deltas": {
    "pathfinding_score": -49,
    "first_touch_rate": -51,
    "revisit_waste_rate": 192,
    "focus_ratio": -56,
    "warmup_cost": 133,
    "token_efficiency_rate": -53,
    "task_success_rate": -25,
    "tool_call_count": 117,
    "speed_score": -50
  }
}
```

The `deltas` object contains the percentage change from Condition A to Condition B for each metric, calculated as `((val_b - val_a) / val_a) * 100` and rounded to the nearest integer.

---

## 4. Markdown Export Format

Triggered when the user requests `--report` or asks for a Markdown report.

### Output Location

```
docs/benchmarks/YYYY-MM-DD-report.md
```

The date is the date of the benchmark run.

### Structure

The Markdown report mirrors the terminal output but uses Markdown tables for structured data.

#### Example

```markdown
# Agent Benchmark Report

**Project:** {project_name}
**Commit:** {commit_hash}
**Date:** {YYYY-MM-DD}

## Navigability (40%)

| Metric | Value | Grade |
|---|---|---|
| Pathfinding Score | 0.77 | Good |
| First Touch Rate | 0.67 | Good |
| Revisit Waste Rate | 0.12 | Excellent |

## Cognitive Load (35%)

| Metric | Value | Grade |
|---|---|---|
| Focus Ratio | 0.48 | Fair |
| Warmup Cost | 6 | Good |
| Token Efficiency Rate | 0.66 | Good |

## Task Effectiveness (25%)

| Metric | Value | Grade |
|---|---|---|
| Task Success Rate | 1.00 | Excellent |
| Tool Call Count | 24 | Fair |
| Speed Score | 0.82 | Excellent |

## Overall

**Agent Readiness Score:** 72 / 100 (Good)

## Task Breakdown

| # | Category | Pathfinding | Status | Tool Calls |
|---|---|---|---|---|
| 1 | Discovery | 0.85 | Complete | 6 |
| 2 | Comprehension | 0.72 | Complete | 8 |
| 3 | Modification | 0.65 | Complete | 12 |
| 4 | Diagnosis | 0.90 | Failed | 15 |

<details>
<summary>Raw JSON Data</summary>

\```json
{ ... full JSON export ... }
\```

</details>
```

### Notes

- The JSON block inside `<details>` contains the complete JSON export as defined in Section 3.
- If the run was an A/B comparison, the Markdown report includes a comparison table between the two sections and the Overall score, following the same layout as the terminal A/B comparison format.
