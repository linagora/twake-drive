import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'

export const E2E_PORTS_PATH = path.join(__dirname, '..', '.e2e-ports.json')
export const DEV_PORTS_PATH = path.join(__dirname, '..', '.dev-ports.json')

const PORT_ALLOCATION_LOCK_PATH = path.join(
  os.tmpdir(),
  'twake-drive-e2e-ports.lock'
)
let portAllocationLockSequence = 0

export const DEFAULT_E2E_STACK_PORT = 18080
export const DEFAULT_E2E_ADMIN_PORT = 16060
export const DEFAULT_E2E_COUCHDB_PORT = 15984

export const DEFAULT_DEV_STACK_PORT = 19080
export const DEFAULT_DEV_ADMIN_PORT = 17060
export const DEFAULT_DEV_COUCHDB_PORT = 16984

export interface E2EPortsConfig {
  projectName: string
  stackPort: number
  adminPort: number
  couchdbPort: number
  rootDomain: string
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error: unknown) {
    return isNodeError(error) && error.code === 'EPERM'
  }
}

function removeStalePortAllocationLock(): void {
  let token: string
  try {
    token = fs.readlinkSync(PORT_ALLOCATION_LOCK_PATH)
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') return
    throw error
  }

  const pid = parseInt(token.split(':', 1)[0], 10)
  if (Number.isInteger(pid) && isProcessRunning(pid)) return

  try {
    if (fs.readlinkSync(PORT_ALLOCATION_LOCK_PATH) === token) {
      fs.unlinkSync(PORT_ALLOCATION_LOCK_PATH)
    }
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') throw error
  }
}

export async function withPortAllocationLock(
  callback: () => Promise<void>
): Promise<void> {
  const token = `${process.pid}:${portAllocationLockSequence++}`

  while (true) {
    try {
      fs.symlinkSync(token, PORT_ALLOCATION_LOCK_PATH)
      break
    } catch (error: unknown) {
      if (!isNodeError(error) || error.code !== 'EEXIST') throw error
      removeStalePortAllocationLock()
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  let callbackResult: { ok: true } | { ok: false; error: unknown } = {
    ok: true
  }
  try {
    await callback()
  } catch (error: unknown) {
    callbackResult = { ok: false, error }
  }

  let releaseError: unknown = null
  try {
    if (fs.readlinkSync(PORT_ALLOCATION_LOCK_PATH) === token) {
      fs.unlinkSync(PORT_ALLOCATION_LOCK_PATH)
    }
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') releaseError = error
  }

  if (!callbackResult.ok) throw normalizeError(callbackResult.error)
  if (releaseError !== null) throw normalizeError(releaseError)
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '0.0.0.0')
  })
}

export async function findAvailablePort(
  startPort: number,
  reserved: Set<number>
): Promise<number> {
  for (let port = startPort; port <= 65535; port++) {
    if (!reserved.has(port) && (await isPortAvailable(port))) {
      reserved.add(port)
      return port
    }
  }
  throw new Error(`No available port found starting from ${startPort}`)
}

export function isDockerProjectRunning(projectName: string): boolean {
  try {
    const output = execFileSync(
      'docker',
      ['compose', '-f', 'docker-compose.e2e.yml', '-p', projectName, 'ps', '-q'],
      { encoding: 'utf-8', cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] }
    )
    return output.trim().length > 0
  } catch {
    return false
  }
}

export function getWorktreeSlug(): string {
  const raw = path.basename(process.cwd()).toLowerCase()
  const cleaned = raw.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned || 'dev'
}

// --- E2E Tests (Ephemerial / Automated) ---

export function loadE2EPorts(): E2EPortsConfig | null {
  try {
    if (fs.existsSync(E2E_PORTS_PATH)) {
      return JSON.parse(fs.readFileSync(E2E_PORTS_PATH, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return null
}

export function getE2EProjectName(): string {
  if (process.env.E2E_PROJECT_NAME) {
    return process.env.E2E_PROJECT_NAME
  }
  const saved = loadE2EPorts()
  if (saved?.projectName) {
    return saved.projectName
  }
  return `twake-e2e-${getWorktreeSlug()}`
}

export async function resolveE2EPorts(): Promise<E2EPortsConfig> {
  const projectName = getE2EProjectName()
  const rootDomain = process.env.COZY_E2E_ROOT_DOMAIN || 'cozy.localhost'

  if (
    process.env.COZY_E2E_STACK_PORT &&
    process.env.COZY_E2E_ADMIN_PORT &&
    process.env.COZY_E2E_COUCHDB_PORT
  ) {
    const config: E2EPortsConfig = {
      projectName,
      stackPort: parseInt(process.env.COZY_E2E_STACK_PORT, 10),
      adminPort: parseInt(process.env.COZY_E2E_ADMIN_PORT, 10),
      couchdbPort: parseInt(process.env.COZY_E2E_COUCHDB_PORT, 10),
      rootDomain
    }
    fs.writeFileSync(E2E_PORTS_PATH, JSON.stringify(config, null, 2))
    return config
  }

  const saved = loadE2EPorts()
  if (saved && saved.projectName === projectName) {
    if (isDockerProjectRunning(projectName)) {
      return saved
    }
    const [stackFree, adminFree, couchFree] = await Promise.all([
      isPortAvailable(saved.stackPort),
      isPortAvailable(saved.adminPort),
      isPortAvailable(saved.couchdbPort)
    ])
    if (stackFree && adminFree && couchFree) {
      return saved
    }
  }

  const reserved = new Set<number>()
  const stackPort = process.env.COZY_E2E_STACK_PORT
    ? parseInt(process.env.COZY_E2E_STACK_PORT, 10)
    : await findAvailablePort(DEFAULT_E2E_STACK_PORT, reserved)

  const adminPort = process.env.COZY_E2E_ADMIN_PORT
    ? parseInt(process.env.COZY_E2E_ADMIN_PORT, 10)
    : await findAvailablePort(DEFAULT_E2E_ADMIN_PORT, reserved)

  const couchdbPort = process.env.COZY_E2E_COUCHDB_PORT
    ? parseInt(process.env.COZY_E2E_COUCHDB_PORT, 10)
    : await findAvailablePort(DEFAULT_E2E_COUCHDB_PORT, reserved)

  const config: E2EPortsConfig = {
    projectName,
    stackPort,
    adminPort,
    couchdbPort,
    rootDomain
  }

  fs.writeFileSync(E2E_PORTS_PATH, JSON.stringify(config, null, 2))
  return config
}

// --- Dev Stack (Persistent / Browser development) ---

export function loadDevPorts(): E2EPortsConfig | null {
  try {
    if (fs.existsSync(DEV_PORTS_PATH)) {
      return JSON.parse(fs.readFileSync(DEV_PORTS_PATH, 'utf-8'))
    }
  } catch {
    // ignore
  }
  return null
}

export function getDevProjectName(): string {
  if (process.env.E2E_PROJECT_NAME) {
    return process.env.E2E_PROJECT_NAME
  }
  const saved = loadDevPorts()
  if (saved?.projectName) {
    return saved.projectName
  }
  return `twake-dev-${getWorktreeSlug()}`
}

export function getDevRootDomain(): string {
  if (process.env.COZY_E2E_ROOT_DOMAIN) {
    return process.env.COZY_E2E_ROOT_DOMAIN
  }
  const saved = loadDevPorts()
  if (saved?.rootDomain) {
    return saved.rootDomain
  }
  return `${getWorktreeSlug()}.localhost`
}

function matchesDevOverrides(config: E2EPortsConfig): boolean {
  return (
    (!process.env.COZY_E2E_STACK_PORT ||
      Number(process.env.COZY_E2E_STACK_PORT) === config.stackPort) &&
    (!process.env.COZY_E2E_ADMIN_PORT ||
      Number(process.env.COZY_E2E_ADMIN_PORT) === config.adminPort) &&
    (!process.env.COZY_E2E_COUCHDB_PORT ||
      Number(process.env.COZY_E2E_COUCHDB_PORT) === config.couchdbPort) &&
    (!process.env.COZY_E2E_ROOT_DOMAIN ||
      process.env.COZY_E2E_ROOT_DOMAIN === config.rootDomain)
  )
}

export async function resolveDevPorts(): Promise<E2EPortsConfig> {
  const projectName = getDevProjectName()
  const rootDomain = getDevRootDomain()

  const saved = loadDevPorts()
  if (
    saved &&
    saved.projectName === projectName &&
    matchesDevOverrides(saved)
  ) {
    if (!saved.rootDomain) {
      saved.rootDomain = rootDomain
    }
    if (isDockerProjectRunning(projectName)) {
      return saved
    }
    const [stackFree, adminFree, couchFree] = await Promise.all([
      isPortAvailable(saved.stackPort),
      isPortAvailable(saved.adminPort),
      isPortAvailable(saved.couchdbPort)
    ])
    if (stackFree && adminFree && couchFree) {
      return saved
    }
  }

  const reserved = new Set<number>()
  const stackPort = process.env.COZY_E2E_STACK_PORT
    ? parseInt(process.env.COZY_E2E_STACK_PORT, 10)
    : await findAvailablePort(DEFAULT_DEV_STACK_PORT, reserved)

  const adminPort = process.env.COZY_E2E_ADMIN_PORT
    ? parseInt(process.env.COZY_E2E_ADMIN_PORT, 10)
    : await findAvailablePort(DEFAULT_DEV_ADMIN_PORT, reserved)

  const couchdbPort = process.env.COZY_E2E_COUCHDB_PORT
    ? parseInt(process.env.COZY_E2E_COUCHDB_PORT, 10)
    : await findAvailablePort(DEFAULT_DEV_COUCHDB_PORT, reserved)

  const config: E2EPortsConfig = {
    projectName,
    rootDomain,
    stackPort,
    adminPort,
    couchdbPort
  }

  fs.writeFileSync(DEV_PORTS_PATH, JSON.stringify(config, null, 2))
  return config
}
