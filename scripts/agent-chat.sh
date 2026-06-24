#!/bin/bash
# JKAuto CLI Agent Chat
# Usage: ./scripts/agent-chat.sh "PROJECTS/ECM PROJECT" [model]
# Models: v1 (default), cc/claude-sonnet-4-6, cc/claude-opus-4-8

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export NODE_PATH="/Users/coinhat/Documents/jkauto/node_modules/.pnpm/@playwright+test@1.60.0/node_modules/@playwright/test/node_modules:/Users/coinhat/Documents/jkauto/node_modules/.pnpm/@playwright+test@1.60.0/node_modules:/Users/coinhat/Documents/jkauto/node_modules/.pnpm/node_modules"

exec node "$ROOT/scripts/agent-chat.mjs" "$@"
