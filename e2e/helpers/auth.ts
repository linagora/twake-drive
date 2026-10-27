import * as fs from 'fs'
import * as path from 'path'
import type { Page } from '@playwright/test'
import { ROOT_DOMAIN, USERS, type UserLabel } from './config'

const AUTH_STATE_PATH =
  process.env.E2E_AUTH_STATE_PATH ||
  path.join(__dirname, '..', '.auth-state.json')

/** Session cookies of every provisioned instance, keyed by instance domain
 * since each Playwright worker uses its own Alice, Bob and Charlie. */
export interface AuthState {
  [instance: string]: {
    domain: string
    cookieName: string
    cookieValue: string
  }
}

export function loadAuthState(): AuthState {
  return JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf-8'))
}

export function saveAuthState(state: AuthState): void {
  fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify(state, null, 2))
}

export async function authenticate(page: Page, user: UserLabel): Promise<void> {
  const { cookieName, cookieValue } = loadAuthState()[USERS[user].instance]
  // Cookie is pinned to the parent domain so it covers both the instance
  // (e.g. alice.cozy.localhost) and its app subdomain (alice-drive.cozy.localhost).
  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: `.${ROOT_DOMAIN}`,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax'
    }
  ])
}
