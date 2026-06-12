import { cn } from '@/lib/utils'
import projectIconUrl from '@/assets/icons/project.svg'
import testCaseIconUrl from '@/assets/icons/test-case.svg'
import testSuiteIconUrl from '@/assets/icons/test-suite.svg'

interface IconProps {
  className?: string
}

export function ProjectIcon({ className }: IconProps) {
  return (
    <img
      src={projectIconUrl}
      className={cn('shrink-0 object-contain', className)}
      style={{ width: undefined, height: undefined }}
      aria-hidden
    />
  )
}

export function TestCaseIcon({ className }: IconProps) {
  return (
    <img
      src={testCaseIconUrl}
      className={cn('shrink-0 object-contain', className)}
      aria-hidden
    />
  )
}

export function TestSuiteIcon({ className }: IconProps) {
  return (
    <img
      src={testSuiteIconUrl}
      className={cn('shrink-0 object-contain', className)}
      aria-hidden
    />
  )
}
