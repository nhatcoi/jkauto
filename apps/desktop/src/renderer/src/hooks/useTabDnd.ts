import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

/**
 * Native HTML5 drag-and-drop reorder for tab strips (VSCode/Zed style).
 * Returns prop getters to spread onto each tab element and the index
 * currently being hovered as a drop target (for visual feedback).
 */
export function useTabDnd(onReorder: (from: number, to: number) => void) {
  const dragIndex = useRef<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const getTabProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      dragIndex.current = index
      e.dataTransfer.effectAllowed = 'move'
      // Firefox requires data to be set for drag to start
      e.dataTransfer.setData('text/plain', String(index))
    },
    onDragOver: (e: DragEvent) => {
      if (dragIndex.current === null) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (overIndex !== index) setOverIndex(index)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const from = dragIndex.current
      if (from !== null && from !== index) onReorder(from, index)
      dragIndex.current = null
      setOverIndex(null)
    },
    onDragEnd: () => {
      dragIndex.current = null
      setOverIndex(null)
    },
  })

  return { getTabProps, overIndex }
}

/** Pure helper: move item from `from` index to `to` index, returning new array. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
