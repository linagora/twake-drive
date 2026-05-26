import { execSync } from 'child_process'

export const COMPOSE_FILE = 'docker-compose.e2e.yml'
export const STACK_HOST = 'localhost'
export const STACK_PORT = 80
export const STACK_URL = `http://${STACK_HOST}:${STACK_PORT}`
export const ADMIN_PORT = 6060
export const ADMIN_URL = `http://${STACK_HOST}:${ADMIN_PORT}`
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

export const USERS: Record<UserLabel, User> = {
  alice: {
    label: 'alice',
    instance: 'alice.cozy.localhost',
    appUrl: 'http://alice-drive.cozy.localhost',
    email: 'alice@cozy.localhost',
    passphrase: 'alice1234'
  },
  bob: {
    label: 'bob',
    instance: 'bob.cozy.localhost',
    appUrl: 'http://bob-drive.cozy.localhost',
    email: 'bob@cozy.localhost',
    passphrase: 'bob1234'
  }
}

export function stackExec(cmd: string): string {
  return execSync(
    `docker compose -f ${COMPOSE_FILE} exec -T -e COZY_ADMIN_PASSPHRASE=cozy -e COZY_ADMIN_HOST=${STACK_HOST} cozystack cozy-stack ${cmd}`,
    { encoding: 'utf-8', cwd: process.cwd() }
  ).trim()
}
