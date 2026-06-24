import type { RunReport } from './types.js'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function toJUnitXml(report: RunReport): string {
  const { testCases, passed, failed, total, durationMs, projectName, suiteName, profile } = report
  const name = esc(`${projectName}${suiteName ? ' / ' + suiteName : ''} [${profile}]`)
  const ts = report.startedAt

  const cases = testCases.map((tc) => {
    const dur = (tc.durationMs / 1000).toFixed(3)
    const failedSteps = tc.steps.filter((s) => s.status === 'failed')

    if (tc.status === 'passed') {
      return `    <testcase name="${esc(tc.testCaseName)}" classname="${esc(tc.testCaseId)}" time="${dur}" />`
    }

    const failures = failedSteps.map((s) =>
      `      <failure message="${esc(s.keyword + (s.message ? ': ' + s.message : ''))}" type="AssertionError">${esc(s.message ?? '')}</failure>`,
    )

    return [
      `    <testcase name="${esc(tc.testCaseName)}" classname="${esc(tc.testCaseId)}" time="${dur}">`,
      ...failures,
      `    </testcase>`,
    ].join('\n')
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="${name}" tests="${total}" failures="${failed}" errors="0" time="${(durationMs / 1000).toFixed(3)}" timestamp="${ts}">`,
    `  <testsuite name="${name}" tests="${total}" failures="${failed}" errors="0" skipped="${total - passed - failed}" time="${(durationMs / 1000).toFixed(3)}" timestamp="${ts}">`,
    ...cases,
    '  </testsuite>',
    '</testsuites>',
  ].join('\n')
}
