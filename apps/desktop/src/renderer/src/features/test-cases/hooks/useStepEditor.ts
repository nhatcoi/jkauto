import { useState } from "react";
import type { TestCase, TestStep } from "../types";

export function makeStep(keyword = "click"): TestStep {
  return {
    id: crypto.randomUUID(),
    keyword,
    description: "",
    objectRef: "",
    input: "",
    expected: "",
    enabled: true,
    continueOnFailure: false,
    timeout: null,
  };
}

interface Options {
  tc: TestCase | null;
  mutate: (fn: (prev: TestCase) => TestCase) => void;
}

// Step CRUD: add/update/delete/move/duplicate/insert/copy/cut/paste/import/call-test-case.
export function useStepEditor({ tc, mutate }: Options) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<Partial<TestStep> | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callDialogTargetIdx, setCallDialogTargetIdx] = useState<number | null>(
    null,
  );

  const updateStep = (idx: number, patch: Partial<TestStep>) => {
    mutate((tc) => ({
      ...tc,
      steps: tc.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const addStep = () => {
    mutate((tc) => ({
      ...tc,
      steps: [...tc.steps, makeStep()],
    }));
    setSelectedIdx(tc?.steps.length ?? 0);
  };

  const deleteStep = (idx: number) => {
    mutate((tc) => ({ ...tc, steps: tc.steps.filter((_, i) => i !== idx) }));
    setSelectedIdx(null);
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    mutate((tc) => {
      if (target < 0 || target >= tc.steps.length) return tc;
      const steps = [...tc.steps];
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...tc, steps };
    });
    setSelectedIdx(target);
  };

  const handleImport = (importedSteps: any[]) => {
    mutate((tc) => ({
      ...tc,
      steps: [...tc.steps, ...importedSteps],
    }));
  };

  const duplicateStep = (idx: number) => {
    if (!tc) return;
    const src = tc.steps[idx];
    mutate((prev) => {
      const steps = [...prev.steps];
      steps.splice(idx + 1, 0, { ...src, id: crypto.randomUUID() });
      return { ...prev, steps };
    });
    setSelectedIdx(idx + 1);
  };

  const insertStepBefore = (idx: number) => {
    mutate((tc) => {
      const steps = [...tc.steps];
      steps.splice(idx, 0, makeStep());
      return { ...tc, steps };
    });
    setSelectedIdx(idx);
  };

  const insertStepAfter = (idx: number) => {
    mutate((tc) => {
      const steps = [...tc.steps];
      steps.splice(idx + 1, 0, makeStep());
      return { ...tc, steps };
    });
    setSelectedIdx(idx + 1);
  };

  const copyStep = (idx: number) => {
    if (!tc) return;
    const stepToCopy = tc.steps[idx];
    setClipboard({ ...stepToCopy, id: undefined });
  };

  const cutStep = (idx: number) => {
    if (!tc) return;
    const stepToCut = tc.steps[idx];
    setClipboard({ ...stepToCut, id: undefined });
    deleteStep(idx);
  };

  const pasteStepBefore = (idx: number) => {
    if (!clipboard) return;
    mutate((tc) => {
      const steps = [...tc.steps];
      steps.splice(idx, 0, {
        ...makeStep(clipboard.keyword),
        ...clipboard,
        id: crypto.randomUUID(),
      });
      return { ...tc, steps };
    });
    setSelectedIdx(idx);
  };

  const pasteStepAfter = (idx: number) => {
    if (!clipboard) return;
    mutate((tc) => {
      const steps = [...tc.steps];
      steps.splice(idx + 1, 0, {
        ...makeStep(clipboard.keyword),
        ...clipboard,
        id: crypto.randomUUID(),
      });
      return { ...tc, steps };
    });
    setSelectedIdx(idx + 1);
  };

  const toggleFailureHandling = (idx: number) => {
    if (!tc) return;
    updateStep(idx, { continueOnFailure: !tc.steps[idx].continueOnFailure });
  };

  const openCallDialog = (idx: number) => {
    setCallDialogTargetIdx(idx);
    setShowCallDialog(true);
  };

  const handleCallTestCaseSelect = (path: string, name: string) => {
    const targetIdx = callDialogTargetIdx;
    mutate((tc) => {
      const steps = [...tc.steps];
      const newStep = {
        ...makeStep("call-test-case"),
        description: `Call: ${name}`,
        input: path,
      };
      steps.splice(
        targetIdx !== null ? targetIdx + 1 : steps.length,
        0,
        newStep,
      );
      return { ...tc, steps };
    });
    setSelectedIdx(
      targetIdx !== null ? targetIdx + 1 : (tc?.steps.length ?? 0),
    );
    setCallDialogTargetIdx(null);
  };

  return {
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
  };
}
