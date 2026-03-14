# Conventions

## Adding a New Skill

1. Create `skills/{skill-name}/SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: {skill-name}    # Must match directory name
   description: Use when... # Triggers skill discovery — be specific about when to activate
   ---
   ```

2. If the skill needs reference documents, create `skills/{skill-name}/references/` and reference all files from SKILL.md. No orphan files.

3. Update these files:
   - `README.md` — add to Skills table
   - `.claude-plugin/plugin.json` — update `description`, `keywords`, bump `version` (minor for new skill)
   - `.claude-plugin/marketplace.json` — sync `description` and `version` with plugin.json

4. Run garden-docs skill to verify document consistency across all layers.

## SKILL.md Structure

Follow the pattern established by existing skills:

```markdown
---
name: skill-name
description: Use when...
---

# Skill Title

Brief purpose statement.

<HARD-GATE>
- Inviolable constraints
</HARD-GATE>

---

## Execution Flow / Workflow

(Main content — how the agent should operate)

---

## Tools

- `ToolName`: What it's used for in this skill

## Red Flags

| Thought | Reality |
|---------|---------|
| Common mistake | Correct approach |
```

## Commit Messages

Follow conventional commits: `feat:`, `fix:`, `docs:`, `chore:`.

## Language

- SKILL.md content: can be Korean or English (match the target audience)
- Frontmatter `name` and `description`: English (machine-parsed)
- README.md: English
