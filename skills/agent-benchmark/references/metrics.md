# Metrics Reference

This document defines the metrics used by the agent-benchmark skill to evaluate Claude Code agent performance. All metrics are organized into three weighted dimensions that combine into a single **Agent Readiness Score**.

---

## 1. Tool Classification

Every tool call is classified into one of three categories. This classification drives the Cognitive Load metrics.

| Category | Label | Tools |
|---|---|---|
| **Orientation** | 탐색 | `Read`, `Grep`, `Glob`, read-only `Bash` commands (`git log`, `git diff`, `git status`, `ls`, `find`, `cat`, `head`, `tail`, `wc`, `file`, `which`, `pwd`, `echo`, `env`, `printenv`) |
| **Execution** | 실행 | `Edit`, `Write`, state-modifying `Bash` commands (anything not classified as read-only — e.g., `mkdir`, `cp`, `mv`, `rm`, `npm install`, `git commit`, `sed -i`) |
| **Delegation** | 위임 | `Agent` — subagent spawns. Internal tool calls within a subagent are tracked separately and do not count toward the parent agent's metrics. |

**Classification rule for `Bash`:** A Bash call is **orientation** if its command is read-only (produces output without side effects). It is **execution** if the command creates, modifies, or deletes files or state. When ambiguous, treat as execution.

---

## 2. Dimension 1: Navigability (Weight: 40%)

Navigability measures how efficiently the agent locates the files it needs. An expert agent navigates directly to relevant files with minimal backtracking.

### 2.1 Pathfinding Score

**Direction:** higher is better (0–1)

Measures how directly the agent reaches the right files without unnecessary exploration or revisits.

**Variables:**
- `N` = number of unique files accessed
- `S` = total file accesses (including revisits to the same file)
- `R` = minimum files needed (from the task answer key)

**Formula:**

```
pathfinding_score = 1 - sqrt((N/S - 1)² + (R/N - 1)²)
```

- When `N/S = 1` (no revisits) and `R/N = 1` (no unnecessary files), the score is 1.0.
- Revisits push `N/S` below 1; exploring extra files pushes `R/N` below 1.

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | >= 0.8 |
| Good | >= 0.6 |
| Fair | >= 0.4 |
| Poor | < 0.4 |

### 2.2 First Touch Rate

**Direction:** higher is better (0–1)

Measures whether the agent's earliest tool calls target the correct files, indicating strong initial intuition about the codebase.

**Formula:**

```
first_touch_rate = (number of first 3 tool calls that access answer-key files) / 3
```

Only the first 3 tool calls that reference a file path are considered. Tool calls without file references (e.g., a generic `Bash` command) are skipped when counting.

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | >= 0.67 (2/3) |
| Good | >= 0.33 (1/3) |
| Fair | > 0 |
| Poor | = 0 |

### 2.3 Revisit Waste Rate

**Direction:** lower is better (0–1)

Measures the proportion of file accesses that are redundant revisits.

**Formula:**

```
revisit_waste_rate = (S - N) / S
```

- `S - N` is the number of revisit accesses.
- A rate of 0 means every file was accessed exactly once.

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | <= 0.1 |
| Good | <= 0.25 |
| Fair | <= 0.4 |
| Poor | > 0.4 |

---

## 3. Dimension 2: Cognitive Load (Weight: 35%)

Cognitive Load measures how much exploratory overhead the agent requires before and during productive work. A low-overhead agent spends more of its budget on execution than orientation.

### 3.1 Focus Ratio

**Direction:** higher is better (ratio, unbounded but typically 0–2)

Measures the balance between execution and orientation tool calls.

**Formula:**

```
focus_ratio = execution_calls / orientation_calls
```

Uses the tool classification defined in Section 1. If `orientation_calls = 0`, the focus ratio is defined as the maximum grade value (treated as Excellent).

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | >= 0.5 |
| Good | >= 0.3 |
| Fair | >= 0.15 |
| Poor | < 0.15 |

### 3.2 Warmup Cost

**Direction:** lower is better (count)

Measures how many tool calls the agent makes before its first productive action (an `Edit` or `Write` call).

**Formula:**

```
warmup_cost = number of tool calls before the first Edit or Write call
```

If the agent never calls `Edit` or `Write`, warmup cost equals the total tool call count (worst case).

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | <= 3 |
| Good | <= 6 |
| Fair | <= 10 |
| Poor | > 10 |

### 3.3 Token Efficiency Rate

**Direction:** higher is better (0–1)

Measures what fraction of total tokens were spent on execution-related tool calls versus orientation.

**Formula:**

```
token_efficiency_rate = tokens_in_execution_calls / total_tokens
```

Token counts include both input and output tokens for each tool call. Only tool-call tokens are counted (system prompt and final response tokens are excluded).

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | >= 0.5 |
| Good | >= 0.35 |
| Fair | >= 0.2 |
| Poor | < 0.2 |

### 3.4 Orientation Time Ratio

**Direction:** lower is better (0–1)

Measures what fraction of total elapsed time was spent on orientation (read-only exploration) versus execution (productive modifications). Complements Focus Ratio (which counts calls) by capturing time — a single slow exploration call has more impact here than in Focus Ratio.

**Variables:**
- `orientation_time` = sum of elapsed time for all orientation tool calls (classified per Section 1)
- `total_time` = total elapsed time from first to last tool call

**Formula:**

```
orientation_time_ratio = orientation_time / total_time
```

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | <= 0.4 |
| Good | <= 0.55 |
| Fair | <= 0.7 |
| Poor | > 0.7 |

### 3.5 Warmup Precision

**Direction:** higher is better (0–1)

Measures whether warmup calls (tool calls before the first Edit/Write) targeted answer-relevant files. Distinguishes productive warmup (reading the right files) from wasted warmup (exploring irrelevant files). Used alongside Warmup Cost to give a complete picture: high cost + high precision = justified warmup; high cost + low precision = wasted exploration.

**Variables:**
- `relevant_warmup_calls` = number of warmup tool calls that accessed files in the task's answer key
- `warmup_cost` = total warmup tool calls (as defined in §3.2)

**Formula:**

```
warmup_precision = relevant_warmup_calls / warmup_cost
```

If `warmup_cost = 0`, warmup precision is 1.0 (no warmup needed, no waste).

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | >= 0.8 |
| Good | >= 0.5 |
| Fair | >= 0.25 |
| Poor | < 0.25 |

---

## 4. Dimension 3: Task Effectiveness (Weight: 25%)

Task Effectiveness measures whether the agent actually completed the task correctly and how efficiently it did so.

### 4.1 Task Success Rate

**Direction:** higher is better (0–1)

Measures the fraction of tasks completed correctly across a benchmark run.

**Formula:**

```
task_success_rate = correct_tasks / total_tasks
```

A task is "correct" if it passes all validation checks defined in the task answer key.

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | = 1.0 |
| Good | >= 0.75 |
| Fair | >= 0.5 |
| Poor | < 0.5 |

### 4.2 Tool Call Count

**Direction:** lower is better (count)

Raw count of all tool calls made to complete the task. Grading thresholds vary by task difficulty.

**Grading:**

| Grade | Easy | Medium | Hard |
|---|---|---|---|
| Excellent | <= 5 | <= 10 | <= 20 |
| Good | <= 10 | <= 20 | <= 35 |
| Fair | <= 20 | <= 35 | <= 50 |
| Poor | > 20 | > 35 | > 50 |

### 4.3 Speed Score

**Direction:** higher is better (0–1)

Measures time-to-completion normalized against a baseline (the fastest possible completion time for the task).

**Formula:**

```
speed_score = baseline_time / actual_time
```

- Capped at 1.0 (if the agent is faster than baseline, score is 1.0).
- `baseline_time` is defined per task in the answer key.

**Grading:**

| Grade | Threshold |
|---|---|
| Excellent | >= 0.8 |
| Good | >= 0.6 |
| Fair | >= 0.4 |
| Poor | < 0.4 |

---

## 5. Grading Summary Table

| # | Metric | Dimension | Direction | Excellent | Good | Fair | Poor |
|---|---|---|---|---|---|---|---|
| 1 | Pathfinding Score | Navigability | higher is better | >= 0.8 | >= 0.6 | >= 0.4 | < 0.4 |
| 2 | First Touch Rate | Navigability | higher is better | >= 0.67 | >= 0.33 | > 0 | = 0 |
| 3 | Revisit Waste Rate | Navigability | lower is better | <= 0.1 | <= 0.25 | <= 0.4 | > 0.4 |
| 4 | Focus Ratio | Cognitive Load | higher is better | >= 0.5 | >= 0.3 | >= 0.15 | < 0.15 |
| 5 | Warmup Cost | Cognitive Load | lower is better | <= 3 | <= 6 | <= 10 | > 10 |
| 6 | Token Efficiency Rate | Cognitive Load | higher is better | >= 0.5 | >= 0.35 | >= 0.2 | < 0.2 |
| 7 | Orientation Time Ratio | Cognitive Load | lower is better | <= 0.4 | <= 0.55 | <= 0.7 | > 0.7 |
| 8 | Warmup Precision | Cognitive Load | higher is better | >= 0.8 | >= 0.5 | >= 0.25 | < 0.25 |
| 9 | Task Success Rate | Task Effectiveness | higher is better | = 1.0 | >= 0.75 | >= 0.5 | < 0.5 |
| 10 | Tool Call Count | Task Effectiveness | lower is better | <= 5/10/20 | <= 10/20/35 | <= 20/35/50 | > 20/35/50 |
| 11 | Speed Score | Task Effectiveness | higher is better | >= 0.8 | >= 0.6 | >= 0.4 | < 0.4 |

*Tool Call Count thresholds shown as Easy/Medium/Hard.*

---

## 6. Agent Readiness Score (0–100)

The Agent Readiness Score combines all eleven metrics into a single number on a 0–100 scale.

### Step 1: Normalize each metric to 0–1

For **higher-is-better** metrics (Pathfinding Score, First Touch Rate, Focus Ratio, Token Efficiency Rate, Warmup Precision, Task Success Rate, Speed Score):
- Use the raw value directly (already 0–1, or cap at 1.0 for Focus Ratio).
- For Focus Ratio: `normalized = min(focus_ratio, 1.0)`.

For **lower-is-better** metrics (Revisit Waste Rate, Warmup Cost, Tool Call Count, Orientation Time Ratio):
- **Revisit Waste Rate:** `normalized = 1 - revisit_waste_rate`
- **Warmup Cost:** `normalized = 1 - min(warmup_cost / 15, 1.0)` (15 is the ceiling — beyond 15 tool calls, normalized value is 0)
- **Tool Call Count:** `normalized = 1 - min(tool_call_count / max_poor_threshold, 1.0)` where `max_poor_threshold` is 20 (Easy), 35 (Medium), or 50 (Hard)
- **Orientation Time Ratio:** `normalized = 1 - orientation_time_ratio`

### Step 2: Average within each dimension

```
navigability_avg    = mean(pathfinding_score, first_touch_rate, 1 - revisit_waste_rate)
cognitive_load_avg  = mean(min(focus_ratio, 1.0), 1 - warmup_cost_norm, token_efficiency_rate,
                          1 - orientation_time_ratio, warmup_precision)
effectiveness_avg   = mean(task_success_rate, 1 - tool_call_count_norm, speed_score)
```

### Step 3: Apply dimension weights

```
weighted_score = navigability_avg × 0.40
               + cognitive_load_avg × 0.35
               + effectiveness_avg × 0.25
```

### Step 4: Scale to 0–100

```
agent_readiness_score = round(weighted_score × 100)
```

### Overall Grade

| Grade | Score |
|---|---|
| Excellent | >= 80 |
| Good | >= 60 |
| Fair | >= 40 |
| Poor | < 40 |
