import { useEffect, useState } from "react";

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
  stepIdx: number;
}

// Right-click context menu position/visibility for a step row, with outside-click close.
export function useStepContextMenu(setSelectedIdx: (idx: number) => void) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setSelectedIdx(index);

    const menuWidth = 220;
    const menuHeight = 280;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > screenWidth) posX = screenWidth - menuWidth - 8;
    if (posY + menuHeight > screenHeight) posY = screenHeight - menuHeight - 8;

    setContextMenu({
      x: posX,
      y: posY,
      visible: true,
      stepIdx: index,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Close context menu on window mousedown
  useEffect(() => {
    if (!contextMenu || !contextMenu.visible) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#step-context-menu")) {
        closeContextMenu();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [contextMenu]);

  return { contextMenu, handleContextMenu, closeContextMenu };
}
