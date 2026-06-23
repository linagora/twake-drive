import { execSync } from 'child_process'

import { COMPOSE_FILE } from '../helpers/config'

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_SKIP_TEARDOWN === '1') {
    console.log('[e2e] E2E_SKIP_TEARDOWN=1 — leaving containers up.')
    return
  }
  console.log('[e2e] Tearing down Docker containers...')
  execSync(`docker compose -f ${COMPOSE_FILE} down -v`, {
    stdio: 'inherit',
    cwd: process.cwd()
  })
}
