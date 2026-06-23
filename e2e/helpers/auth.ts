import * as fs from 'fs'
import * as path from 'path'
import type { Page } from '@playwright/test'

const AUTH_STATE_PATH = path.join(__dirname, '..', '.auth-state.json')

export interface AuthState {
  [user: string]: {
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

export async function authenticate(page: Page, user: string): Promise<void> {
  const { cookieName, cookieValue } = loadAuthState()[user]
  // Cookie is pinned to the parent domain so it covers both the instance
  // (alice.cozy.localhost) and its app subdomain (alice-drive.cozy.localhost).
  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: '.cozy.localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax'
    }
  ])
}
