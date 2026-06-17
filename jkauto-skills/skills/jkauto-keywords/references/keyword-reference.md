# JKAuto Keyword Reference

Canonical source in repo: `packages/engine/src/keywords/defs/*.ts`.

## Web, Desktop, Mobile Emulation, Appium Shared

| Keyword | Platforms | objectRef | input | expected | Notes |
|---|---|---|---|---|---|
| `navigate-to` | web, mobile, appium | no | URL/deep link | no | Appium opens URL/deep link. |
| `click` | web, mobile, desktop, appium | selector/ref | no | no | Mouse click or Appium click. |
| `type-text` | web, mobile, desktop, appium | selector/ref | text | no | Fills input; Appium clears then sets value. |
| `clear-text` | web, mobile, desktop, appium | selector/ref | no | no | Clears an input. |
| `press-key` | web, mobile, desktop | no | key name | no | Example: `Enter`, `Tab`, `Escape`, `ArrowDown`. |
| `scroll-to` | web, mobile, desktop | selector/ref | no | no | Scrolls element into view. |
| `wait-ms` | web, mobile, desktop, appium | no | milliseconds | no | Alias: `wait`. |
| `wait` | web, mobile, desktop, appium | no | milliseconds | no | Alias for `wait-ms`. |
| `wait-for-element` | web, mobile, desktop, appium | selector/ref | timeout ms optional | no | Default timeout 30000 ms. |
| `wait-for-visible` | web, mobile, desktop, appium | selector/ref | no | no | Waits for visibility. |
| `assert-text` | web, mobile, desktop, appium | selector/ref | no | expected text | Checks text contains expected. |
| `assert-visible` | web, mobile, desktop, appium | selector/ref | no | no | Element must be visible. |
| `assert-hidden` | web, mobile, desktop, appium | selector/ref | no | no | Element must be hidden/not visible. |
| `get-text` | web, mobile, desktop, appium | selector/ref | no | no | Reads text; current executor does not store it. |
| `call-test-case` | web, mobile, desktop, api, appium | no | absolute testcase path | no | Executes another testcase inline where supported by runner. |

## Web and Desktop

| Keyword | Platforms | objectRef | input | expected | Notes |
|---|---|---|---|---|---|
| `hover` | web, desktop | selector/ref | no | no | Hover target. |
| `select-option` | web, desktop | selector/ref | option value/label | no | Selects option in `<select>`. |
| `check` | web, desktop | selector/ref | no | no | Checks checkbox/radio. |
| `uncheck` | web, desktop | selector/ref | no | no | Unchecks checkbox. |
| `assert-element-value` | web, mobile, desktop | selector/ref | no | expected value | Checks input value exactly. |
| `assert-url-contains` | web, mobile | no | no | URL substring | Current URL must contain substring. |
| `assert-url` | web, mobile | no | no | URL substring | Alias for `assert-url-contains`. |
| `assert-window-title` | desktop, web | no | no | title substring | Page/window title contains expected. |
| `focus-window` | desktop, web | no | window index optional | no | Default index `0`. |
| `close-window` | desktop | no | no | no | Closes current window. |
| `maximize-window` | desktop, web | no | no | no | Maximizes current window. |
| `take-screenshot` | web, mobile, desktop | no | no | no | Takes screenshot. |

## Native Mobile and Appium

Legacy low-level appium-oriented keywords:

| Keyword | Platforms | objectRef | input | expected | Notes |
|---|---|---|---|---|---|
| `tap` | appium | selector/accessibility id | no | no | Native tap/click. |
| `swipe-up` | appium | no | distance px optional | no | Default 300. |
| `swipe-down` | appium | no | distance px optional | no | Default 300. |
| `long-press` | appium | selector/accessibility id | no | no | Long press. |

Neutral mobile DSL keywords:

| Keyword | Platforms | objectRef | input | expected | Notes |
|---|---|---|---|---|---|
| `mobile.launchApp` | mobile, appium | no | app id optional | no | Uses APP_ID/profile when input omitted. Maestro input `clearState` or `true` maps to clear state launch. |
| `mobile.tap` | mobile, appium | text, `~accessibilityId`, or selector | no | no | Good default for mobile tests. |
| `mobile.inputText` | mobile, appium | field selector/ref optional in Maestro mapping | text | no | In Maestro mapping, taps objectRef then inputs text. |
| `mobile.clearText` | mobile, appium | selector/ref | no | no | Appium clears; skipped by Maestro conversion. |
| `mobile.assertVisible` | mobile, appium | selector/text/ref | no | no | Visible assertion. |
| `mobile.assertNotVisible` | mobile, appium | selector/text/ref | no | no | Not visible assertion. |
| `mobile.waitForVisible` | mobile, appium | selector/ref | timeout ms optional | no | Default 5000 ms. |
| `mobile.swipe` | mobile, appium | no | direction | no | Direction: `up`, `down`, `left`, `right`. |
| `mobile.scrollUntilVisible` | mobile, appium | selector/ref | no | no | Appium scrolls up to 10 times. Not supported by Maestro mapping. |
| `mobile.back` | mobile, appium | no | no | no | Device back. |
| `mobile.pressKey` | mobile, appium | no | key name | no | `Enter`, `Delete`, `Home`, `Back`, `Search`. |
| `mobile.screenshot` | mobile, appium | no | checkpoint name optional | no | Saves screenshot. |
| `mobile.closeApp` | mobile, appium | no | app id optional | no | Appium terminates app; skipped by Maestro conversion. |

## API

| Keyword | Platforms | objectRef | input | expected | Notes |
|---|---|---|---|---|---|
| `set-base-url` | api | no | base URL | no | Sets session base URL. |
| `set-request-header` | api | header name | header value | no | Adds default header. |
| `http-request` | api | method optional | URL/path | no | For GET/DELETE-style requests. Default method GET. |
| `http-request-body` | api | method optional | URL/path | JSON body optional | For POST/PUT/PATCH. If input contains newline, first line is URL and remaining lines are body. Otherwise body comes from `expected`. |
| `assert-status-code` | api | no | no | status code | Asserts last response status. |
| `assert-response-contains` | api | no | no | body substring | Asserts last response body contains string. |
| `assert-json-path` | api | dot path | no | expected value | Dot notation, string compare. |
