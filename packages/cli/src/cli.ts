import { Command } from 'commander'
import { runCommand } from './commands/run.js'
import { generateCommand } from './commands/generate.js'

const program = new Command()

program
  .name('jkauto')
  .description('jkauto CLI — run automated tests from CI/CD pipelines')
  .version('0.1.0')

program
  .command('run')
  .description('Run a test case or test suite')
  .requiredOption('--project <path>', 'Project root directory')
  .option('--suite <name>', 'Suite name or path to run')
  .option('--test-case <name>', 'Test case name or path to run')
  .option('--profile <name>', 'Profile name', 'default')
  .option('--headless', 'Run browser headless', false)
  .option('--reporter <type>', 'Reporter: console | junit | json', 'console')
  .option('--output <path>', 'Output file for junit/json reporters')
  .option('--screenshot-dir <path>', 'Directory for failure screenshots')
  .option('--continue-on-failure', 'Continue suite even if a test fails', false)
  .option('--verbose', 'Print each step as it runs', false)
  .action(async (opts) => {
    const reporter = opts.reporter as 'console' | 'junit' | 'json'
    if (!['console', 'junit', 'json'].includes(reporter)) {
      console.error(`Invalid reporter: ${reporter}. Must be console | junit | json`)
      process.exit(2)
    }
    if (!opts.suite && !opts.testCase) {
      console.error('Error: --suite or --test-case is required')
      process.exit(2)
    }
    await runCommand({
      project: opts.project,
      suite: opts.suite,
      testCase: opts.testCase,
      profile: opts.profile,
      headless: opts.headless,
      reporter,
      output: opts.output,
      screenshotDir: opts.screenshotDir,
      continueOnFailure: opts.continueOnFailure,
      verbose: opts.verbose,
    })
  })

program
  .command('generate-workflow')
  .description('Generate CI/CD workflow config for GitHub Actions, GitLab CI, or Jenkins')
  .requiredOption('--project <path>', 'Project root directory')
  .option('--suite <name>', 'Suite to include in the workflow')
  .option('--profile <name>', 'Profile name', 'default')
  .option('--provider <name>', 'CI provider: github | gitlab | jenkins', 'github')
  .option('--output <path>', 'Output file path')
  .option('--node-version <version>', 'Node.js version', '22')
  .action(async (opts) => {
    const provider = opts.provider as 'github' | 'gitlab' | 'jenkins'
    if (!['github', 'gitlab', 'jenkins'].includes(provider)) {
      console.error(`Invalid provider: ${provider}. Must be github | gitlab | jenkins`)
      process.exit(2)
    }
    await generateCommand({
      project: opts.project,
      suite: opts.suite,
      profile: opts.profile,
      provider,
      output: opts.output,
      nodeVersion: opts.nodeVersion,
    })
  })

program.parse()
