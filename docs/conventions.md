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
   - `.claude-plugin/plugin.json` — update `description`, `keywords`, bump `version` (minor for new skill, patch for existing skill changes)
   - `.claude-plugin/marketplace.json` — sync `description` and `version` with plugin.json
   - `.cursor-plugin/plugin.json` — sync `description`, `keywords`, and `version` with plugin.json

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

## Version Bumping

유의미한 변경 단위가 완료되면 플러그인 버전을 올린다. 매 커밋마다가 아니라, 하나의 기능/수정이 논리적으로 완결된 시점에 한 번.

- **minor** (0.X.0): 새 스킬 추가
- **patch** (0.0.X): 기존 스킬의 동작 변경, 메트릭/포맷 변경, 버그 수정

**동기화 대상 (모두 같은 버전이어야 함):**
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.cursor-plugin/plugin.json`

## Commit Messages

Follow conventional commits: `feat:`, `fix:`, `docs:`, `chore:`.

## Language

- SKILL.md content: can be Korean or English (match the target audience)
- Frontmatter `name` and `description`: English (machine-parsed)
- README.md: English
