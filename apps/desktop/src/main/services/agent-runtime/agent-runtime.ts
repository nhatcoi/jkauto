import { spawn, type ChildProcess } from 'node:child_process'

interface RuntimeInstance {
  process: ChildProcess
  port: number
}

const instances = new Map<string, RuntimeInstance>()
const startPromises = new Map<string, Promise<string>>()

export async function getOrStartRuntime(projectPath: string): Promise<string> {
  const existing = instances.get(projectPath)
  if (existing) return `http://127.0.0.1:${existing.port}`

  const pending = startPromises.get(projectPath)
  if (pending) return pending

  const promise = startRuntime(projectPath)
  startPromises.set(projectPath, promise)
  promise.finally(() => startPromises.delete(projectPath))
  return promise
}

function startRuntime(projectPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('opencode', ['serve', '--port', '0'], {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error('opencode startup timeout (10s)'))
    }, 10_000)

    function onData(data: Buffer) {
      const text = data.toString()
      // "opencode server listening on http://127.0.0.1:PORT"
      const match = text.match(/listening on http:\/\/[\d.]+:(\d+)/)
      if (match) {
        clearTimeout(timeout)
        const port = parseInt(match[1], 10)
        instances.set(projectPath, { process: proc, port })
        resolve(`http://127.0.0.1:${port}`)
      }
    }

    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
    proc.on('exit', (code) => {
      clearTimeout(timeout)
      instances.delete(projectPath)
      if (code !== 0 && code !== null) {
        reject(new Error(`opencode exited with code ${code}`))
      }
    })
  })
}

export function stopRuntime(projectPath: string): void {
  const inst = instances.get(projectPath)
  if (inst) {
    inst.process.kill()
    instances.delete(projectPath)
  }
}

export function stopAllRuntimes(): void {
  for (const [, inst] of instances) {
    inst.process.kill()
  }
  instances.clear()
}
