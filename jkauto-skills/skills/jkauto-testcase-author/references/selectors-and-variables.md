# Selectors and Variables

## Variables

JKAuto interpolates both syntaxes:

- `{{name}}`
- `${name}`

Prefer `{{name}}` in generated test files.

Variable lookup combines testcase `variables` and active profile variables. Profile variables can provide environment-specific values such as:

- `baseUrl`
- `APP_ID`
- `APPIUM_HOST`
- `APPIUM_PORT`
- credentials or API tokens

## Web and Desktop Selectors

Prefer stable selectors:

1. `[data-testid="..."]`
2. Accessible role/name only when the current keyword/runtime supports it through object repository resolution.
3. CSS ids/classes when stable.
4. XPath only when CSS cannot express the target.

Examples:

```yaml
objectRef: '[data-testid="login-submit-button"]'
objectRef: '#email'
objectRef: 'xpath=//button[contains(.,"Save")]'
```

## Appium and Native Mobile Selectors

Use accessibility ids with a leading `~` when available:

```yaml
objectRef: '~login-submit-button'
```

Plain text can be used for Maestro-oriented mobile steps:

```yaml
objectRef: Login
```

For native mobile, prefer `~accessibilityId` because it maps cleanly to Appium and Maestro conversion.

## Object Repository

Object repository references may resolve through JKAuto's object repository loader. If the target project has `.objects.json`/`.objects.yaml`, prefer existing object names over duplicating selectors. If no repo context is available, use direct selectors.
