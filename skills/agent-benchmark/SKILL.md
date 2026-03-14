---
name: agent-benchmark
description: Use when measuring agent task performance in a codebase, evaluating environment setup quality for AI agents, benchmarking agent navigation efficiency, running A/B comparisons of documentation/context configurations, or assessing Agent Readiness Score
---

# Agent Benchmark

Measure how well a codebase environment supports AI agent task performance. Uses the Lostness Metric (Smith, 1996) and DevEx Framework (Noda & Storey, 2023) to quantify agent navigability, cognitive load, and task effectiveness.

<HARD-GATE>

- Never report scores without actually running benchmark tasks
- Always generate tasks dynamically from the target repo — never use hardcoded tasks
- Always use hooks (PreToolUse/PostToolUse) for log capture — never rely on agent self-reporting
- Always run benchmark agents in worktree isolation — never let them modify the actual repo
- Never skip the repo analysis step — task quality depends on accurate code element extraction
- Always clean up hooks and worktrees after benchmark completion

</HARD-GATE>

---

## Execution Flow Overview

```
Phase 1: Repo Analysis          Phase 2: Agent Execution         Phase 3: Report
& Task Generation               & Hook Capture                   & Cleanup
─────────────────────           ─────────────────────            ─────────────────
[1] Scan repo structure         [4] Setup hooks (JSONL log)      [7] Parse logs
[2] Extract code elements       [5] Run agent(s) in worktree     [8] Calculate metrics
[3] Generate dynamic tasks      [6] Capture tool calls           [9] Generate report
                                                                 [10] Cleanup
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
| **Discovery** | "Find the entry point for the API server" | Lostness (optimal vs actual path) |
| **Comprehension** | "List all modules that depend on the auth package" | Comprehension depth |
| **Diagnosis** | "Find where ValidationError is thrown and trace its handler" | Search efficiency |
| **Modification** | "Add a new field to the User model" (in worktree) | End-to-end task completion |

**Each generated task must include:**
- Clear task description
- Expected answer (ground truth, verified by the benchmark runner)
- Expected optimal tool call count (**R** value for Lostness calculation)
- Task category label

**R value determination**: The benchmark runner solves the task first (or uses repo analysis results) to establish the minimum number of tool calls needed. This becomes the optimal path length **R**.

---

## Phase 2: Hooks Setup & Agent Execution

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
            "command": "jq -c '{phase: \"pre\", tool: .tool_name, file_path: (.tool_input.file_path // .tool_input.path // \"\"), timestamp: (now | strftime(\"%Y-%m-%dT%H:%M:%SZ\"))}' >> /tmp/agent-benchmark-TIMESTAMP.jsonl"
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
            "command": "jq -c '{phase: \"post\", tool: .tool_name, timestamp: (now | strftime(\"%Y-%m-%dT%H:%M:%SZ\"))}' >> /tmp/agent-benchmark-TIMESTAMP.jsonl"
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
- Hooks apply project-wide, so the main benchmark runner's own tool calls are also captured. Use **timestamp gaps** between tasks to segment the log: record task start/end timestamps and filter log entries by time range during Phase 3 log parsing.

**Stdin JSON structure (provided by Claude Code):**
- `session_id`: Session identifier
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
  "timestamp": "ISO-8601"
}
```

> **Note:** `task_id` is not available in hook stdin. The benchmark runner must track task boundaries by recording timestamps before/after each subagent dispatch, then correlate log entries by time range during log parsing (Phase 3, step [7]).

### [5] Agent Execution — Basic Mode

Single execution: run each task sequentially with a subagent.

- **Isolation**: Each subagent runs in a **git worktree** (created via `git worktree add`)
- **Subagent scope**: The subagent receives only the task description — no hints, no expected answers
- **No commits**: Subagents must not commit or push. Modification tasks are verified by file diff
- **Dispatch**: Use the `Agent` tool to launch each task subagent

```
Main Agent                          Subagent (in worktree)
───────────                         ──────────────────────
[Generate task]
     │
     ├──dispatch──→  Execute task using available tools
     │               (Glob, Grep, Read, Bash)
     │               ← return answer + completion status
     │
[Next task]
```

### [6] Agent Execution — Advanced Mode (A/B Comparison)

For comparing two environment configurations (e.g., with vs without CLAUDE.md, different docs structures):

1. **User defines 2 conditions**:
   - Condition A: baseline (e.g., repo as-is)
   - Condition B: treatment (e.g., repo with improved docs)
2. **Create 2 worktrees**: one per condition, apply configuration differences
3. **Run identical tasks on both**: same task set, same order
4. **Capture separate logs**: one JSONL per condition
5. **Generate comparison report**: side-by-side metrics

```
Condition A (worktree-a)              Condition B (worktree-b)
────────────────────────              ────────────────────────
Task 1 → log-a.jsonl                 Task 1 → log-b.jsonl
Task 2 → log-a.jsonl                 Task 2 → log-b.jsonl
  ...                                  ...
Task N → log-a.jsonl                 Task N → log-b.jsonl
         │                                     │
         └────────── Compare ──────────────────┘
                        │
               Comparison Report
```

---

## Phase 3: Log Collection & Report

### [7] Log Parsing

Read the JSONL log file(s) and extract per-task metrics:

- Total tool calls per task (**S** — actual steps)
- Unique files/nodes visited (**N**)
- Optimal tool calls (**R** — from task definition)
- Task completion status (correct/incorrect/partial)
- Time spent (first to last timestamp per task)

### [8] Metric Calculation

Calculate metrics as defined in `references/metrics.md`:

- **Lostness score** per task: `L = sqrt((N/S - 1)² + (R/N - 1)²)`

Refer to `references/metrics.md` for all 9 metrics across 3 dimensions:
- **Navigability** (40%): Pathfinding Score, First Touch Rate, Revisit Waste Rate
- **Cognitive Load** (35%): Focus Ratio, Warmup Cost, Token Efficiency Rate
- **Task Effectiveness** (25%): Task Success Rate, Tool Call Count, Speed Score

### [9] Grading & Agent Readiness Score

**Per-task grading:**

| Grade | Lostness (L) | Interpretation |
|-------|-------------|----------------|
| **Excellent** | L < 0.4 | Agent navigated efficiently |
| **Good** | 0.4 ≤ L < 0.6 | Minor detours but effective |
| **Fair** | 0.6 ≤ L < 0.8 | Significant wandering |
| **Poor** | L ≥ 0.8 | Agent was lost |

**Agent Readiness Score (0–100):**

Composite score reflecting overall environment quality:

| Dimension | Weight | Metrics |
|-----------|--------|---------|
| Navigability | 40% | Pathfinding Score, First Touch Rate, Revisit Waste Rate |
| Cognitive Load | 35% | Focus Ratio, Warmup Cost, Token Efficiency Rate |
| Task Effectiveness | 25% | Task Success Rate, Tool Call Count, Speed Score |

### [10] Terminal Output

Generate the report in terminal using the format defined in `references/report-format.md`.

**Report sections:**
- Header with repo name, timestamp, task count
- Per-task results table (task, category, grade, Lostness, steps)
- Aggregate metrics summary
- Agent Readiness Score with grade
- Recommendations for environment improvement

**Optional export** (only on user request):
- **JSON**: Machine-readable full results
- **Markdown**: Human-readable report file

### Cleanup

After report generation:
1. **Remove hooks**: Uninstall PreToolUse/PostToolUse hooks
2. **Clean worktrees**: `git worktree remove` for all benchmark worktrees
3. **Preserve logs**: Keep JSONL log at `/tmp/` (user can delete manually)

---

## Tools

- `Glob`: Repo structure scan, file pattern search, test/config file discovery
- `Grep`: Import/export graph collection, error pattern search, code element extraction
- `Read`: File content verification, JSONL log file reading, task answer verification
- `Bash`: git log for change history, hooks setup/teardown, worktree creation and cleanup, log file management
- `Agent`: Benchmark task execution subagents, repo analysis assistance

---

## Red Flags

| Thought | Reality |
|---------|---------|
| "레포가 작아서 벤치마크할 필요 없다" | 작은 레포도 환경 세팅 품질은 다를 수 있다 |
| "태스크 하나만 돌려보면 충분하다" | 카테고리별 최소 1개씩 4개는 필요하다 |
| "에이전트가 직접 도구 호출을 보고하면 된다" | 자기 보고는 누락 가능. hooks로 외부 캡처해야 한다 |
| "실제 레포에서 바로 수정 태스크를 돌려도 된다" | worktree isolation 필수. 실제 코드를 오염시키면 안 된다 |
| "점수가 낮으면 모델이 나쁜 것이다" | 이 벤치마크는 환경 품질을 측정한다. 모델 성능 측정이 아니다 |
| "hooks 로그가 없어도 대략 추정하면 된다" | 추정은 벤치마크가 아니다. 정확한 데이터 수집이 핵심 |
