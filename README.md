# just-useful-plugin

Practical skills for Claude Code — document gardening, knowledge base maintenance, doc-code sync workflows, and agent benchmarking.

## Skills

| Skill | Description |
|-------|-------------|
| **garden-docs** | Document gardening — verify docs match code, maintain knowledge base structure, CLAUDE.md authoring |
| **agent-benchmark** | Agent benchmark — measure how well your codebase environment supports AI agents. Tracks improvement over time with a fixed task set, detects regressions, and compares two environment configurations side by side. |

### agent-benchmark

Measures **environment quality** — how well your docs, structure, and setup help an AI agent work efficiently. Scores are not about model capability; they reflect how well-prepared your codebase is for agents.

**Two modes:**

| Mode | When to use |
|------|-------------|
| **Single** | Measure the current environment. Results are saved to `docs/benchmarks/history.jsonl` automatically. |
| **A/B** | Compare two environment configurations side by side (e.g., with vs. without CLAUDE.md). |

**Continuous improvement loop:**

```
1st run  →  tasks generated from git history, reviewed by you, saved to tasks.json
2nd run  →  same tasks reused  →  regression warning if metrics worsen
3rd run+ →  trend view appears  →  feedback loop suggests task set refinements
```

The task set is versioned (`task_set_version`). Comparisons across runs only apply within the same version — so changes to the task set are always explicit, never silent.

**Metrics** (lower is better): Total Tokens · Elapsed Time · Backtrack Rate

---

## Quick Start

```
/plugin marketplace add identity16/just-useful-plugin
/plugin install just-useful-plugin@just-useful-dev
```

## License

MIT
