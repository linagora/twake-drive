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
    return { status: 'not_found' }
  }

  const sharecode = getShortcode(existingPermission)
  if (!sharecode) {
    return { status: 'no_sharecode' }
  }

  return {
    status: 'found',
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
    result = { status: 'not_found' }
  }

  return result.status === 'found'
    ? result.url
    : makeSharingLink(client, [getFileId(file)])
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
