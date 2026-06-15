# appium feature

- **AppiumSection:** settings UI (host/port/logLevel/autoStart) + server start/stop. In `settings/sections/`.
- **AppiumPanel:** RightPanel tab — embeds live device mirror inline (no longer just a launcher). Server status poll + Start/Stop (gated on env), env banners (appium missing / no Android SDK), **Guide** button, `DeviceToolbar`, bundleId + Connect/Disconnect, interaction log. Driver install list lives in the Guide dialog now (panel keeps the drivers state + `handleInstall`, passed as props). Detached inspector window still available via `APPIUM_INSPECTOR_OPEN`.
- **DeviceToolbar:** floating pill over mirror (device select + hardware/nav buttons home/back/appswitch/lock/vol±/screenshot). Calls `pressButton`/`screenshot` from `useAppiumSession`. Tooltips need `TooltipProvider` (in AppiumPanel).
- **AppiumGuideDialog:** install docs (appium CLI, drivers, Android SDK+emulator, iOS sim) with env-driven detected/missing badges + external links. Section 2 hosts the interactive driver install list (`DriverList`: status icon, version, Install button, refresh) — props from AppiumPanel.
- **Env check:** `APPIUM_ENV_CHECK` (main `checkEnv`) probes appium bin + adb + xcrun → `AppiumEnvStatus`. Drives banners + Start gating + guide badges.
- **Hardware buttons / screenshot:** `APPIUM_SESSION_BUTTON` (Android press_keycode / iOS `mobile: pressButton`), `APPIUM_SESSION_SCREENSHOT` (base64 PNG → browser download).
- **MobileInspector:** full-window device mirror + controls. Rendered standalone when `main.tsx` sees `#inspector` hash. Device picker, Connect/Disconnect, interaction log.
- **DeviceMirror:** routes Android → `AndroidMirror` (scrcpy H.264 WebCodecs canvas), iOS → `MjpegMirror` (`<img>` MJPEG WDA). Tap/swipe normalized [0,1] → `onTap`/`onSwipe` props.
- **AndroidMirror:** `SCRCPY_START/STOP` IPC + `SCRCPY_VIDEO_PACKET` stream → `VideoDecoder` (WebCodecs) → `<canvas>`. Main process: `scrcpy.handler.ts` uses `@yume-chan/adb` + `@yume-chan/adb-scrcpy` to push server JAR and stream H.264 at 30fps. Touch still via Appium REST (`APPIUM_SESSION_TAP/SWIPE`).
- **useAppiumSession:** hook wrapping `APPIUM_SESSION_*` IPC + interaction log state.
- **Appium logs:** streamed to `run.store` `appiumLogs[]` (separate from test Console); shown in BottomPanel Appium tab + AppiumPanel/inspector.
