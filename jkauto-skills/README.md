# JKAuto Skills

Agent skills and Claude commands for writing, validating, and debugging JKAuto tests.

## Install

Run this one-line installer:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/nhatcoi/jkauto/main/jkauto-skills/install-online.sh)"
```

The installer asks for:

```text
Install scope:
  1) global
  2) project
```

Then it asks for the target:

```text
Install target:
  1) claude - Claude Code only
  2) other  - Codex, Antigravity, and common .agents loaders
  3) all    - Claude + other
```

## Install Targets

| Scope | Target | Installed paths |
| --- | --- | --- |
| global | claude | `~/.claude/skills`, `~/.claude/commands` |
| global | other | `~/.agents/skills`, `${CODEX_HOME:-~/.codex}/skills` |
| global | all | all global paths above |
| project | claude | `./.claude/skills`, `./.claude/commands` |
| project | other | `./.agents/skills` |
| project | all | all project paths above |

## Non-interactive Install

Use `curl | bash -s --` when passing options:

```bash
curl -fsSL https://raw.githubusercontent.com/nhatcoi/jkauto/main/jkauto-skills/install-online.sh | bash -s -- --scope global --agent all
```

Project-local Claude only:

```bash
curl -fsSL https://raw.githubusercontent.com/nhatcoi/jkauto/main/jkauto-skills/install-online.sh | bash -s -- --scope project --agent claude
```

Dry run:

```bash
curl -fsSL https://raw.githubusercontent.com/nhatcoi/jkauto/main/jkauto-skills/install-online.sh | bash -s -- --scope project --agent all --dry-run
```

## Included Skills

- `jkauto-testcase-author`: write and review JKAuto `.test.yaml`, `.test.yml`, and `.test.json` files in the IDE-safe TestCase format.
- `jkauto-keywords`: choose valid JKAuto keyword ids and required fields for web, desktop, mobile, Appium, API, Playwright, and Maestro-backed tests.
- `jkauto-run-debugger`: diagnose failed JKAuto runs, broken steps, selector issues, unsupported keywords, API assertions, and flaky waits.

## Claude Commands

When installing with target `claude` or `all`, these command files are also installed:

- `jkauto-testcase.md`
- `jkauto-keywords.md`
- `jkauto-debug.md`

They are copied into `.claude/commands` for the selected scope.

## Local Install From Repo

From the repository root:

```bash
jkauto-skills/scripts/install-jkauto-skills.sh --scope project --agent all
```

Available options:

```text
--scope project|global
--agent claude|agents|codex|other|all
--mode copy|symlink
--project DIR
--source DIR
--dry-run
```

## Pin a Version

By default, the online installer downloads from `main`. To install from a branch, tag, or commit SHA:

```bash
JKAUTO_SKILLS_REF=c75c854 bash -c "$(curl -fsSL https://raw.githubusercontent.com/nhatcoi/jkauto/main/jkauto-skills/install-online.sh)"
```

To install from a fork:

```bash
JKAUTO_SKILLS_REPO=owner/repo bash -c "$(curl -fsSL https://raw.githubusercontent.com/owner/repo/main/jkauto-skills/install-online.sh)"
```
