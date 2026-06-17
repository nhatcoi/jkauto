---
name: jkauto-testcase-author
description: Use when creating, editing, reviewing, or converting JKAuto .test.yaml/.test.yml/.test.json files or apply-steps blocks for the JKAuto IDE. Covers TestCase fields, step shape, variables, selectors, platform/runner choices, and IDE-safe output rules.
---

# JKAuto Testcase Author

Use this skill whenever the task involves writing or modifying JKAuto test cases, importing steps, or producing an `apply-steps` block for the embedded JKAuto assistant.

## Required Workflow

1. Identify the target surface:
   - Full file: `.test.yaml`, `.test.yml`, or `.test.json`.
   - Embedded IDE change: `apply-steps` block only.
2. Read [references/testcase-format.md](references/testcase-format.md) before writing a full testcase file.
3. Read [references/apply-steps.md](references/apply-steps.md) before outputting an `apply-steps` block.
4. Read [references/selectors-and-variables.md](references/selectors-and-variables.md) when choosing selectors, object refs, profile variables, or interpolation syntax.
5. If choosing keywords, use the `jkauto-keywords` skill or read its keyword reference.

## Authoring Rules

- Prefer YAML for new JKAuto project files unless the user asks for JSON or the existing project uses JSON.
- Keep step ids stable when editing an existing full file. Use short stable ids such as `s01`, `open_login`, or existing ids.
- For `apply-steps`, omit `id`; the IDE generates ids.
- Use only JKAuto keyword ids, not human labels.
- Use strings for `objectRef`, `input`, and `expected`; use empty string when a field is unused in full JSON.
- Put assertions after actions and waits. Prefer `wait-for-element`/`wait-for-visible` before interacting with elements that may render asynchronously.
- Use `{{variableName}}` for testcase/profile variables.
- Do not invent unsupported runner-specific YAML commands inside a JKAuto `.test.yaml`; JKAuto YAML is the TestCase schema, not raw Maestro flow YAML.

## Output Rules

- If editing a file directly, preserve its format and nearby style.
- If answering inside JKAuto's embedded agent and the user asks to add/remove/reorder/change steps, output exactly one fenced code block tagged `apply-steps` containing the complete updated steps array.
- If the user only asks a question or asks for explanation, do not output `apply-steps`.
