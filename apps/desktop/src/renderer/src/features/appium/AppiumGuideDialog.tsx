import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, ExternalLink, Download, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppiumEnvStatus, AppiumDriverMap } from '@jkauto/core'

const KNOWN_DRIVERS: { name: string; label: string; platform: string }[] = [
  { name: 'uiautomator2', label: 'UiAutomator2', platform: 'Android' },
  { name: 'xcuitest',     label: 'XCUITest',     platform: 'iOS' },
  { name: 'espresso',     label: 'Espresso',     platform: 'Android (alt)' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  env: AppiumEnvStatus | null
  drivers: AppiumDriverMap
  loadingDrivers: boolean
  installingDriver: string | null
  onInstall: (driverName: string) => void
  onRefreshDrivers: () => void
}

function DriverList({
  drivers,
  loadingDrivers,
  installingDriver,
  onInstall,
  onRefreshDrivers,
}: Pick<Props, 'drivers' | 'loadingDrivers' | 'installingDriver' | 'onInstall' | 'onRefreshDrivers'>) {
  return (
    <div className="rounded border border-border bg-muted/20 p-2 space-y-1">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Installed drivers
        </span>
        <button
          onClick={onRefreshDrivers}
          disabled={loadingDrivers}
          className="text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-30 transition-colors"
          title="Refresh drivers"
        >
          <RefreshCw className={cn('w-3 h-3', loadingDrivers && 'animate-spin')} />
        </button>
      </div>
      {KNOWN_DRIVERS.map((d) => {
        const info = drivers[d.name]
        const installed = !!info?.installed
        const installing = installingDriver === d.name
        return (
          <div key={d.name} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              {installed ? (
                <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0" />
              )}
              <span className="text-[11px] font-medium text-foreground/80 truncate">{d.label}</span>
              <span className="text-[11px] text-muted-foreground/50 shrink-0">{d.platform}</span>
              {info?.version && (
                <span className="text-[11px] text-muted-foreground/40 shrink-0">v{info.version}</span>
              )}
            </div>
            {!installed && (
              <Button
                size="sm"
                variant="outline"
                className="h-5 text-[10px] px-1.5 gap-0.5 shrink-0"
                disabled={installing || installingDriver !== null}
                onClick={() => onInstall(d.name)}
              >
                <Download className="w-2.5 h-2.5" />
                {installing ? '…' : 'Install'}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface Link {
  label: string
  url: string
}

function Code({ children }: { children: string }) {
  return (
    <code className="block bg-muted/50 rounded px-2 py-1.5 font-mono text-[11px] text-foreground/90 select-text whitespace-pre-wrap">
      {children}
    </code>
  )
}

function GuideSection({
  title,
  ok,
  children,
  links,
}: {
  title: string
  ok?: boolean
  children: React.ReactNode
  links?: Link[]
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        {ok === undefined ? null : ok ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
        )}
        <h3 className="text-sm font-semibold">{title}</h3>
        {ok !== undefined && (
          <span className={ok ? 'text-[11px] text-green-500' : 'text-[11px] text-yellow-500'}>
            {ok ? 'detected' : 'missing'}
          </span>
        )}
      </div>
      <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">{children}</div>
      {links && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              {l.label}
              <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

export function AppiumGuideDialog({
  open,
  onOpenChange,
  env,
  drivers,
  loadingDrivers,
  installingDriver,
  onInstall,
  onRefreshDrivers,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Mobile automation setup</DialogTitle>
          <DialogDescription>
            Install the tooling below, then restart the IDE so the updated PATH is picked up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <GuideSection
            title="1. Appium server"
            ok={env?.appiumInstalled}
            links={[{ label: 'Appium docs', url: 'https://appium.io/docs/en/latest/quickstart/install/' }]}
          >
            <p>Requires Node.js 18+. Install the Appium CLI globally:</p>
            <Code>npm install -g appium</Code>
            {env?.appiumPath && <p className="text-[11px]">Found at {env.appiumPath}</p>}
          </GuideSection>

          <GuideSection
            title="2. Drivers"
            links={[
              { label: 'UiAutomator2', url: 'https://github.com/appium/appium-uiautomator2-driver' },
              { label: 'XCUITest', url: 'https://github.com/appium/appium-xcuitest-driver' },
            ]}
          >
            <p>Install the platform driver below, or via CLI:</p>
            <Code>{'appium driver install uiautomator2\nappium driver install xcuitest'}</Code>
            <DriverList
              drivers={drivers}
              loadingDrivers={loadingDrivers}
              installingDriver={installingDriver}
              onInstall={onInstall}
              onRefreshDrivers={onRefreshDrivers}
            />
          </GuideSection>

          <GuideSection
            title="3. Android SDK + emulator"
            ok={env?.androidSdk}
            links={[
              { label: 'Android Studio', url: 'https://developer.android.com/studio' },
              { label: 'Command-line tools', url: 'https://developer.android.com/tools/releases/cmdline-tools' },
            ]}
          >
            <p>
              Install Android Studio (or the command-line tools), then add an emulator from the
              Device Manager. Ensure <span className="font-mono">adb</span> is on your PATH:
            </p>
            <Code>{'export ANDROID_HOME="$HOME/Library/Android/sdk"\nexport PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"'}</Code>
            <p>Start an emulator before connecting:</p>
            <Code>{'emulator -list-avds\nemulator -avd <name>'}</Code>
          </GuideSection>

          <GuideSection
            title="4. iOS simulator (macOS only)"
            ok={env?.xcode}
            links={[{ label: 'Xcode', url: 'https://developer.apple.com/xcode/' }]}
          >
            <p>Install Xcode + command-line tools, then boot a simulator:</p>
            <Code>{'xcode-select --install\nxcrun simctl list devices\nopen -a Simulator'}</Code>
          </GuideSection>
        </div>
      </DialogContent>
    </Dialog>
  )
}
