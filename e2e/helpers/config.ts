import { execFileSync } from 'child_process'
import {
  E2E_PORTS_PATH,
  getE2EProjectName,
  loadE2EPorts,
  type E2EPortsConfig
} from './ports'

export { E2E_PORTS_PATH, loadE2EPorts }

export const COMPOSE_FILE = 'docker-compose.e2e.yml'
export const STACK_HOST = 'localhost'

const savedPorts = loadE2EPorts()

export const getStackPort = (): number =>
  parseInt(
    process.env.COZY_E2E_STACK_PORT ||
      String(loadE2EPorts()?.stackPort || 18080),
    10
  )
export const getAdminPort = (): number =>
  parseInt(
    process.env.COZY_E2E_ADMIN_PORT ||
      String(loadE2EPorts()?.adminPort || 16060),
    10
  )

export const getStackUrl = (): string => `http://${STACK_HOST}:${getStackPort()}`
export const getAdminUrl = (): string => `http://${STACK_HOST}:${getAdminPort()}`

export const STACK_PORT = parseInt(
  process.env.COZY_E2E_STACK_PORT ||
    (savedPorts ? String(savedPorts.stackPort) : '18080'),
  10
)
export const STACK_URL = `http://${STACK_HOST}:${STACK_PORT}`
export const ADMIN_PORT = parseInt(
  process.env.COZY_E2E_ADMIN_PORT ||
    (savedPorts ? String(savedPorts.adminPort) : '16060'),
  10
)
export const ADMIN_URL = `http://${STACK_HOST}:${ADMIN_PORT}`
export const PERSIST =
  process.env.E2E_PERSIST === '1' || process.env.E2E_SKIP_TEARDOWN === '1'
export const RESET = process.env.E2E_RESET === '1'
export const ADMIN_USER = 'admin'
export const ADMIN_PASSPHRASE = 'cozy'

// Tying all instances to the same (OrgID, OrgDomain) makes them count as
// trusted contacts of each other for cozy-to-cozy sharing — combined with the
// `auto_accept_trusted_contacts` context option, invitations no longer need
// an SMTP delivery to be accepted.
export const ROOT_DOMAIN =
  process.env.COZY_E2E_ROOT_DOMAIN ||
  savedPorts?.rootDomain ||
  'cozy.localhost'
export const ORG_ID = 'twake-drive-e2e'
export const ORG_DOMAIN = ROOT_DOMAIN

export type UserLabel = 'alice' | 'bob' | 'charlie'

export interface User {
  label: UserLabel
  instance: string
  appUrl: string
  email: string
  passphrase: string
}

function computeInstancePortSuffix(port: number): string {
  return port === 80 ? '' : `:${port}`
}

export function buildUsers(
  rootDomain = ROOT_DOMAIN,
  stackPort = STACK_PORT
): Record<UserLabel, User> {
  const suffix = computeInstancePortSuffix(stackPort)
  return {
    alice: {
      label: 'alice',
      instance: `alice.${rootDomain}${suffix}`,
      appUrl: `http://alice-drive.${rootDomain}${suffix}`,
      email: `alice@${rootDomain}`,
      passphrase: 'alice1234'
    },
    bob: {
      label: 'bob',
      instance: `bob.${rootDomain}${suffix}`,
      appUrl: `http://bob-drive.${rootDomain}${suffix}`,
      email: `bob@${rootDomain}`,
      passphrase: 'bob1234'
    },
    charlie: {
      label: 'charlie',
      instance: `charlie.${rootDomain}${suffix}`,
      appUrl: `http://charlie-drive.${rootDomain}${suffix}`,
      email: `charlie@${rootDomain}`,
      passphrase: 'charlie1234'
    }
  }
}

export const USERS: Record<UserLabel, User> = buildUsers()

export function applyConfigUpdate(config: E2EPortsConfig): void {
  const newUsers = buildUsers(config.rootDomain, config.stackPort)
  for (const key of ['alice', 'bob', 'charlie'] as UserLabel[]) {
    Object.assign(USERS[key], newUsers[key])
  }
}

export function getProjectName(): string {
  return getE2EProjectName()
}

export const PROJECT_NAME = getProjectName()

/** Arguments shared by every Docker Compose call for this E2E runtime. */
export function composeArgs(...args: string[]): string[] {
  const proj = getProjectName()
  return [
    'compose',
    '--file',
    COMPOSE_FILE,
    ...(proj ? ['--project-name', proj] : []),
    ...args
  ]
}

/** Execute a cozy-stack command inside the E2E Compose project. */
export function stackExec(...args: string[]): string {
  return execFileSync(
    'docker',
    composeArgs(
      'exec',
      '-T',
      '-e',
      `COZY_ADMIN_PASSPHRASE=${ADMIN_PASSPHRASE}`,
      '-e',
      `COZY_ADMIN_HOST=${STACK_HOST}`,
      'cozystack',
      'cozy-stack',
      ...args
    ),
    { encoding: 'utf-8', cwd: process.cwd() }
  ).trim()
}
