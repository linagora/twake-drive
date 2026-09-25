import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { composeArgs } from './config'

export function saveComposeDiagnostics(): void {
  const commands = [
    ['ps', '--all'],
    ['logs', '--no-color', '--tail', '200', 'cozystack', 'onlyoffice', 'onlyoffice-proxy']
  ]
  const output = commands.map(args => {
    try {
      return execFileSync('docker', composeArgs(...args), {
        cwd: process.cwd(),
        encoding: 'utf-8',
        maxBuffer: 5 * 1024 * 1024
      })
    } catch (error) {
      return String(error)
    }
  })
  const redacted = output
    .join('\n')
    .replace(/\/files\/downloads\/[^\s/?]+/g, '/files/downloads/[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]')
    .replace(/(Authorization: Bearer )[^\s]+/gi, '$1[redacted]')
  const outputPath = path.join(process.cwd(), 'test-results', 'compose.log')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, redacted)
}
