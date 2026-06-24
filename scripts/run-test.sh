#!/bin/bash
# JKAuto CLI test runner
# Usage: ./scripts/run-test.sh <testcase-or-suite.yaml> [project-dir] [profile-name]
# Examples:
#   ./scripts/run-test.sh "PROJECTS/ECM PROJECT/test-cases/ecm-ui/auth/ui-login-valid.test.yaml" "PROJECTS/ECM PROJECT"
#   ./scripts/run-test.sh "PROJECTS/ECM PROJECT/test-suites/ecm-ui-smoke.suite.yaml" "PROJECTS/ECM PROJECT"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export NODE_PATH="/Users/coinhat/Documents/jkauto/node_modules/.pnpm/@playwright+test@1.60.0/node_modules/@playwright/test/node_modules:/Users/coinhat/Documents/jkauto/node_modules/.pnpm/@playwright+test@1.60.0/node_modules:/Users/coinhat/Documents/jkauto/node_modules/.pnpm/node_modules"

exec node "$ROOT/scripts/run-test.bundle.mjs" "$@"
