import { ADMIN_PASSPHRASE, ADMIN_USER, getAdminUrl } from './config'

const ADMIN_AUTH = `Basic ${Buffer.from(`${ADMIN_USER}:${ADMIN_PASSPHRASE}`).toString('base64')}`

/** The disk quota of an instance in bytes, null when it has none. */
export async function getDiskQuota(instance: string): Promise<number | null> {
  const res = await fetch(`${getAdminUrl()}/instances/${instance}`, {
    headers: { Authorization: ADMIN_AUTH, Accept: 'application/json' }
  })
  if (!res.ok) {
    throw new Error(
      `Read instance ${instance} failed (${res.status}): ${await res.text()}`
    )
  }
  // The stack serializes the quota as a string
  const body = (await res.json()) as {
    data: { attributes: { disk_quota?: string } }
  }
  const quota = body.data.attributes.disk_quota
  return quota === undefined ? null : Number(quota)
}

/** Set the disk quota of an instance, or remove it with null. */
export async function setDiskQuota(
  instance: string,
  bytes: number | null
): Promise<void> {
  // The stack reads -1 as "no quota"
  const quota = bytes === null ? -1 : bytes
  const res = await fetch(
    `${getAdminUrl()}/instances/${instance}?DiskQuota=${quota}`,
    { method: 'PATCH', headers: { Authorization: ADMIN_AUTH } }
  )
  if (!res.ok) {
    throw new Error(
      `Set the disk quota of ${instance} failed (${res.status}): ${await res.text()}`
    )
  }
}
