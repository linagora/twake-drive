import isValid from 'date-fns/isValid'
import parseISO from 'date-fns/parseISO'

import type { IOCozyFile } from 'cozy-client/types/types'

export interface SharingsEntry extends IOCozyFile {
  driveId?: string
}

/**
 * Raw sharing or link-permission document fields used to resolve activity.
 */
export interface SharingActivityDocument {
  id: string
  attributes?: {
    created_at?: string
    updated_at?: string
  }
}

/**
 * Sharing and permission IDs indexed by the shared document ID.
 */
export interface DocumentSharingReferences {
  sharings: string[]
  permissions: string[]
}

/**
 * Small subset of the cozy-sharing context required by the resolver.
 */
export interface SharingsTimestampContext {
  byDocId: Record<string, DocumentSharingReferences>
  getDocumentPermissions: (documentId: string) => SharingActivityDocument[]
  getSharingById: (
    sharingId: string
  ) => SharingActivityDocument | null | undefined
}

function getTimestampCandidates(
  document: SharingActivityDocument | null | undefined
): Array<string | null | undefined> {
  return [document?.attributes?.created_at, document?.attributes?.updated_at]
}

function computeLatestValidTimestamp(
  candidates: Array<string | null | undefined>
): string | null {
  let latestTimestamp: string | null = null
  let latestTime = Number.NEGATIVE_INFINITY

  for (const candidate of candidates) {
    if (!candidate) continue

    const parsedDate = parseISO(candidate)
    if (!isValid(parsedDate)) continue

    const candidateTime = parsedDate.getTime()
    if (candidateTime > latestTime) {
      latestTime = candidateTime
      latestTimestamp = candidate
    }
  }

  return latestTimestamp
}

function getSharingDocuments(
  entry: SharingsEntry,
  documentId: string,
  context: SharingsTimestampContext
): Array<SharingActivityDocument | null | undefined> {
  if (entry.driveId) {
    // Shared-drive roots use their drive sharing id and are not indexed byDocId.
    return [context.getSharingById(entry.driveId)]
  }

  const sharingIds = context.byDocId[documentId]?.sharings ?? []
  return sharingIds.map(sharingId => context.getSharingById(sharingId))
}

export function getSharingsLastUpdatedAt(
  entry: SharingsEntry,
  context: SharingsTimestampContext
): string | null {
  const documentId = entry._id ?? entry.id ?? null
  // Pending invitations carry local activity on the shortcut, not metadata.target.
  const fileTimestamps = [entry.created_at, entry.updated_at]
  if (documentId === null) {
    return computeLatestValidTimestamp(fileTimestamps)
  }

  const sharingTimestamps = getSharingDocuments(
    entry,
    documentId,
    context
  ).flatMap(getTimestampCandidates)
  // Link-only shares may have permission activity without a sharing document.
  const permissionTimestamps = context
    .getDocumentPermissions(documentId)
    .flatMap(getTimestampCandidates)

  return computeLatestValidTimestamp([
    ...fileTimestamps,
    ...sharingTimestamps,
    ...permissionTimestamps
  ])
}
