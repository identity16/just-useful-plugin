# just-useful-plugin

Practical skills for AI coding agents — document gardening, knowledge base maintenance, doc-code sync workflows, and agent benchmarking.

## Skills

| Skill | Description |
|-------|-------------|
| **garden-docs** | Document gardening — verify docs match code, maintain knowledge base structure, CLAUDE.md authoring |
| **agent-benchmark** | Agent benchmark — measure agent task performance, evaluate environment setup quality, A/B comparison |

## Installation

### Claude Code

```bash
claude plugin add /path/to/just-useful-plugin
```

### Cursor

Install via `.cursor-plugin/plugin.json`. See [Cursor plugin docs](https://docs.cursor.com) for details.

### Codex

See [`.codex/INSTALL.md`](.codex/INSTALL.md) for setup instructions.

### OpenCode

See [`.opencode/INSTALL.md`](.opencode/INSTALL.md) for setup instructions.

### Gemini CLI

Copy or symlink this directory and ensure `gemini-extension.json` is discoverable. See [`GEMINI.md`](GEMINI.md) for tool mappings.

## Platform Support

| Platform | Config | Status |
|----------|--------|--------|
| Claude Code | `.claude-plugin/` | ✅ |
| Cursor | `.cursor-plugin/` | ✅ |
| Codex | `.codex/` | ✅ |
| OpenCode | `.opencode/` | ✅ |
| Gemini CLI | `gemini-extension.json` | ✅ |

## License

MIT
