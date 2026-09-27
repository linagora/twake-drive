import { execFileSync } from 'child_process'
import * as fs from 'fs'

import { composeArgs, E2E_PORTS_PATH, PERSIST } from '../helpers/config'
import { saveComposeDiagnostics } from '../helpers/compose-diagnostics'

export default function globalTeardown(): void {
  if (PERSIST) {
    console.log('[e2e] Persistent mode — leaving this runtime and its data up.')
    return
  }

  console.log('[e2e] Tearing down Docker containers and runtime data...')
  try {
    saveComposeDiagnostics()
  } catch (error) {
    console.error('[e2e] Could not collect Compose diagnostics:', error)
  }
  execFileSync('docker', composeArgs('down', '--volumes'), {
    stdio: 'inherit',
    cwd: process.cwd()
  })

  if (fs.existsSync(E2E_PORTS_PATH)) {
    try {
      fs.unlinkSync(E2E_PORTS_PATH)
    } catch {
      // ignore
    }
  }
}
