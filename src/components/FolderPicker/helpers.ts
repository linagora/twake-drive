import CozyClient from 'cozy-client/types/CozyClient'
import { IOCozyFile, NextcloudFile } from 'cozy-client/types/types'

import { FolderPickerEntry, File } from '@/components/FolderPicker/types'
import { ROOT_DIR_ID } from '@/constants/config'
import { getParentPath } from '@/lib/path'
import {
  buildFileOrFolderByIdQuery,
  buildNextcloudFolderQuery,
  buildSharedDriveFileOrFolderByIdQuery,
  buildSharedDriveIdQuery
} from '@/queries'

/**
 * Checks if the target is an invalid move target based on the subjects and target provided.
 *
 * @param subjects - The array of subjects to check against.
 * @param target - The target object to check.
 * @returns - Returns true if the target is an invalid move target, otherwise false.
 */
export const isInvalidMoveTarget = (
  subjects: FolderPickerEntry[],
  target: File
): boolean => {
  const isASubject = subjects.find(subject => subject._id === target._id)
  const isAFile =
    target.type === 'file' &&
    (target._type === 'io.cozy.remote.nextcloud.files' ||
      target.cozyMetadata?.createdByApp !== 'nextcloud')
  return isAFile || isASubject !== undefined
}

/**
 * Returns whether one of the targeted folders is part of the current folder
 *
 * @param targets - List of folders
 * @param folder - The id of the current folder
 * @returns - Whether one of the targeted folders is part of the current folder
 */
export const areTargetsInCurrentDir = (
  targets: FolderPickerEntry[],
  folder?: File
): boolean => {
  if (!folder) return false

  return targets.every(target => {
    if (target.dir_id) {
      return target.dir_id === folder._id
    }
    if (target._type === folder._type && target.path) {
      return getParentPath(target.path) === folder.path
    }
    return false
  })
}

/**
 * Retrieves the parent folder of a given file from the Cozy client.
 *
 * @param client - The Cozy client instance.
 * @param folder - The file for which to retrieve the parent folder.
 * @returns A promise that resolves to the parent folder of the given file, or undefined if not found.
 */
const getCozyParentFolder = async (
  client: CozyClient | null,
  id: string,
  driveId?: string
): Promise<IOCozyFile> => {
  const parentFolderQuery = driveId
    ? buildSharedDriveFileOrFolderByIdQuery({ fileId: id, driveId })
    : buildFileOrFolderByIdQuery(id)
  const parentFolder = (await client?.fetchQueryAndGetFromState({
    definition: parentFolderQuery.definition(),
    options: parentFolderQuery.options
  })) as {
    data?: IOCozyFile
  }

  if (!parentFolder.data) {
    throw new Error('Parent folder not found')
  }

  return parentFolder.data
}

/**
 * Returns the root folder object for Nextcloud.
 *
 * @param options - The options for getting the root folder.
 * @param options.sourceAccount - The id of account that n.
 * @param options.instanceName - The instance name of the Nextcloud server.
 * @returns - The root folder object.
 */
export const computeNextcloudRootFolder = ({
  sourceAccount,
  instanceName
}: {
  sourceAccount: string
  instanceName?: string
}): NextcloudFile => ({
  id: 'io.cozy.remote.nextcloud.files.root-dir',
  _id: 'io.cozy.remote.nextcloud.files.root-dir',
  _type: 'io.cozy.remote.nextcloud.files',
  name: `${instanceName ?? ''} (Nextcloud)`,
  path: '/',
  parentPath: '',
  cozyMetadata: {
    sourceAccount: sourceAccount
  },
  type: 'directory',
  links: {
    self: 'unknown'
  },
  size: 0,
  updated_at: new Date().toISOString()
})

/**
 * Retrieves the parent folder of a given Nextcloud file.
 *
 * @param client - The CozyClient instance used to fetch the parent folder.
 * @param folder - The Nextcloud file for which to retrieve the parent folder.
 * @param instanceName - The display name of the Nextcloud instance.
 * @returns The parent folder, or the local Drive root when leaving Nextcloud.
 */
async function getNextcloudParentFolder(
  client: CozyClient | null,
  folder: NextcloudFile,
  instanceName?: string
): Promise<File> {
  if (folder.path === '/') {
    return await getCozyParentFolder(client, ROOT_DIR_ID)
  }
  if (folder.parentPath === '/') {
    return computeNextcloudRootFolder({
      sourceAccount: folder.cozyMetadata.sourceAccount,
      instanceName
    })
  }

  const parentFolderQuery = buildNextcloudFolderQuery({
    sourceAccount: folder.cozyMetadata.sourceAccount,
    path: getParentPath(folder.parentPath) ?? 'unknown'
  })
  const parentFolderResult = (await client?.fetchQueryAndGetFromState({
    definition: parentFolderQuery.definition(),
    options: parentFolderQuery.options
  })) as {
    data?: NextcloudFile[]
  }
  const parentFolder = (parentFolderResult.data ?? []).find(
    file => file.path === folder.parentPath
  )

  if (!parentFolder) {
    throw new Error('Parent folder not found')
  }

  return parentFolder
}

/**
 * Retrieves the parent folder of a given file.
 *
 * @param client - The CozyClient instance.
 * @param folder - The file for which to retrieve the parent folder.
 * @param instanceName - (Optional) The name of the Cozy instance.
 * @returns A Promise that resolves to the parent folder of the given file, or undefined if the file is the root folder.
 */
export async function getParentFolder(
  client: CozyClient | null,
  folder: File,
  { instanceName }: { instanceName?: string }
): Promise<File> {
  if (folder._type === 'io.cozy.remote.nextcloud.files') {
    return await getNextcloudParentFolder(client, folder, instanceName)
  }

  if (folder.driveId) {
    const sharingQuery = buildSharedDriveIdQuery({ driveId: folder.driveId })
    const result = (await client?.fetchQueryAndGetFromState({
      definition: sharingQuery.definition(),
      options: sharingQuery.options
    })) as { data?: { rules?: { values?: string[] }[] } } | null
    if (
      !folder.dir_id ||
      result?.data?.rules?.[0]?.values?.[0] === folder._id
    ) {
      return await getCozyParentFolder(client, ROOT_DIR_ID)
    }
  }
  return await getCozyParentFolder(client, folder.dir_id, folder.driveId)
}
