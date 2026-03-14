# Architecture

## What This Is

A Claude Code plugin that provides prompt-based skills for AI coding agents. No code — skills are pure Markdown documents that instruct agents how to perform specific workflows.

## Plugin Structure

```
just-useful-plugin/
├── .claude-plugin/          # Claude Code platform config
│   ├── plugin.json          # Plugin metadata (name, version, keywords)
│   └── marketplace.json     # Marketplace listing
├── skills/                  # All skills live here
│   └── {skill-name}/
│       ├── SKILL.md         # Required: YAML frontmatter + skill prompt
│       └── references/      # Optional: supporting docs referenced by SKILL.md
└── docs/                    # Knowledge base
    ├── specs/               # Design specifications
    └── plans/               # Implementation plans
```

## How Skills Work

A skill is a directory under `skills/` containing at minimum a `SKILL.md` file.

**SKILL.md anatomy:**
- YAML frontmatter with `name` (must match directory name) and `description` (triggers skill discovery)
- Prompt body that instructs the agent on execution flow
- Optional `<HARD-GATE>` section for inviolable constraints
- Tools section listing which Claude Code tools to use
- Red Flags table for common mistakes

**references/ directory:**
- Optional supporting documents that SKILL.md references
- Must be referenced from SKILL.md (no orphan files)
- Contains detailed specs that would bloat SKILL.md if inlined (metrics definitions, templates, format specs)

## Platform

Claude Code only. Discovery via `.claude-plugin/plugin.json` → scans `skills/*/SKILL.md`.

## Version Sync

When updating the plugin version, update both files:
- `.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → `plugins[0].version`

Same for description changes — both must stay in sync.
