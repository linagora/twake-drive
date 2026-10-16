import { stackExec, type User } from './config'

export interface MoveIntentReference {
  id: string
  href: string
}

export async function createMoveIntent(
  user: User
): Promise<MoveIntentReference> {
  const token = stackExec('instances', 'token-app', user.instance, 'drive')
  const response = await fetch(`http://${user.instance}/intents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: new URL(user.appUrl).origin
    },
    body: JSON.stringify({
      data: {
        type: 'io.cozy.intents',
        attributes: { action: 'MOVE', type: 'io.cozy.files' }
      }
    })
  })
  if (!response.ok) {
    throw new Error(
      `Create MOVE intent failed (${response.status}): ${await response.text()}`
    )
  }
  const body = (await response.json()) as {
    data: {
      id: string
      attributes: { services: Array<{ slug: string; href: string }> }
    }
  }
  const service = body.data.attributes.services.find(
    service => service.slug === 'drive'
  )
  if (!service) throw new Error('Drive did not declare a MOVE service')
  return { id: body.data.id, href: service.href }
}
