# Gemini CLI Tool Mappings

When following skills that reference Claude Code tools, use these Gemini equivalents:

| Claude Code | Gemini CLI | Notes |
|-------------|-----------|-------|
| `Read` | `read_file` | |
| `Write` | `write_file` | |
| `Edit` | `replace` | |
| `Bash` | `run_shell_command` | |
| `Grep` | `grep_search` | |
| `Glob` | `glob` | |
| `WebSearch` | `google_web_search` | |
| `WebFetch` | `web_fetch` | |
| `Skill` | `activate_skill` | |

**Limitations:** Gemini CLI does not support subagents. For skills that dispatch subagents, run the checklist steps sequentially instead.
