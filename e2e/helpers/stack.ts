import { stackExec } from './config'

/**
 * Stack-side helpers for tests that need to manipulate state the UI can't
 * reach. The expiration DatePicker has `minDate = today`, so a share link can
 * never be made expired through the UI; to test enforcement we create the
 * link with a future date and then backdate the permission's `expires_at`
 * directly on the stack.
 *
 * A share-by-link is an `io.cozy.permissions` doc. The stack lists them per
 * doctype at `/permissions/doctype/:doctype/shared-by-link` and updates them at
 * `/permissions/:id`. The update is restricted to the permission's parent, so
 * we use the drive app token (which created the link) rather than a plain
 * doctype token.
 */

interface PermissionDoc {
  id: string
  attributes: {
    expires_at?: string
    permissions?: Record<string, { values?: string[]; verbs?: string[] }>
  }
}

/** Mint an app token for the drive app, the parent of the link permission. */
function driveAppToken(instance: string): string {
  return stackExec('instances', 'token-app', instance, 'drive')
}

/** Find the share-by-link permission whose rule targets `fileId`. */
export async function findLinkPermission(
  instance: string,
  fileId: string
): Promise<PermissionDoc> {
  const token = driveAppToken(instance)
  const res = await fetch(
    `http://${instance}/permissions/doctype/io.cozy.files/shared-by-link`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    }
  )
  if (!res.ok) {
    throw new Error(
      `List sharedByLink permissions on ${instance} failed (${res.status}): ${await res.text()}`
    )
  }
  const body = (await res.json()) as { data: PermissionDoc[] }
  const match = body.data.find(doc =>
    Object.values(doc.attributes.permissions ?? {}).some(rule =>
      (rule.values ?? []).includes(fileId)
    )
  )
  if (!match) {
    throw new Error(
      `No share-by-link permission found for ${fileId} on ${instance}`
    )
  }
  return match
}

/** PATCH a permission's `expires_at` to an arbitrary instant (past = expired). */
export async function setLinkExpiry(
  instance: string,
  permissionId: string,
  expiresAt: Date
): Promise<void> {
  const token = driveAppToken(instance)
  const res = await fetch(`http://${instance}/permissions/${permissionId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      data: {
        type: 'io.cozy.permissions',
        id: permissionId,
        attributes: { expires_at: expiresAt.toISOString() }
      }
    })
  })
  if (!res.ok) {
    throw new Error(
      `PATCH permission ${permissionId} on ${instance} failed (${res.status}): ${await res.text()}`
    )
  }
}
