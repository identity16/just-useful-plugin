# Installing just-useful-plugin for OpenCode

## Setup

1. Clone the repository:
   ```bash
   git clone <repo-url> ~/.config/opencode/just-useful-plugin
   ```

2. Register the plugin:
   ```bash
   ln -sf ~/.config/opencode/just-useful-plugin/.opencode/plugins/just-useful-plugin.js \
     ~/.config/opencode/plugins/just-useful-plugin.js
   ```

3. Symlink skills:
   ```bash
   mkdir -p ~/.agents/skills
   ln -sf ~/.config/opencode/just-useful-plugin/skills/* ~/.agents/skills/
   ```

## Verification

```bash
ls ~/.agents/skills/garden-docs/SKILL.md
```
