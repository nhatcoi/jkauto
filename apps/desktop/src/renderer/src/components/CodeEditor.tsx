import { useEffect, useMemo, useState } from 'react'
import ReactCodeMirror from '@uiw/react-codemirror'
import { autocompletion, type CompletionSource } from '@codemirror/autocomplete'
import { json } from '@codemirror/lang-json'
import { StreamLanguage } from '@codemirror/language'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import { cn } from '@/lib/utils'

function useDarkMode() {
  // App default = dark (:root). Light mode adds .light class — no .dark class used.
  const [dark, setDark] = useState(() => !document.documentElement.classList.contains('light'))
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(!document.documentElement.classList.contains('light'))
    )
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

const LANG_EXTENSIONS = {
  yaml: [StreamLanguage.define(yaml)],
  json: [json()],
}

interface CodeEditorProps {
  language: 'yaml' | 'json'
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  placeholder?: string
  height?: string
  className?: string
  completionSource?: CompletionSource
}

export function CodeEditor({
  language,
  value,
  onChange,
  readOnly,
  placeholder,
  height = '100%',
  className,
  completionSource,
}: CodeEditorProps) {
  const dark = useDarkMode()

  const extensions = useMemo(() => {
    const base = LANG_EXTENSIONS[language]
    if (!completionSource) return base
    return [...base, autocompletion({ override: [completionSource] })]
  }, [language, completionSource])

  return (
    <ReactCodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={dark ? oneDark : 'light'}
      readOnly={readOnly}
      placeholder={placeholder}
      height={height}
      className={cn('h-full text-xs [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto', className)}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        bracketMatching: true,
        autocompletion: false,
      }}
    />
  )
}
