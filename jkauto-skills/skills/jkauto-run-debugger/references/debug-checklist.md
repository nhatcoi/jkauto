# JKAuto Debug Checklist

## Common Failure Classes

### Unsupported Keyword

Symptoms:

- `Maestro runner does not support keyword: ...`
- Keyword missing from dropdown for selected platform.

Fix:

- Switch to a keyword supported by the platform.
- For Maestro mobile tests, use the supported mobile DSL subset from `jkauto-keywords/references/maestro-mapping.md`.
- For native step-by-step execution, use `runner: appium`.

### Selector Not Found

Symptoms:

- Playwright `waiting for selector`.
- Appium element lookup fails.
- Maestro cannot find element/text.

Fix:

- Web/desktop: prefer `[data-testid="..."]`.
- Native mobile/Appium: prefer `~accessibilityId`.
- Maestro: use `~id` for accessibility id or exact visible text.
- Add `wait-for-element`, `wait-for-visible`, or `mobile.waitForVisible` before interaction.

### Wrong Field

Examples:

- `type-text` needs selector in `objectRef`, typed value in `input`.
- `assert-text` needs selector in `objectRef`, expected text in `expected`.
- `http-request` needs method in `objectRef`, URL/path in `input`.
- `assert-json-path` needs dot path in `objectRef`, expected value in `expected`.

### Missing Variables

Symptoms:

- URL contains literal `{{baseUrl}}`.
- Credentials are blank.
- Maestro says app id missing.

Fix:

- Add variables to testcase `variables` or active profile.
- For mobile Maestro, set `app.id` or `APP_ID`.

### API Assertion Without Response

Symptoms:

- `No response - run http-request first`.

Fix:

- Add `set-base-url` if using relative paths.
- Add `http-request` or `http-request-body` before assertions.

### Flaky Timing

Fix order:

1. Add/adjust targeted wait for the element.
2. Increase keyword timeout input.
3. Use `config.stepDelayMs` only if the app needs a general pacing delay.
4. Use `wait-ms` as last resort for animations or backend eventual consistency.

## Run Context to Ask For

When context is missing, ask for:

- Testcase file or steps.
- Platform and runner.
- Failed step index/id.
- Exact error.
- Relevant profile variables with secrets redacted.
- Whether the run was normal or debug mode.
