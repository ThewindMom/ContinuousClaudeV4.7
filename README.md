# Continuous Claude v4.7

Autonomous software development pipeline for Claude Code and Factory Droid. Skills orchestrate; workers build; the project improves with every task.

> **Factory Droid Users:** See [FACTORY.md](FACTORY.md) for the repo-local Factory port with hooks, skills, droids, RTK wiring, and statusline support.

## Factory Droid Support

This repo is adapted for both Claude Code and Factory Droid:

- **Claude Code**: Use `.claude/` directory with 5 hooks
- **Factory Droid**: Use `.factory/` directory with hooks, skills, droids, RTK wiring, and custom statusline support

Factory Droid ships a repo-local port under `.factory/` with hooks, skills, droids, RTK wiring, and a custom status line. See [FACTORY.md](FACTORY.md) for details.

## What's in here

```
.claude/                    Claude Code version
  skills/          9 workflow skills
  agents/          worker + oracle
  hooks/           5 hooks (.mjs — cross-platform)
  settings.json    hook wiring + env config
.factory/                   Factory Droid version
  hooks/           5 hooks + RTK installer/wrapper
  skills/          9 workflow skill ports
  droids/          worker + oracle
  settings.json    hook + statusline wiring
scripts/
  readiness.sh     assess project health (27 criteria, 5 levels)
  readiness-fix.sh auto-remediate gaps
tools/
  ouros_harness.py sandboxed Python REPL with external function bridge
  exa_search.py    web search bridge (requires EXA_API_KEY)
  nia_docs.py      documentation search bridge (requires NIA_API_KEY)
```

## Skills

| Skill | What it does |
|-------|-------------|
| `/autonomous` | Full SDLC pipeline: assess, plan, premortem, prepare, execute, validate, evolve |
| `/autonomous-research` | Looping research pipeline — hypotheses deepen via Ouros sessions |
| `/research` | Open-ended exploration via Ouros REPL with persistent state |
| `/premortem` | Failure analysis gate — first-principles retrospective before implementation |
| `/bootup` | Assess project readiness, route to research/autonomous/review |
| `/review` | Structural + semantic code review |
| `/create-handoff` | Serialize session context for transfer |
| `/resume-handoff` | Resume an autonomous session from handoff |
| `/upgrade-harness` | Add new external functions to the Ouros sandbox |

## Hooks

All hooks are plain `.mjs` (ES modules). No build step, no dependencies — Node.js is guaranteed wherever Claude Code runs.

| Hook | Event | Purpose |
|------|-------|---------|
| `status.mjs` | statusLine | Shows context %, git branch, staged/unstaged counts, goal from handoffs |
| `tldr-read.mjs` | PreToolUse:Read | Injects structural nav map for large code files, truncates to save tokens |
| `post-edit-diagnostics.mjs` | PostToolUse | Runs type checker + linter after edits for immediate feedback |
| `pre-compact.mjs` | PreCompact | Writes auto-handoff YAML before context compaction |
| `auto-handoff-stop.mjs` | Stop | Blocks at 85% context usage to force handoff before data loss |

Hooks that use `tldr` (tldr-read, post-edit-diagnostics) fall through silently if tldr is not installed.

## Dependencies

### Required

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — the runtime

### Recommended (on PATH)

| Tool | Install | What it does |
|------|---------|-------------|
| [bloks](https://github.com/parcadei/bloks) | `cargo install bloks` | Library knowledge cards — API docs, taste, corrections |
| [tldr](https://github.com/parcadei/tldr-code) | `cargo install tldr-code` | Token-efficient code analysis (AST, call graphs, impact, diagnostics) |
| [ouros](https://github.com/parcadei/ouros) | `cargo install ouros` | Sandboxed Python REPL with fork/save/resume |
| [fastedit](https://github.com/parcadei/fastedit) | `pip install fastedits` | Fast code editing via merge model — 10x fewer tokens per edit |

### Optional (API keys in .env)

```bash
cp .env.example .env
# Add your keys:
# EXA_API_KEY=     — for web search via exa_search.py
# NIA_API_KEY=     — for documentation search via nia_docs.py
```

Python dependencies for tools that use API keys:
```bash
pip install -r tools/requirements.txt  # aiohttp
```

### FastEdit setup

A PreToolUse hook redirects the built-in `Edit` tool to [FastEdit](https://github.com/parcadei/fastedit) when available. If FastEdit isn't installed, Edit falls through normally. Model weights on [HuggingFace](https://huggingface.co/continuous-lab/FastEdit).

```bash
pip install fastedits[mlx]
fastedit pull                # downloads MLX 8-bit model (~1.7GB) from HuggingFace
fastedit read src/app.py     # verify it works — shows file structure
fastedit search "auth" src/  # search codebase for symbols
```

The PyPI package is `fastedits` but the CLI entry point is `fastedit`. To choose a different model format:

```bash
fastedit pull              # MLX 8-bit (default, Apple Silicon)
fastedit pull --model bf16 # BF16 safetensors (GPU serving)
```

To point at a custom model path: `export FASTEDIT_MODEL_PATH=/path/to/your/model`. Resolution order: `FASTEDIT_MODEL_PATH` env var → `./models/` → `~/.cache/fastedit/models/` → auto-download.

MCP server config — add to `~/.claude.json` (or use `claude mcp add`):

```json
{
  "mcpServers": {
    "fastedit": {
      "command": "python3",
      "args": ["-m", "fastedit.mcp_server"]
    }
  }
}
```

This exposes 10 tools in Claude Code automatically: `fast_edit`, `fast_batch_edit`, `fast_read`, `fast_search`, `fast_delete`, `fast_move`, `fast_rename`, `fast_diff`, `fast_undo`, `fast_multi_edit`.

## Quick start

1. Install recommended tools above
2. Clone this repo into your project (or copy `.claude/`, `scripts/`, and `tools/`)
3. Run `/bootup` to assess readiness and route to a workflow
4. Or jump straight to `/autonomous` with a task description

## How it works

**The loop:** Research explores unknowns. Autonomous plans and builds. Workers execute atomic tasks. Validation gates each milestone. Evolve aggregates findings, recommends lint rules and tool configs, and feeds corrections back to bloks cards. The project gets better with every run.

**Knowledge flow:** Bloks cards carry API knowledge, taste, and corrections. Cards are consumed during PREPARE (injected into worker prompts) and produced during EVOLVE (from worker findings). Cards score through ack/nack — useful cards surface, bad cards get revised or retired.

**Research flow:** `/autonomous-research` runs a looping pipeline where workers research inside Ouros. Results persist in the REPL heap (zero orchestrator tokens). Workers share state via Ouros sessions (`--load` for sequential, `--fork` for parallel). Only compact artifacts cross back to the orchestrator.

**Enforcement hierarchy:** When workers report conventions, evolve maps them to the strongest deterministic enforcement: lint rule > type system > formatter > pre-commit hook > CI check > CLAUDE.md (last resort). Probabilistic instructions are always the fallback, never the first choice.

## Project structure (created by autonomous)

```
continuum/
  autonomous/{task-id}/
    contract.json    assertions + lifecycle state
    plan.md          milestones (multi-feature+)
    reports/         worker reports (uniform JSON)
    validation/      milestone results
  research/{topic}/
    research_contract.json   hypotheses + lifecycle + iteration history
    findings.md              final synthesis
    artifacts/               per-hypothesis per-iteration evidence
    reports/                 worker reports (compact JSON)
```

## License

MIT
