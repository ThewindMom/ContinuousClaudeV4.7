# Continuous Claude for Factory Droid

Autonomous SDLC pipeline adapted for Factory Droid. 3 hooks, optional external tools.

## Hooks (Factory Droid Compatible)

| Hook | Event | What it does |
|------|-------|-------------|
| `tldr-read.mjs` | PreToolUse:Read | Injects structural nav map for large code files (requires `tldr` CLI) |
| `post-edit-diagnostics.mjs` | PostToolUse:Edit\|Create\|Write\|MultiEdit | Type errors + lint after edits (requires `tldr` CLI) |
| `pre-compact.mjs` | PreCompact | Auto-handoff before context compaction |

## Removed vs Claude Code Version

| Hook | Why Removed |
|------|-------------|
| `status.mjs` | Factory Droid has native status line |
| `auto-handoff-stop.mjs` | Factory's PreCompact trigger="auto" handles context-fullness |

## External Tools (optional, on PATH)

| Tool | What it does | Install |
|------|-------------|---------|
| [tldr](https://github.com/parcadei/tldr-code) | Token-efficient code analysis (AST, call graphs, diagnostics) | `pip install tldr-code` |

## Installation

1. Clone this repo to your project or use as a template
2. Copy `.factory/settings.json` to your project's `.factory/` directory
3. (Optional) Install `tldr` CLI for code navigation features: `pip install tldr-code`

## Configuration

The hooks are configured in `.factory/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [{ "type": "command", "command": "node \"$FACTORY_PROJECT_DIR\"/.factory/hooks/tldr-read.mjs", "timeout": 15 }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Create|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "node \"$FACTORY_PROJECT_DIR\"/.factory/hooks/pre-compact.mjs", "timeout": 15 }]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "node \"$FACTORY_PROJECT_DIR\"/.factory/hooks/pre-compact.mjs" }]
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

## Skills & Agents

The original Claude Code skills and agents are preserved in `.claude/skills/` and `.claude/agents/` for reference. These can be adapted to Factory Droid skills/droids if needed.

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
