import { execFileSync } from 'child_process'
import * as fs from 'fs'

import { composeArgs, E2E_PORTS_PATH, PERSIST } from '../helpers/config'

export default function globalTeardown(): void {
  if (PERSIST) {
    console.log(
      '[e2e] Persistent mode — leaving this runtime and its data up.'
    )
    return
  }

  console.log('[e2e] Tearing down Docker containers and runtime data...')
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
