import type CozyClient from 'cozy-client/types/CozyClient'
import { getIllegalCharacters as getUntypedIllegalCharacters } from 'cozy-stack-client/dist/getIllegalCharacter'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import {
  isConflictError,
  uploadWithRenamedFile,
  type FileDoc
} from '@/modules/upload/conflictResolution'
import { buildFileOrFolderByIdQuery } from '@/queries'

export interface UrlUploadConfig {
  url: string
  folderId: string
  name: string
}

// cozy-stack-client does not ship types for this filename validator.
const getIllegalCharacters = getUntypedIllegalCharacters as (
  name: string
) => string

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function getUploadName(name: string): string {
  if (
    name.trim() === '.' ||
    name.trim() === '..' ||
    getIllegalCharacters(name)
  ) {
    throw new Error('Invalid file name')
  }
  return name.trim()
}

function getUploadFolderId(folderId: string): string {
  if (
    folderId.includes('/') &&
    folderId !== 'io.cozy.apps/mail' &&
    folderId !== 'io.cozy.apps/notes'
  ) {
    throw new Error('Unsupported destination')
  }
  return folderId
}

function getUploadSourceUrl(url: string): string {
  let source: URL
  try {
    source = new URL(url)
  } catch {
    throw new Error('Invalid source URL')
  }
  if (
    !['http:', 'https:'].includes(source.protocol) ||
    !source.hostname ||
    source.username ||
    source.password
  ) {
    throw new Error('Source URL must be HTTP(S) without credentials')
  }
  return url
}

function getUploadConfig(data: unknown): UrlUploadConfig {
  if (!data || typeof data !== 'object') throw new Error('Invalid upload data')
  const { url, folderId, name } = data as Partial<UrlUploadConfig>
  if (
    !isNonEmptyString(url) ||
    !isNonEmptyString(folderId) ||
    !isNonEmptyString(name)
  ) {
    throw new Error('url, folderId and name are required')
  }
  const validatedName = getUploadName(name)
  const validatedFolderId = getUploadFolderId(folderId)
  return {
    url: getUploadSourceUrl(url),
    folderId: validatedFolderId,
    name: validatedName
  }
}

function getHttpErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const { status } = error
  return typeof status === 'number' &&
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
    ? status
    : null
}

export function normalizeUrlUploadError(error: unknown): Error {
  const status = getHttpErrorStatus(error)
  // FetchError's URL, reason and message can contain the signed SourceURL.
  const safeError = new Error(
    status ? `URL upload failed (HTTP ${status})` : 'URL upload failed'
  )
  return status ? Object.assign(safeError, { status }) : safeError
}

function isDirectoryWithId(
  folder: unknown
): folder is { _id: string; type: 'directory' } {
  return (
    !!folder &&
    typeof folder === 'object' &&
    '_id' in folder &&
    typeof folder._id === 'string' &&
    !!folder._id &&
    'type' in folder &&
    folder.type === 'directory'
  )
}

function getLocalFolderId(folder: unknown): string {
  if (!isDirectoryWithId(folder)) {
    throw new Error('The destination is not a local Drive folder')
  }
  if (
    ('trashed' in folder && folder.trashed) ||
    folder._id === 'io.cozy.files.trash-dir' ||
    ('driveId' in folder && folder.driveId)
  ) {
    throw new Error('The destination is not a local Drive folder')
  }
  return folder._id
}

export async function uploadFileFromUrl(
  client: CozyClient,
  data: unknown,
  signal: AbortSignal
): Promise<FileDoc> {
  const config = getUploadConfig(data)
  signal.throwIfAborted()
  const query = buildFileOrFolderByIdQuery(config.folderId)
  const result = await client.fetchQueryAndGetFromState({
    definition: query.definition(),
    options: query.options
  })
  const dirId = getLocalFolderId(result.data)
  const createFile = async (name: string): Promise<FileDoc> => {
    signal.throwIfAborted()
    const response = (await client.create(DOCTYPE_FILES, {
      type: 'file',
      sourceURL: config.url,
      dirId,
      name
    })) as { data: FileDoc }
    return response.data
  }
  try {
    return await createFile(config.name)
  } catch (error: unknown) {
    if (!isConflictError(error)) throw error
    const response = await uploadWithRenamedFile({
      client,
      name: config.name,
      dirID: dirId,
      createFile
    })
    return response.data
  }
}
