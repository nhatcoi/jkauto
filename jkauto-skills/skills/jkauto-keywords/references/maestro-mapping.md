# JKAuto Maestro Mapping

Canonical source in repo: `packages/engine/src/runner.ts`.

When `platform: mobile` uses `runner: maestro`, JKAuto converts steps into a temporary Maestro flow. This is not raw Maestro YAML in the testcase file.

## Required App Id

Maestro runner requires one of:

```yaml
app:
  id: com.example.app
```

or profile/testcase variable:

```yaml
variables:
  APP_ID: com.example.app
```

## Selector Conversion

`objectRef` or target values beginning with `~` become Maestro `id`.

```yaml
objectRef: '~login-submit-button'
```

maps to:

```yaml
tapOn:
  id: "login-submit-button"
```

Plain values map as text:

```yaml
objectRef: Login
```

maps to:

```yaml
tapOn: "Login"
```

## Supported Keywords in Maestro Runner

| JKAuto keyword | Maestro command |
|---|---|
| `mobile.launchApp`, `launchApp` | `launchApp`; input `clearState` or `true` adds `clearState: true` |
| `clearState`, `mobile.clearState` | `clearState` |
| `mobile.tap`, `tapOn`, `tap` | `tapOn` |
| `mobile.inputText`, `type-text`, `inputText` | optional `tapOn` objectRef, then `inputText` |
| `mobile.assertVisible`, `assertVisible`, `assert-visible`, `wait-for-element`, `mobile.waitForVisible` | `assertVisible` |
| `mobile.assertNotVisible`, `assertNotVisible` | `assertNotVisible` |
| `assert-text` | optional `assertVisible` objectRef, then `assertVisible` expected text |
| `mobile.back`, `back` | `back` |
| `mobile.pressKey`, `pressKey` | `pressKey` |
| `mobile.screenshot`, `takeScreenshot` | `takeScreenshot` |
| `mobile.swipe`, `swipe` | `swipe` |

## Skipped in Maestro Runner

These keywords currently generate no Maestro command:

- `clear-text`
- `mobile.clearText`
- `mobile.closeApp`
- `closeApp`

Avoid using them for Maestro tests unless a no-op is intended.

## Unsupported in Maestro Runner

Any keyword not listed above throws `Maestro runner does not support keyword`.

For reliable mobile Maestro tests, prefer:

- `mobile.launchApp`
- `mobile.tap`
- `mobile.inputText`
- `mobile.assertVisible`
- `mobile.assertNotVisible`
- `mobile.waitForVisible`
- `mobile.swipe`
- `mobile.back`
- `mobile.pressKey`
- `mobile.screenshot`
