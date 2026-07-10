import CozyClient, { generateWebLink, models } from 'cozy-client'
import { makeSharingLink } from 'cozy-client/dist/models/sharing'

import { TEMPORARY_LINK_TTL } from './constants'

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
 * Check if a permission is related to a specific file
 */
const isPermissionRelatedTo = (perm, file) => {
  const fileId = getFileId(file)
  return perm.attributes?.permissions?.files?.values?.includes(fileId)
}

/**
 * Fetch an existing sharing link for a file, if one exists.
 * This avoids creating duplicate sharing links.
 *
 * @param {object} client - CozyClient instance
 * @param {object} file - File document
 * @returns {Promise<string|null>} - The existing sharing link or null
 */
const fetchExistingSharingLink = async (client, file) => {
  try {
    const permissionsCol = client.collection('io.cozy.permissions')
    const result = await permissionsCol.findLinksByDoctype('io.cozy.files')
    const permissions = result?.data ?? []

    const existingPermission = permissions.find(perm =>
      isPermissionRelatedTo(perm, file)
    )

    if (!existingPermission) {
      return null
    }

    const sharecode = getShortcode(existingPermission)

    if (!sharecode) {
      return null
    }

    return generateWebLink({
      cozyUrl: client.getStackClient().uri,
      searchParams: [['sharecode', sharecode]],
      pathname: '/public',
      slug: 'drive',
      subDomainType: client.capabilities.flat_subdomains ? 'flat' : 'nested'
    })
  } catch {
    // Silently fail if we can't fetch existing links — we'll create a new one
    return null
  }
}

/**
 * Get an existing sharing link for a file, or create a new one if none exists.
 *
 * @param {object} client - CozyClient instance
 * @param {object} file - File document
 * @returns {Promise<string>} - The sharing link
 */
export const getOrCreateSharingLink = async (client, file) => {
  const existingLink = await fetchExistingSharingLink(client, file)

  return existingLink || makeSharingLink(client, [getFileId(file)])
}

/**
 * Create temporary download links for files.
 * A single temporary sharing link grants access to all the files, then
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
  const downloadLinks = await Promise.all(
    files.map(file =>
      filesCollection.getDownloadLinkById(getFileId(file), file.name)
    )
  )

  return downloadLinks
}
