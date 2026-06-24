# AGENTS.md — Root (cross-package changes)

- **CLI + CI/CD (`packages/cli`):** Standalone `jkauto` binary. `run` command executes a test case or suite headlessly, streams step events, outputs JUnit XML / JSON / console reporter, exits 1 on failure. `generate-workflow` prints ready-to-use GitHub Actions / GitLab CI / Jenkinsfile config. Built with esbuild (CJS, workspace source aliased to bypass bundler-resolution dist files). Key files: `src/cli.ts`, `src/commands/run.ts`, `src/commands/generate.ts`, `src/reporters/`, `src/loader/project.ts`, `build.mjs`.
