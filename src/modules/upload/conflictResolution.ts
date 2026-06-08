import {
  generateNewFileNameOnConflict,
  getFullpath,
  splitFilename
} from 'cozy-client/dist/models/file'
import type CozyClient from 'cozy-client/types/CozyClient'

import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { CozyFile } from '@/models'
import {
  uploadConflictStrategies,
  type UploadConflictStrategy
} from '@/modules/upload/constants'

type DriveId = string | null | undefined
type UploadOptions = Record<string, unknown>
type ConflictError = { status?: number }
type RenameLimitError = Error & { code: string }
type UploadConflictError = Error & { status: number }

type FileDoc = {
  id: string
  name?: string
  type: string
  [key: string]: unknown
}

type FilesCollection = {
  statByPath: (path: string) => Promise<{ data: FileDoc }>
  createFile: (
    file: File,
    options: UploadOptions & { dirId: string; name: string }
  ) => Promise<{ data: FileDoc }>
  createDirectory: (options: {
    name: string
    dirId: string
  }) => Promise<{ data: FileDoc }>
  updateFile: (
    file: File,
    options: UploadOptions & { fileId: string }
  ) => Promise<{ data: FileDoc }>
}

const CONFLICT_ERROR = 409
const DIRECTORY_TYPE = 'directory'
const FILE_TYPE = 'file'
export const MAX_UPLOAD_CONFLICT_RENAME_ATTEMPTS = 1000
const UPLOAD_CONFLICT_RENAME_LOG_STEP = 100

type GetConflictStrategy = () => UploadConflictStrategy | undefined
type NameResolvedCallback = (name: string) => void
type ReplaceConflictingFileParams = {
  client: CozyClient
  file: File
  fileId: string
  options?: UploadOptions
  driveId?: DriveId
}

type UploadWithRenamedFileParams = {
  client: CozyClient
  file: File
  dirID: string
  options?: UploadOptions
  driveId?: DriveId
  onNameResolved?: NameResolvedCallback
}

type ResolveFileConflictParams = {
  client: CozyClient
  file: File
  dirID: string
  uploadOptions?: UploadOptions
  driveId?: DriveId
  getConflictStrategy?: GetConflictStrategy
  onNameResolved?: NameResolvedCallback
}

type CreateFolderWithRenameOnFileCollisionParams = {
  client: CozyClient
  name: string
  dirID: string
  driveId?: DriveId
}

type ReplaceConflictResult = {
  data: FileDoc
  isUpdate: true
  finalName: string
}
type RenamedUploadResult = { data: FileDoc; isUpdate: false; finalName: string }
type PendingConflictResult = { isConflict: true }
type CancelConflictResult = { isCancel: true }
export type FileConflictResult =
  | ReplaceConflictResult
  | RenamedUploadResult
  | PendingConflictResult
  | CancelConflictResult

type FolderCollisionResult = {
  data: FileDoc
  finalName: string
  reusedExisting: boolean
}

type CozyFileModel = {
  getFullpath: (dirID: string, name: string) => Promise<string>
}

const cozyFileModel = CozyFile as CozyFileModel

/**
 * Checks whether an upload error is the server conflict response.
 *
 * @param {{status?: number}} [error] - Error returned by the file collection request.
 * @returns {boolean} True when the error is an HTTP 409 conflict.
 */
const isConflictError = (error: unknown): error is ConflictError =>
  (error as ConflictError | undefined)?.status === CONFLICT_ERROR

/**
 * Logs long rename retry loops without flooding the console.
 *
 * @param {string} type - Item type being renamed.
 * @param {number} attempt - Current rename attempt number.
 * @returns {void}
 */
const warnOnManyRenameAttempts = (type: string, attempt: number): void => {
  if (attempt % UPLOAD_CONFLICT_RENAME_LOG_STEP !== 0) return
  logger.warn(
    `Upload conflict rename for ${type} still retrying after ${attempt} attempts`
  )
}

/**
 * Builds the error used when conflict rename retries hit the safety limit.
 *
 * @param {string} type - Item type that could not be renamed.
 * @returns {Error} Error raised when no available name is found.
 */
const buildRenameLimitError = (type: string): RenameLimitError => {
  const error = new Error(
    `Could not find an available upload ${type} name after ${MAX_UPLOAD_CONFLICT_RENAME_ATTEMPTS} attempts`
  ) as RenameLimitError
  error.code = 'UPLOAD_CONFLICT_RENAME_LIMIT_REACHED'
  return error
}

/**
 * Returns the files collection for the current drive context.
 *
 * @param {object} client - CozyClient instance.
 * @param {string} [driveId] - Shared drive id.
 * @returns {object} Files collection scoped to the requested drive.
 */
const filesCollection = (
  client: CozyClient,
  driveId?: DriveId
): FilesCollection =>
  client.collection(DOCTYPE_FILES, { driveId }) as FilesCollection

/**
 * Generates the next upload conflict name for a file or folder.
 *
 * @param {string} originalName - Name that already conflicts.
 * @param {string} [type='file'] - Cozy file type used to split filename and extension.
 * @returns {string} Next generated conflict name.
 */
export const generateUploadConflictName = (
  originalName: string,
  type = FILE_TYPE
): string => {
  const { filename, extension } = splitFilename({
    name: originalName,
    type
  })

  // Cozy client owns the numeric conflict suffix generation.
  return `${generateNewFileNameOnConflict(filename)}${extension}`
}

/**
 * Stats an item by name inside a target directory.
 *
 * @param {object} client - CozyClient instance.
 * @param {string} dirID - Parent directory id.
 * @param {string} name - Item name to resolve.
 * @param {string} [driveId] - Shared drive id.
 * @returns {Promise<object>} Existing `io.cozy.files` document.
 */
const statByName = async (
  client: CozyClient,
  dirID: string,
  name: string,
  driveId?: DriveId
): Promise<FileDoc> => {
  const path = driveId
    ? await getFullpath(client, dirID, name, driveId)
    : await cozyFileModel.getFullpath(dirID, name)
  const resp = await filesCollection(client, driveId).statByPath(path)
  return resp.data
}

/**
 * Creates a file with the upload options and an explicit resolved name.
 *
 * @param {object} client - CozyClient instance.
 * @param {File} file - Browser File object to upload.
 * @param {string} dirID - Target parent directory id.
 * @param {string} name - Resolved upload name.
 * @param {object} [options] - Additional createFile options.
 * @param {string} [driveId] - Shared drive id.
 * @returns {Promise<object>} Created `io.cozy.files` document.
 */
const createFileWithName = async (
  client: CozyClient,
  file: File,
  dirID: string,
  name: string,
  options: UploadOptions = {},
  driveId?: DriveId
): Promise<FileDoc> => {
  const resp = await filesCollection(client, driveId).createFile(file, {
    ...options,
    dirId: dirID,
    name
  })
  return resp.data
}

/**
 * Creates a directory with an explicit resolved name.
 *
 * @param {object} client - CozyClient instance.
 * @param {string} name - Resolved folder name.
 * @param {string} dirID - Target parent directory id.
 * @param {string} [driveId] - Shared drive id.
 * @returns {Promise<object>} Created `io.cozy.files` folder document.
 */
const createDirectoryWithName = async (
  client: CozyClient,
  name: string,
  dirID: string,
  driveId?: DriveId
): Promise<FileDoc> => {
  const resp = await filesCollection(client, driveId).createDirectory({
    name,
    dirId: dirID
  })
  return resp.data
}

/**
 * Replaces an existing conflicted file by uploading a new version.
 *
 * @param {object} params - Replace conflict parameters.
 * @param {object} params.client - CozyClient instance.
 * @param {File} params.file - Browser File object to upload as the new version.
 * @param {string} params.fileId - Existing file id to update.
 * @param {object} [params.options] - Additional updateFile options.
 * @param {string|null} [params.driveId] - Shared drive id.
 * @returns {Promise<{data: object, isUpdate: boolean, finalName: string}>} Updated file result.
 */
export const replaceConflictingFile = async ({
  client,
  file,
  fileId,
  options = {},
  driveId = null
}: ReplaceConflictingFileParams): Promise<ReplaceConflictResult> => {
  // Replace keeps the current versioning behavior through updateFile.
  const resp = await filesCollection(client, driveId).updateFile(file, {
    fileId,
    ...options
  })

  return {
    data: resp.data,
    isUpdate: true,
    finalName: resp.data.name || file.name
  }
}

/**
 * Uploads a file under generated names until the server accepts one.
 *
 * @param {object} params - Renamed upload parameters.
 * @param {object} params.client - CozyClient instance.
 * @param {File} params.file - Browser File object to upload.
 * @param {string} params.dirID - Target parent directory id.
 * @param {object} [params.options] - Additional createFile options.
 * @param {string} [params.driveId] - Shared drive id.
 * @param {Function} [params.onNameResolved] - Callback called with each generated name before upload.
 * @returns {Promise<{data: object, isUpdate: boolean, finalName: string}>} Created file result.
 */
export const uploadWithRenamedFile = async ({
  client,
  file,
  dirID,
  options = {},
  driveId,
  onNameResolved
}: UploadWithRenamedFileParams): Promise<RenamedUploadResult> => {
  // Keep-both starts from the next generated name and retries on 409.
  let name = generateUploadConflictName(file.name)
  let attempt = 0

  while (attempt < MAX_UPLOAD_CONFLICT_RENAME_ATTEMPTS) {
    attempt += 1
    onNameResolved?.(name)
    try {
      const data = await createFileWithName(
        client,
        file,
        dirID,
        name,
        options,
        driveId
      )
      return { data, isUpdate: false, finalName: name }
    } catch (error) {
      if (!isConflictError(error)) throw error
      warnOnManyRenameAttempts(FILE_TYPE, attempt)
      name = generateUploadConflictName(name)
    }
  }

  throw buildRenameLimitError(FILE_TYPE)
}

/**
 * Resolves a file upload conflict using the current modal choice when one exists.
 *
 * @param {object} params - Conflict resolution parameters.
 * @param {object} params.client - CozyClient instance.
 * @param {File} params.file - Browser File object to upload.
 * @param {string} params.dirID - Target parent directory id.
 * @param {object} [params.uploadOptions] - Additional upload options.
 * @param {string} [params.driveId] - Shared drive id.
 * @param {Function} [params.getConflictStrategy] - Reads the latest selected modal strategy.
 * @param {Function} [params.onNameResolved] - Callback called when a renamed upload name is selected.
 * @returns {Promise<{data?: object, isUpdate?: boolean, isConflict?: boolean, isCancel?: boolean, finalName?: string}>}
 */
export const resolveFileConflict = async ({
  client,
  file,
  dirID,
  uploadOptions = {},
  driveId,
  getConflictStrategy,
  onNameResolved
}: ResolveFileConflictParams): Promise<FileConflictResult> => {
  // Only a successful stat can prove the conflict type; stat failures stay as upload errors.
  let existingItem
  try {
    existingItem = await statByName(client, dirID, file.name, driveId)
  } catch (error) {
    logger.error('Upload conflict inspection failed', error)
    throw error
  }

  // File-vs-folder conflicts never ask the user; the file gets a new name.
  if (existingItem.type === DIRECTORY_TYPE) {
    return uploadWithRenamedFile({
      client,
      file,
      dirID,
      options: uploadOptions,
      driveId,
      onNameResolved
    })
  }

  // Unknown conflicts stay as real upload errors.
  if (existingItem.type !== FILE_TYPE) {
    const error = new Error(
      `"${file.name}" already exists`
    ) as UploadConflictError
    error.status = CONFLICT_ERROR
    throw error
  }

  // Read the modal choice late so in-flight uploads can see answers saved meanwhile.
  const selectedConflictStrategy = getConflictStrategy?.()

  // Replace keeps the existing versioning behavior through updateFile.
  if (selectedConflictStrategy === uploadConflictStrategies.REPLACE) {
    return replaceConflictingFile({
      client,
      file,
      fileId: existingItem.id,
      options: uploadOptions,
      driveId
    })
  }

  // Keep-both uploads the same file with the next available generated name.
  if (selectedConflictStrategy === uploadConflictStrategies.KEEP_BOTH) {
    return uploadWithRenamedFile({
      client,
      file,
      dirID,
      options: uploadOptions,
      driveId,
      onNameResolved
    })
  }

  // Cancel skips this conflicted file without stopping the rest of the queue.
  if (selectedConflictStrategy === uploadConflictStrategies.CANCEL) {
    return { isCancel: true }
  }

  // No modal choice yet: store the row as conflict and continue uploading.
  return { isConflict: true }
}

/**
 * Creates or reuses a folder, renaming only when a file already owns the same name.
 *
 * @param {object} params - Folder collision parameters.
 * @param {object} params.client - CozyClient instance.
 * @param {string} params.name - Requested folder name.
 * @param {string} params.dirID - Target parent directory id.
 * @param {string} [params.driveId] - Shared drive id.
 * @returns {Promise<{data: object, finalName: string, reusedExisting: boolean}>} Resolved folder result.
 */
export const createFolderWithRenameOnFileCollision = async ({
  client,
  name,
  dirID,
  driveId
}: CreateFolderWithRenameOnFileCollisionParams): Promise<FolderCollisionResult> => {
  try {
    const data = await createDirectoryWithName(client, name, dirID, driveId)
    return { data, finalName: name, reusedExisting: false }
  } catch (error) {
    if (!isConflictError(error)) throw error
    const existing = await statByName(client, dirID, name, driveId)

    // folder-vs-folder keeps the existing merge/reuse behavior.
    if (existing.type === DIRECTORY_TYPE) {
      return { data: existing, finalName: name, reusedExisting: true }
    }

    if (existing.type !== FILE_TYPE) throw error
  }

  let nextName = generateUploadConflictName(name, DIRECTORY_TYPE)
  let attempt = 0

  while (attempt < MAX_UPLOAD_CONFLICT_RENAME_ATTEMPTS) {
    attempt += 1
    try {
      const data = await createDirectoryWithName(
        client,
        nextName,
        dirID,
        driveId
      )
      return { data, finalName: nextName, reusedExisting: false }
    } catch (error) {
      if (!isConflictError(error)) throw error
      const existing = await statByName(client, dirID, nextName, driveId)

      if (existing.type === DIRECTORY_TYPE) {
        return { data: existing, finalName: nextName, reusedExisting: true }
      }

      if (existing.type !== FILE_TYPE) throw error
      warnOnManyRenameAttempts(DIRECTORY_TYPE, attempt)
      // folder-vs-file keeps incrementing until a folder name is available.
      nextName = generateUploadConflictName(nextName, DIRECTORY_TYPE)
    }
  }

  throw buildRenameLimitError(DIRECTORY_TYPE)
}
