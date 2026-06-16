import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useSettingsKeymap } from "@/hooks/useSettingsKeymap";
import { TEST_CASE_KEYMAPS, KEYMAP_SCOPES } from "@/shared/keymaps";
import { useProjectStore } from "@/store/project.store";
import { useKeywords } from "./hooks/useKeywords";
import { useObjectItems } from "./hooks/useObjectItems";
import { useTestCaseFile } from "./hooks/useTestCaseFile";
import { useTestCaseRun } from "./hooks/useTestCaseRun";
import { useStepEditor } from "./hooks/useStepEditor";
import { useStepDragDrop } from "./hooks/useStepDragDrop";
import { useStepContextMenu } from "./hooks/useStepContextMenu";
import { ImportStepsDialog } from "./components/ImportStepsDialog";
import { CallTestCaseDialog } from "./components/CallTestCaseDialog";
import { StepContextMenu } from "./components/StepContextMenu";
import { EngineInstallBanner } from "@/components/engine-install/EngineInstallBanner";
import { TestCaseToolbar } from "./components/TestCaseToolbar";
import { MobileYamlEditor } from "./components/MobileYamlEditor";
import { StepTable } from "./components/StepTable";

export function TestCaseEditor({ filePath }: { filePath: string }) {
  const { markTabDirty, activeProject } = useProjectStore();

  const { tc, tcRef, tcHistory, error, saving, mutate, save, serialize } =
    useTestCaseFile(filePath);

  const platform = tc?.platform ?? activeProject?.project.type;
  // For keyword filtering: normal/yaml mode shows 'mobile' DSL keywords; appium shows 'appium' keywords.
  const effectivePlatform =
    platform === "mobile"
      ? tc?.mobileTestType === "appium"
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
  }, [filePath, setSelectedIdx]);

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

  const km = useSettingsKeymap(TEST_CASE_KEYMAPS, KEYMAP_SCOPES.TEST_CASE, {
    save,
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

  const isYamlMode = platform === "mobile" && (tc.mobileTestType ?? "normal") === "yaml";

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
        isDebugMode={isDebugMode}
        isDebugPaused={isDebugPaused}
        onRun={() => handleRun(false)}
        onDebug={() => handleRun(true)}
        onStop={handleStop}
        onDebugNext={handleDebugNext}
        onSave={save}
        saving={saving}
        saveHint={km.save.hint}
      />

      {/* engine install banner — mobile only, auto-hides when installed */}
      {platform === "mobile" && (
        <EngineInstallBanner
          engine={tc.mobileTestType === "appium" ? "appium" : "maestro"}
          className="mx-3 my-1.5 shrink-0"
        />
      )}

      {isYamlMode ? (
        <MobileYamlEditor
          value={tc.mobileYaml ?? ""}
          onChange={(value) => mutate((prev) => ({ ...prev, mobileYaml: value }))}
        />
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
