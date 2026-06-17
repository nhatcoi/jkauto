# JKAuto TestCase Format

Canonical source in repo: `packages/core/src/schemas/test-case.ts`.

## Full TestCase Fields

```yaml
schemaVersion: 1
id: tc_login_success
name: Login - Success
description: Login with valid credentials and verify dashboard
owner: qa
tags: [login, smoke]
platform: web
runner: playwright
app:
  id: ""
  env: ""
  path: ""
config:
  timeoutMs: null
  retry: 0
  stepDelayMs: null
variables:
  email: tester@example.com
  password: password123
stepDelayMs: null
steps:
  - id: s01
    name: Open app
    keyword: navigate-to
    description: Open login page
    objectRef: ""
    input: "{{baseUrl}}/login"
    expected: ""
    enabled: true
    continueOnFailure: false
    timeout: null
createdAt: "2026-06-17T00:00:00.000Z"
updatedAt: "2026-06-17T00:00:00.000Z"
```

The normalizer supplies defaults for omitted optional fields, but generated files should include enough fields to be clear. Existing examples may omit `createdAt`/`updatedAt` in YAML; the engine normalizes missing timestamps at run time.

## Platform and Runner

Platforms: `web`, `mobile`, `desktop`, `api`, `appium`.

Runners: `playwright`, `maestro`, `appium`, `api`.

Default runner behavior:

| Platform | Default runner |
|---|---|
| `web` | `playwright` |
| `desktop` | `playwright` |
| `mobile` | `maestro` |
| `appium` | `appium` |
| `api` | `api` |

Use `platform: mobile` + `runner: maestro` for native Maestro-style mobile flows generated from JKAuto steps. Use `platform: appium` or `runner: appium` when the test should execute step-by-step through Appium/WebDriverIO.

For Maestro mobile runs, set `app.id` or provide `APP_ID` in profile variables.

## Step Fields

```yaml
- id: s01
  name: ""
  keyword: click
  description: Click submit
  objectRef: '[data-testid="submit"]'
  input: ""
  expected: ""
  enabled: true
  continueOnFailure: false
  timeout: null
```

Required in practice: `id` for full files, `keyword`.

Common optional fields:

| Field | Use |
|---|---|
| `name` | short display label |
| `description` | human explanation of the step |
| `objectRef` | CSS selector, XPath, object repository name, text, or `~accessibilityId` |
| `input` | URL, typed text, timeout ms, key name, method, body path, etc. |
| `expected` | assertion target, expected text/value/status |
| `enabled` | false skips the step |
| `continueOnFailure` | true continues run after failure |
| `timeout` | per-step timeout in ms; `null` uses default |

## Full YAML Example

```yaml
schemaVersion: 1
id: tc_login_success
name: Login - Valid credentials
description: Login and verify the tasks screen appears
platform: web
runner: playwright
tags: [login, smoke]
variables:
  email: tester@example.com
  password: password123
steps:
  - id: open_app
    keyword: navigate-to
    description: Open app
    input: "{{baseUrl}}"
  - id: wait_login_form
    keyword: wait-for-element
    description: Wait for login form
    objectRef: '[data-testid="login-email-input"]'
    input: "15000"
  - id: enter_email
    keyword: type-text
    objectRef: '[data-testid="login-email-input"]'
    input: "{{email}}"
  - id: enter_password
    keyword: type-text
    objectRef: '[data-testid="login-password-input"]'
    input: "{{password}}"
  - id: submit_login
    keyword: click
    objectRef: '[data-testid="login-submit-button"]'
  - id: wait_tasks_screen
    keyword: wait-for-element
    objectRef: '[data-testid="tasks-screen"]'
    input: "15000"
  - id: assert_logged_in_email
    keyword: assert-text
    objectRef: '[data-testid="signed-in-email-text"]'
    expected: "{{email}}"
```

## API Test Example

```yaml
schemaVersion: 1
id: tc_api_health
name: API - Health check
platform: api
runner: api
steps:
  - id: set_base
    keyword: set-base-url
    input: "{{baseUrl}}"
  - id: get_health
    keyword: http-request
    objectRef: GET
    input: /health
  - id: assert_status
    keyword: assert-status-code
    expected: "200"
  - id: assert_body
    keyword: assert-response-contains
    expected: ok
```
