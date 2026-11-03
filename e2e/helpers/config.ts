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
// Also the subdomain of the organization instance, where flat subdomains
// forbid dashes.
export const ORG_ID = 'e2eorg'
export const ORG_DOMAIN = ROOT_DOMAIN

export type UserLabel = 'alice' | 'bob' | 'charlie' | 'dave' | 'emma'

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

/** Upper bound of Playwright workers: each one needs its own team of
 * instances. */
export const MAX_WORKERS = 4

/** Playwright sets TEST_PARALLEL_INDEX in each worker process; the main
 * process (global setup and teardown) runs as index 0. */
export const PARALLEL_INDEX = parseInt(
  process.env.TEST_PARALLEL_INDEX || '0',
  10
)

const buildUser = (
  label: UserLabel,
  rootDomain: string,
  stackPort: number,
  parallelIndex: number
): User => {
  const name = parallelIndex === 0 ? label : `${label}${parallelIndex}`
  const suffix = computeInstancePortSuffix(stackPort)
  return {
    label,
    instance: `${name}.${rootDomain}${suffix}`,
    appUrl: `http://${name}-drive.${rootDomain}${suffix}`,
    email: `${name}@${rootDomain}`,
    passphrase: `${label}1234`
  }
}

/** Users of one Playwright worker: worker 0 keeps the historical alice, bob
 * and charlie instances, worker N gets aliceN, bobN and charlieN, so specs
 * that change instance state (feature flags) never collide across workers.
 * Dave and Emma have no browser page: specs check them through the stack. */
export function buildUsers(
  rootDomain = ROOT_DOMAIN,
  stackPort = STACK_PORT,
  parallelIndex = PARALLEL_INDEX
): Record<UserLabel, User> {
  return {
    alice: buildUser('alice', rootDomain, stackPort, parallelIndex),
    bob: buildUser('bob', rootDomain, stackPort, parallelIndex),
    charlie: buildUser('charlie', rootDomain, stackPort, parallelIndex),
    dave: buildUser('dave', rootDomain, stackPort, parallelIndex),
    emma: buildUser('emma', rootDomain, stackPort, parallelIndex)
  }
}

/** The instance of the organization, shared by every worker: the stack
 * treats an instance as the one of its organization when its subdomain is
 * the OrgID. Directory groups and organization drives live there. */
export function buildOrgInstance(
  rootDomain = ROOT_DOMAIN,
  stackPort = STACK_PORT
): string {
  return `${ORG_ID}.${rootDomain}${computeInstancePortSuffix(stackPort)}`
}

export const USERS: Record<UserLabel, User> = buildUsers()

export function applyConfigUpdate(config: E2EPortsConfig): void {
  const newUsers = buildUsers(config.rootDomain, config.stackPort)
  for (const key of Object.keys(newUsers) as UserLabel[]) {
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
