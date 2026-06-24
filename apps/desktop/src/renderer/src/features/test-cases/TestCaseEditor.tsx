import { useEffect, useState } from "react";
import { parse as yamlParse } from "yaml";
import { AlertCircle } from "lucide-react";
import { useSettingsKeymap } from "@/hooks/useSettingsKeymap";
import { TEST_CASE_KEYMAPS, KEYMAP_SCOPES } from "@/shared/keymaps";
import { useProjectStore } from "@/store/project.store";
import { useKeywords } from "./hooks/useKeywords";
import { useObjectItems } from "./hooks/useObjectItems";
import { normalizeTestCase, useTestCaseFile } from "./hooks/useTestCaseFile";
import { useTestCaseRun } from "./hooks/useTestCaseRun";
import { useStepEditor } from "./hooks/useStepEditor";
import { useStepDragDrop } from "./hooks/useStepDragDrop";
import { useStepContextMenu } from "./hooks/useStepContextMenu";
import { ImportStepsDialog } from "./components/ImportStepsDialog";
import { CallTestCaseDialog } from "./components/CallTestCaseDialog";
import { FileHistoryDialog } from "./components/FileHistoryDialog";
import { ApiTestEditor } from "./components/ApiTestEditor";
import { StepContextMenu } from "./components/StepContextMenu";
import { EngineInstallBanner } from "@/components/engine-install/EngineInstallBanner";
import { TestCaseToolbar, type TestCaseViewMode } from "./components/TestCaseToolbar";
import { YamlTestcaseEditor } from "./components/YamlTestcaseEditor";
import { StepTable } from "./components/StepTable";
import { DataFileBinding } from "./components/DataFileBinding";
import type { TestCase } from "./types";

export function TestCaseEditor({ filePath }: { filePath: string }) {
  const { markTabDirty, activeProject, triggerTabReload } = useProjectStore();
  const [viewMode, setViewMode] = useState<TestCaseViewMode>("table");
  const [yamlDraft, setYamlDraft] = useState("");
  const [yamlError, setYamlError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const { tc, tcRef, tcHistory, error, saving, mutate, save, saveRaw, serialize } =
    useTestCaseFile(filePath);

  const platform = tc?.platform ?? activeProject?.project.type;
  // For keyword filtering: runner decides the concrete engine when platform is mobile.
  const effectivePlatform =
    platform === "mobile"
      ? tc?.runner === "appium"
        ? ("appium" as const)
        : ("mobile" as const)
      : platform;
  const keywords = useKeywords(effectivePlatform);
  const objectItems = useObjectItems(activeProject?.path);

  const {
    runStatus,
    stepStatuses,
    stepMessages,
    isDebugMode,
    isDebugPaused,
    handleRun,
    handleStop,
    handleDebugNext,
  } = useTestCaseRun({ filePath, tcRef, serialize });

  const {
    selectedIdx,
    setSelectedIdx,
    clipboard,
    showImport,
    setShowImport,
    showCallDialog,
    setShowCallDialog,
    updateStep,
    addStep,
    deleteStep,
    moveStep,
    handleImport,
    duplicateStep,
    insertStepBefore,
    insertStepAfter,
    copyStep,
    cutStep,
    pasteStepBefore,
    pasteStepAfter,
    toggleFailureHandling,
    openCallDialog,
    handleCallTestCaseSelect,
  } = useStepEditor({ tc, mutate });

  const dragDrop = useStepDragDrop({ mutate, setSelectedIdx });
  const { contextMenu, handleContextMenu, closeContextMenu } =
    useStepContextMenu(setSelectedIdx);

  // Reset step selection whenever a different file is opened.
  useEffect(() => {
    setSelectedIdx(null);
    setViewMode("table");
    setYamlError("");
  }, [filePath, setSelectedIdx]);

  useEffect(() => {
    if (tc && viewMode === "table") {
      setYamlDraft(serialize(tc));
    }
  }, [tc, serialize, viewMode]);

  // Undo / Redo — skip when focus is inside a text field (let browser handle native undo there)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inEditable =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable;
      if (inEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        tcHistory.undo();
        markTabDirty(filePath, true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        tcHistory.redo();
        markTabDirty(filePath, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tcHistory.undo, tcHistory.redo, filePath, markTabDirty]);

  const handleViewModeChange = (mode: TestCaseViewMode) => {
    if (mode === "yaml" && tc) {
      setYamlDraft(serialize(tc));
      setYamlError("");
    }
    setViewMode(mode);
  };

  const handleYamlChange = (value: string) => {
    setYamlDraft(value);
    try {
      const parsed = normalizeTestCase(yamlParse(value) as Partial<TestCase>);
      setYamlError("");
      mutate(() => parsed);
    } catch (e) {
      setYamlError(e instanceof Error ? e.message : "Invalid YAML");
      markTabDirty(filePath, true);
    }
  };

  const handleSave = () => {
    if (viewMode === "yaml") {
      if (yamlError) return;
      void saveRaw(yamlDraft);
      return;
    }
    void save();
  };

  const km = useSettingsKeymap(TEST_CASE_KEYMAPS, KEYMAP_SCOPES.TEST_CASE, {
    save: handleSave,
    addStep,
    deleteStep: () => {
      if (selectedIdx !== null) deleteStep(selectedIdx);
    },
    moveUp: () => {
      if (selectedIdx !== null) moveStep(selectedIdx, -1);
    },
    moveDown: () => {
      if (selectedIdx !== null) moveStep(selectedIdx, 1);
    },
    duplicateStep: () => {
      if (selectedIdx !== null) duplicateStep(selectedIdx);
    },
    run: () => {
      if (runStatus !== "running") handleRun(false);
    },
    debug: () => {
      if (runStatus !== "running") handleRun(true);
    },
    stop: () => {
      if (runStatus === "running") handleStop();
    },
    toggleHistory: () => {},
  });

  const handleOpenCallDialog = (idx: number) => {
    closeContextMenu();
    openCallDialog(idx);
  };

  // API test cases use a dedicated split-pane editor.
  // This check is placed after all hooks so React's rules are satisfied.
  if (effectivePlatform === "api") {
    return <ApiTestEditor filePath={filePath} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-destructive text-xs">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (!tc) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TestCaseToolbar
        tc={tc}
        platform={platform}
        canUndo={tcHistory.canUndo}
        canRedo={tcHistory.canRedo}
        onUndo={() => { tcHistory.undo(); markTabDirty(filePath, true); }}
        onRedo={() => { tcHistory.redo(); markTabDirty(filePath, true); }}
        selectedIdx={selectedIdx}
        stepsLength={tc.steps.length}
        onAddStep={addStep}
        onShowImport={() => setShowImport(true)}
        onMoveStep={moveStep}
        onMutate={mutate}
        runStatus={runStatus}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        isDebugMode={isDebugMode}
        isDebugPaused={isDebugPaused}
        onRun={() => handleRun(false)}
        onDebug={() => handleRun(true)}
        onStop={handleStop}
        onDebugNext={handleDebugNext}
        onSave={handleSave}
        saving={saving}
        saveHint={km.save.hint}
        onShowHistory={() => setShowHistory(true)}
      />

      {/* engine install banner — mobile only, auto-hides when installed */}
      {platform === "mobile" && (
        <EngineInstallBanner
          engine={tc.runner === "appium" ? "appium" : "maestro"}
          className="mx-3 my-1.5 shrink-0"
        />
      )}

      <DataFileBinding tc={tc} onChange={mutate} />

      {viewMode === "yaml" ? (
        <>
          {yamlError && (
            <div className="px-3 py-1 text-[11px] font-mono text-destructive border-b border-border/40 shrink-0">
              {yamlError}
            </div>
          )}
          <YamlTestcaseEditor
            value={yamlDraft}
            onChange={handleYamlChange}
            keywords={keywords}
            objectItems={objectItems}
          />
        </>
      ) : (
        <StepTable
          steps={tc.steps}
          keywords={keywords}
          platform={platform}
          objectItems={objectItems}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          onChange={updateStep}
          onDelete={deleteStep}
          stepStatuses={stepStatuses}
          stepMessages={stepMessages}
          dragOverIdx={dragDrop.dragOverIdx}
          onDragStart={dragDrop.handleDragStart}
          onDragOver={dragDrop.handleDragOver}
          onDragEnd={dragDrop.handleDragEnd}
          onDrop={dragDrop.handleDrop}
          onDragEnter={dragDrop.handleDragEnter}
          onDragLeave={dragDrop.handleDragLeave}
          onContextMenu={handleContextMenu}
        />
      )}

      <ImportStepsDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImport={handleImport}
      />

      <FileHistoryDialog
        open={showHistory}
        filePath={filePath}
        onClose={() => setShowHistory(false)}
        onRestored={() => triggerTabReload(filePath)}
      />

      {contextMenu && contextMenu.visible && (
        <StepContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clipboard={clipboard}
          stepIdx={contextMenu.stepIdx}
          onInsertBefore={insertStepBefore}
          onInsertAfter={insertStepAfter}
          onCallTestCase={handleOpenCallDialog}
          onCopy={copyStep}
          onCut={cutStep}
          onPasteBefore={pasteStepBefore}
          onPasteAfter={pasteStepAfter}
          onToggleFailure={toggleFailureHandling}
          onDelete={deleteStep}
        />
      )}

      <CallTestCaseDialog
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
        onSelect={handleCallTestCaseSelect}
      />
    </div>
  );
}
