import { useCallback, useEffect, useRef, useState } from "react";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { IpcChannels } from "@jkauto/core";
import { invoke } from "@/lib/utils";
import { useHistory } from "@/hooks/useHistory";
import { useProjectStore } from "@/store/project.store";
import type { TestCase } from "../types";

// Loads/saves a test case file (JSON or YAML) and exposes undo/redo history + dirty tracking.
export function useTestCaseFile(filePath: string) {
  const { markTabDirty } = useProjectStore();
  const tcHistory = useHistory<TestCase>();
  const tc = tcHistory.state;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // keep ref for save callback (avoids stale closure in keydown)
  const tcRef = useRef<TestCase | null>(null);
  tcRef.current = tc;

  const isYaml = filePath.endsWith(".yaml") || filePath.endsWith(".yml");

  const load = useCallback(async () => {
    try {
      setError("");
      const raw = await invoke<string>(IpcChannels.FS_READ_FILE, filePath);
      const parsed = (isYaml ? yamlParse(raw) : JSON.parse(raw)) as TestCase;
      tcHistory.setInitial(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [filePath, isYaml, tcHistory.setInitial]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = useCallback(
    (fn: (prev: TestCase) => TestCase) => {
      tcHistory.update(fn);
      markTabDirty(filePath, true);
    },
    [tcHistory.update, markTabDirty, filePath],
  );

  const serialize = useCallback(
    (current: TestCase) =>
      isYaml ? yamlStringify(current) : JSON.stringify(current, null, 2),
    [isYaml],
  );

  const save = useCallback(async () => {
    const current = tcRef.current;
    if (!current) return;
    setSaving(true);
    try {
      await invoke(IpcChannels.FS_WRITE_FILE, filePath, serialize(current));
      markTabDirty(filePath, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [filePath, markTabDirty, serialize]);

  return { tc, tcRef, tcHistory, error, saving, mutate, save, serialize };
}
