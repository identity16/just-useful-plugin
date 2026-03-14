---
name: agent-benchmark
description: Use when measuring agent task performance in a codebase, evaluating environment setup quality for AI agents, benchmarking agent resource efficiency, or running A/B comparisons of documentation/context configurations
---

# Agent Benchmark

Measure how well a codebase environment supports AI agent task performance. Compares resource efficiency (tokens, time, backtracking) across environment configurations using A/B benchmarking.

<HARD-GATE>

- Never report scores without actually running benchmark tasks
- Always generate tasks dynamically from the target repo — never use hardcoded tasks
- Always use hooks (PreToolUse/PostToolUse) for log capture — never rely on agent self-reporting
- Always run benchmark agents in worktree isolation — use `isolation: "worktree"` on every Agent dispatch (basic mode) or pre-configured worktrees (A/B mode). Never let agents modify the actual repo.
- Never skip the repo analysis step — task quality depends on accurate code element extraction
- Always clean up hooks and worktrees after benchmark completion

</HARD-GATE>

---

## Execution Flow Overview

```
Phase 1: Repo Analysis          Phase 2: Agent Execution         Phase 3: Report
& Task Generation               & Hook Capture                   & Cleanup
─────────────────────           ─────────────────────            ─────────────────
[1] Scan repo structure         [4] Setup hooks (JSONL log)      [7] Parse logs (by session_id)
[2] Extract code elements       [5] Run agents in parallel       [8] Calculate metrics
[3] Generate dynamic tasks      [6] Capture tool calls           [9] Generate report
                                                                 [10] Cleanup
```

---

## Phase 0: User Intent Confirmation

Use `AskUserQuestion` at skill start to confirm execution mode and options. Skip items the user has already specified.

**Items to confirm:**
- **Execution mode**: Basic (single environment) vs A/B (comparison)
- **If A/B mode**: What differs between the two conditions (e.g., "with vs without CLAUDE.md", "docs structure A vs B")
- **Task count preference**: Default 4–8, can be adjusted
- **Focus category**: Whether to focus on a specific category (e.g., Modification only)

```
AskUserQuestion (adapt to user's language): "Please choose a benchmark mode:
1. Basic — single benchmark run on current environment
2. A/B — compare two environment configurations

Any preference on task count or focus category? (Default: 1 per category, 4–8 total)"
```

---

## Phase 1: Repo Analysis & Task Generation

### [1] Repo Structure Scan

Collect the structural fingerprint of the target repository.

```bash
# Directory structure (depth-limited)
find . -type f -not -path './.git/*' | head -200

# Documentation listing
ls -la docs/ CLAUDE.md AGENTS.md README.md 2>/dev/null

# Recent change history
git log --oneline -20
git log --oneline --diff-filter=ADR --name-status --since="4 weeks ago"
```

Use `Glob` to map file patterns: `**/*.ts`, `**/*.py`, `**/*.md`, etc.

### [2] Code Element Extraction

Extract key code elements that will seed task generation:

| Element | How to Extract | Purpose |
|---------|---------------|---------|
| **Entry points** | Glob for `main.*`, `index.*`, `app.*`, `server.*` | Navigation tasks |
| **Modules/packages** | Glob for directory patterns with `__init__.py`, `package.json` | Architecture tasks |
| **Import/export graph** | Grep for `import`, `require`, `export` | Dependency tasks |
| **Error patterns** | Grep for `throw`, `raise`, `catch`, `Error`, custom error classes | Debugging tasks |
| **Config files** | Glob for `*.config.*`, `*.json`, `*.yaml`, `*.toml` | Setup tasks |
| **Test files** | Glob for `*test*`, `*spec*`, `__tests__/` | Verification tasks |

### [3] Dynamic Task Generation

Generate 4–8 tasks per repo using extracted code elements. Reference `references/task-templates.md` for task category definitions and templates.

**Task categories** (minimum 1 per category):

| Category | Example | Measures |
|----------|---------|----------|
| **Discovery** | "Find the entry point for the API server" | Token/time efficiency for navigation |
| **Comprehension** | "List all modules that depend on the auth package" | Token/time efficiency for understanding |
| **Diagnosis** | "Find where ValidationError is thrown and trace its handler" | Token/time efficiency for search |
| **Modification** | "Add a new field to the User model" (in worktree) | Token/time efficiency for end-to-end task |

**Each generated task must include:**
- Clear task description
- Expected answer (ground truth, verified by the benchmark runner)
- Expected relevant files list (for Backtrack Rate calculation)
- Task category label

**Expected files determination**: The benchmark runner solves the task first (or uses repo analysis results) to establish the relevant files list. This is used to calculate Backtrack Rate (unique files accessed vs total file accesses).

---

## Phase 2: Hooks Setup & Agent Execution

### Phase 1 Complete → Task Confirmation

After Phase 1, show generated tasks to the user and use `AskUserQuestion` to confirm before proceeding:

```
AskUserQuestion (adapt to user's language): "[Phase 1 complete] N tasks generated:

1. [Discovery] Find the entry point for the API server
2. [Comprehension] List all modules that depend on auth
3. [Diagnosis] Trace where ValidationError is thrown
4. [Modification] Add a new field to the User model

Proceed with benchmark? Let me know if you want to modify/add/remove any tasks."
```

Proceed to Phase 2 only after user approval.

### [4] Hooks Setup

Create a temporary JSONL log file for capturing all tool calls:

```
/tmp/agent-benchmark-{TIMESTAMP}.jsonl
```

**Hook installation via `settings.local.json`:**

Claude Code hooks receive JSON on **stdin** containing tool information. The `tool_name` field identifies which tool was called. **Merge** the hooks config into the project's existing `.claude/settings.local.json` (read the file first, add the `hooks` key, write back — do not overwrite other keys like `permissions` or `enabledPlugins`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '{phase: \"pre\", tool: .tool_name, file_path: (.tool_input.file_path // .tool_input.path // \"\"), session_id: .session_id, timestamp: (now | strftime(\"%Y-%m-%dT%H:%M:%SZ\"))}' >> /tmp/agent-benchmark-TIMESTAMP.jsonl"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "jq -c '{phase: \"post\", tool: .tool_name, session_id: .session_id, timestamp: (now | strftime(\"%Y-%m-%dT%H:%M:%SZ\"))}' >> /tmp/agent-benchmark-TIMESTAMP.jsonl"
          }
        ]
      }
    ]
  }
}
```

**Important:**
- Replace `TIMESTAMP` in the file path with the actual benchmark run timestamp before writing the settings file.
- After the benchmark completes, **remove only the `hooks` key** from `settings.local.json` to restore normal operation (preserve other keys).
- Hooks apply project-wide, so the main benchmark runner's own tool calls are also captured. Use `session_id` to correlate log entries to specific tasks — each subagent runs in its own session, so the benchmark runner records each subagent's `session_id` and maps it to a task during Phase 3 log parsing.

**Stdin JSON structure (provided by Claude Code):**
- `session_id`: Session identifier (unique per subagent — used to correlate logs to tasks)
- `tool_name`: Tool identifier (e.g., `"Read"`, `"Grep"`, `"Bash"`, `"Glob"`, `"Edit"`, `"Write"`, `"Agent"`)
- `tool_input`: Tool parameters object (contains `file_path`, `pattern`, `command`, etc. depending on tool)
- `tool_use_id`: Unique tool call identifier
- `tool_response`: (PostToolUse only) Result returned by the tool

Each log entry records:
```json
{
  "phase": "pre|post",
  "tool": "Grep|Read|Bash|...",
  "file_path": "/path/to/file",
  "session_id": "session-abc123",
  "timestamp": "ISO-8601"
}
```

> **Note:** Each subagent dispatch gets a unique `session_id`. The benchmark runner records the mapping of `session_id → task_id` from each Agent dispatch, then uses this mapping to correlate JSONL log entries to tasks during Phase 3 log parsing. This enables parallel task execution without log entry ambiguity.

### [5] Agent Execution — Basic Mode

**Parallel execution**: dispatch all tasks concurrently as subagents for maximum speed.

- **Isolation**: Every subagent **must** be dispatched with `isolation: "worktree"` on the `Agent` tool — even for a single task. This creates a temporary git worktree automatically; do **not** use manual `git worktree add`.
- **Subagent scope**: The subagent receives only the task description — no hints, no expected answers
- **No commits**: Subagents must not commit or push. Modification tasks are verified by file diff
- **Dispatch**: Use the `Agent` tool with `isolation: "worktree"` for every task
- **Parallelism**: Dispatch **all tasks in a single message** with multiple Agent tool calls. Each subagent gets its own worktree and session, so there are no conflicts between concurrent tasks. Record the returned `agentId` (= session_id) for each task to correlate logs in Phase 3.

```python
# Dispatch ALL tasks in parallel in a single message
# Each gets its own isolated worktree — no conflicts
Agent(prompt="<task 1>", isolation="worktree", description="benchmark task 1")
Agent(prompt="<task 2>", isolation="worktree", description="benchmark task 2")
Agent(prompt="<task 3>", isolation="worktree", description="benchmark task 3")
Agent(prompt="<task 4>", isolation="worktree", description="benchmark task 4")
# ... all in one message block
```

```
Main Agent
───────────
[Generate all tasks]
     │
     ├──dispatch task 1 (isolation: "worktree")──→  Subagent 1 (worktree-1)
     ├──dispatch task 2 (isolation: "worktree")──→  Subagent 2 (worktree-2)
     ├──dispatch task 3 (isolation: "worktree")──→  Subagent 3 (worktree-3)
     ├──dispatch task 4 (isolation: "worktree")──→  Subagent 4 (worktree-4)
     │         (all running concurrently)
     │
     ├── all complete ← collect results + agentIds
     │
[Map agentId → task for log correlation]
```

**Session-to-task mapping**: After all agents complete, record the `agentId` returned by each Agent dispatch. This `agentId` corresponds to the `session_id` in JSONL log entries, enabling accurate per-task log correlation even with concurrent execution.

### [6] Agent Execution — Advanced Mode (A/B Comparison)

For comparing two environment configurations (e.g., with vs without CLAUDE.md, different docs structures):

1. **User defines 2 conditions**:
   - Condition A: baseline (e.g., repo as-is)
   - Condition B: treatment (e.g., repo with improved docs)
2. **Create 2 worktrees manually** (`git worktree add`): one per condition, apply configuration differences (e.g., add/remove CLAUDE.md). A/B mode requires manual worktree setup because each condition needs different file modifications applied before agent execution.
3. **Run all tasks on both conditions in parallel**: Dispatch all tasks across both conditions concurrently in a single message. Subagents do **not** use `isolation: "worktree"` in A/B mode — they run directly in the pre-configured worktree paths instead.
4. **Capture logs with session_id**: All logs go to condition-specific JSONL files. Use `session_id` to correlate entries to tasks.
5. **Generate comparison report**: side-by-side metrics

```
                    ┌── Task 1-A (worktree-a) ──→ log-a.jsonl
                    ├── Task 2-A (worktree-a) ──→ log-a.jsonl
All dispatched      ├── Task 1-B (worktree-b) ──→ log-b.jsonl
concurrently  ──────├── Task 2-B (worktree-b) ──→ log-b.jsonl
                    ├── ...
                    └── Task N-B (worktree-b) ──→ log-b.jsonl
                              │
                    All complete → Compare
                              │
                     Comparison Report
```

**Note**: Tasks within the same worktree run concurrently. Since subagents only read files (Discovery, Comprehension, Diagnosis tasks), concurrent access is safe. For Modification tasks that write files, each subagent operates on different files as determined by the task, minimizing conflict risk.

---

## Phase 3: Log Collection & Report

### [7] Log Parsing

Read the JSONL log file(s) and extract per-task data using the `session_id → task` mapping recorded during Phase 2:

- Group log entries by `session_id`, then map each group to its task using the recorded mapping
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

### Phase 2 Complete → Progress Update

Output a text status update when Phase 2 finishes (adapt to user's language):
```
[Phase 2 complete] N tasks finished. Starting log parsing and report generation.
```

### [10] Terminal Output

Generate the report in terminal using the format defined in `references/report-format.md`.

**Report sections:**
- Header with repo name, commit hash, task count
- Per-task results table (category, status, tokens, time, backtrack)
- Summary (successful count, total tokens, total time, avg backtrack)
- A/B comparison tables and summary ratios (comparison mode only)

After displaying the report, use `AskUserQuestion` to check for follow-up actions:
```
AskUserQuestion (adapt to user's language): "Would you like to export the report as JSON or Markdown? (Say 'no' if not needed)"
```

**Export formats** (only when user requests):
- **JSON**: Machine-readable full results
- **Markdown**: Human-readable report file

### Cleanup

After report generation:
1. **Remove hooks**: Uninstall PreToolUse/PostToolUse hooks
2. **Clean worktrees**:
   - Basic mode: `isolation: "worktree"` auto-cleans worktrees with no changes. For Modification tasks where files were changed, the Agent tool returns the worktree path — run `git worktree remove <path>` to clean up.
   - A/B mode: `git worktree remove` for both condition worktrees.
3. **Preserve logs**: Keep JSONL log at `/tmp/` (user can delete manually)

---

## Tools

- `AskUserQuestion`: Mode selection, task confirmation, report export — any point requiring user decision
- `Glob`: Repo structure scan, file pattern search, test/config file discovery
- `Grep`: Import/export graph collection, error pattern search, code element extraction
- `Read`: File content verification, JSONL log file reading, task answer verification
- `Bash`: git log for change history, hooks setup/teardown, worktree creation and cleanup, log file management
- `Agent`: Benchmark task execution subagents, repo analysis assistance

---

## Red Flags

| Thought | Reality |
|---------|---------|
| "Repo is too small to benchmark" | Small repos can still vary in environment setup quality |
| "One task is enough" | Minimum 1 per category, 4 total required |
| "Agent can self-report tool calls" | Self-reporting can miss calls. Use hooks for external capture |
| "Run modification tasks directly on the repo" | Worktree isolation is mandatory. Never pollute the actual codebase |
| "Only one task, no need for isolation" | Even single tasks require `isolation: "worktree"`. Modifications can pollute main |
| "Low score means the model is bad" | This benchmark measures environment quality, not model performance |
| "Estimate without hook logs" | Estimation is not benchmarking. Accurate data collection is the point |
| "Run tasks sequentially" | All tasks are independent. Use parallel dispatch to save time |
