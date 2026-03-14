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

```
elapsed_time = last_tool_call_timestamp - first_tool_call_timestamp
```

### 1.3 Backtrack Rate

**Direction:** lower is better (0–1)

Proportion of file accesses that are redundant revisits to previously accessed files.

**Variables:**
- `N` = number of unique files accessed
- `S` = total file accesses (including revisits to the same file)

**Formula:**

```
backtrack_rate = (S - N) / S
```

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

```
token_ratio     = tokens_A / tokens_B
time_ratio      = time_A / time_B
backtrack_ratio = backtrack_A / backtrack_B
```

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
