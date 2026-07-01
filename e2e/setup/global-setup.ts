import { execSync } from 'child_process'
import { pbkdf2Sync } from 'crypto'

import { saveAuthState } from '../helpers/auth'
import {
  ADMIN_PASSPHRASE,
  ADMIN_URL,
  ADMIN_USER,
  COMPOSE_FILE,
  ORG_DOMAIN,
  ORG_ID,
  STACK_URL,
  USERS,
  User,
  stackExec
} from '../helpers/config'
import { setFlags } from '../helpers/flags'

const ADMIN_AUTH = `Basic ${Buffer.from(`${ADMIN_USER}:${ADMIN_PASSPHRASE}`).toString('base64')}`

async function createInstance(user: User): Promise<void> {
  const params = new URLSearchParams({
    Domain: user.instance,
    Email: user.email,
    Locale: 'en',
    Passphrase: user.passphrase,
    ContextName: 'default',
    OrgID: ORG_ID,
    OrgDomain: ORG_DOMAIN
  })
  const res = await fetch(`${ADMIN_URL}/instances?${params}`, {
    method: 'POST',
    headers: { Authorization: ADMIN_AUTH, Accept: 'application/json' }
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `Failed to create instance ${user.instance} (${res.status}): ${body}`
    )
  }
}

const FEATURE_FLAGS = {
  'cozy.hide-sharing-cozy-to-cozy': true,
  'drive.shared-drive.enabled': true,
  'drive.federated-shared-folder.enabled': true,
  'drive.federated-shared-modal.enabled': true,
  'drive.file-picker-demo.enabled': true
}

async function waitForStack(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/version`)
      if (res.ok) return
    } catch {
      // stack not up yet
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`cozy-stack did not become ready within ${timeoutMs}ms`)
}

interface LoginParams {
  csrfToken: string
  iterations: number
  salt: string
}

function parseLoginParams(html: string, instance: string): LoginParams {
  const find = (pattern: RegExp, label: string): string => {
    const m = html.match(pattern)
    if (!m) throw new Error(`Could not find ${label} for ${instance}`)
    return m[1]
  }
  return {
    csrfToken: find(/name="csrf_token"\s+value="([^"]+)"/, 'CSRF token'),
    iterations: parseInt(find(/data-iterations="(\d+)"/, 'PBKDF2 iterations'), 10),
    salt: find(/data-salt="([^"]+)"/, 'PBKDF2 salt')
  }
}

async function getSessionCookie(
  user: User
): Promise<{ name: string; value: string }> {
  const { instance, passphrase } = user
  const loginPageRes = await fetch(`http://${instance}:80/auth/login`)
  if (!loginPageRes.ok) {
    throw new Error(
      `GET /auth/login on ${instance} failed (${loginPageRes.status}): ${await loginPageRes.text()}`
    )
  }
  const params = parseLoginParams(await loginPageRes.text(), instance)

  // Two-step PBKDF2 hash matching cozy-stack's password-helpers.js:
  // 1. master = PBKDF2(password, salt, iterations, 32, sha256)
  // 2. hashed = PBKDF2(master, password, 1, 32, sha256) — base64-encoded.
  const master = pbkdf2Sync(passphrase, params.salt, params.iterations, 32, 'sha256')
  const hashed = pbkdf2Sync(Uint8Array.from(master), passphrase, 1, 32, 'sha256')

  const initialCookies = loginPageRes.headers.getSetCookie?.() ?? []
  const res = await fetch(`http://${instance}:80/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: initialCookies.map(c => c.split(';')[0]).join('; ')
    },
    body: new URLSearchParams({
      passphrase: hashed.toString('base64'),
      csrf_token: params.csrfToken
    }),
    redirect: 'manual'
  })

  // Session cookie name is dynamic: sess-<hash> with Domain=cozy.localhost.
  const setCookies = res.headers.getSetCookie?.() ?? []
  const sess = setCookies.find(c => c.startsWith('sess-'))
  const m = sess?.match(/^([^=]+)=([^;]+)/)
  if (!m) {
    throw new Error(
      `POST /auth/login on ${instance} did not return a session cookie (status ${res.status}): ${await res.text()}`
    )
  }
  return { name: m[1], value: m[2] }
}

async function setupUser(
  user: User
): Promise<{ cookieName: string; cookieValue: string }> {
  console.log(`[e2e] Creating instance for ${user.label} (${user.instance})...`)
  await createInstance(user)

  console.log(`[e2e] Installing Drive app for ${user.label}...`)
  stackExec(`apps install drive file:///app/drive --domain ${user.instance}`)

  console.log(`[e2e] Setting feature flags for ${user.label}...`)
  setFlags(user.instance, FEATURE_FLAGS)

  console.log(`[e2e] Getting session cookie for ${user.label}...`)
  const cookie = await getSessionCookie(user)
  return { cookieName: cookie.name, cookieValue: cookie.value }
}

// Pre-populate each instance's address book with a contact for every other
// org member. Without this, the cozy-sharing modal only knows the recipient's
// email, and `Sharing.SendInvitations` fails over to SMTP. With the contact
// in place the modal stamps the recipient's instance URL on the share, so
// cozy-stack does a direct stack-to-stack PUT and the trusted-domain rule on
// the receiving side fires `auto_accept_trusted`.
async function createContact(hostUser: User, peer: User): Promise<void> {
  const token = stackExec(
    `instances token-cli ${hostUser.instance} io.cozy.contacts`
  )
  const res = await fetch(
    `http://${hostUser.instance}/data/io.cozy.contacts/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fullname: peer.instance.split('.')[0],
        name: { givenName: peer.instance.split('.')[0] },
        email: [{ address: peer.email, primary: true }],
        cozy: [{ url: `http://${peer.instance}`, primary: true }]
      })
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `Failed to create contact for ${peer.email} on ${hostUser.instance} (${res.status}): ${body}`
    )
  }
}

async function syncContacts(): Promise<void> {
  const entries = Object.values(USERS)
  await Promise.all(
    entries.flatMap(host =>
      entries
        .filter(peer => peer.instance !== host.instance)
        .map(peer => createContact(host, peer))
    )
  )
}

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_SKIP_TEARDOWN === '1') {
    console.log(
      '[e2e] E2E_SKIP_TEARDOWN=1 — skipping pre-run cleanup. ' +
        'Provisioning will fail if state from a previous run conflicts; ' +
        '`docker compose -f docker-compose.e2e.yml down -v` to reset.'
    )
  } else {
    console.log('[e2e] Cleaning up previous containers...')
    execSync(`docker compose -f ${COMPOSE_FILE} down -v`, {
      encoding: 'utf-8',
      cwd: process.cwd()
    })
  }

  console.log('[e2e] Starting Docker containers...')
  execSync(`docker compose -f ${COMPOSE_FILE} up -d --wait`, {
    encoding: 'utf-8',
    cwd: process.cwd()
  })

  console.log('[e2e] Waiting for cozy-stack...')
  await waitForStack(STACK_URL)

  const results = await Promise.all(
    Object.values(USERS).map(async user => {
      const cookie = await setupUser(user)
      return [user.label, { domain: user.instance, ...cookie }] as const
    })
  )
  saveAuthState(Object.fromEntries(results))

  console.log('[e2e] Cross-populating org contacts...')
  await syncContacts()

  console.log('[e2e] Setup complete.')
}
