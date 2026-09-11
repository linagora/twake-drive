import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as net from 'net'
import * as path from 'path'

export const E2E_PORTS_PATH = path.join(__dirname, '..', '.e2e-ports.json')
export const DEV_PORTS_PATH = path.join(__dirname, '..', '.dev-ports.json')

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

export async function resolveDevPorts(): Promise<E2EPortsConfig> {
  const projectName = getDevProjectName()
  const rootDomain = getDevRootDomain()

  if (fs.existsSync(DEV_PORTS_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(DEV_PORTS_PATH, 'utf-8'))
      if (saved.projectName === projectName) {
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
    } catch {
      // ignore corrupted file and reallocate
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
