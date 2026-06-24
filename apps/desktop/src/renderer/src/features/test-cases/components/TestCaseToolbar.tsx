import {
  Plus,
  ChevronUp,
  ChevronDown,
  Save,
  Play,
  Bug,
  CircleCheck,
  CircleX,
  Circle,
  Loader2,
  Square,
  Upload,
  StepForward,
  Undo2,
  Redo2,
  Globe,
  History,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import type { Platform } from "@jkauto/core";
import type { TestCase } from "../types";

export type TestCaseViewMode = "table" | "yaml";

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "desktop", label: "Desktop" },
  { value: "api", label: "API" },
];

const MOBILE_RUNNER_OPTIONS: { value: "maestro" | "appium"; label: string }[] = [
  { value: "maestro", label: "Maestro" },
  { value: "appium", label: "Appium" },
];
const VIEW_OPTIONS: Array<{ value: TestCaseViewMode; label: string }> = [
  { value: "table", label: "Table" },
  { value: "yaml", label: "YAML" },
];

function defaultRunner(platform?: Platform): NonNullable<TestCase["runner"]> {
  if (platform === "mobile") return "maestro";
  if (platform === "api") return "api";
  if (platform === "appium") return "appium";
  return "playwright";
}

function RunStatusBadge({ runStatus }: { runStatus: string }) {
  const map: Record<
    string,
    { icon: React.ElementType; label: string; cls: string }
  > = {
    idle: { icon: Circle, label: "Never run", cls: "text-muted-foreground/50" },
    running: { icon: Loader2, label: "Running…", cls: "text-yellow-400" },
    passed: { icon: CircleCheck, label: "Passed", cls: "text-green-500" },
    failed: { icon: CircleX, label: "Failed", cls: "text-red-500" },
    stopped: { icon: Square, label: "Stopped", cls: "text-muted-foreground" },
  };
  const { icon: Icon, label, cls } = map[runStatus] ?? map.idle;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", cls)}>
      <Icon className={cn("w-3.5 h-3.5", runStatus === "running" && "animate-spin")} />
      {label}
    </span>
  );
}

interface Props {
  tc: TestCase;
  platform?: Platform | string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedIdx: number | null;
  stepsLength: number;
  onAddStep: () => void;
  onShowImport: () => void;
  onMoveStep: (idx: number, dir: -1 | 1) => void;
  onMutate: (fn: (prev: TestCase) => TestCase) => void;
  runStatus: string;
  viewMode: TestCaseViewMode;
  onViewModeChange: (mode: TestCaseViewMode) => void;
  isDebugMode: boolean;
  isDebugPaused: boolean;
  onRun: () => void;
  onDebug: () => void;
  onStop: () => void;
  onDebugNext: () => void;
  onSave: () => void;
  saving: boolean;
  saveHint: string;
  onOpenApiConfig?: () => void;
  onShowHistory: () => void;
  onOpenConfig: () => void;
  configBadge?: string;
}

export function TestCaseToolbar({
  tc,
  platform,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedIdx,
  stepsLength,
  onAddStep,
  onShowImport,
  onMoveStep,
  onMutate,
  runStatus,
  viewMode,
  onViewModeChange,
  isDebugMode,
  isDebugPaused,
  onRun,
  onDebug,
  onStop,
  onDebugNext,
  onSave,
  saving,
  saveHint,
  onOpenApiConfig,
  onShowHistory,
  onOpenConfig,
  configBadge,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 gap-y-1.5 px-2 py-1 border-b border-border bg-panel shrink-0">
      {/* edit actions */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onAddStep}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Step
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Add Step<Kbd>Alt+A</Kbd>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onShowImport}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Steps
          </button>
        </TooltipTrigger>
        <TooltipContent>Import steps from file</TooltipContent>
      </Tooltip>

      <div className="w-px h-4 bg-border mx-0.5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Undo<Kbd>⌘+Z</Kbd></TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Redo<Kbd>⌘+⇧+Z</Kbd></TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onShowHistory}
            className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <History className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>File History</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpenConfig}
            className="relative p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <Database className="w-3.5 h-3.5" />
            {configBadge && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground font-bold px-0.5 leading-none">
                {configBadge}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>Variables &amp; Data File</TooltipContent>
      </Tooltip>

      <div className="w-px h-4 bg-border mx-0.5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={selectedIdx === null || selectedIdx === 0}
            onClick={() => selectedIdx !== null && onMoveStep(selectedIdx, -1)}
            className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Move Up<Kbd>Alt+↑</Kbd>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={selectedIdx === null || selectedIdx === stepsLength - 1}
            onClick={() => selectedIdx !== null && onMoveStep(selectedIdx, 1)}
            className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Move Down<Kbd>Alt+↓</Kbd>
        </TooltipContent>
      </Tooltip>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* platform picker */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          Platform:
        </span>
        <Select
          value={tc.platform ?? "web"}
          onValueChange={(value) => {
            const p = value as Platform;
            onMutate((prev) => ({
              ...prev,
              platform: p,
              runner: defaultRunner(p),
            }));
          }}
        >
          <SelectTrigger className="h-6 w-[92px] px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PLATFORM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground/70 shrink-0">Runner:</span>
        {tc.platform === "mobile" ? (
          <Select
            value={tc.runner === "appium" ? "appium" : "maestro"}
            onValueChange={(value) =>
              onMutate((prev) => ({ ...prev, runner: value as "maestro" | "appium" }))
            }
          >
            <SelectTrigger className="h-6 w-[96px] px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {MOBILE_RUNNER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[11px] px-2 py-0.5 rounded bg-secondary text-foreground/70 font-mono">
            {tc.runner ?? "playwright"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground/70 shrink-0">View:</span>
        <Select value={viewMode} onValueChange={(value) => onViewModeChange(value as TestCaseViewMode)}>
          <SelectTrigger className="h-6 w-[80px] px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {VIEW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* step delay override */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          Delay:
        </span>
        <input
          type="number"
          min={0}
          step={100}
          value={tc.stepDelayMs ?? ""}
          placeholder="ms"
          onChange={(e) =>
            onMutate((prev) => ({
              ...prev,
              stepDelayMs: e.target.value
                ? Math.max(0, parseInt(e.target.value, 10))
                : null,
            }))
          }
          className="text-xs bg-input text-foreground px-1.5 py-0.5 rounded border border-border focus:border-primary outline-none w-20"
        />
      </div>

      {platform === 'api' && onOpenApiConfig && (
        <>
          <div className="w-px h-4 bg-border mx-0.5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onOpenApiConfig}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80"
              >
                <Globe className="w-3.5 h-3.5" />
                URL Config
              </button>
            </TooltipTrigger>
            <TooltipContent>Configure base URL &amp; auth for active profile</TooltipContent>
          </Tooltip>
        </>
      )}

      <div className="flex-1" />

      {/* run status + run controls */}
      <RunStatusBadge runStatus={runStatus} />

      <div className="w-px h-4 bg-border mx-0.5" />

      {runStatus === "running" ? (
        <>
          {isDebugMode && isDebugPaused && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onDebugNext}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-blue-600 hover:bg-blue-500 text-white"
                >
                  <StepForward className="w-3.5 h-3.5" />
                  Next Step
                </button>
              </TooltipTrigger>
              <TooltipContent>Execute next step</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-red-600 hover:bg-red-500 text-white"
              >
                <Square className="w-3 h-3 fill-white" />
                Stop
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Stop run<Kbd>Shift+F5</Kbd>
            </TooltipContent>
          </Tooltip>
        </>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRun}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-medium transition-colors bg-[hsl(142,72%,29%)] hover:bg-[hsl(142,72%,34%)] text-white"
            >
              <Play className="w-3 h-3 fill-white" />
              Run
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Run test case<Kbd>F5</Kbd>
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={runStatus === "running"}
            onClick={onDebug}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
              "bg-secondary hover:bg-secondary/80 text-foreground/80",
              "disabled:opacity-40",
            )}
          >
            <Bug className="w-3.5 h-3.5" />
            Debug
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Debug — 1 s pause between steps<Kbd>F6</Kbd>
        </TooltipContent>
      </Tooltip>

      <div className="w-px h-4 bg-border mx-0.5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-secondary transition-colors text-foreground/80 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Save<Kbd>{saveHint}</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
