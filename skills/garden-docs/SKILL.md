---
name: garden-docs
description: Use when asked to verify docs match code, after structural changes needing doc updates, periodic doc maintenance, detecting stale docs, doc consistency checks, doc gardening, knowledge base structure design, CLAUDE.md authoring/refactoring
---

# Document Gardening

Process for keeping docs in sync with code and maintaining the knowledge base as a **system of record**.

<HARD-GATE>

- Never report "no issues" without actually inspecting docs
- Always perform structural verification (file existence, reference consistency) mechanically
- Always verify fixes before committing
- Never rationalize "unnecessary at this scale" — entropy accumulates regardless of scale
- Never speculatively add rules to knowledge base docs — add only when an agent makes a mistake
- Never put context directly in CLAUDE.md. No exceptions. "It's short", "it's a behavior rule", "this repo is special" are all rationalizations.
- Never add LLM-generated architecture overviews or project descriptions to docs/ — they degrade agent performance (ETH Zurich finding: -3% success rate). Add docs only when an agent makes a mistake or a human writes the content.
- Treat every token in CLAUDE.md as currency — each token competes for attention in the model's context window. Irrelevant tokens actively introduce noise into reasoning.

</HARD-GATE>

---

## Part 1: Knowledge Base Design Principles

### CLAUDE.md is a Table of Contents — Not a Context Container

CLAUDE.md (or AGENTS.md) should contain **only a table of contents**. All context for agents to read must live in the `docs/` knowledge base.

| Location | Role |
|----------|------|
| **CLAUDE.md** | ~100-line table of contents. Contains only **conditional triggers** pointing to docs/ files. Target ≤ 500 tokens (`wc -w` ≤ ~375 words) |
| **docs/** | All context. Architecture, conventions, design docs, execution plans, etc. |

**"It's short enough to keep in CLAUDE.md" is a rationalization.** Whether it's a 1-line project overview, 5-line convention, or behavior rule — all context belongs in docs/. CLAUDE.md should only contain triggers pointing to the relevant docs/ file.

### Token Budget

Every token loaded into context competes for the model's attention. Bloated context makes agents **dumber**, not smarter.

| Target | Budget |
|--------|--------|
| **CLAUDE.md** | ≤ 500 tokens (~375 words). Measure with `wc -w` |
| **docs/ file** | ≤ 200 lines each. Split if larger |
| **Enforceable rules** | Do NOT document in CLAUDE.md or docs/. Delegate to linter/formatter. One trigger suffices: `Run \`lint:fix\` after changes` |

Rules that linters, formatters, or type checkers can enforce (indentation, quotes, line length, import ordering) waste tokens when written in docs. The tool config **is** the documentation.

### Use Conditional Triggers

Each CLAUDE.md entry must specify **when to read it**. Simple pointers (path + description) won't be read by agents.

```markdown
# ❌ Simple pointer — agents won't read this
## References
- [Architecture Details](docs/architecture.md): Directory structure and layer relationships
- [Conventions](docs/conventions.md): Coding rules and workflows

# ✅ Conditional trigger — agents actually read this
## References
- When understanding project structure → read `docs/architecture.md`
- When adding/modifying skills or plugins → read `docs/conventions.md`
- When checking MCP server integration → see `docs/mcp-servers.md`
- When working on tech debt → check `docs/exec-plans/tech-debt-tracker.md`
```

**The difference**: Simple pointers say "this exists." Conditional triggers say "read this when." Agents act on instructions, not awareness.

### Progressive Disclosure: Index → Details → Deep Dive

Context should flow through layers, not be dumped all at once. Apply a **3-layer architecture** to both triggers and docs/ structure:

| Layer | What | Token Cost | When Loaded |
|-------|------|------------|-------------|
| **Index** | CLAUDE.md triggers, `docs/index.md` routing map | ~500 tokens | Always |
| **Details** | `docs/*.md` (architecture, conventions) | ~200 lines each | On trigger match |
| **Deep Dive** | `docs/deep-dive/*.md`, `docs/design-docs/*.md` | Unlimited | On explicit need from Details |

**Trigger format with layers:**

```markdown
# ❌ Flat — agent reads entire file, no path to deeper context
- When understanding layer boundaries → read `docs/architecture.md`

# ✅ Layered — agent targets section, can go deeper if needed
- When understanding layer boundaries → read `docs/architecture.md` §Layer Dependencies
  # Deep dive available: `docs/deep-dive/layer-dependency-rationale.md`
```

**Rules for section hints (§):**
- Use `§` followed by the section heading name (matching the `##` or `###` heading in the doc)
- Add hints by default for any docs/ file with 2+ distinct sections
- One trigger per section — don't combine multiple sections into one trigger
- Keep section names short (2-3 words) — they are navigation aids, not descriptions

### Trigger Specificity

Vague triggers fire too broadly or not at all. Each trigger condition must match an **observable agent action**, not an abstract intent.

```markdown
# ❌ Vague — "understanding" is not an observable action
- When understanding the project → read `docs/architecture.md`

# ❌ Too broad — fires on every file touch
- When working on the project → read `docs/conventions.md`

# ✅ Specific — matches observable file access patterns
- When modifying src/middleware/ or adding new API routes → read `docs/architecture.md` §Middleware Layer
- When adding/modifying skills or updating plugin metadata → read `docs/conventions.md`
```

**Self-test**: for each trigger, ask "can I name a specific file or command that would cause this to fire?" If not, the trigger is too vague.

### docs/ = System of Record

All context that agents need to read lives here. Structure docs/ for **progressive disclosure** — agents should read a routing map first, then dive into specific files.

```
docs/
├── index.md               # Routing map — what's in each file, when to read it
├── architecture.md        # ≤ 200 lines. Project structure, layer boundaries
├── conventions.md         # ≤ 200 lines. Coding rules, workflows
├── design-docs/           # Design documents (navigated via index.md)
├── deep-dive/             # Detailed context, accessed only from Details-layer docs
│   ├── auth-flow.md
│   └── data-model.md
├── exec-plans/            # Execution plans
│   ├── active/            #   In progress
│   ├── completed/         #   Done
│   └── tech-debt-tracker.md
├── generated/             # Auto-generated docs (DB schemas, etc.)
├── product-specs/         # Product specs
└── references/            # External references (LLM-friendly docs, etc.)
```

**`docs/index.md`** is optional but recommended for repos with 5+ docs/ files. It serves as a routing map that agents consult before reading individual docs. CLAUDE.md triggers should point to specific docs/ files, not to index.md.

**`docs/deep-dive/`** files should NOT appear in CLAUDE.md triggers. They are referenced from within Details-layer docs (architecture.md, conventions.md, etc.) when an agent needs to go deeper.

### Monorepo Progressive Disclosure

In monorepos, follow the **inheritance model**. Root CLAUDE.md triggers and rules automatically apply to all workspaces. Workspace CLAUDE.md should only add triggers for its own scope — never repeat what's in root.

#### CLAUDE.md Ownership

| Item | Root CLAUDE.md | Workspace CLAUDE.md |
|------|----------------|---------------------|
| Shared docs/ triggers | ✅ | ❌ (inherited) |
| Workspace-specific docs/ triggers | ❌ | ✅ |
| Shared behavior rule triggers | ✅ | ❌ (inherited) |
| Workspace-specific rule triggers | ❌ | ✅ |

#### docs/ Ownership Boundaries

```
monorepo/
├── CLAUDE.md              # Shared triggers
├── docs/                  # Shared knowledge base (context needed by 2+ workspaces)
├── apps/
│   ├── web/
│   │   ├── CLAUDE.md      # web-specific triggers
│   │   └── docs/          # web-specific knowledge base
│   └── api/
│       ├── CLAUDE.md
│       └── docs/
└── packages/
    └── ui/
        ├── CLAUDE.md
        └── docs/
```

#### Decision Criteria

"Where does this context/trigger go?"

- **Needed by 2+ workspaces** → Root `docs/` + root CLAUDE.md trigger
- **Needed by 1 workspace only** → That workspace's `docs/` + workspace CLAUDE.md trigger
- **Workspace needs to reference root docs/ file** → Don't add a trigger in workspace CLAUDE.md. It's already inherited from root

```markdown
# ❌ Duplicating root trigger in apps/web/CLAUDE.md
## References
- When understanding project structure → `../../docs/architecture.md`    ← already in root
- When modifying routing logic → read `docs/routing.md`

# ✅ Workspace-specific triggers only
## References
- When modifying routing logic → read `docs/routing.md`
```

### Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| **Inline context in CLAUDE.md** | Loses table-of-contents role | Move all context to docs/ |
| **Simple pointers** `[Title](path): description` | Agents won't read them | Use conditional triggers `when ~ → path` |
| **200+ line CLAUDE.md** | Context overload | Compress to ~100-line TOC (≤ 500 tokens) |
| **"Short enough to inline"** | Exceptions pile up into bloat | No exceptions. Everything in docs/ |
| **Speculative rules** | Noise | Add only on agent mistakes. Review for deletion if unviolated for 3 months |
| **LLM-generated docs** | -3% success rate, +20% cost | Human-written only. Add on actual agent mistakes |
| **Linter rules in docs** | Wasted tokens | Delegate to tooling. One trigger: `Run lint:fix` |
| **Vague trigger conditions** | Won't fire or fires too broadly | Reference observable actions: file paths, commands |
| **Flat docs/ without layers** | Agent reads everything | Use Index → Details → Deep Dive layers |
| **Stale docs trusted silently** | Silent agent failures | Context rot detection in [0] |
| **Knowledge only in external systems** | Agents can't access it | Encode in repo |
| **Root-workspace trigger duplication** | Fix one, the other drifts | Once in root only. Workspaces inherit |
| **Copying shared rules to workspaces** | Can't stay in sync | Manage in root docs/ |
| **Workspace-specific context in root** | Noise for unrelated workspaces | Move to that workspace's docs/ |

---

## Part 2: Document Review Workflow

### Document Layers

| Layer | Target Files | Key Question |
|-------|-------------|--------------|
| **L4: Meta** | `marketplace.json`, `plugin.json` | Machine-parseable? |
| **L3: Skills** | `SKILL.md`, `references/` | Does it drive correct behavior? |
| **L2: AI Context** | `CLAUDE.md`, `AGENTS.md` | TOC-only structure? Are triggers valid? |
| **L1: Entry Point** | `README.md` | Can someone install and get started? |

### Review Strategy: Delegate to Subagents

If the main agent runs checklists directly, reading many files bloats context and reduces focus. **Delegate verification to subagents; the main agent synthesizes results.**

```
Main Agent                         Subagents
───────────                        ──────────
[0] Check change history via git log
         │
         ├──dispatch──→  SubA: L4 Meta + L3 Skills
         ├──dispatch──→  SubB: L2 AI Context
         └──dispatch──→  SubC: L1 Entry Point + Cross-references
         │
    Collect results (structured report)
         │
[6] Synthesize report & apply fixes
```

**Subagent dispatch rules:**
- Include **repo root path** and **change list from [0]** in each subagent's prompt
- Include the **full checklist** for that layer in each subagent's prompt
- Subagents **read and verify only**. They do not modify files
- Return format: use the `Issues Found` table format from the report template below

**Grouping rationale:**
- **SubA (L4+L3)**: Plugin meta and skill docs share the same directory structure
- **SubB (L2)**: CLAUDE.md verification requires judging TOC structure, consistency, and health — needs a focused agent
- **SubC (L1+cross-refs)**: README and cross-references can be verified by path existence alone, without results from other layers

### [0] Check Change History & Context Rot — Main Agent Executes Directly

Run git log before reviewing. **Do not rely on memory. Always run the commands.**

```bash
# Recent structural changes (files added/deleted/renamed)
git log --oneline --diff-filter=ADR --name-status --since="2 weeks ago"

# Last modified date for each doc (run individually per file)
git log --format='%ar %s' -1 -- CLAUDE.md
git log --format='%ar %s' -1 -- README.md
```

**Context Rot Detection**: Stale docs cause silent failures when agents trust outdated information. Check for docs that haven't been updated while their referenced source code has changed.

```bash
# Find docs/ files not modified in 3+ months
find docs/ -name "*.md" -exec sh -c 'echo "$(git log --format=%ar -1 -- "$1") $1"' _ {} \;

# Find source files modified in the last 3 months (compare against stale docs)
git log --since="3 months ago" --name-only --pretty=format: -- src/ | sort -u | head -20
```

If a docs/ file hasn't been modified in 3+ months but the source code it references has changed, flag it as **stale** in the subagent prompt. SubB must verify whether the content is still accurate.

Include change history and staleness flags in subagent prompts. Subagents cross-check whether each change is reflected in docs.

**Progress updates** (adapt to user's language):

Before dispatching subagents:
```
[Step 0 complete] Change history analysis done. Dispatching 3 subagents for L4–L1 layer verification.
```

After subagents complete:
```
[Verification complete] Synthesizing subagent results.
```

### SubA Checklist: L4 Meta + L3 Skills

**L4: Meta File Verification**

- [ ] Plugin count in `marketplace.json` == actual subdirectory count under `plugins/`
- [ ] Each plugin directory contains `.claude-plugin/plugin.json`
- [ ] Each plugin directory contains `.mcp.json`
- [ ] `plugin.json` `name` field == directory name
- [ ] `marketplace.json` description semantically matches `plugin.json` description

**L3: Skill Document Verification**

- [ ] Each skill directory under `skills/` contains `SKILL.md`
- [ ] `SKILL.md` has YAML frontmatter (`name`, `description`)
- [ ] Frontmatter `name` == directory name
- [ ] If MCP servers are mentioned, they are defined in `.mcp.json` (excluding built-in tools)
- [ ] All files in `references/` are referenced from `SKILL.md` (no orphan files)
- [ ] All `references/` files referenced in `SKILL.md` actually exist (no broken references)

### SubB Checklist: L2 AI Context

**TOC Structure & Token Budget:**
- [ ] Is CLAUDE.md ~100 lines or fewer?
- [ ] Is CLAUDE.md ≤ 500 tokens? (`wc -w` ≤ ~375 words)
- [ ] No inline context in CLAUDE.md? (Violation if project overview, architecture, conventions, commands, etc. are written directly)
- [ ] No linter/formatter-enforceable rules in CLAUDE.md or docs/? (indentation, quotes, line length → delegate to tooling)
- [ ] All context lives in docs/ knowledge base?
- [ ] Are docs/ references in conditional trigger format? (`when ~ → path`) — not simple pointers (`[Title](path): description`)?
- [ ] Each docs/ file ≤ 200 lines? (Split if larger, add § hints to triggers)

**Trigger Quality:**
- [ ] Each trigger condition references an **observable agent action** (file access, command execution), not abstract intent ("understanding", "working on")?
- [ ] Self-test: can you name a specific file or command that would cause each trigger to fire?
- [ ] Triggers include § section hints for docs/ files with 2+ sections?
- [ ] `docs/deep-dive/` files are NOT directly referenced from CLAUDE.md triggers?

**Consistency:**
- [ ] Do conditional triggers point to docs/ files that actually exist?
- [ ] Does docs/ content match current codebase structure?
- [ ] Does MCP server list match actual `.mcp.json`?
- [ ] No orphan docs/ files (files not referenced by any trigger or other doc)?

**Freshness (Context Rot):**
- [ ] Docs/ files flagged as stale in [0] — do they still match current source code?
- [ ] If source code referenced by a doc has changed since last doc update, content is still accurate?
- [ ] No LLM-generated architecture overviews or project descriptions in docs/?

**Health:**
- [ ] No duplicate triggers between root and workspace CLAUDE.md
- [ ] No speculative rules (rules not responding to actual agent mistakes)
- [ ] Review rules unviolated for 3+ months for deletion

### SubC Checklist: L1 Entry Point + Cross-references

**L1: Entry Point Verification**

- [ ] Plugin list == plugin list in `marketplace.json`
- [ ] Each plugin description semantically matches `plugin.json` `description`
- [ ] Install commands work (correct plugin name, marketplace name)
- [ ] External links are valid (just note existence for auth-required internal URLs)

**Cross-reference Verification**

- [ ] Skills referenced from SKILL.md actually exist
- [ ] CLAUDE.md trigger paths point to docs/ files that actually exist
- [ ] Internal paths referenced from README.md actually exist

### [6] Synthesize Report & Apply Fixes — Main Agent

Synthesize subagent results into a single report. **If issues are found, use `AskUserQuestion` to confirm fix scope before proceeding.**

```markdown
## Document Gardening Report (YYYY-MM-DD)

### Review Scope
- L4 Meta: ✅/❌
- L3 Skills: ✅/❌
- L2 AI Context: ✅/❌
- L1 Entry Point: ✅/❌
- Cross-references: ✅/❌

### Issues Found

| # | Layer | File | Issue | Severity | Token Impact |
|---|-------|------|-------|----------|-------------|
| 1 | L2   | CLAUDE.md | Conventions written inline | High | +2,400 tokens/session |
| 2 | L2   | CLAUDE.md | docs/ references are simple pointers | High | — (behavioral) |
| 3 | L2   | docs/arch.md | 350 lines, no § hints in triggers | Med | +800 tokens (full file read) |
| 4 | L2   | docs/style.md | Linter-enforceable rules documented | Med | +600 tokens (wasted) |
```

**Token Impact** estimates the per-session cost of the issue. Use `wc -w` on the affected content to estimate. Issues that waste tokens get priority over purely behavioral issues.

**Severity criteria:**
- **High**: Inline context in CLAUDE.md, conditional triggers not used, agent working with wrong context, token budget exceeded
- **Medium**: Wrong information for users, affects skill behavior, docs/ file over 200 lines without § hints
- **Low**: Formatting inconsistency

**The urge to downgrade severity is itself a Red Flag.** "This repo is special", "this level is fine" are rationalizations. Judge by the criteria.

**Fix principles:**
- **Fix directly**: Structural mismatches (missing file listings, path errors, MCP server lists)
- **Confirm with user first**: Knowledge base structure changes, convention changes — use `AskUserQuestion` to present the fix plan and get approval:
  ```
  AskUserQuestion (adapt to user's language): "I'd like to apply these fixes:
  1. [High] Move inline context from CLAUDE.md to docs/conventions.md
  2. [Med] Split docs/architecture.md to stay under 200 lines

  Proceed? Let me know if you want to skip or modify any items."
  ```
- Re-dispatch the relevant layer's subagent to re-verify after fixes

---

## Red Flags

| Thought | Reality |
|---------|---------|
| "Too few files to bother reviewing" | Fewer files = higher impact per error |
| "No structural changes, should be fine" | Run git log. Don't rely on memory |
| "Just need to fix CLAUDE.md" | Always review all layers L4→L3→L2→L1 |
| "This inconsistency is minor" | The urge to downgrade severity is itself a Red Flag |
| "Fixed it, no need to re-verify" | Fixes can introduce new inconsistencies. Re-verify |
| "It's short, keep it in CLAUDE.md" | No exceptions. All context goes in docs/ |
| "Behavior rules belong inline" | Behavior rules go in docs/ too. CLAUDE.md holds triggers only |
| "This repo is special" | No repo is special. Principles are universal |
| "Just listing the docs/ path is enough" | Without conditional triggers, agents won't read it |
| "Better add a rule just in case" | Speculative rules are noise. Add only on mistakes |
| "Copy to all workspaces" | Duplication always drifts |
| "The docs haven't changed, so they're fine" | Source code may have changed. Run context rot detection |
| "Let Claude generate the architecture doc" | LLM-generated docs degrade performance. Human-written only |
| "More context = more helpful" | More context = more noise. Every token competes for attention |
| "This trigger is clear enough" | If you can't name a file that fires it, it's too vague |

## Tools

- `AskUserQuestion`: Fix plan confirmation, knowledge base structure change approval — any point requiring user decision
- `Glob`: Check file existence
- `Grep`: Search references in docs, detect duplicate content, find orphan docs/ files
- `Read`: Verify doc contents
- `Edit`: Modify docs
- `Bash (git log)`: Last modified dates, structural change history, context rot detection
- `Bash (wc -l)`: Measure CLAUDE.md line count
- `Bash (wc -w)`: Measure CLAUDE.md token budget (~words ≈ tokens)
- `Bash (find + git log)`: Context rot detection — compare doc freshness vs source changes
