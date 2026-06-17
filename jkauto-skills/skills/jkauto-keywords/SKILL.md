---
name: jkauto-keywords
description: Use when choosing, validating, explaining, or mapping JKAuto keyword ids for web, desktop, mobile, appium, api, Playwright, or Maestro tests. Covers objectRef/input/expected requirements and runner-specific support.
---

# JKAuto Keywords

Use this skill whenever a task depends on selecting valid JKAuto keywords or understanding what fields a keyword uses.

## Workflow

1. Read [references/keyword-reference.md](references/keyword-reference.md) for keyword ids, platforms, and field usage.
2. For `platform: mobile` with `runner: maestro`, also read [references/maestro-mapping.md](references/maestro-mapping.md).
3. Use keyword ids exactly as written. Do not use UI labels such as `Click` or raw Playwright/Maestro commands inside JKAuto test files.
4. Match the keyword to the platform before writing steps.

## Field Convention

- `objectRef`: target selector, object repository ref, accessibility id, JSON path, or header name depending on keyword.
- `input`: action value such as URL, text, timeout ms, key, method body path, base URL, or direction.
- `expected`: assertion value or API request body depending on keyword.

When a field is unused in full JSON, set it to `""`; in YAML it may be omitted unless clarity requires it.
