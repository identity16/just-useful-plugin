# Installing just-useful-plugin for Codex

## Setup

1. Clone the repository:
   ```bash
   git clone <repo-url> ~/.codex/just-useful-plugin
   ```

2. Symlink skills into Codex's skill directory:
   ```bash
   mkdir -p ~/.agents/skills
   ln -sf ~/.codex/just-useful-plugin/skills/* ~/.agents/skills/
   ```

## Codex Tool Mappings

When following skills that reference Claude Code tools, use these Codex equivalents:

| Claude Code | Codex | Notes |
|-------------|-------|-------|
| `Agent` (subagent) | `spawn_agent` | Requires `[features] collab = true` in config |
| Agent result | `wait` | Wait for subagent completion |
| `TodoWrite` | `update_plan` | |

All other tools (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`) work natively in Codex.

## Verification

```bash
ls ~/.agents/skills/garden-docs/SKILL.md
```
