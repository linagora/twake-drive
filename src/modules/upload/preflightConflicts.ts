import type CozyClient from 'cozy-client/types/CozyClient'
import type { IOCozyFile } from 'cozy-client/types/types'

import { paginatedStatById, type PaginatedStatByIdResult } from '@/lib/files'

const DIRECTORY_TYPE = 'directory'
const FILE_TYPE = 'file'

type DriveId = string | null | undefined
type UploadEntryType = typeof DIRECTORY_TYPE | typeof FILE_TYPE

interface UploadEntry {
  root?: boolean
  file?: File | null
  isDirectory?: boolean
  entry?: { name?: string } | null
}

interface UploadFirstLevelEntry {
  name: string
  type: UploadEntryType
}

type ExistingFirstLevelItem = IOCozyFile & {
  _id?: string
  name: string
  type: string
}

interface HasPreflightUploadConflictsParams {
  client: CozyClient
  entries: UploadEntry[]
  folderId: string
  driveId?: DriveId
}

/**
 * Fetch all first-level items from the upload target folder.
 *
 * @param client - cozy-client instance
 * @param folderId - Folder that will receive the upload
 * @param driveId - Shared drive id
 * @returns First-level `io.cozy.files` documents
 */
export const fetchFolderFirstLevelItems = async (
  client: CozyClient,
  folderId: string,
  driveId?: DriveId
): Promise<ExistingFirstLevelItem[]> => {
  const statById = paginatedStatById(client, driveId)
  const items: ExistingFirstLevelItem[] = []
  let cursor: string | null = null

  do {
    const result: PaginatedStatByIdResult = await statById(folderId, cursor)
    items.push(...(result.included as ExistingFirstLevelItem[]))
    cursor = result.nextCursor
  } while (cursor)

  return items
}

/**
 * Read the first-level names that this drop will create in the target folder.
 *
 * @param entries - Browser-provided upload entries before flattening
 * @returns First-level upload entries
 */
export const getUploadFirstLevelEntries = (
  entries: UploadEntry[]
): UploadFirstLevelEntry[] => {
  return entries
    .filter(entry => entry.root)
    .map(entry => {
      if (entry.isDirectory && entry.entry?.name) {
        return { name: entry.entry.name, type: DIRECTORY_TYPE }
      }
      return { name: entry.file?.name ?? '', type: FILE_TYPE }
    })
    .filter(entry => entry.name)
}

/**
 * Check first-level name conflicts that should open the upload modal early.
 *
 * @param uploadEntries - First-level upload entries
 * @param existingItems - Current first-level folder contents
 * @returns True when at least one first-level name conflict exists
 */
export const hasMatchingPreflightUploadConflict = (
  uploadEntries: UploadFirstLevelEntry[],
  existingItems: ExistingFirstLevelItem[]
): boolean => {
  const uploadedEntryNames = new Set(uploadEntries.map(entry => entry.name))

  return existingItems.some(item => uploadedEntryNames.has(item.name))
}

/**
 * Check whether the upload target already contains a first-level item
 * that should open the upload conflict modal before enqueueing.
 *
 * @param client - cozy-client instance
 * @param entries - Browser-provided upload entries before flattening
 * @param folderId - Folder that will receive the upload
 * @param driveId - Shared drive id
 * @returns True when the preflight scan finds a first-level name conflict
 */
export const hasPreflightUploadConflicts = async ({
  client,
  entries,
  folderId,
  driveId
}: HasPreflightUploadConflictsParams): Promise<boolean> => {
  const uploadFirstLevelEntries = getUploadFirstLevelEntries(entries)
  const existingItems = await fetchFolderFirstLevelItems(
    client,
    folderId,
    driveId
  )

  return hasMatchingPreflightUploadConflict(
    uploadFirstLevelEntries,
    existingItems
  )
}
