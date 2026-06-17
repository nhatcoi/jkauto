#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Install JKAuto skills for Claude Code and common agent skill loaders.

Usage:
  install-jkauto-skills.sh [options]

Options:
  --scope project|global       Install into project-local or user-global context. Default: project.
  --agent claude|agents|codex|all
                              Target loader. Default: all.
  --mode copy|symlink          Install by copying or symlinking. Default: copy.
  --project DIR                Project root for project scope. Default: current directory.
  --source DIR                 Source jkauto-skills directory. Default: parent of this script.
  --dry-run                    Print actions without changing files.
  -h, --help                   Show this help.

Targets:
  project + claude  -> <project>/.claude/skills
  project + agents  -> <project>/.agents/skills
  project + codex   -> <project>/.agents/skills
  global  + claude  -> ~/.claude/skills
  global  + agents  -> ~/.agents/skills
  global  + codex   -> ${CODEX_HOME:-~/.codex}/skills
USAGE
}

scope="project"
agent="all"
mode="copy"
project_dir="$(pwd)"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$(cd "$script_dir/.." && pwd)"
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      scope="${2:-}"; shift 2 ;;
    --agent)
      agent="${2:-}"; shift 2 ;;
    --mode)
      mode="${2:-}"; shift 2 ;;
    --project)
      project_dir="${2:-}"; shift 2 ;;
    --source)
      source_dir="${2:-}"; shift 2 ;;
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

case "$scope" in project|global) ;; *) echo "--scope must be project or global" >&2; exit 2 ;; esac
case "$agent" in claude|agents|codex|all) ;; *) echo "--agent must be claude, agents, codex, or all" >&2; exit 2 ;; esac
case "$mode" in copy|symlink) ;; *) echo "--mode must be copy or symlink" >&2; exit 2 ;; esac

skills_src="$source_dir/skills"
if [[ ! -d "$skills_src" ]]; then
  echo "Skills source not found: $skills_src" >&2
  exit 1
fi

abs_project="$(cd "$project_dir" && pwd)"
home_dir="${HOME:?HOME is required}"
codex_home="${CODEX_HOME:-$home_dir/.codex}"

targets=()
add_target() {
  local dir="$1"
  for existing in "${targets[@]:-}"; do
    [[ "$existing" == "$dir" ]] && return
  done
  targets+=("$dir")
}

if [[ "$scope" == "project" ]]; then
  [[ "$agent" == "claude" || "$agent" == "all" ]] && add_target "$abs_project/.claude/skills"
  [[ "$agent" == "agents" || "$agent" == "codex" || "$agent" == "all" ]] && add_target "$abs_project/.agents/skills"
else
  [[ "$agent" == "claude" || "$agent" == "all" ]] && add_target "$home_dir/.claude/skills"
  [[ "$agent" == "agents" || "$agent" == "all" ]] && add_target "$home_dir/.agents/skills"
  [[ "$agent" == "codex" || "$agent" == "all" ]] && add_target "$codex_home/skills"
fi

run() {
  if [[ "$dry_run" == "1" ]]; then
    printf 'DRY RUN:'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

install_one() {
  local src="$1"
  local target_root="$2"
  local name
  name="$(basename "$src")"
  local dest="$target_root/$name"

  run mkdir -p "$target_root"
  if [[ -e "$dest" || -L "$dest" ]]; then
    run rm -rf "$dest"
  fi

  if [[ "$mode" == "symlink" ]]; then
    run ln -s "$src" "$dest"
  else
    run cp -R "$src" "$dest"
  fi
}

count=0
for target in "${targets[@]}"; do
  for skill in "$skills_src"/*; do
    [[ -d "$skill" ]] || continue
    install_one "$(cd "$skill" && pwd)" "$target"
    count=$((count + 1))
  done
done

echo "Installed $count skill target(s)."
for target in "${targets[@]}"; do
  echo "- $target"
done
