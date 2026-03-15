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

# Files touched by multiple contributors (group by file, count distinct authors)
git log --format="" --name-only | sort | uniq | xargs -I{} sh -c 'echo "$(git log --format="%ae" -- {} | sort -u | wc -l) {}"' | sort -rn | head -20

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

Only after user approval are tasks saved to `docs/benchmarks/tasks.json`. On initial creation, set both `created_at` and `last_updated` to the current timestamp.

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
      "expected_identifiers": ["createUser", "UserModel"],
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
  2. If expected_identifiers is set, Grep each identifier in its expected_files
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
