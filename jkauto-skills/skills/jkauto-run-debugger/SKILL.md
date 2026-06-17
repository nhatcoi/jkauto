---
name: jkauto-run-debugger
description: Use when diagnosing failed JKAuto test runs, broken steps, unsupported keywords, selector failures, API assertion failures, Playwright/Appium/Maestro execution problems, or flaky wait/timing issues.
---

# JKAuto Run Debugger

Use this skill when a user asks why a JKAuto test failed or how to fix a flaky/broken run.

## Workflow

1. Gather the active testcase, failed step index, error message, platform, runner, profile variables, console/problems/events, and run history if available.
2. Read [references/debug-checklist.md](references/debug-checklist.md).
3. If the fix changes test steps, use `jkauto-testcase-author` and output the appropriate file edit or `apply-steps` block.
4. If the issue is keyword support, use `jkauto-keywords`.

## Debugging Priorities

- Check that the failing keyword supports the selected platform/runner.
- Check field placement: selector in `objectRef`, action value in `input`, assertion value in `expected`.
- Check interpolation: unresolved `{{var}}` usually means missing testcase/profile variable.
- Prefer fixing selectors and waits before adding arbitrary `wait-ms`.
- For Maestro, verify `APP_ID`/`app.id` and supported keyword mapping.
- For Appium, verify Appium server env, device/session capabilities, and accessibility ids.
- For API, confirm a request ran before response assertions.
