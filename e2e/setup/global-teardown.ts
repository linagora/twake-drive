import { execFileSync } from 'child_process'

import { composeArgs, PERSIST } from '../helpers/config'

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
}
