import { useReducer, useCallback } from 'react'

const LIMIT = 50

interface State<T> {
  past: T[]
  present: T | null
  future: T[]
}

type Action<T> =
  | { type: 'SET_INITIAL'; value: T }
  | { type: 'UPDATE'; fn: (prev: T) => T }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR' }

function reduce<T>(s: State<T>, a: Action<T>): State<T> {
  switch (a.type) {
    case 'SET_INITIAL':
      return { past: [], present: a.value, future: [] }
    case 'UPDATE': {
      if (s.present === null) return s
      const next = a.fn(s.present)
      return {
        past: [...s.past.slice(-(LIMIT - 1)), s.present],
        present: next,
        future: [],
      }
    }
    case 'UNDO': {
      if (s.past.length === 0) return s
      return {
        past: s.past.slice(0, -1),
        present: s.past[s.past.length - 1],
        future: s.present !== null ? [s.present, ...s.future] : s.future,
      }
    }
    case 'REDO': {
      if (s.future.length === 0) return s
      return {
        past: s.present !== null ? [...s.past, s.present] : s.past,
        present: s.future[0],
        future: s.future.slice(1),
      }
    }
    case 'CLEAR':
      return { past: [], present: s.present, future: [] }
    default:
      return s
  }
}

export interface UseHistoryReturn<T> {
  state: T | null
  setInitial: (value: T) => void
  update: (fn: (prev: T) => T) => void
  undo: () => void
  redo: () => void
  clear: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useHistory<T>(): UseHistoryReturn<T> {
  const [{ past, present, future }, dispatch] = useReducer(
    reduce as (s: State<T>, a: Action<T>) => State<T>,
    { past: [], present: null as unknown as T, future: [] },
  )

  const setInitial = useCallback((value: T) => dispatch({ type: 'SET_INITIAL', value }), [])
  const update = useCallback((fn: (prev: T) => T) => dispatch({ type: 'UPDATE', fn }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), [])

  return {
    state: present,
    setInitial,
    update,
    undo,
    redo,
    clear,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
