import { useMemo, useState } from 'react'
import { parse as parseYaml } from 'yaml'
import * as prettier from 'prettier/standalone'
import * as prettierYaml from 'prettier/plugins/yaml'
import { CodeEditor } from '@/components/CodeEditor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { KeywordMeta } from '@jkauto/core'
import type { ObjectEntry } from '../hooks/useObjectItems'
import { buildYamlCompletion } from '../utils/yamlCompletion'

const SAMPLE = `schemaVersion: 1
id: login_mobile
name: Login Mobile
description: Verify user can login successfully
owner: qa-team
tags:
  - smoke
  - auth
platform: mobile
runner: maestro
app:
  id: com.example.app
  env: staging
config:
  timeoutMs: 30000
  retry: 1
  stepDelayMs: 300
variables:
  email: user@example.com
steps:
  - id: launch
    name: Launch app
    keyword: launchApp
  - id: tap_email
    name: Tap email field
    keyword: tapOn
    objectRef: Email
  - id: type_email
    name: Enter email
    keyword: inputText
    input: "{{email}}"
  - id: submit
    name: Submit login
    keyword: tapOn
    objectRef: Login
  - id: welcome
    name: Assert welcome
    keyword: assertVisible
    objectRef: Welcome`

interface Props {
  value: string
  onChange: (value: string) => void
  keywords?: KeywordMeta[]
  objectItems?: ObjectEntry[]
}

type ValidationState = { ok: true } | { ok: false; msg: string } | null

export function YamlTestcaseEditor({ value, onChange, keywords = [], objectItems = [] }: Props) {
  const [validation, setValidation] = useState<ValidationState>(null)
  const [copied, setCopied] = useState(false)
  const [formatting, setFormatting] = useState(false)

  const completionSource = useMemo(
    () => buildYamlCompletion(keywords, objectItems),
    [keywords, objectItems],
  )

  async function handleFormat() {
    setFormatting(true)
    try {
      const formatted = await prettier.format(value, {
        parser: 'yaml',
        plugins: [prettierYaml],
      })
      onChange(formatted)
      setValidation({ ok: true })
    } catch (e) {
      setValidation({ ok: false, msg: (e as Error).message })
    } finally {
      setFormatting(false)
    }
  }

  function handleValidate() {
    try {
      parseYaml(value)
      setValidation({ ok: true })
    } catch (e) {
      setValidation({ ok: false, msg: (e as Error).message })
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border/40 shrink-0">
        <span className="text-[10px] text-muted-foreground font-mono mr-2 select-none">TEST YAML</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={handleFormat}
          disabled={formatting}
        >
          {formatting ? 'Formatting…' : 'Format'}
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={handleValidate}>
          Validate
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => { onChange(SAMPLE); setValidation(null) }}
        >
          Insert sample
        </Button>
      </div>

      {validation && (
        <div
          className={cn(
            'px-3 py-1 text-[11px] font-mono shrink-0 border-b border-border/40',
            validation.ok ? 'text-green-500' : 'text-destructive'
          )}
        >
          {validation.ok ? '✓ Valid YAML' : `✗ ${validation.msg}`}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <CodeEditor
          language="yaml"
          value={value}
          onChange={onChange}
          placeholder={SAMPLE}
          completionSource={completionSource}
        />
      </div>
    </div>
  )
}
