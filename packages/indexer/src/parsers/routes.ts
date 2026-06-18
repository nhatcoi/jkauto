import fs from 'node:fs'
import path from 'node:path'
import type { CodePage, Framework } from '../types'

export function extractRoutes(repoPath: string, framework: Framework): CodePage[] {
  switch (framework) {
    case 'nextjs':
      return extractNextRoutes(repoPath)
    case 'react':
      return extractReactRouterRoutes(repoPath)
    case 'angular':
      return extractAngularRoutes(repoPath)
    default:
      return []
  }
}

function extractNextRoutes(repoPath: string): CodePage[] {
  const pages: CodePage[] = []

  // Next.js app router: app/**/page.tsx
  const appDir = path.join(repoPath, 'app')
  if (fs.existsSync(appDir)) {
    walkForPages(appDir, appDir, pages, 'page.tsx')
  }

  // Next.js pages router: pages/**/*.tsx
  const pagesDir = path.join(repoPath, 'pages')
  if (fs.existsSync(pagesDir)) {
    walkForPages(pagesDir, pagesDir, pages)
  }

  return pages
}

function walkForPages(
  base: string,
  dir: string,
  acc: CodePage[],
  target?: string
): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', '_app', '_document', 'api'].includes(entry.name)) {
        walkForPages(base, full, acc, target)
      }
    } else if (!target ? /\.(tsx|jsx)$/.test(entry.name) : entry.name === target) {
      const rel = path.relative(base, full)
      const route = '/' + rel.replace(/\\/g, '/').replace(/\/(page\.(tsx|jsx)|index\.(tsx|jsx))$/, '').replace(/\.(tsx|jsx)$/, '')
      acc.push({
        route: route || '/',
        componentFile: full,
        componentName: entry.name.replace(/\.(tsx|jsx)$/, ''),
      })
    }
  }
}

function extractReactRouterRoutes(repoPath: string): CodePage[] {
  const pages: CodePage[] = []
  const routeRe = /path=["'`]([^"'`]+)["'`]/g

  function scan(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
        scan(full)
      } else if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        const src = fs.readFileSync(full, 'utf-8')
        let m: RegExpExecArray | null
        routeRe.lastIndex = 0
        while ((m = routeRe.exec(src)) !== null) {
          pages.push({ route: m[1], componentFile: full, componentName: entry.name })
        }
      }
    }
  }

  scan(repoPath)
  return pages
}

function extractAngularRoutes(repoPath: string): CodePage[] {
  const pages: CodePage[] = []
  const routingFile = path.join(repoPath, 'src', 'app', 'app-routing.module.ts')
  if (!fs.existsSync(routingFile)) return pages

  const src = fs.readFileSync(routingFile, 'utf-8')
  const pathRe = /path:\s*['"`]([^'"`]+)['"`]/g
  let m: RegExpExecArray | null
  while ((m = pathRe.exec(src)) !== null) {
    pages.push({ route: '/' + m[1], componentFile: routingFile, componentName: m[1] })
  }
  return pages
}
