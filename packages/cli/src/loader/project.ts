import fs from 'node:fs/promises'
import path from 'node:path'
import { readProjectFile } from '@jkauto/project-fs'
import {
  ProjectSchema,
  TestCaseSchema,
  TestSuiteSchema,
  ProfileSchema,
  ObjectRepositorySchema,
} from '@jkauto/core'
import type { Project, TestCase, TestSuite, Profile, ObjectRepository } from '@jkauto/core'

export type LoadedProject = {
  root: string
  project: Project
}

export async function loadProject(projectRoot: string): Promise<LoadedProject> {
  const configPath = path.join(projectRoot, 'project.json')
  const raw = await readProjectFile<unknown>(configPath, 'json')
  const project = ProjectSchema.parse(raw)
  return { root: projectRoot, project }
}

export async function loadProfile(projectRoot: string, profileName: string, format: 'json' | 'yaml'): Promise<Profile> {
  const ext = format === 'yaml' ? 'yaml' : 'json'
  const profilePath = path.join(projectRoot, 'profiles', `${profileName}.env.${ext}`)
  try {
    const raw = await readProjectFile<unknown>(profilePath, format)
    return ProfileSchema.parse(raw)
  } catch {
    // Fall back to default empty profile
    return ProfileSchema.parse({ name: profileName, schemaVersion: 1 })
  }
}

export async function loadTestCaseByPath(filePath: string, format: 'json' | 'yaml'): Promise<TestCase> {
  const raw = await readProjectFile<unknown>(filePath, format)
  return TestCaseSchema.parse(raw)
}

export async function findTestCase(projectRoot: string, nameOrPath: string, format: 'json' | 'yaml'): Promise<{ tc: TestCase; filePath: string }> {
  // If it looks like a path, load directly
  if (nameOrPath.includes('/') || nameOrPath.includes('\\') || nameOrPath.endsWith('.json') || nameOrPath.endsWith('.yaml')) {
    const resolved = path.isAbsolute(nameOrPath) ? nameOrPath : path.join(projectRoot, nameOrPath)
    const tc = await loadTestCaseByPath(resolved, format)
    return { tc, filePath: resolved }
  }

  // Search in test-cases/ directory
  const dir = path.join(projectRoot, 'test-cases')
  const entries = await fs.readdir(dir).catch(() => [] as string[])
  const ext = format === 'yaml' ? ['.test.yaml', '.test.yml'] : ['.test.json']

  for (const entry of entries) {
    const matchesName = entry.replace(/\.test\.(json|yaml|yml)$/, '') === nameOrPath
    const matchesExt = ext.some((e) => entry.endsWith(e))
    if (matchesName && matchesExt) {
      const filePath = path.join(dir, entry)
      const tc = await loadTestCaseByPath(filePath, format)
      return { tc, filePath }
    }
  }

  throw new Error(`Test case not found: ${nameOrPath}`)
}

export async function findSuite(projectRoot: string, nameOrPath: string, format: 'json' | 'yaml'): Promise<TestSuite> {
  if (nameOrPath.includes('/') || nameOrPath.includes('\\') || nameOrPath.endsWith('.json') || nameOrPath.endsWith('.yaml')) {
    const resolved = path.isAbsolute(nameOrPath) ? nameOrPath : path.join(projectRoot, nameOrPath)
    const raw = await readProjectFile<unknown>(resolved, format)
    return TestSuiteSchema.parse(raw)
  }

  const dir = path.join(projectRoot, 'test-suites')
  const entries = await fs.readdir(dir).catch(() => [] as string[])
  const ext = format === 'yaml' ? ['.suite.yaml', '.suite.yml'] : ['.suite.json']

  for (const entry of entries) {
    const matchesName = entry.replace(/\.suite\.(json|yaml|yml)$/, '') === nameOrPath
    const matchesExt = ext.some((e) => entry.endsWith(e))
    if (matchesName && matchesExt) {
      const raw = await readProjectFile<unknown>(path.join(dir, entry), format)
      return TestSuiteSchema.parse(raw)
    }
  }

  throw new Error(`Suite not found: ${nameOrPath}`)
}

export async function loadObjectRepositories(projectRoot: string, format: 'json' | 'yaml'): Promise<ObjectRepository[]> {
  const dir = path.join(projectRoot, 'object-repository')
  const entries = await fs.readdir(dir).catch(() => [] as string[])
  const ext = format === 'yaml' ? ['.objects.yaml', '.objects.yml'] : ['.objects.json']
  const repos: ObjectRepository[] = []

  for (const entry of entries) {
    if (!ext.some((e) => entry.endsWith(e))) continue
    try {
      const raw = await readProjectFile<unknown>(path.join(dir, entry), format)
      repos.push(ObjectRepositorySchema.parse(raw))
    } catch {
      // skip malformed files
    }
  }

  return repos
}
