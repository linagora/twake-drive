import { execFileSync } from 'child_process'

import { composeArgs } from './config'

const MANAGEMENT_URL = 'http://rabbitmq:15672/api'
const ACTIVITY_QUEUE = 'e2e.activity'

// Runs in the stack container: the management API is only reachable inside
// the runtime. Arguments: method, URL, JSON body (may be empty).
const REQUEST_SCRIPT = `
const [method, url, body] = process.argv.slice(1)
;(async () => {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from('cozy:cozy').toString('base64'),
      'Content-Type': 'application/json'
    },
    body: body || undefined
  })
  const text = await res.text()
  if (!res.ok) throw new Error(method + ' ' + url + ': ' + res.status + ' ' + text)
  process.stdout.write(text)
})().catch(err => {
  console.error(err.message)
  process.exit(1)
})
`

function request(method: string, path: string, body?: unknown): string {
  return execFileSync(
    'docker',
    composeArgs(
      'exec',
      '-T',
      'cozystack',
      'node',
      '-e',
      REQUEST_SCRIPT,
      method,
      `${MANAGEMENT_URL}${path}`,
      body === undefined ? '' : JSON.stringify(body)
    ),
    { encoding: 'utf-8', cwd: process.cwd() }
  )
}

/** Publish a JSON message, as the directory or another app would. Throws when
 * no queue is bound to the routing key, as the stack would never receive it. */
export function publish(
  exchange: string,
  routingKey: string,
  message: unknown
): void {
  const res = JSON.parse(
    request('POST', `/exchanges/%2F/${exchange}/publish`, {
      properties: { content_type: 'application/json' },
      routing_key: routingKey,
      payload: JSON.stringify(message),
      payload_encoding: 'string'
    })
  ) as { routed: boolean }
  if (!res.routed) {
    throw new Error(`No queue is bound to ${routingKey} on ${exchange}`)
  }
}

/** The stack replies to the commands of other apps on the activity exchange,
 * and a command whose reply cannot be routed fails: this queue receives the
 * replies. Idempotent, for persistent runtimes. */
export function declareActivityQueue(): void {
  request('PUT', '/exchanges/%2F/activity', { type: 'topic', durable: true })
  request('PUT', `/queues/%2F/${ACTIVITY_QUEUE}`, {
    durable: true,
    arguments: { 'x-max-length': 1000 }
  })
  request('POST', `/bindings/%2F/e/activity/q/${ACTIVITY_QUEUE}`, {
    routing_key: '#'
  })
}
