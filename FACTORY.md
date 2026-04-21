# Continuous Claude for Factory Droid

Autonomous SDLC pipeline adapted for Factory Droid. Factory port includes 5 hooks, 9 skills, 2 droids, and optional external tools.

## Hooks (Factory Droid Compatible)

| Hook | Event | What it does |
|------|-------|-------------|
| `statusline.mjs` | statusLine | Shows context usage, git state, and latest handoff goal/now |
| `rtk-rewrite.sh` | PreToolUse:Execute | Rewrites shell commands through RTK when rewrite rules apply |
| `tldr-read.mjs` | PreToolUse:Read | Injects structural nav map for large code files (requires `tldr` CLI) |
| `post-edit-diagnostics.mjs` | PostToolUse:Edit\|Create\|Write\|MultiEdit | Type errors + lint after edits (requires `tldr` CLI) |
| `pre-compact.mjs` | PreCompact | Auto-handoff before context compaction |
| `auto-handoff-stop.mjs` | Stop | Blocks stop when context is high and suggests a handoff |

## Factory Port Structure

- `.factory/hooks/` — Factory-native hook implementations, including statusline and RTK
- `.factory/skills/` — repo-local ports of the original orchestration skills
- `.factory/droids/` — repo-local `worker` and `oracle` droids
- `.factory/settings.json` — hook + statusline wiring for the project

## External Tools (optional, on PATH)

| Tool | What it does | Install |
|------|-------------|---------|
| [tldr](https://github.com/parcadei/tldr-code) | Token-efficient code analysis (AST, call graphs, diagnostics) | `pip install tldr-code` |
| [rtk](https://github.com/rtk-ai/rtk) | Shell command auto-rewrites for token savings | `cargo install rtk` or `brew install rtk` |

## Installation

1. Clone this repo to your project or use as a template
2. Copy `.factory/settings.json` to your project's `.factory/` directory
3. (Optional) Install `tldr` for read/diagnostic hooks and `rtk` for execute rewrites

## Configuration

The project-level Factory wiring in `.factory/settings.json` enables:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"$FACTORY_PROJECT_DIR\"/.factory/hooks/statusline.mjs"
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Execute",
        "hooks": [{ "type": "command", "command": "bash \"$FACTORY_PROJECT_DIR\"/.factory/hooks/rtk-rewrite.sh" }]
      },
      {
        "matcher": "Read",
        "hooks": [{ "type": "command", "command": "node \"$FACTORY_PROJECT_DIR\"/.factory/hooks/tldr-read.mjs", "timeout": 15 }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Create|Write|MultiEdit|Update",
        "hooks": [{ "type": "command", "command": "node \"$FACTORY_PROJECT_DIR\"/.factory/hooks/post-edit-diagnostics.mjs", "timeout": 15 }]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "node \"$FACTORY_PROJECT_DIR\"/.factory/hooks/pre-compact.mjs" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "node \"$FACTORY_PROJECT_DIR\"/.factory/hooks/auto-handoff-stop.mjs" }]
      }
    ]
  }
}
```

## Handoff System

When context compaction triggers (auto or manual), `pre-compact.mjs` creates a handoff document in `thoughts/shared/handoffs/<session-id>/`. This preserves:
- Current todos and their status
- Recent tool calls
- Files modified
- Errors encountered
- Last assistant context

Resume sessions by reading the latest handoff: `Read thoughts/shared/handoffs/<session-id>/auto-handoff-*.md`

## Skills & Droids

The original workflow has been ported into `.factory/skills/` and `.factory/droids/`:

- Skills: `autonomous`, `autonomous-research`, `bootup`, `create-handoff`, `premortem`, `research`, `resume-handoff`, `review`, `upgrade-harness`
- Droids: `worker`, `oracle`

The original Claude Code definitions remain in `.claude/` for comparison and maintenance.

## Scripts

- `scripts/readiness.sh` — assess project health (27 criteria, 5 levels)
- `scripts/readiness-fix.sh` — auto-remediate readiness gaps

## Tool Bridges (in tools/)

- `ouros_harness.py` — Ouros REPL bridge with exa_search, nia_search, llm_call, agent_call
- `exa_search.py` — web search (requires EXA_API_KEY in .env)
- `nia_docs.py` — documentation search (requires NIA_API_KEY in .env)

## Architecture

Hooks provide guardrails and automation. Factory Droid's native capabilities handle status display, permissions, and session management.

**Enforcement hierarchy:** lint rule > type system > formatter > pre-commit hook > CI check > FACTORY.md (last resort). Deterministic enforcement always preferred over probabilistic instructions.
