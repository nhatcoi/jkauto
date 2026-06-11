import { parse as parseYaml } from 'yaml'

export interface TestStep {
  id: string
  keyword: string
  description: string
  objectRef: string
  input: string
  expected: string
  enabled: boolean
  continueOnFailure: boolean
  timeout: number | null
}

function parseJsonYaml(text: string): Partial<TestStep>[] {
  const parsed = parseYaml(text)
  const items = Array.isArray(parsed) ? parsed : [parsed]
  return items.map((item: any) => ({
    keyword: item.keyword || 'click',
    description: item.description || '',
    objectRef: item.objectRef || '',
    input: item.input || '',
    expected: item.expected || item.output || '',
    enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    continueOnFailure: typeof item.continueOnFailure === 'boolean' ? item.continueOnFailure : false,
    timeout: typeof item.timeout === 'number' ? item.timeout : null,
  }))
}

function parseSeleniumIDE(text: string): Partial<TestStep>[] {
  const parsed = JSON.parse(text)
  const steps: Partial<TestStep>[] = []
  
  const tests = parsed.tests || []
  for (const t of tests) {
    const commands = t.commands || []
    for (const cmd of commands) {
      const keywordMap: Record<string, string> = {
        open: 'navigate-to',
        click: 'click',
        type: 'type-text',
        sendKeys: 'type-text',
        assertText: 'assert-text',
        verifyText: 'assert-text',
        assertElementPresent: 'assert-visible',
        verifyElementPresent: 'assert-visible',
        waitForElementVisible: 'wait-for-element',
        check: 'check',
        uncheck: 'uncheck',
      }
      
      const keyword = keywordMap[cmd.command]
      if (keyword) {
        steps.push({
          keyword,
          description: cmd.comment || '',
          objectRef: cmd.target || '',
          input: cmd.value || '',
          expected: keyword === 'assert-text' ? cmd.value : '',
          enabled: true,
          continueOnFailure: false,
          timeout: null,
        })
      }
    }
  }
  return steps
}

function parsePlaywright(text: string): Partial<TestStep>[] {
  const lines = text.split('\n')
  const steps: Partial<TestStep>[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue
    
    // goto
    const gotoMatch = trimmed.match(/page\.goto\(\s*['"`](.*?)['"`]\s*\)/)
    if (gotoMatch) {
      steps.push({ keyword: 'navigate-to', input: gotoMatch[1] })
      continue
    }
    
    // click
    const clickMatch = trimmed.match(/page\.click\(\s*['"`](.*?)['"`]/) || trimmed.match(/locator\(\s*['"`](.*?)['"`]\s*\)\.click\(\)/)
    if (clickMatch) {
      steps.push({ keyword: 'click', objectRef: clickMatch[1] })
      continue
    }
    
    // fill
    const fillMatch = trimmed.match(/page\.fill\(\s*['"`](.*?)['"`]\s*,\s*['"`](.*?)['"`]/) || 
                      trimmed.match(/locator\(\s*['"`](.*?)['"`]\s*\)\.fill\(\s*['"`](.*?)['"`]/)
    if (fillMatch) {
      steps.push({ keyword: 'type-text', objectRef: fillMatch[1], input: fillMatch[2] })
      continue
    }
    
    // type
    const typeMatch = trimmed.match(/page\.type\(\s*['"`](.*?)['"`]\s*,\s*['"`](.*?)['"`]/) || 
                      trimmed.match(/locator\(\s*['"`](.*?)['"`]\s*\)\.type\(\s*['"`](.*?)['"`]/)
    if (typeMatch) {
      steps.push({ keyword: 'type-text', objectRef: typeMatch[1], input: typeMatch[2] })
      continue
    }
    
    // expect text
    const expectTextMatch = trimmed.match(/expect\(.*locator\(\s*['"`](.*?)['"`]\s*\)\)\.toHaveText\(\s*['"`](.*?)['"`]/)
    if (expectTextMatch) {
      steps.push({ keyword: 'assert-text', objectRef: expectTextMatch[1], expected: expectTextMatch[2] })
      continue
    }
    
    // expect visible
    const expectVisibleMatch = trimmed.match(/expect\(.*locator\(\s*['"`](.*?)['"`]\s*\)\)\.toBeVisible\(\)/)
    if (expectVisibleMatch) {
      steps.push({ keyword: 'assert-visible', objectRef: expectVisibleMatch[1] })
      continue
    }
    
    // expect hidden
    const expectHiddenMatch = trimmed.match(/expect\(.*locator\(\s*['"`](.*?)['"`]\s*\)\)\.toBeHidden\(\)/)
    if (expectHiddenMatch) {
      steps.push({ keyword: 'assert-hidden', objectRef: expectHiddenMatch[1] })
      continue
    }
    
    // wait for selector
    const waitMatch = trimmed.match(/page\.waitForSelector\(\s*['"`](.*?)['"`]/)
    if (waitMatch) {
      steps.push({ keyword: 'wait-for-element', objectRef: waitMatch[1] })
      continue
    }
    
    // wait for timeout
    const waitTimeoutMatch = trimmed.match(/page\.waitForTimeout\(\s*(\d+)\s*\)/)
    if (waitTimeoutMatch) {
      steps.push({ keyword: 'wait-ms', input: waitTimeoutMatch[1] })
      continue
    }
    
    // hover
    const hoverMatch = trimmed.match(/page\.hover\(\s*['"`](.*?)['"`]/) || trimmed.match(/locator\(\s*['"`](.*?)['"`]\s*\)\.hover\(\)/)
    if (hoverMatch) {
      steps.push({ keyword: 'hover', objectRef: hoverMatch[1] })
      continue
    }
    
    // selectOption
    const selectMatch = trimmed.match(/page\.selectOption\(\s*['"`](.*?)['"`]\s*,\s*['"`](.*?)['"`]/) || 
                        trimmed.match(/locator\(\s*['"`](.*?)['"`]\s*\)\.selectOption\(\s*['"`](.*?)['"`]/)
    if (selectMatch) {
      steps.push({ keyword: 'select-option', objectRef: selectMatch[1], input: selectMatch[2] })
      continue
    }
    
    // check
    const checkMatch = trimmed.match(/page\.check\(\s*['"`](.*?)['"`]/) || trimmed.match(/locator\(\s*['"`](.*?)['"`]\s*\)\.check\(\)/)
    if (checkMatch) {
      steps.push({ keyword: 'check', objectRef: checkMatch[1] })
      continue
    }
    
    // uncheck
    const uncheckMatch = trimmed.match(/page\.uncheck\(\s*['"`](.*?)['"`]/) || trimmed.match(/locator\(\s*['"`](.*?)['"`]\s*\)\.uncheck\(\)/)
    if (uncheckMatch) {
      steps.push({ keyword: 'uncheck', objectRef: uncheckMatch[1] })
      continue
    }
    
    // screenshot
    const screenshotMatch = trimmed.match(/page\.screenshot\(\)/)
    if (screenshotMatch) {
      steps.push({ keyword: 'take-screenshot' })
      continue
    }
  }
  
  return steps
}

function parseCypress(text: string): Partial<TestStep>[] {
  const lines = text.split('\n')
  const steps: Partial<TestStep>[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue
    
    // visit
    const visitMatch = trimmed.match(/cy\.visit\(\s*['"`](.*?)['"`]\s*\)/)
    if (visitMatch) {
      steps.push({ keyword: 'navigate-to', input: visitMatch[1] })
      continue
    }
    
    // click
    const clickMatch = trimmed.match(/cy\.get\(\s*['"`](.*?)['"`]\s*\)\.click\(\)/)
    if (clickMatch) {
      steps.push({ keyword: 'click', objectRef: clickMatch[1] })
      continue
    }
    
    // type
    const typeMatch = trimmed.match(/cy\.get\(\s*['"`](.*?)['"`]\s*\)\.type\(\s*['"`](.*?)['"`]/)
    if (typeMatch) {
      steps.push({ keyword: 'type-text', objectRef: typeMatch[1], input: typeMatch[2] })
      continue
    }
    
    // clear
    const clearMatch = trimmed.match(/cy\.get\(\s*['"`](.*?)['"`]\s*\)\.clear\(\)/)
    if (clearMatch) {
      steps.push({ keyword: 'clear-text', objectRef: clearMatch[1] })
      continue
    }
    
    // assert text
    const shouldTextMatch = trimmed.match(/cy\.get\(\s*['"`](.*?)['"`]\s*\)\.should\(\s*['"`](have\.text|contain)['"`]\s*,\s*['"`](.*?)['"`]/)
    if (shouldTextMatch) {
      steps.push({ keyword: 'assert-text', objectRef: shouldTextMatch[1], expected: shouldTextMatch[3] })
      continue
    }
    
    // assert visible
    const shouldVisibleMatch = trimmed.match(/cy\.get\(\s*['"`](.*?)['"`]\s*\)\.should\(\s*['"`]be\.visible['"`]\)/)
    if (shouldVisibleMatch) {
      steps.push({ keyword: 'assert-visible', objectRef: shouldVisibleMatch[1] })
      continue
    }
    
    // assert hidden
    const shouldHiddenMatch = trimmed.match(/cy\.get\(\s*['"`](.*?)['"`]\s*\)\.should\(\s*['"`](be\.hidden|not\.be\.visible)['"`]\)/)
    if (shouldHiddenMatch) {
      steps.push({ keyword: 'assert-hidden', objectRef: shouldHiddenMatch[1] })
      continue
    }
    
    // wait ms
    const waitMatch = trimmed.match(/cy\.wait\(\s*(\d+)\s*\)/)
    if (waitMatch) {
      steps.push({ keyword: 'wait-ms', input: waitMatch[1] })
      continue
    }
    
    // screenshot
    const screenshotMatch = trimmed.match(/cy\.screenshot\(\)/)
    if (screenshotMatch) {
      steps.push({ keyword: 'take-screenshot' })
      continue
    }
  }
  
  return steps
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  
  return result.map(val => {
    if (val.startsWith('"') && val.endsWith('"')) {
      return val.slice(1, -1)
    }
    return val
  })
}

function parseCsv(text: string): Partial<TestStep>[] {
  const lines = text.split('\n')
  const steps: Partial<TestStep>[] = []
  
  let startIndex = 0
  let headers = ['keyword', 'objectRef', 'input', 'expected', 'description']
  
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase()
    if (firstLine.includes('keyword') || firstLine.includes('objectref') || firstLine.includes('input')) {
      headers = parseCsvLine(lines[0]).map(h => h.trim())
      startIndex = 1
    }
  }
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCsvLine(line)
    const step: any = {}
    
    headers.forEach((header, index) => {
      const value = values[index] || ''
      if (header === 'keyword') step.keyword = value
      else if (header === 'objectref' || header === 'objectRef') step.objectRef = value
      else if (header === 'input') step.input = value
      else if (header === 'expected' || header === 'output') step.expected = value
      else if (header === 'description') step.description = value
    })
    
    if (step.keyword) {
      steps.push(step)
    }
  }
  return steps
}

export function parseImportedSteps(text: string, format: string): TestStep[] {
  let partials: Partial<TestStep>[] = []
  
  const cleanText = text.trim()
  if (!cleanText) return []

  try {
    if (format === 'json' || format === 'yaml') {
      partials = parseJsonYaml(cleanText)
    } else if (format === 'csv') {
      partials = parseCsv(cleanText)
    } else if (format === 'selenium') {
      partials = parseSeleniumIDE(cleanText)
    } else if (format === 'playwright') {
      partials = parsePlaywright(cleanText)
    } else if (format === 'cypress') {
      partials = parseCypress(cleanText)
    }
  } catch (err) {
    throw new Error(`Failed to parse ${format.toUpperCase()}: ${err instanceof Error ? err.message : String(err)}`)
  }
  
  return partials.map((p) => ({
    id: crypto.randomUUID(),
    keyword: p.keyword || 'click',
    description: p.description || '',
    objectRef: p.objectRef || '',
    input: p.input || '',
    expected: p.expected || '',
    enabled: typeof p.enabled === 'boolean' ? p.enabled : true,
    continueOnFailure: typeof p.continueOnFailure === 'boolean' ? p.continueOnFailure : false,
    timeout: typeof p.timeout === 'number' ? p.timeout : null,
  }))
}

