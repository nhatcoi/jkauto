import { useCallback, useEffect } from "react";
import { IpcChannels } from "@jkauto/core";
import type { RunRecord, StepResult } from "@jkauto/core";
import { invoke } from "@/lib/utils";
import { useProjectStore } from "@/store/project.store";
import { useRunStore } from "@/store/run.store";
import { readProfile } from "@/features/env/api";
import type { TestCase } from "../types";

interface Options {
  filePath: string;
  tcRef: React.MutableRefObject<TestCase | null>;
  serialize: (tc: TestCase) => string;
}

// Wires run/stop/debug controls + subscribes to engine IPC events for one test case file.
export function useTestCaseRun({ filePath, tcRef, serialize }: Options) {
  const { markTabDirty, activeProject } = useProjectStore();
  const {
    startRun,
    handleStepEvent,
    handleRunComplete,
    stopRun,
    status: runStatus,
    stepStatuses,
    stepMessages,
    runId,
    setRunHistory,
    appendRunRecord,
    isDebugMode,
    isDebugPaused,
  } = useRunStore();

  // Load run history whenever the file changes
  useEffect(() => {
    invoke<RunRecord[]>(IpcChannels.ENGINE_GET_RUNS, filePath)
      .then((records) => setRunHistory(records ?? []))
      .catch(() => setRunHistory([]));
  }, [filePath, setRunHistory]);

  // Subscribe to engine events
  useEffect(() => {
    const offStep = window.api.on(
      IpcChannels.ENGINE_STEP_EVENT,
      (event: any) => {
        handleStepEvent(event);
      },
    );
    // ENGINE_DEBUG_NEXT from main signals engine is paused — store already tracks via handleStepEvent
    // We just need to unsub on cleanup; the actual pause state is managed in run.store
    const offDebugNext = window.api.on(IpcChannels.ENGINE_DEBUG_NEXT, () => {});
    const offComplete = window.api.on(
      IpcChannels.ENGINE_RUN_COMPLETE,
      (event: any) => {
        handleRunComplete(event);
        const { stepStatuses, stepMessages, stepDurations, stepScreenshots } = useRunStore.getState();
        const stepResults: StepResult[] = Object.entries(stepStatuses)
          .map(([idx, status]) => {
            const i = Number(idx);
            const s = status === 'idle' || status === 'running' ? 'skipped' : status;
            return {
              stepIndex: i,
              status: s as StepResult['status'],
              message: stepMessages[i],
              durationMs: stepDurations[i],
              screenshotPath: stepScreenshots[i],
            };
          })
          .sort((a, b) => a.stepIndex - b.stepIndex);
        const record: RunRecord = {
          runId: event.runId,
          filePath,
          status: event.status,
          totalSteps: event.totalSteps,
          passedSteps: event.passedSteps,
          failedSteps: event.failedSteps,
          durationMs: event.durationMs,
          startedAt: new Date(Date.now() - event.durationMs).toISOString(),
          endedAt: new Date().toISOString(),
          stepResults,
        };
        appendRunRecord(record);
        invoke(IpcChannels.ENGINE_SAVE_RUN, filePath, record).catch(
          console.error,
        );
      },
    );
    return () => {
      offStep();
      offDebugNext();
      offComplete();
    };
  }, [filePath, handleStepEvent, handleRunComplete, appendRunRecord]);

  const handleRun = useCallback(
    async (debugMode = false) => {
      if (runStatus === "running") return;
      const current = tcRef.current;
      if (current) {
        await invoke(IpcChannels.FS_WRITE_FILE, filePath, serialize(current));
        markTabDirty(filePath, false);
      }
      let profileVariables: Record<string, string> = {};
      let profileApi = undefined;
      let profilePath: string | undefined;
      if (activeProject) {
        profilePath = `${activeProject.path}/profiles/${activeProject.activeProfile ?? 'default'}.env.json`;
        try {
          const profile = await readProfile(profilePath);
          profileVariables = profile.variables;
          profileApi = profile.api;
        } catch {
          /* profile missing — ignore */
        }
      }
      const result = await invoke<{ runId: string }>(
        IpcChannels.ENGINE_RUN_CASE,
        {
          filePath,
          debugMode,
          profileVariables,
          profileApi,
          profilePath,
          projectPath: activeProject?.path,
        },
      );
      startRun(result.runId, filePath, debugMode);
    },
    [filePath, runStatus, markTabDirty, startRun, activeProject, serialize, tcRef],
  );

  const handleStop = useCallback(async () => {
    if (!runId) return;
    await invoke(IpcChannels.ENGINE_STOP, runId);
    stopRun();
  }, [runId, stopRun]);

  const handleDebugNext = useCallback(async () => {
    if (!runId) return;
    await invoke(IpcChannels.ENGINE_DEBUG_NEXT, runId);
  }, [runId]);

  return {
    runStatus,
    stepStatuses,
    stepMessages,
    isDebugMode,
    isDebugPaused,
    handleRun,
    handleStop,
    handleDebugNext,
  };
}
