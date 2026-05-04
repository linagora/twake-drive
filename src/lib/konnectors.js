import { getReferencedBy } from 'cozy-client'

import { DOCTYPE_KONNECTORS } from '@/lib/doctypes'

/**
 * Returns the slug of the konnector that produced the given file, or null
 * if the file is not referenced by any konnector.
 *
 * Konnector-created files carry an explicit `io.cozy.konnectors/<slug>`
 * entry in their `referenced_by` list. We read the first such reference
 * and strip the doctype prefix to recover the bare slug (e.g. "edf").
 *
 * `cozyMetadata.createdByApp` is intentionally not used: it is set by any
 * app or konnector that creates files (drive, notes, ...), so its value
 * can be an app slug that does not exist as a konnector and would 404
 * against `GET /konnectors/<slug>` on cozy-stack.
 *
 * @param {import('cozy-client/types/types').IOCozyFile} file - A file doc with its references hydrated.
 * @returns {string|null} The konnector slug, or null when the file has no konnector reference.
 */
export const getKonnectorSlugFromFile = file => {
  const ref = getReferencedBy(file, DOCTYPE_KONNECTORS)[0]
  return ref?.id?.replace(`${DOCTYPE_KONNECTORS}/`, '') ?? null
}
