# JKAuto apply-steps Blocks

The embedded JKAuto assistant applies complete step arrays from fenced code blocks tagged `apply-steps`.

Use this only when the user explicitly asks to add, remove, reorder, or modify steps. Include every step after modification, not a partial diff.

## Format

```apply-steps
[
  {
    "keyword": "navigate-to",
    "description": "Open login page",
    "objectRef": "",
    "input": "{{baseUrl}}/login",
    "expected": ""
  },
  {
    "keyword": "type-text",
    "description": "Enter email",
    "objectRef": "[data-testid=\"login-email-input\"]",
    "input": "{{email}}",
    "expected": ""
  }
]
```

## Rules

- Output one `apply-steps` block only.
- The block content must be a JSON array.
- Each step must include `keyword`.
- Supported optional fields: `description`, `objectRef`, `input`, `expected`, `enabled`, `continueOnFailure`, `timeout`.
- Omit `id`; JKAuto generates UUIDs.
- Do not include comments or trailing commas.
- Include all existing steps that should remain.
- Preserve current order unless asked to reorder.
