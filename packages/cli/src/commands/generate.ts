import fs from 'node:fs/promises'
import path from 'node:path'
import { loadProject } from '../loader/project.js'

export type GenerateOptions = {
  project: string
  suite?: string
  profile: string
  provider: 'github' | 'gitlab' | 'jenkins'
  output?: string
  nodeVersion: string
}

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  const projectRoot = path.resolve(opts.project)
  const { project } = await loadProject(projectRoot)

  let content: string

  switch (opts.provider) {
    case 'github':
      content = githubActionsWorkflow(project.name, opts)
      break
    case 'gitlab':
      content = gitlabCiYaml(project.name, opts)
      break
    case 'jenkins':
      content = jenkinsfile(project.name, opts)
      break
  }

  if (opts.output) {
    await fs.mkdir(path.dirname(path.resolve(opts.output)), { recursive: true })
    await fs.writeFile(path.resolve(opts.output), content, 'utf-8')
    console.log(`Generated ${opts.provider} CI config → ${opts.output}`)
  } else {
    console.log(content)
  }
}

function buildRunArgs(opts: GenerateOptions): string {
  const args = [
    `--project .`,
    opts.suite ? `--suite ${opts.suite}` : '',
    `--profile ${opts.profile}`,
    `--headless`,
    `--reporter junit`,
    `--output ./reports/junit.xml`,
  ].filter(Boolean)
  return args.join(' ')
}

function githubActionsWorkflow(projectName: string, opts: GenerateOptions): string {
  const runArgs = buildRunArgs(opts)
  return `name: ${projectName} — Automated Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  autotest:
    name: Run Automated Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '${opts.nodeVersion}'

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm --filter @jkauto/cli exec playwright install --with-deps chromium

      - name: Run tests
        run: pnpm jkauto ${runArgs}

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-report
          path: reports/

      - name: Publish JUnit results
        if: always()
        uses: mikepenz/action-junit-report@v4
        with:
          report_paths: reports/junit.xml
          check_name: Test Results
`
}

function gitlabCiYaml(projectName: string, opts: GenerateOptions): string {
  const runArgs = buildRunArgs(opts)
  return `# ${projectName} — Automated Tests

image: node:${opts.nodeVersion}

stages:
  - test

variables:
  PLAYWRIGHT_BROWSERS_PATH: .pw-browsers

cache:
  key: \${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/
    - .pw-browsers/

autotest:
  stage: test
  before_script:
    - npm install -g pnpm
    - pnpm install --frozen-lockfile
    - pnpm --filter @jkauto/cli exec playwright install --with-deps chromium
  script:
    - pnpm jkauto ${runArgs}
  artifacts:
    when: always
    reports:
      junit: reports/junit.xml
    paths:
      - reports/
    expire_in: 7 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "push"
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_PIPELINE_SOURCE == "web"
`
}

function jenkinsfile(projectName: string, opts: GenerateOptions): string {
  const runArgs = buildRunArgs(opts)
  return `// ${projectName} — Automated Tests
pipeline {
    agent any

    tools {
        nodejs '${opts.nodeVersion}'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm install -g pnpm'
                sh 'pnpm install --frozen-lockfile'
                sh 'pnpm --filter @jkauto/cli exec playwright install --with-deps chromium'
            }
        }

        stage('Test') {
            steps {
                sh 'pnpm jkauto ${runArgs}'
            }
            post {
                always {
                    junit 'reports/junit.xml'
                    archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
                }
            }
        }
    }

    post {
        failure {
            echo 'Tests failed!'
        }
    }
}
`
}
