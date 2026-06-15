# appium feature

- **AppiumSection:** settings UI (host/port/logLevel/autoStart) + server start/stop. In `settings/sections/`.
- **AppiumPanel:** RightPanel tab — server status poll, driver install (UiAutomator2/XCUITest/Espresso), log tail, and **Inspect** button (opens detached inspector window via `APPIUM_INSPECTOR_OPEN`).
- **MobileInspector:** full-window device mirror + controls. Rendered standalone when `main.tsx` sees `#inspector` hash. Device picker, Connect/Disconnect, interaction log.
- **DeviceMirror:** `<img>` MJPEG stream from WDA (`mjpegServerPort`). Click→tap, drag→swipe (normalized coords, tap threshold 0.02).
- **useAppiumSession:** hook wrapping `APPIUM_SESSION_*` IPC + interaction log state.
- **Appium logs:** streamed to `run.store` `appiumLogs[]` (separate from test Console); shown in BottomPanel Appium tab + AppiumPanel/inspector.
