# Agent Benchmark v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace template-based task generation with canonical fixtures + git history parallel tracks for improved task quality and cross-repo consistency.

**Architecture:** Two parallel tracks (canonical fixtures + git history) feed into the existing Phase 2 parallel dispatch pipeline. Canonical fixtures use YAML definitions with select/verify rules. Git history tasks derive from actual fix/feat commits. Existing Phase 2 (hooks + dispatch) and Phase 3 (metrics + report) remain largely unchanged.

**Tech Stack:** YAML fixture definitions, Claude Code hooks (JSONL), git worktrees, shell commands for mutation/test validation.

**Spec:** `docs/specs/2026-03-15-agent-benchmark-v2-design.md`

---

## Chunk 1: Reference Documents & Fixtures

### Task 1: Create mutation engine reference

**Files:**
- Create: `skills/agent-benchmark/references/mutation.md`

- [ ] **Step 1: Write mutation.md**

```markdown
# Mutation Engine Reference

This document defines mutation types, execution rules, and validation procedures for mutation-based benchmark tasks (Diagnosis, Modification categories).

---

## 1. Mutation Types

| Action | Description | Target Condition | Mutation Operation |
|--------|-------------|------------------|--------------------|
| `delete_validation_branch` | Delete one validation if-statement inside a function | Function with tests, 2+ params | Remove the if-block that validates a parameter (grep for patterns like `if not`, `if.*is None`, `if.*===`, `if.*<=`) |
| `remove_error_handler` | Remove error handling from a try-catch/except block | Function with error handling pattern | Strip the catch/except block, leaving only the try body |
| `swap_condition` | Invert a comparison operator | Function with tests, contains conditional | Replace `>` with `<`, `>=` with `<=`, `==` with `!=`, or vice versa |
| `delete_import` | Delete one used import statement | File with module dependencies | Remove one import line whose exported symbol is used in the file body |

---

## 2. Target Selection

The benchmark runner uses the fixture's `select` rules to find mutation targets:

1. **Glob/Grep scan**: Find candidate files matching patterns
2. **Test existence check**: Verify the candidate has associated test files (co-located `*.test.*`, `*.spec.*`, or in `__tests__/`, `tests/` directories)
3. **Test command detection**: Identify the test runner and specific test command for the target
   - Check for: `package.json` scripts (`test`, `jest`, `vitest`), `pytest.ini`/`pyproject.toml`, `Makefile` test targets
   - Build specific command: e.g., `npm test -- --testPathPattern=auth`, `pytest tests/test_auth.py`
4. **Parameter/pattern filter**: Apply `min_params`, `has_tests`, and other select filters

If no candidate passes all filters, the fixture is skipped.

---

## 3. Execution Procedure

### Prerequisites

- Benchmark runner creates a dedicated worktree: `git worktree add /tmp/bench-mutation-{id} HEAD`
- All mutation operations happen inside this worktree

### Steps

1. **Select target** in worktree using fixture's `select` rules
2. **Baseline test**: Run `{test_command}` in worktree → must pass (exit 0)
   - Timeout: 60 seconds. If exceeded, skip this fixture.
3. **Apply mutation**: Execute the mutation action on the target code
4. **Verify mutation**: Run `{test_command}` again → must fail (exit non-0)
   - If test still passes after mutation, the mutation was ineffective → skip
5. **Dispatch agent**: Send task to subagent with worktree path as working directory
   - Do NOT use `isolation: "worktree"` — the worktree is pre-configured
6. **Verify fix**: After agent completes, run `{test_command}` → pass = success
7. **Cleanup**: `git worktree remove /tmp/bench-mutation-{id}`

### Failure Modes

| Failure | Action |
|---------|--------|
| No select target found | Skip fixture, mark N/A |
| Baseline test fails | Skip fixture (tests already broken) |
| Baseline test times out (>60s) | Skip fixture (test suite too slow) |
| Mutation doesn't break test | Skip fixture (ineffective mutation) |
| Agent fails to fix | Mark task as failed, include in report |

---

## 4. Worktree Lifecycle

Mutation tasks use manually created worktrees (not `isolation: "worktree"`):

```
Runner creates worktree → applies mutation → dispatches agent into it → agent works → runner verifies → runner removes worktree
```

This differs from Discovery/Comprehension tasks which use automatic `isolation: "worktree"` on Agent dispatch.
```

- [ ] **Step 2: Commit**

```bash
git add skills/agent-benchmark/references/mutation.md
git commit -m "docs: add mutation engine reference for agent-benchmark v2"
```

---

### Task 2: Create git history reference

**Files:**
- Create: `skills/agent-benchmark/references/git-history.md`

- [ ] **Step 1: Write git-history.md**

```markdown
# Git History Task Generation Reference

This document defines how benchmark tasks are generated from a repository's git history.

---

## 1. Commit Scanning

### Scan Range

```bash
git log --oneline -50 --no-merges
```

Exclude merge commits. Scan the 50 most recent commits.

### Commit Type Detection

**Step 1: Check for conventional commits**

```bash
git log --oneline -50 --no-merges | grep -cE '^[a-f0-9]+ (fix|feat)(\(.+\))?:'
```

If count > 0, use prefix-based filtering. Otherwise, fall back to diff-size filtering.

**Step 2a: Prefix-based filter (conventional commits)**

- `fix:` or `fix(scope):` → Regression task candidate
- `feat:` or `feat(scope):` → Modification task candidate
- All other prefixes → skip

**Step 2b: Diff-size filter (non-conventional repos)**

For each non-merge commit:
```bash
git diff --stat {commit}^..{commit}
git diff {commit}^..{commit} | wc -l
```

- Changed files: 1-5
- Diff lines: 50-300
- Classify by heuristic: if diff adds new files → Modification candidate; if diff only modifies existing files → Regression candidate

### Additional Filters

For all candidates:
1. **Test association**: Check if changed files have corresponding test files. Prioritize commits that include test file changes.
2. **Diff size bounds**: Changed files 1-5, diff lines 50-300. Outside range → skip.

---

## 2. Task Conversion Rules

### fix: → Regression Task

1. Create worktree at commit's parent: `git worktree add /tmp/bench-regression-{hash} {commit}^`
2. Identify relevant test command from the commit's changed test files
3. Run test in worktree → must fail (confirms the bug exists at parent)
   - If test passes at parent, the fix commit didn't address a test-visible bug → skip
4. Task prompt: `"This test is failing: {test_command}. Find the cause and fix it."`
5. Verification: `test_pass` — run `{test_command}`, exit 0 = success

### feat: → Modification Task

1. Create worktree at commit's parent: `git worktree add /tmp/bench-feat-{hash} {commit}^`
2. Derive task description (see §3 below)
3. Task prompt: `"{feature_description}"`
4. Verification:
   - Primary: `test_pass` if the feat commit included test files
   - Fallback: `diff_files` — compare agent's modified files against commit's changed files (70% match threshold)

---

## 3. Task Description Derivation (feat commits)

**Anti-leak rule:** Task descriptions must NEVER include diff content (specific file paths, code patterns, function names from the diff). Describe WHAT to implement (user-facing behavior), not WHERE or HOW.

**Derivation order:**

1. **Commit message body**: Use if it describes the feature behavior (not just "add X to Y.ts")
2. **Linked issue/PR**: If commit references `#123`, attempt `gh issue view 123 --json title,body` or `gh pr view 123 --json title,body`. Best-effort — skip on failure.
3. **Insufficient description**: If neither source provides a behavioral description → exclude this commit from candidates

**Examples of good vs bad task descriptions:**

| Source | Bad (leaks answer) | Good (behavioral) |
|--------|-------------------|-------------------|
| `feat: add phone field to User model` | "Add phone field to User model in src/models/user.ts" | "Add phone number support to user profiles" |
| `feat(auth): add rate limiting` | "Add rate limiter middleware in src/middleware/rateLimit.ts" | "Add rate limiting to prevent brute force login attempts" |

---

## 4. Selection Priority

When multiple eligible commits exist:

1. Commits with test files changed → higher priority
2. Include at least 1 Regression + 1 Modification if both types available
3. Prefer commits that touch different modules (maximize diversity)
4. Maximum 4 git history tasks total (0-2 Regression + 0-2 Modification)

---

## 5. Zero Eligible Commits

If no commits pass all filters:
- Run canonical fixtures only
- Report: `"Git history tasks: 0 (no eligible commits found)"`

This is expected for new repos, repos without tests, or repos without conventional commits and small diffs.
```

- [ ] **Step 2: Commit**

```bash
git add skills/agent-benchmark/references/git-history.md
git commit -m "docs: add git history task generation reference for agent-benchmark v2"
```

---

### Task 3: Create canonical fixture files

**Files:**
- Create: `skills/agent-benchmark/fixtures/discovery.yaml`
- Create: `skills/agent-benchmark/fixtures/comprehension.yaml`
- Create: `skills/agent-benchmark/fixtures/diagnosis.yaml`
- Create: `skills/agent-benchmark/fixtures/modification.yaml`

Each category file contains 2 fixture variants. The benchmark runner tries the first fixture; if its `select` fails (no suitable target), it tries the second. Only one fixture per category is used — this provides fallback coverage without inflating task count.

- [ ] **Step 1: Write discovery.yaml**

```yaml
# Discovery category fixtures
# Verification: import_graph (static analysis of import/require relationships)
# Always runs — no test dependency

- id: canonical-discovery-01
  name: "Trace feature entry to core logic"
  category: discovery
  select:
    entry_point:
      glob: ["main.*", "index.*", "app.*", "server.*", "src/main.*", "src/index.*", "src/app.*"]
      pick: "shallowest"
    target_module:
      strategy: "most_files"
  task: "Find the core logic of {target_module} starting from {entry_point}. List every file in the call chain."
  verify:
    method: "import_graph"
    expect: "files in call chain from {entry_point} to {target_module}"
    match: "precision_recall"

- id: canonical-discovery-02
  name: "Enumerate public API of a module"
  category: discovery
  select:
    target_module:
      strategy: "most_outgoing_deps"
  task: "List all public API exports of the {target_module} module. For each export, identify which file defines it."
  verify:
    method: "import_graph"
    expect: "exported symbols and their defining files in {target_module}"
    match: "precision_recall"
```

- [ ] **Step 2: Write comprehension.yaml**

```yaml
# Comprehension category fixtures
# Verification: checklist (required files + required concepts)
# Always runs — no test dependency

- id: canonical-comprehension-01
  name: "Explain dependency relationship between modules"
  category: comprehension
  select:
    module_a:
      strategy: "most_outgoing_deps"
    module_b:
      strategy: "dependency_of"
      ref: "module_a"
  task: "Explain the dependency relationship between {module_a} and {module_b}. List the files that form the boundary between them and describe what each boundary file does."
  verify:
    method: "checklist"
    expect:
      required_files:
        source: "import_graph"
      required_concepts:
        - "which module depends on which"
        - "boundary files that connect them"
    match: "all_required"

- id: canonical-comprehension-02
  name: "Trace data flow from entry to storage"
  category: comprehension
  select:
    entry_point:
      glob: ["main.*", "index.*", "app.*", "server.*", "src/main.*", "src/index.*"]
      pick: "shallowest"
    storage_module:
      grep: "(database|db|store|repository|dao|model)"
      strategy: "most_files"
  task: "Trace how data flows from {entry_point} to {storage_module}. List every intermediate file and explain the transformation at each step."
  verify:
    method: "checklist"
    expect:
      required_files:
        source: "import_graph"
      required_concepts:
        - "data transformation steps"
        - "intermediate handlers or services"
    match: "all_required"
```

- [ ] **Step 3: Write diagnosis.yaml**

```yaml
# Diagnosis category fixtures
# Verification: test_pass (mutation-based — requires test coverage)
# Runs only when suitable mutation target exists

- id: canonical-diagnosis-01
  name: "Find and fix injected validation bug"
  category: diagnosis
  select:
    target_function:
      has_tests: true
      min_params: 2
      pick: "random"
  mutate:
    action: "delete_validation_branch"
    description: "Remove one parameter validation check"
  task: "This test is failing: {test_command}. Find the cause and fix it."
  verify:
    method: "test_pass"
    command: "{test_command}"

- id: canonical-diagnosis-02
  name: "Find and fix injected error handling bug"
  category: diagnosis
  select:
    target_function:
      has_tests: true
      grep: "(try|catch|except|throw|raise)"
      pick: "random"
  mutate:
    action: "remove_error_handler"
    description: "Remove error handling from a try-catch/except block"
  task: "This test is failing: {test_command}. Find the cause and fix it."
  verify:
    method: "test_pass"
    command: "{test_command}"
```

- [ ] **Step 4: Write modification.yaml**

Note: Canonical Modification fixtures use mutation but focus on **targeted code changes** (restoring structure, fixing imports) rather than **root cause investigation** (Diagnosis). The tasks frame the problem more explicitly — the agent knows *what* is broken, just not *how* to fix it. True "implement a feature" Modification tasks come from git history (feat commits).

```yaml
# Modification category fixtures
# Verification: test_pass (mutation-based — requires test coverage)
# Runs only when suitable mutation target exists
#
# Distinction from Diagnosis: Modification tasks tell the agent WHAT is wrong
# (broken import, wrong condition). Diagnosis tasks only say "test is failing."

- id: canonical-modification-01
  name: "Restore broken import"
  category: modification
  select:
    target_file:
      grep: "(import|require|from)"
      has_tests: true
      pick: "random"
  mutate:
    action: "delete_import"
    description: "Delete one used import statement"
  task: "A required import was accidentally removed from {target_file} and tests are failing: {test_command}. Identify the missing import and restore it."
  verify:
    method: "test_pass"
    command: "{test_command}"

- id: canonical-modification-02
  name: "Fix inverted condition"
  category: modification
  select:
    target_function:
      has_tests: true
      grep: "(>|<|>=|<=|==|!=)"
      pick: "random"
  mutate:
    action: "swap_condition"
    description: "Invert a comparison operator"
  task: "A comparison operator in {target_function} was accidentally inverted and tests are failing: {test_command}. Find the inverted condition and correct it."
  verify:
    method: "test_pass"
    command: "{test_command}"
```

- [ ] **Step 5: Commit**

```bash
git add skills/agent-benchmark/fixtures/
git commit -m "feat: add canonical fixture definitions for agent-benchmark v2"
```

---

## Chunk 2: Update Existing Files

### Task 4: Update SKILL.md Phase 1

**Files:**
- Modify: `skills/agent-benchmark/SKILL.md`

- [ ] **Step 1: Update HARD-GATE**

Replace the hard gate line:
```
- Always generate tasks dynamically from the target repo — never use hardcoded tasks
```
With:
```
- Always generate tasks from canonical fixtures (bound to target repo) and/or git history — never use static hardcoded tasks with fixed answers
```

- [ ] **Step 2: Replace Phase 1 content**

Replace the entire "Phase 1: Repo Analysis & Task Generation" section (from `## Phase 1:` through the end of `[3] Dynamic Task Generation`) with the new two-track architecture:

```markdown
## Phase 1: Task Generation (Two-Track)

Task generation runs two parallel tracks. Both tracks bind to the target repository — no tasks run without repo context.

### Track A: Canonical Fixtures (always runs)

Read fixture files from `fixtures/*.yaml`. For each fixture:

1. **Select**: Use `select` rules to find code elements in the target repo
   - `glob`: Use Glob tool to find matching files
   - `grep`: Use Grep tool to find matching code patterns
   - `has_tests`: Check for co-located test files (`*.test.*`, `*.spec.*`, `__tests__/`, `tests/`)
   - `strategy`/`pick`: Apply selection logic to narrow candidates
2. **Bind**: Replace `{variable}` placeholders in `task` and `verify` with found elements
3. **Mutation** (if `mutate` defined): Follow mutation procedure in `references/mutation.md`
4. **Skip**: If `select` finds no suitable target, skip the fixture

**Fixture files** (read `fixtures/` directory):
- `discovery.yaml` — import graph verification, always runs
- `comprehension.yaml` — checklist verification, always runs
- `diagnosis.yaml` — mutation + test_pass verification, requires test coverage
- `modification.yaml` — mutation + test_pass verification, requires test coverage

Output: 2-4 tasks (Discovery + Comprehension always; Diagnosis + Modification when mutation targets exist)

### Track B: Git History Analysis (runs when eligible commits exist)

Follow the procedure in `references/git-history.md`:

1. **Scan**: `git log --oneline -50 --no-merges`
2. **Filter**: Identify `fix:`/`feat:` commits (or diff-size filter for non-conventional repos)
3. **Validate**: Check diff size (1-5 files, 50-300 lines), test association
4. **Convert**: fix → Regression task, feat → Modification task
5. **Select**: Up to 4 tasks, balanced across types, diverse modules

Output: 0-4 tasks

### Combined Task List

Merge Track A and Track B results. Total: 2-8 tasks across 5 categories:
- **Discovery** (canonical, always)
- **Comprehension** (canonical, always)
- **Diagnosis** (canonical mutation, when target exists)
- **Modification** (canonical mutation + git history feat, when available)
- **Regression** (git history fix only, when eligible commits exist)
```

- [ ] **Step 3: Update Execution Flow Overview diagram**

Replace the Phase 1 labels in the ASCII diagram (lines 26-33):

```
Phase 1: Task Generation         Phase 2: Agent Execution         Phase 3: Report
(Two-Track)                      & Hook Capture                   & Cleanup
─────────────────────           ─────────────────────            ─────────────────
[1] Bind canonical fixtures     [5] Setup hooks (JSONL log)      [8] Parse logs (by session_id)
[2] Run mutation validation     [6] Run agents in parallel       [9] Calculate metrics
[3] Scan git history            [7] Capture tool calls           [10] Generate report
[4] Merge task list                                              [11] Cleanup
```

- [ ] **Step 4: Update Phase 0 task count range**

In the Phase 0 AskUserQuestion prompt, change `"Default: 1 per category, 4–8 total"` to `"Default: 2–8 total (depends on repo's test coverage and git history)"`.

- [ ] **Step 5: Update Red Flags table**

Replace:
```
| "Repo is too small to benchmark" | Small repos can still vary in environment setup quality |
```
With:
```
| "Repo is too small to benchmark" | Even repos with 2 tasks (Discovery + Comprehension) produce useful environment measurements |
```

Replace:
```
| "One task is enough" | Minimum 1 per category, 4 total required |
```
With:
```
| "One task is enough" | Minimum 2 tasks required (Discovery + Comprehension). More categories activate with test coverage and git history |
```

- [ ] **Step 7: Update Phase 2 dispatch note**

In the "Agent Execution — Basic Mode" section, add after the parallel dispatch instructions:

```markdown
**Worktree modes by task type:**
- Discovery, Comprehension: Use `isolation: "worktree"` (auto-created)
- Diagnosis, Modification (canonical): Use pre-configured mutation worktree path (see `references/mutation.md`)
- Regression, Modification (git history): Use pre-configured commit-parent worktree path (see `references/git-history.md`)
```

- [ ] **Step 8: Commit**

```bash
git add skills/agent-benchmark/SKILL.md
git commit -m "feat: update SKILL.md Phase 1 for two-track task generation"
```

---

### Task 5: Update report-format.md

**Files:**
- Modify: `skills/agent-benchmark/references/report-format.md`

- [ ] **Step 1: Add source column to single run template**

Update the terminal output Task Results table (line 18-22) to include a Source column:

```
── Task Results ───────────────────────────────────
  #   Category        Source       Status   Tokens    Time    Backtrack
  1   Discovery       canonical    ✓        12,340    42.0s   0.08
  2   Comprehension   canonical    ✓        28,100   107.3s   0.15
  3   Diagnosis       canonical    ✓         8,200    26.1s   0.00
  4   Modification    canonical    ✓         6,500    26.9s   0.03
  5   Regression      git-history  ✓         4,100    18.2s   0.05
  6   Modification    git-history  ✓         7,800    31.4s   0.11
```

- [ ] **Step 2: Update JSON schema**

In the single-run JSON schema, update the task object:
- Replace `"category": "Discovery|Comprehension|Modification|Diagnosis"` with `"category": "Discovery|Comprehension|Diagnosis|Modification|Regression"`
- Replace `"difficulty": "easy|medium|hard"` with `"source": "canonical|git-history"`

- [ ] **Step 3: Update A/B comparison template**

Add Source column to A/B comparison task tables, same as single run.

- [ ] **Step 4: Update field descriptions table**

Add:
```
| `tasks[].source` | string | `"canonical"` or `"git-history"` |
| `tasks[].category` | string | `"Discovery"`, `"Comprehension"`, `"Diagnosis"`, `"Modification"`, or `"Regression"` |
```

Remove the `difficulty` field row.

- [ ] **Step 5: Update Markdown export format**

In Section 4 "Markdown Export Format", update the single run table to include Source column:

```markdown
| # | Category | Source | Status | Tokens | Time | Backtrack |
|---|----------|--------|--------|--------|------|-----------|
| 1 | Discovery | canonical | ✓ | 12,340 | 42.0s | 0.08 |
| 2 | Comprehension | canonical | ✓ | 28,100 | 107.3s | 0.15 |
| 3 | Diagnosis | canonical | ✓ | 8,200 | 26.1s | 0.00 |
| 4 | Modification | canonical | ✓ | 6,500 | 26.9s | 0.03 |
| 5 | Regression | git-history | ✓ | 4,100 | 18.2s | 0.05 |
```

- [ ] **Step 6: Add N/A handling note**

After the formatting rules section, add:

```markdown
### N/A Categories

When a category has no suitable target (e.g., no mutation target for Diagnosis, no eligible git commits for Regression), it is omitted from the task table. A note appears after the table:

```
  Note: Diagnosis (N/A — no suitable mutation target), Regression (N/A — no eligible commits)
```
```

- [ ] **Step 7: Commit**

```bash
git add skills/agent-benchmark/references/report-format.md
git commit -m "feat: add source column and Regression category to report format"
```

---

### Task 6: Delete task-templates.md

**Files:**
- Delete: `skills/agent-benchmark/references/task-templates.md`

- [ ] **Step 1: Remove the file**

```bash
git rm skills/agent-benchmark/references/task-templates.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove task-templates.md (superseded by fixture YAML files)"
```

---

## Chunk 3: Metadata & Finalization

### Task 7: Update CLAUDE.md references

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace stale references and add new ones**

In the `## References` section of CLAUDE.md, make these changes:

Remove these lines:
```
- When working on agent-benchmark task generation → read `skills/agent-benchmark/references/task-templates.md`
```

Replace with:
```
- When working on agent-benchmark task generation or fixtures → read `docs/specs/2026-03-15-agent-benchmark-v2-design.md`
- When working on agent-benchmark mutation engine → read `skills/agent-benchmark/references/mutation.md`
- When working on agent-benchmark git history tasks → read `skills/agent-benchmark/references/git-history.md`
```

Keep the existing v1 design spec reference (`docs/specs/2026-03-14-agent-benchmark-design.md`) as historical context — it documents the theoretical basis (Lostness metric, DevEx framework) that v2 builds on.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md references for agent-benchmark v2"
```

---

### Task 8: Bump plugin version

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `.cursor-plugin/plugin.json`

Per `docs/conventions.md`: existing skill modification = patch bump.

- [ ] **Step 1: Bump version in all 3 files**

Change `0.2.7` to `0.2.8` in:
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.cursor-plugin/plugin.json`

- [ ] **Step 2: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json .cursor-plugin/plugin.json
git commit -m "chore: bump version to 0.2.8"
```

---

### Task 9: Run garden-docs verification

- [ ] **Step 1: Run garden-docs skill**

Invoke the `just-useful-plugin:garden-docs` skill to verify documentation consistency across the updated files.

- [ ] **Step 2: Fix any issues found**

Address any inconsistencies flagged by garden-docs.

- [ ] **Step 3: Commit fixes if any**

```bash
git add -A
git commit -m "docs: fix consistency issues found by garden-docs"
```
