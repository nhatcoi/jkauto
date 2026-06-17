#!/usr/bin/env bash
set -euo pipefail

repo="${JKAUTO_SKILLS_REPO:-nhatcoi/jkauto}"
ref="${JKAUTO_SKILLS_REF:-main}"
raw_base="https://raw.githubusercontent.com/${repo}/${ref}/jkauto-skills"

usage() {
  cat <<'USAGE'
Download and install JKAuto skills from raw.githubusercontent.com.

Usage:
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/nhatcoi/jkauto/main/jkauto-skills/install-online.sh)"

Options:
  --scope project|global
  --agent claude|other|all
  --project DIR
  --dry-run
  -h, --help

Environment:
  JKAUTO_SKILLS_REPO=owner/repo   Default: nhatcoi/jkauto
  JKAUTO_SKILLS_REF=branch-or-sha Default: main
USAGE
}

scope=""
agent=""
project_dir="$(pwd)"
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      scope="${2:-}"; shift 2 ;;
    --agent)
      agent="${2:-}"; shift 2 ;;
    --project)
      project_dir="${2:-}"; shift 2 ;;
    --dry-run)
      dry_run=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2 ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

prompt_scope() {
  while [[ -z "$scope" ]]; do
    cat <<'MENU'
Install scope:
  1) global
  2) project
MENU
    read -r -p "Choose scope [1-2]: " choice </dev/tty
    case "$choice" in
      1|global) scope="global" ;;
      2|project) scope="project" ;;
      *) echo "Please choose 1 or 2." ;;
    esac
  done
}

prompt_agent() {
  while [[ -z "$agent" ]]; do
    cat <<'MENU'
Install target:
  1) claude - Claude Code only
  2) other  - Codex, Antigravity, and common .agents loaders
  3) all    - Claude + other
MENU
    read -r -p "Choose target [1-3]: " choice </dev/tty
    case "$choice" in
      1|claude) agent="claude" ;;
      2|other) agent="other" ;;
      3|all) agent="all" ;;
      *) echo "Please choose 1, 2, or 3." ;;
    esac
  done
}

case "${scope:-}" in ""|project|global) ;; *) echo "--scope must be project or global" >&2; exit 2 ;; esac
case "${agent:-}" in ""|claude|other|all) ;; *) echo "--agent must be claude, other, or all" >&2; exit 2 ;; esac

if [[ ! -r /dev/tty || ! -w /dev/tty ]]; then
  scope="${scope:-global}"
  agent="${agent:-all}"
else
  prompt_scope
  prompt_agent
fi

need_cmd curl
need_cmd mktemp

tmp="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp"
}
trap cleanup EXIT

files=(
  "scripts/install-jkauto-skills.sh"
  "commands/jkauto-debug.md"
  "commands/jkauto-keywords.md"
  "commands/jkauto-testcase.md"
  "skills/jkauto-keywords/SKILL.md"
  "skills/jkauto-keywords/references/keyword-reference.md"
  "skills/jkauto-keywords/references/maestro-mapping.md"
  "skills/jkauto-run-debugger/SKILL.md"
  "skills/jkauto-run-debugger/references/debug-checklist.md"
  "skills/jkauto-testcase-author/SKILL.md"
  "skills/jkauto-testcase-author/references/apply-steps.md"
  "skills/jkauto-testcase-author/references/selectors-and-variables.md"
  "skills/jkauto-testcase-author/references/testcase-format.md"
)

for file in "${files[@]}"; do
  dest="$tmp/jkauto-skills/$file"
  mkdir -p "$(dirname "$dest")"
  curl -fsSL "$raw_base/$file" -o "$dest"
done

chmod +x "$tmp/jkauto-skills/scripts/install-jkauto-skills.sh"

args=(
  --scope "$scope"
  --agent "$agent"
  --project "$project_dir"
  --source "$tmp/jkauto-skills"
)

if [[ "$dry_run" == "1" ]]; then
  args+=(--dry-run)
fi

"$tmp/jkauto-skills/scripts/install-jkauto-skills.sh" "${args[@]}"
