import path from 'node:path'
import fs from 'node:fs'
import type { DetectedStack, Framework, Language } from './types'

const OPENAPI_CANDIDATES = [
  'swagger.json', 'openapi.json', 'swagger.yaml', 'openapi.yaml',
  'docs/swagger.json', 'docs/openapi.yaml', 'api/swagger.json',
  'src/main/resources/swagger.yaml', 'src/main/resources/openapi.yaml',
]

export function detectStack(repoPath: string): DetectedStack {
  if (fs.existsSync(path.join(repoPath, 'package.json'))) return detectNode(repoPath)
  if (fs.existsSync(path.join(repoPath, 'pom.xml'))) return detectJava(repoPath, 'maven')
  if (fs.existsSync(path.join(repoPath, 'build.gradle')) || fs.existsSync(path.join(repoPath, 'build.gradle.kts'))) return detectJava(repoPath, 'gradle')
  if (fs.existsSync(path.join(repoPath, 'go.mod'))) return detectGo(repoPath)
  if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) return detectRust(repoPath)
  if (fs.existsSync(path.join(repoPath, 'composer.json'))) return detectPHP(repoPath)
  if (fs.existsSync(path.join(repoPath, 'requirements.txt')) || fs.existsSync(path.join(repoPath, 'pyproject.toml'))) return detectPython(repoPath)

  return { framework: 'unknown', language: 'unknown', hasOpenApi: false, hasReadme: false }
}

function findOpenApi(repoPath: string) {
  const p = OPENAPI_CANDIDATES.find((f) => fs.existsSync(path.join(repoPath, f)))
  return p ? path.join(repoPath, p) : undefined
}

function findReadme(repoPath: string) {
  const candidates = ['README.md', 'readme.md', 'README.rst']
  return candidates.find((f) => fs.existsSync(path.join(repoPath, f)))
}

function base(repoPath: string, framework: Framework, language: Language): DetectedStack {
  const openApiPath = findOpenApi(repoPath)
  const readmeFile = findReadme(repoPath)
  return {
    framework,
    language,
    hasOpenApi: !!openApiPath,
    openApiPath,
    hasReadme: !!readmeFile,
    readmePath: readmeFile ? path.join(repoPath, readmeFile) : undefined,
  }
}

function detectNode(repoPath: string): DetectedStack {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoPath, 'package.json'), 'utf-8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>

  let framework: Framework = 'unknown'
  if (deps['next']) framework = 'nextjs'
  else if (deps['@angular/core']) framework = 'angular'
  else if (deps['nuxt']) framework = 'nuxt'
  else if (deps['svelte']) framework = 'svelte'
  else if (deps['vue']) framework = 'vue'
  else if (deps['@nestjs/core']) framework = 'nestjs'
  else if (deps['fastify']) framework = 'fastify'
  else if (deps['koa']) framework = 'koa'
  else if (deps['express']) framework = 'express'
  else if (deps['react']) framework = 'react'

  let testFramework: string | undefined
  if (deps['vitest']) testFramework = 'vitest'
  else if (deps['jest']) testFramework = 'jest'
  else if (deps['mocha']) testFramework = 'mocha'

  const language: Language = deps['typescript'] ? 'typescript' : 'javascript'
  const result = base(repoPath, framework, language)
  return { ...result, testFramework }
}

function detectJava(repoPath: string, _build: string): DetectedStack {
  // Check Kotlin
  const hasKotlin = fs.existsSync(path.join(repoPath, 'src/main/kotlin'))
  const language: Language = hasKotlin ? 'kotlin' : 'java'

  // Detect framework from pom.xml/build.gradle
  let framework: Framework = 'spring'
  try {
    const buildFile = fs.existsSync(path.join(repoPath, 'pom.xml'))
      ? fs.readFileSync(path.join(repoPath, 'pom.xml'), 'utf-8')
      : fs.readFileSync(path.join(repoPath, 'build.gradle'), 'utf-8')
    if (buildFile.includes('quarkus')) framework = 'quarkus'
    else if (buildFile.includes('micronaut')) framework = 'micronaut'
  } catch {}

  return base(repoPath, framework, language)
}

function detectGo(repoPath: string): DetectedStack {
  let framework: Framework = 'unknown'
  try {
    const goMod = fs.readFileSync(path.join(repoPath, 'go.mod'), 'utf-8')
    if (goMod.includes('github.com/gin-gonic/gin')) framework = 'gin'
    else if (goMod.includes('github.com/labstack/echo')) framework = 'echo'
    else if (goMod.includes('github.com/gofiber/fiber')) framework = 'fiber'
    else if (goMod.includes('github.com/go-chi/chi')) framework = 'chi'
  } catch {}
  return base(repoPath, framework, 'go')
}

function detectRust(repoPath: string): DetectedStack {
  let framework: Framework = 'unknown'
  try {
    const cargo = fs.readFileSync(path.join(repoPath, 'Cargo.toml'), 'utf-8')
    if (cargo.includes('actix-web')) framework = 'actix'
    else if (cargo.includes('axum')) framework = 'axum'
    else if (cargo.includes('rocket')) framework = 'rocket'
  } catch {}
  return base(repoPath, framework, 'rust')
}

function detectPHP(repoPath: string): DetectedStack {
  let framework: Framework = 'unknown'
  try {
    const composer = JSON.parse(fs.readFileSync(path.join(repoPath, 'composer.json'), 'utf-8'))
    const req = { ...composer.require, ...composer['require-dev'] }
    if (req['laravel/framework']) framework = 'laravel'
    else if (req['symfony/framework-bundle']) framework = 'symfony'
    else if (req['codeigniter4/framework']) framework = 'codeigniter'
  } catch {}
  return base(repoPath, framework, 'php')
}

function detectPython(repoPath: string): DetectedStack {
  let framework: Framework = 'unknown'
  const sources = [
    path.join(repoPath, 'requirements.txt'),
    path.join(repoPath, 'pyproject.toml'),
    path.join(repoPath, 'setup.py'),
  ]
  for (const src of sources) {
    if (!fs.existsSync(src)) continue
    const content = fs.readFileSync(src, 'utf-8').toLowerCase()
    if (content.includes('fastapi')) { framework = 'fastapi'; break }
    if (content.includes('django')) { framework = 'django'; break }
    if (content.includes('flask')) { framework = 'flask'; break }
  }
  return base(repoPath, framework, 'python')
}
