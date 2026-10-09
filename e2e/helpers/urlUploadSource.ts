import {
  spawn,
  execFileSync,
  type ChildProcessWithoutNullStreams
} from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createInterface } from 'readline'

import { composeArgs } from './config'

export interface UrlUploadSourceRequest {
  path: string
  authorization: string | null
  cookie: string | null
  userAgent: string | null
  hasExpectedSignature: boolean
}

export interface UrlUploadSource {
  url: string
  getRequests: () => UrlUploadSourceRequest[]
  close: () => Promise<void>
}

export async function startUrlUploadSource(): Promise<UrlUploadSource> {
  const script = await readFile(
    join(__dirname, '../fixtures/url-upload-source.js'),
    'utf8'
  )
  const child: ChildProcessWithoutNullStreams = spawn(
    'docker',
    composeArgs('exec', '-T', 'cozystack', 'node', '-e', script)
  )
  const closed = new Promise<number | null>(resolve => {
    child.once('error', () => resolve(null))
    child.once('exit', resolve)
  })
  const lines = createInterface({ input: child.stdout })
  let url: string
  try {
    url = await new Promise<string>((resolve, reject) => {
      lines.once('line', resolve)
      child.once('error', reject)
      child.once('exit', () =>
        reject(
          new Error(
            'Could not start the URL-upload source inside the test Stack'
          )
        )
      )
    })
  } catch (error: unknown) {
    child.stdin.end()
    await closed
    throw error
  } finally {
    lines.close()
  }
  return {
    url,
    getRequests: () =>
      JSON.parse(
        execFileSync(
          'docker',
          composeArgs(
            'exec',
            '-T',
            'cozystack',
            'node',
            '-e',
            '(async () => { const response = await fetch(process.argv[1]); process.stdout.write(await response.text()) })().catch(() => process.exit(1))',
            `${url}/requests`
          ),
          { encoding: 'utf8' }
        )
      ),
    close: async () => {
      child.stdin.end()
      if ((await closed) !== 0) {
        throw new Error('URL-upload source fixture exited unsuccessfully')
      }
    }
  }
}
