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

/**
 * Version-history helpers. The Drive UI renames a same-name upload rather than
 * overwriting it, so the only way to build a version history for a test is to
 * PUT new content onto an existing file, which is what the stack records as a
 * version.
 */

const ROOT_DIR_ID = 'io.cozy.files.root-dir'

function filesToken(instance: string): string {
  return stackExec('instances', 'token-cli', instance, 'io.cozy.files')
}

interface FileRef {
  instance: string
  fileId: string
}

/** Create a text file at the root of the instance and return its id. */
export async function createFile({
  instance,
  name,
  content
}: {
  instance: string
  name: string
  content: string
}): Promise<string> {
  const res = await fetch(
    `http://${instance}/files/${ROOT_DIR_ID}?Type=file&Name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${filesToken(instance)}`,
        'Content-Type': 'text/plain'
      },
      body: content
    }
  )
  if (!res.ok) {
    throw new Error(
      `Create file ${name} on ${instance} failed (${res.status}): ${await res.text()}`
    )
  }
  const body = (await res.json()) as { data: { id: string } }
  return body.data.id
}

/** Overwrite a file's content, which makes the stack keep the former one as a version. */
export async function overwriteFile({
  instance,
  fileId,
  content
}: FileRef & { content: string }): Promise<void> {
  const res = await fetch(`http://${instance}/files/${fileId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${filesToken(instance)}`,
      'Content-Type': 'text/plain'
    },
    body: content
  })
  if (!res.ok) {
    throw new Error(
      `Overwrite file ${fileId} on ${instance} failed (${res.status}): ${await res.text()}`
    )
  }
}

/** Number of versions the stack currently keeps for a file. */
export async function countFileVersions({
  instance,
  fileId
}: FileRef): Promise<number> {
  const res = await fetch(`http://${instance}/files/${fileId}`, {
    headers: {
      Authorization: `Bearer ${filesToken(instance)}`,
      Accept: 'application/json'
    }
  })
  if (!res.ok) {
    throw new Error(
      `Get file ${fileId} on ${instance} failed (${res.status}): ${await res.text()}`
    )
  }
  const body = (await res.json()) as {
    included?: { type: string }[]
  }
  return (body.included ?? []).filter(
    doc => doc.type === 'io.cozy.files.versions'
  ).length
}
