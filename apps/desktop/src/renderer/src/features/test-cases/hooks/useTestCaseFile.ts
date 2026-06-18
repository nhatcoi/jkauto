import { useCallback, useEffect, useRef, useState } from "react";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { IpcChannels } from "@jkauto/core";
import { invoke } from "@/lib/utils";
import { useHistory } from "@/hooks/useHistory";
import { useProjectStore } from "@/store/project.store";
import type { TestCase, TestStep } from "../types";

function defaultRunner(platform?: TestCase["platform"]): TestCase["runner"] {
  if (platform === "mobile") return "maestro";
  if (platform === "api") return "api";
  if (platform === "appium") return "appium";
  return "playwright";
}

export function normalizeTestCase(input: Partial<TestCase> | null | undefined): TestCase {
  const now = new Date().toISOString();
  const source = input ?? {};
  const platform = source.platform;
  return {
    schemaVersion: source.schemaVersion ?? 1,
    id: source.id ?? crypto.randomUUID(),
    name: source.name ?? "Unnamed",
    description: source.description ?? "",
    owner: source.owner ?? "",
    tags: source.tags ?? [],
    platform,
    runner: source.runner ?? defaultRunner(platform),
    app: {
      id: source.app?.id ?? "",
      env: source.app?.env ?? "",
      path: source.app?.path ?? "",
    },
    config: {
      timeoutMs: source.config?.timeoutMs ?? null,
      retry: source.config?.retry ?? 0,
      stepDelayMs: source.config?.stepDelayMs ?? source.stepDelayMs ?? null,
    },
    variables: source.variables ?? {},
    stepDelayMs: source.stepDelayMs ?? source.config?.stepDelayMs ?? null,
    steps: (source.steps ?? []).map((step) => normalizeStep(step)),
    createdAt: source.createdAt ?? now,
    updatedAt: source.updatedAt ?? now,
  };
}

function normalizeStep(input: Partial<TestStep>): TestStep {
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name ?? "",
    keyword: input.keyword ?? "",
    description: input.description ?? "",
    objectRef: input.objectRef ?? "",
    input: input.input ?? "",
    expected: input.expected ?? "",
    enabled: input.enabled ?? true,
    continueOnFailure: input.continueOnFailure ?? false,
    timeout: input.timeout ?? null,
  };
}

function compactStep(step: TestStep): Record<string, unknown> {
  const out: Record<string, unknown> = { id: step.id, keyword: step.keyword }
  if (step.name) out.name = step.name
  if (step.description) out.description = step.description
  if (step.objectRef) out.objectRef = step.objectRef
  if (step.input) out.input = step.input
  if (step.expected) out.expected = step.expected
  if (!step.enabled) out.enabled = false
  if (step.continueOnFailure) out.continueOnFailure = true
  if (step.timeout != null) out.timeout = step.timeout
  return out
}

export function compactTestCase(tc: TestCase): Record<string, unknown> {
  const out: Record<string, unknown> = {
    schemaVersion: tc.schemaVersion,
    id: tc.id,
    name: tc.name,
  }
  if (tc.description) out.description = tc.description
  if (tc.owner) out.owner = tc.owner
  if (tc.tags?.length) out.tags = tc.tags
  if (tc.platform) out.platform = tc.platform
  if (tc.runner) out.runner = tc.runner
  const app = tc.app
  if (app?.id || app?.env || app?.path) out.app = app
  const cfg = tc.config
  if (cfg?.timeoutMs != null || cfg?.retry || cfg?.stepDelayMs != null) out.config = cfg
  if (tc.variables && Object.keys(tc.variables).length) out.variables = tc.variables
  out.steps = tc.steps.map(compactStep)
  return out
}

// Loads/saves a test case file and exposes undo/redo history + dirty tracking.
export function useTestCaseFile(filePath: string) {
  const { markTabDirty } = useProjectStore();
  const reloadKey = useProjectStore((s) => s.tabReloadKeys[filePath] ?? 0);
  const tcHistory = useHistory<TestCase>();
  const tc = tcHistory.state;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // keep ref for save callback (avoids stale closure in keydown)
  const tcRef = useRef<TestCase | null>(null);
  tcRef.current = tc;

  const load = useCallback(async () => {
    try {
      setError("");
      const raw = await invoke<string>(IpcChannels.FS_READ_FILE, filePath);
      const parsed = yamlParse(raw) as Partial<TestCase>;
      tcHistory.setInitial(normalizeTestCase(parsed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [filePath, tcHistory.setInitial]);

  // reloadKey incremented by triggerTabReload (e.g. after agent applies steps)
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const mutate = useCallback(
    (fn: (prev: TestCase) => TestCase) => {
      tcHistory.update(fn);
      markTabDirty(filePath, true);
    },
    [tcHistory.update, markTabDirty, filePath],
  );

  const serialize = useCallback(
    (current: TestCase) => yamlStringify(compactTestCase(current)),
    [],
  );

  const save = useCallback(async () => {
    const current = tcRef.current;
    if (!current) return;
    setSaving(true);
    try {
      const withTimestamp = { ...current, updatedAt: new Date().toISOString() };
      await invoke(IpcChannels.FS_WRITE_FILE, filePath, serialize(withTimestamp));
      markTabDirty(filePath, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [filePath, markTabDirty, serialize]);

  const saveRaw = useCallback(
    async (raw: string) => {
      setSaving(true);
      try {
        await invoke(IpcChannels.FS_WRITE_FILE, filePath, raw);
        markTabDirty(filePath, false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [filePath, markTabDirty],
  );

  return { tc, tcRef, tcHistory, error, saving, mutate, save, saveRaw, serialize };
}
