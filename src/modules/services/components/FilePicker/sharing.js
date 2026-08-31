import CozyClient, { generateWebLink, models } from 'cozy-client'
import { makeSharingLink } from 'cozy-client/dist/models/sharing'

import { filePickerSharingLinkStatuses, TEMPORARY_LINK_TTL } from './constants'

const {
  file: { isFile }
} = models

/**
 * Get the file id from a file object
 */
export const getFileId = file => file._id || file.id

/**
 * Get the shortcode from a permission object.
 */
const getShortcode = permission => {
  return permission?.attributes?.shortcodes?.code || null
}

/**
 * Fetch a public link for a file without creating or updating permissions.
 * The strict mode only accepts permissions concerning this file alone.
 */
export async function fetchExistingSharingLink(
  client,
  file,
  { singleFileOnly = false } = {}
) {
  const permissionsCol = client.collection('io.cozy.permissions')
  const result = await permissionsCol.findLinksByDoctype('io.cozy.files')
  const permissions = result?.data ?? []
  const fileId = getFileId(file)

  const existingPermission = permissions.find(permission => {
    const fileIds = permission.attributes?.permissions?.files?.values ?? []
    return fileIds.includes(fileId) && (!singleFileOnly || fileIds.length === 1)
  })

  if (!existingPermission) {
    return { status: filePickerSharingLinkStatuses.NOT_FOUND }
  }

  const sharecode = getShortcode(existingPermission)
  if (!sharecode) {
    return { status: filePickerSharingLinkStatuses.NO_SHARECODE }
  }

  return {
    status: filePickerSharingLinkStatuses.FOUND,
    url: generateWebLink({
      cozyUrl: client.getStackClient().uri,
      searchParams: [['sharecode', sharecode]],
      pathname: '/public',
      slug: 'drive',
      subDomainType: client.capabilities.flat_subdomains ? 'flat' : 'nested'
    })
  }
}

export async function getOrCreateSharingLink(client, file) {
  let result
  try {
    result = await fetchExistingSharingLink(client, file)
  } catch {
    result = { status: filePickerSharingLinkStatuses.NOT_FOUND }
  }

  return result.status === filePickerSharingLinkStatuses.FOUND
    ? result.url
    : makeSharingLink(client, [getFileId(file)])
}

/**
 * Create temporary download links for files without a drive.
 */
async function makeTemporaryDownloadLinksForDriveLessFiles(client, files) {
  const temporarySharingLink = await makeSharingLink(
    client,
    files.map(getFileId),
    {
      ttl: TEMPORARY_LINK_TTL
    }
  )
  const stackUri = client.getStackClient().uri
  const sharecode = new URL(temporarySharingLink, stackUri).searchParams.get(
    'sharecode'
  )

  if (!sharecode) {
    throw new Error('Temporary sharing link does not contain a sharecode')
  }

  const publicClient = new CozyClient({
    uri: stackUri,
    token: sharecode,
    useCustomStore: true
  })
  const filesCollection = publicClient.collection('io.cozy.files')
  return Promise.all(
    files.map(file =>
      filesCollection.getDownloadLinkById(getFileId(file), file.name)
    )
  )
}

/**
 * Create temporary download links for files.
 * A single temporary sharing link grants access to drive-less files, then
 * the public client creates one direct download link per file.
 *
 * @param {object} client - CozyClient instance
 * @param {object[]} files - File documents
 * @returns {Promise<string[]>} - The download links in file order
 */
export const makeTemporaryDownloadLinks = async (client, files) => {
  if (files.some(file => !isFile(file))) {
    throw new Error('Temporary download links are only available for files')
  }

  const filesByDriveId = new Map()
  files.forEach((file, index) => {
    const driveId = file.driveId || null
    const group = filesByDriveId.get(driveId) || []
    group.push({ file, index })
    filesByDriveId.set(driveId, group)
  })

  const downloadLinks = Array(files.length)
  await Promise.all(
    [...filesByDriveId].map(async ([driveId, group]) => {
      const groupFiles = group.map(({ file }) => file)
      let links
      if (driveId) {
        const filesCollection = client.collection('io.cozy.files', {
          driveId
        })
        links = await Promise.all(
          groupFiles.map(file =>
            filesCollection.getDownloadLinkById(getFileId(file), file.name)
          )
        )
      } else {
        links = await makeTemporaryDownloadLinksForDriveLessFiles(
          client,
          groupFiles
        )
      }

      group.forEach(({ index }, groupIndex) => {
        downloadLinks[index] = links[groupIndex]
      })
    })
  )

  return downloadLinks
}
