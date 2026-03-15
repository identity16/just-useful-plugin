# Agent Benchmark Continuous Measurement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** agent-benchmark 스킬이 단일 레포에서 반복 측정과 점진적 개선을 지원하도록 확장한다.

**Architecture:** 태스크 셋을 고정하여 실행 간 비교 가능성을 확보하고, 매 실행 결과를 히스토리에 자동 저장하며, 누적 결과가 태스크 셋 개선으로 피드백되는 루프를 구성한다. 태스크 선정 신호는 git history(커버리지)와 세션 히스토리(탐색 패턴 보완)로 분리한다.

**Tech Stack:** Markdown skill files, JSONL (history), JSON (task store), git log analysis

**Key Design Constraint:** 태스크 셋 변경은 항상 명시적 버전 증가를 통해 이루어진다. 피드백 루프가 태스크를 수정할 때 암묵적으로 태스크 셋이 바뀌지 않도록, `tasks.json`에 `task_set_version`을 관리하고 `history.jsonl` 각 항목이 이 버전을 기록한다. 트렌드·리그레션 비교는 동일 버전 내에서만 수행한다.

---

## Chunk 1: 개념 설계 — task-lifecycle.md 신규 생성

### Task 1: 태스크 수명주기 레퍼런스 파일 신규 생성

**Files:**
- Create: `skills/agent-benchmark/references/task-lifecycle.md`
- Modify: `CLAUDE.md` (레퍼런스 추가)

---

- [ ] **Step 1: `task-lifecycle.md` 작성**

아래 내용으로 파일 생성:

```markdown
# Task Lifecycle Reference

This document defines how benchmark tasks are selected, fixed, validated, and evolved over time.

---

## 1. Philosophy: Coverage vs. Efficiency Signal

Task selection and efficiency measurement serve different purposes and should use different signals.

| Signal | Role | Source |
|--------|------|--------|
| **Coverage** | Which areas to include in the task set | git history |
| **Efficiency** | Where agents currently struggle | benchmark run results |
| **Pattern enrichment** | Personal navigation patterns | session history (optional) |

**Rule:** Task selection aims for *coverage*, not efficiency prediction. Efficiency is revealed by running the benchmark — it cannot be reliably inferred from external signals before execution.

git history is the universal signal (reflects all contributors across monorepos) while session history is personal and partial. Use git history for task coverage; treat session history as an optional enrichment layer that adds personal navigation pattern context.

---

## 2. Task Source Strategy

### Primary: git history (coverage signal)

Use git log to identify which areas matter most in the repo:

```bash
# File change frequency (last 90 days)
git log --since="90 days ago" --name-only --format="" | sort | uniq -c | sort -rn | head -30

# Files touched by multiple contributors
git log --format="%ae %H" --name-only | ...

# Commit types for task category mapping
git log --oneline --since="90 days ago" | grep -E "^[a-f0-9]+ (fix|feat|refactor):"
```

Mapping:
- High-frequency files → Discovery/Comprehension tasks (important navigation targets)
- `fix:` commits (recent) → Diagnosis tasks (real bug areas)
- `feat:` commits (recent) → Modification tasks (active feature areas)
- Multi-contributor files → harder tasks (complex coordination areas)

### Secondary: canonical fixtures (baseline coverage)

Use `references/task-templates.md` template binding as fallback for repos with sparse git history (< 20 commits or < 4 weeks of history).

### Optional enrichment: session history

When the user volunteers session history context, use it to:
- Prioritize tasks in areas where personal backtrack was previously high
- Surface "this was hard for me" tasks as higher-priority candidates

Session history does NOT replace git history as the primary signal — it supplements it for the individual contributor running the benchmark.

---

## 3. Task Fixation Flow

After Phase 1 task generation, present tasks to the user for review before fixing them.

### Review presentation format

For each generated task, show:
- Task prompt
- Category
- Referenced files (R count)
- Module count (how many distinct modules the task spans)
- Source: `git-history` | `fixture` | `template`

```
Proposed Task Set
─────────────────────────────────────────────────────────────
  #   Category        R   Modules  Source         Task
  1   Discovery       3   1        git-history    Starting from src/index.ts, find the...
  2   Comprehension   5   2        git-history    Explain the dependency between auth and...
  3   Diagnosis       4   2        template       Find where ValidationError is thrown...
  4   Modification    6   3        fixture        Add input validation to createUser()
─────────────────────────────────────────────────────────────
```

### User decisions

AskUserQuestion: Let the user:
- Approve all tasks as-is
- Remove specific tasks (by number)
- Request regeneration of specific tasks
- Add a custom task manually

Only after user approval are tasks saved to `docs/benchmarks/tasks.json`.

### tasks.json schema

```json
{
  "task_set_version": 1,
  "created_at": "ISO-8601",
  "last_updated": "ISO-8601",
  "changelog": [
    {
      "version": 1,
      "date": "ISO-8601",
      "reason": "initial task set"
    }
  ],
  "tasks": [
    {
      "id": "task-001",
      "category": "Discovery|Comprehension|Diagnosis|Modification",
      "prompt": "task description",
      "difficulty": "easy|medium|hard",
      "source": "git-history|fixture|template|manual",
      "expected_files": ["src/auth/index.ts", "src/user/model.ts"],
      "created_at": "ISO-8601"
    }
  ]
}
```

---

## 4. Task Set Versioning

`task_set_version` is an integer that increments whenever the task set changes. It is the key that keeps run history comparable.

### Version increment rules

| Action | Version change |
|--------|---------------|
| Initial task set creation | version = 1 |
| Add one or more tasks | +1 |
| Remove one or more tasks | +1 |
| Edit task prompt or expected_files | +1 |
| Re-order tasks only | no change |
| Staleness fix that doesn't change prompt | +1 (expected_files changed) |

### How to increment

When the user approves a task set change via AskUserQuestion:
1. Increment `task_set_version`
2. Append a changelog entry with `version`, `date`, `reason` (the user's stated reason for the change)
3. Update `last_updated`
4. Save tasks.json

Never silently increment. The user must explicitly approve each change that triggers a version bump.

### history.jsonl — version tracking

Every history entry records the task set version at run time:

```json
{
  "run_id": "2026-03-15T14:32:00Z",
  "task_set_version": 2,
  ...
}
```

This enables the trend view and regression detection to filter entries by version.

### Impact on trend and regression

- **Trend view**: only shows runs with the same `task_set_version` as the current run. When a version boundary exists in history, show a divider:
  ```
  2026-03-10  v1  55,140  202.3s  0.07
  2026-03-12  v1  48,320  178.1s  0.05
  ── task set updated to v2 (added Diagnosis task) ──
  2026-03-14  v2  41,200  158.4s  0.03
  2026-03-15  v2  55,140  202.3s  0.07  ← today
  ```
- **Regression detection**: compare only against the most recent run with the same `task_set_version`. Skip regression check if no prior run exists for this version.
- **Historical comparison**: selecting `last` or `best` filters to same version by default. User can override to compare across versions.

---

## 5. Task Staleness Detection

On re-run (when tasks.json exists), validate that fixed tasks are still runnable:

```
For each task in tasks.json:
  1. Check that all expected_files still exist
  2. Check that referenced function/module names appear in those files (Grep)
  3. If any check fails → mark task as STALE
```

### Handling stale tasks

Present stale tasks to user:
```
⚠️  2 tasks may be stale (referenced code has changed):
  task-003: src/auth/validate.ts — file not found
  task-004: createUser() — function signature changed

Options:
  a) Skip stale tasks this run
  b) Regenerate stale tasks now
  c) Run anyway (task may still be useful as-is)
```

---

## 6. Feedback Loop: Results → Task Set Evolution (always via version bump)

After accumulating 3+ runs, the benchmark has enough data to suggest task set improvements.

### When to surface feedback loop

Show task refinement suggestions when:
- A task category has consistently high backtrack (≥ 0.3 average across 3+ runs)
- A task consistently fails (≥ 2 failures in last 3 runs)
- A task is suspiciously easy (backtrack = 0.00, time < 10s across 3+ runs)

### Suggestion types

| Pattern | Suggestion |
|---------|-----------|
| Consistent high backtrack in Diagnosis | Add more Diagnosis tasks targeting the same module area |
| Consistent task failure | Replace task (prompt may be ambiguous or referenced code stale) |
| Suspiciously easy task | Consider replacing with harder variant (increase R count) |
| All tasks easy after env improvement | Refresh task set — current set may no longer differentiate |

### User decision

Present suggestions after Phase 3 report (not automatically applied):
```
AskUserQuestion: "Based on 5 runs, Diagnosis tasks show avg backtrack 0.38 (highest category).
Would you like to add a harder Diagnosis task targeting the auth module?
(This will increment task_set_version: v2 → v3)"
```

If the user approves, apply the change and increment `task_set_version` per §4 rules.
Never apply task set changes without AskUserQuestion confirmation — even "obvious" improvements.
```

---

- [ ] **Step 2: `CLAUDE.md`에 레퍼런스 추가**

기존 레퍼런스 목록에 한 줄 추가:
```
- When working on agent-benchmark task selection and lifecycle → read `skills/agent-benchmark/references/task-lifecycle.md`
```

- [ ] **Step 3: 커밋**

```bash
git add skills/agent-benchmark/references/task-lifecycle.md CLAUDE.md
git commit -m "docs(agent-benchmark): add task-lifecycle reference for continuous measurement design"
```

---

## Chunk 2: report-format.md 확장

### Task 2: 새 리포트 포맷 추가 (히스토리 비교, 트렌드, 리그레션 경고)

**Files:**
- Modify: `skills/agent-benchmark/references/report-format.md`

---

- [ ] **Step 1: `history.jsonl` 엔트리 포맷 섹션 추가**

파일 끝에 새 섹션 추가:

```markdown
---

## 5. History Log Format (history.jsonl)

Every benchmark run is automatically appended to `docs/benchmarks/history.jsonl`.
One JSON line per run.

### Entry Schema

```json
{
  "run_id": "2026-03-15T14:32:00Z",
  "commit": "9c9526e",
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
```

- [ ] **Step 2: 리그레션 경고 포맷 섹션 추가**

```markdown
---

## 6. Regression Warning Format

Displayed in terminal immediately before the Summary section when any metric worsens by ≥ 20% vs the previous run.

### Template

```
⚠️  Regression detected vs last run (2026-03-14)
──────────────────────────────────────────────────
  Metric     Previous   Current   Change
  Tokens     41,200     55,140    +34%   ← regressed
  Backtrack  0.05       0.20      +0.15  ← regressed
  Time       158.4s     202.3s    +28%   (within threshold)
──────────────────────────────────────────────────
```

### Threshold

Default: ≥ 20% increase in tokens or time, or ≥ +0.10 absolute increase in backtrack rate.

### When not shown

- First run (no previous run to compare)
- Re-run but previous run used different task set (task set was updated since last run)
```

- [ ] **Step 3: 트렌드 뷰 포맷 섹션 추가**

```markdown
---

## 7. Trend View Format

Displayed after the Summary section when `history.jsonl` contains 3 or more runs with the same fixed task set.

### Template

```
── Trend (last 5 runs) ──────────────────────────────────────
  Date        Commit    Tokens    Time      Backtrack
  2026-03-10  4a3b2c1   55,140    202.3s    0.07
  2026-03-11  8d4e5f2   48,320    178.1s    0.05
  2026-03-12  1f6g7h3   45,200    165.4s    0.04
  2026-03-14  9c9526e   41,200    158.4s    0.03
  2026-03-15  a1b2c3d   55,140    202.3s    0.07   ← today

  Tokens:    ↓ 0% net (regressed today)
  Time:      ↓ 0% net (regressed today)
  Backtrack: ↓ 57% over 5 runs
──────────────────────────────────────────────────────────────
```

### Rules

- Show up to last 10 runs (oldest first)
- "Today" marker on the current run row
- Net change line: compares first visible run to current run
- Only shown for re-runs (fixed task set) — not for fresh runs with new task sets
```

- [ ] **Step 4: 히스토리 비교 포맷 섹션 추가**

```markdown
---

## 8. Historical Comparison Format

Used when the user runs "vs history" mode (compare current run against a specific past run).
Layout mirrors A/B comparison format, but labels are dates/commits instead of condition names.

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
- `last`: most recent run in history.jsonl
- `baseline`: a run explicitly tagged as baseline (stored in `docs/benchmarks/baseline.json`)
- `best`: run with lowest total_tokens in history.jsonl
- A specific date: matched against `run_id` prefix
```

- [ ] **Step 5: 커밋**

```bash
git add skills/agent-benchmark/references/report-format.md
git commit -m "docs(agent-benchmark): add history, regression, trend, and historical comparison report formats"
```

---

## Chunk 3: SKILL.md 전면 개정

### Task 3: SKILL.md 업데이트 — 실행 모드, 태스크 고정, 히스토리 자동저장, 피드백 루프

**Files:**
- Modify: `skills/agent-benchmark/SKILL.md`

이 태스크는 SKILL.md의 여러 섹션을 수정한다. 각 스텝이 독립적인 섹션 변경이다.

---

- [ ] **Step 1: HARD-GATE 업데이트**

기존 HARD-GATE를 아래로 교체:

```markdown
<HARD-GATE>

- Never report scores without actually running benchmark tasks
- Always use hooks (PreToolUse/PostToolUse) for log capture — never rely on agent self-reporting
- Always run benchmark agents in worktree isolation — use `isolation: "worktree"` on every Agent dispatch (basic mode) or pre-configured worktrees (A/B mode). Never let agents modify the actual repo.
- Always clean up hooks and worktrees after benchmark completion
- Always auto-save run results to `docs/benchmarks/history.jsonl` — this is mandatory, not optional
- In re-run mode, always validate task staleness before executing — never silently skip stale tasks
- In fresh-run mode, always present generated tasks for user review before fixing them

</HARD-GATE>
```

변경 이유:
- "Always generate tasks dynamically" 제거 — re-run 모드는 고정 태스크를 사용
- "Never skip repo analysis" 제거 — re-run 모드는 repo 분석 불필요
- "Always auto-save to history.jsonl" 추가
- 태스크 검토/고정 규칙 추가

---

- [ ] **Step 2: Execution Flow Overview 업데이트**

기존 3단계 플로우 다이어그램을 5단계로 교체:

```markdown
## Execution Flow Overview

```
[Phase 0] Mode Selection → fresh-run | re-run | historical-comparison

Fresh-run path:
Phase 1: Repo Analysis          Phase 1.5: Task Review        Phase 2: Execution          Phase 3: Report
& Task Generation               & Fixation                    & Hook Capture              & History
─────────────────────           ──────────────────────        ─────────────────────       ─────────────────
[1] git log analysis            [4] Show tasks + metadata     [6] Setup hooks             [9]  Parse logs
[2] Extract code elements       [5] User reviews/approves     [7] Run agents (parallel)   [10] Calculate metrics
[3] Generate tasks                  → save tasks.json         [8] Capture tool calls      [11] Generate report
                                                                                          [12] Auto-save history
                                                                                          [13] Regression check
                                                                                          [14] Trend view (if 3+)
                                                                                          [15] Feedback suggestions
                                                                                          [16] Cleanup

Re-run path:
[1] Load tasks.json → [2] Staleness check → [3] User confirms → [6–16] same as above

Historical-comparison path:
[1] Load tasks.json → [2] Staleness check → [3] Select baseline → [6–16] A/B comparison vs history entry
```
```

---

- [ ] **Step 3: Phase 0 업데이트 — 실행 모드 선택**

기존 Phase 0를 교체:

```markdown
## Phase 0: Mode Selection

Before any analysis, determine which run mode to use.

### Check for existing task set

```bash
# Check if tasks.json exists
ls docs/benchmarks/tasks.json 2>/dev/null
```

**If tasks.json does NOT exist** → Fresh-run mode (go to Phase 1)

**If tasks.json EXISTS** → Use AskUserQuestion:

```
AskUserQuestion (adapt to user's language): "docs/benchmarks/tasks.json found (N tasks, created YYYY-MM-DD).

Choose a run mode:
1. Re-run — use fixed task set (recommended for tracking improvement)
2. Historical comparison — run vs a previous result (last / baseline / best / specific date)
3. Fresh run — generate new tasks (discards existing task set)
4. A/B comparison — compare two environment configurations

Any changes to task count or category focus?"
```

**If mode is re-run or historical-comparison** → skip Phase 1, go to Phase 1.5 (Staleness Check)
**If mode is fresh-run** → proceed to Phase 1
**If mode is A/B** → proceed to Phase 1 (or Phase 1.5 if tasks.json exists and user wants same tasks across both conditions)
```

---

- [ ] **Step 4: Phase 1 업데이트 — git history 기반 태스크 소스 추가**

Phase 1의 [1] Repo Structure Scan 섹션 뒤에 새 단계 추가:

```markdown
### [1b] Git History Analysis (Coverage Signal)

Use git log to identify high-value areas for task coverage. Reference `references/task-lifecycle.md` §2 for full strategy.

```bash
# High-frequency files (last 90 days) — Discovery/Comprehension targets
git log --since="90 days ago" --name-only --format="" | grep -v "^$" | sort | uniq -c | sort -rn | head -20

# Recent fix commits — Diagnosis task candidates
git log --oneline --since="90 days ago" | grep -E " fix(\(|:)"

# Recent feat commits — Modification task candidates
git log --oneline --since="90 days ago" | grep -E " feat(\(|:)"
```

Map findings to task categories:
- Top-frequency files → preferred `expected_files` for Discovery tasks
- `fix:` commit areas → Diagnosis task targets
- `feat:` commit areas → Modification task targets
- Files touched by 3+ contributors → harder Comprehension tasks

For repos with < 20 commits or < 4 weeks history, fall back to canonical template binding (existing Phase 1 [3] logic).
```

---

- [ ] **Step 5: Phase 1.5 신규 추가 — 태스크 검토 및 고정**

Phase 1 다음, Phase 2 전에 새 섹션 삽입:

```markdown
## Phase 1.5: Task Review & Fixation

### [4] Staleness Check (re-run and historical-comparison modes only)

Load `docs/benchmarks/tasks.json` and validate each task:

```bash
# Check expected_files still exist
for file in <expected_files>: test -f "$file"

# Check referenced identifiers still appear in those files (Grep)
grep -l "<referenced_function_or_class>" <expected_files>
```

Mark tasks as STALE if:
- Any expected_file no longer exists
- Referenced identifier not found in expected files

Present stale tasks to user and ask how to handle (skip / regenerate / run anyway). Reference `references/task-lifecycle.md` §4.

### [5] Task Review (fresh-run mode only)

After Phase 1 task generation, present tasks with quality metadata for user review. Reference `references/task-lifecycle.md` §3 for presentation format.

```
AskUserQuestion (adapt to user's language): "[Phase 1 complete] N tasks generated:

  #   Category        R   Modules  Source         Task
  1   Discovery       3   1        git-history    ...
  2   Comprehension   5   2        git-history    ...
  3   Diagnosis       4   2        template       ...
  4   Modification    6   3        fixture        ...

Approve this task set to save as docs/benchmarks/tasks.json?
Or specify: remove #N / regenerate #N / add custom task"
```

After user approval, save tasks to `docs/benchmarks/tasks.json` (schema in `references/task-lifecycle.md` §3).
```

---

- [ ] **Step 6: Phase 3 업데이트 — 히스토리 자동저장, 리그레션, 트렌드, 피드백**

Phase 3의 "[10] Terminal Output" 이후, "Cleanup" 전에 새 단계들 삽입:

```markdown
### [11] Auto-Save to History

After calculating metrics, always append the run result to `docs/benchmarks/history.jsonl`.
This is mandatory — do not skip even if the user does not request export.
Format defined in `references/report-format.md` §5.

```bash
# Append run result as one JSON line
echo '<run_json>' >> docs/benchmarks/history.jsonl
```

Create `docs/benchmarks/` directory if it does not exist.

### [12] Regression Detection

Load the previous run from `history.jsonl` (second-to-last entry with same task set).
Compare current summary metrics against previous run.

Show regression warning (format in `references/report-format.md` §6) if:
- Total tokens increased ≥ 20%
- Total time increased ≥ 20%
- Avg backtrack increased ≥ +0.10

Display warning immediately before the Summary section in terminal output.

Skip regression check if:
- This is the first run (no previous entry)
- Previous run used a different task set version

### [13] Trend View

If `history.jsonl` contains 3+ runs with the same task set, display trend section after Summary.
Format defined in `references/report-format.md` §7.

### [14] Feedback Loop Suggestions

If `history.jsonl` contains 3+ runs, analyze patterns and surface task refinement suggestions.
Reference `references/task-lifecycle.md` §5 for trigger conditions and suggestion types.

```
AskUserQuestion (adapt to user's language): "[Optional] Based on N runs:
  - Diagnosis tasks: avg backtrack 0.38 (consistently highest)
  - task-003: failed 2/3 runs

Would you like to refine the task set? (regenerate task-003 / add harder Diagnosis task / keep as-is)"
```

Only ask if there are actionable suggestions. Skip if all tasks are healthy.

### [15] Export (optional)

```
AskUserQuestion (adapt to user's language): "Would you like to export the report as Markdown? (history.jsonl was already saved automatically)"
```

Note: JSON is already saved to history.jsonl. Only ask about Markdown export.
```

---

- [ ] **Step 7: 커밋**

```bash
git add skills/agent-benchmark/SKILL.md
git commit -m "feat(agent-benchmark): add continuous measurement — task fixation, run history, regression detection, trend view, feedback loop"
```

---

## Chunk 4: 버전 범프 및 메타데이터 업데이트

### Task 4: 버전 범프

**Files:**
- Modify: `skills/agent-benchmark/SKILL.md` (description 업데이트)
- Modify: `docs/conventions.md` 확인 후 버전 파일 업데이트

---

- [ ] **Step 1: conventions.md 읽기**

`docs/conventions.md`의 버전 범프 규칙 확인.

- [ ] **Step 2: SKILL.md description 업데이트**

frontmatter의 description을 확장하여 연속 측정 사용성 반영:

```markdown
---
name: agent-benchmark
description: Use when measuring agent task performance in a codebase, evaluating environment setup quality for AI agents, benchmarking agent resource efficiency, running A/B comparisons of documentation/context configurations, or tracking performance improvement over time with continuous measurement
---
```

- [ ] **Step 3: 버전 범프 실행**

conventions.md의 지침에 따라 버전 파일 업데이트.

- [ ] **Step 4: 최종 커밋**

```bash
git add skills/agent-benchmark/SKILL.md <version_file>
git commit -m "chore: bump version — agent-benchmark continuous measurement feature"
```
