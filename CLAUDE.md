# CLAUDE.md

Central brain. Import contexts and rules via `@path`.

## Contexts

@PLAN.md

<!-- @.claude/contexts/<file>.md -->

## Rules

<!-- @.claude/rules/<file>.md -->

## Notes

- Agents: `.claude/agents/` — one file per specialized role
- Commands: `.claude/commands/` — custom slash commands
- Hooks: `.claude/hooks/` — PreToolUse, PostToolUse, SessionStart, etc.
- Memory: `.claude/memory/` — persistent across sessions
- Plugins: `.claude/plugins/` — generator/scaffold skills
- Skills: `.claude/skills/` — on-demand invokable skills
- MCP: `.claude/mcp/README.md` — configured MCP server docs
