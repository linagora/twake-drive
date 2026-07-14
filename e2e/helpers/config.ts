import { execFileSync } from 'child_process'

export const COMPOSE_FILE = 'docker-compose.e2e.yml'
export const STACK_HOST = 'localhost'
export const STACK_PORT = parseInt(process.env.COZY_E2E_STACK_PORT || '18080', 10)
export const STACK_URL = `http://${STACK_HOST}:${STACK_PORT}`
export const ADMIN_PORT = parseInt(process.env.COZY_E2E_ADMIN_PORT || '16060', 10)
export const ADMIN_URL = `http://${STACK_HOST}:${ADMIN_PORT}`
export const PERSIST =
  process.env.E2E_PERSIST === '1' || process.env.E2E_SKIP_TEARDOWN === '1'
export const RESET = process.env.E2E_RESET === '1'
export const ADMIN_USER = 'admin'
export const ADMIN_PASSPHRASE = 'cozy'

// Tying both instances to the same (OrgID, OrgDomain) makes them count as
// trusted contacts of each other for cozy-to-cozy sharing — combined with the
// `auto_accept_trusted_contacts` context option, invitations no longer need
// an SMTP delivery to be accepted.
export const ORG_ID = 'twake-drive-e2e'
export const ORG_DOMAIN = 'cozy.localhost'

export type UserLabel = 'alice' | 'bob'

export interface User {
  label: UserLabel
  instance: string
  appUrl: string
  email: string
  passphrase: string
}

const instancePortSuffix = STACK_PORT === 80 ? '' : `:${STACK_PORT}`

export const USERS: Record<UserLabel, User> = {
  alice: {
    label: 'alice',
    instance: `alice.cozy.localhost${instancePortSuffix}`,
    appUrl: `http://alice-drive.cozy.localhost${instancePortSuffix}`,
    email: 'alice@cozy.localhost',
    passphrase: 'alice1234'
  },
  bob: {
    label: 'bob',
    instance: `bob.cozy.localhost${instancePortSuffix}`,
    appUrl: `http://bob-drive.cozy.localhost${instancePortSuffix}`,
    email: 'bob@cozy.localhost',
    passphrase: 'bob1234'
  }
}

/** Arguments shared by every Docker Compose call for this E2E runtime. */
export function composeArgs(...args: string[]): string[] {
  return ['compose', '--file', COMPOSE_FILE, ...args]
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
