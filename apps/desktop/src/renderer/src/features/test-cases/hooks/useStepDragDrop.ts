import { useState } from "react";
import type { TestCase } from "../types";

interface Options {
  mutate: (fn: (prev: TestCase) => TestCase) => void;
  setSelectedIdx: (idx: number | null) => void;
}

// Drag-to-reorder state + handlers for the step table.
export function useStepDragDrop({ mutate, setSelectedIdx }: Options) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, _index: number) => {
    e.preventDefault();
  };

  const handleDragEnter = (index: number) => {
    setDragOverIdx(index);
  };

  const handleDragLeave = () => {
    // handled on dragEnd / drop
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    mutate((tc) => {
      const steps = [...tc.steps];
      const [draggedItem] = steps.splice(draggedIdx, 1);
      steps.splice(targetIndex, 0, draggedItem);
      return { ...tc, steps };
    });

    setSelectedIdx(targetIndex);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return {
    dragOverIdx,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDragEnd,
    handleDrop,
  };
}
