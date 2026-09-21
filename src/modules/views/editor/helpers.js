import { deconstructRedirectLink, generateWebLink } from 'cozy-client'

import { SHARING_TAB_WITH_ME } from '@/constants/config'
import { makeDriveWebLink } from '@/modules/shareddrives/helpers'
import { getSharingsTabRoute } from '@/modules/views/Sharings/routes'

/**
 * @typedef {Object} EditorRouteOptions
 * @property {string} [driveId] Id of the shared drive the file belongs to
 * @property {string} [fromPathname] Hash to redirect the user to when he comes back
 * @property {boolean} [fromPublicFolder] The document is opened from a public folder
 */

/**
 * Builds the in-app route to open a file in an editor mounted at `/${slug}`.
 *
 * @param {string} slug - The editor route prefix (e.g. "pdf", "excalidraw")
 * @param {string} fileId - Id of the file
 * @param {EditorRouteOptions} [options]
 * @returns {string}
 */
export const makeEditorFileRoute = (
  slug,
  fileId,
  { driveId, fromPathname, fromPublicFolder = false } = {}
) => {
  const params = new URLSearchParams()
  if (fromPathname) {
    params.append('redirectLink', `drive#${fromPathname}`)
  }
  if (fromPublicFolder) {
    params.append('fromPublicFolder', fromPublicFolder)
  }

  const searchParam = params.size > 0 ? `?${params.toString()}` : ''

  if (driveId) {
    return `/${slug}/${driveId}/${fileId}${searchParam}`
  }

  return `/${slug}/${fileId}${searchParam}`
}

/**
 * Reads the file binary, scoped to the shared drive when the file belongs to
 * one. The stack serves /download/:id without Cache-Control, so the browser
 * may reuse a stale copy for days on an old file: bypass the cache so an editor
 * never reopens (and then autosaves over) an outdated version.
 *
 * @param {object} client - cozy-client
 * @param {string} fileId - Id of the file
 * @param {string} [driveId] - Shared drive the file belongs to
 * @returns {Promise<Response>}
 */
export const fetchFileBinary = (client, fileId, driveId) => {
  const collection = client.collection(
    'io.cozy.files',
    driveId ? { driveId } : {}
  )
  return collection.stackClient.fetch(
    'GET',
    `${collection.prefix}/download/${encodeURIComponent(fileId)}`,
    undefined,
    { cache: 'no-store' }
  )
}

/**
 * Writes the edited content back to the file binary, scoped to the shared drive
 * when the file belongs to one.
 *
 * @param {object} client - cozy-client
 * @param {object} file - The io.cozy.files document being edited
 * @param {Blob|string|ArrayBuffer} content - The content to persist
 * @param {string} contentType - The MIME type to store
 */
export const updateFileBinary = (client, file, content, contentType) =>
  client
    .collection('io.cozy.files', file.driveId ? { driveId: file.driveId } : {})
    .updateFile(content, {
      fileId: file._id,
      name: file.name,
      contentType
    })

/**
 * Returns true when the stack resolved the file to another instance.
 * See https://docs.cozy.io/en/cozy-stack/files/#get-editorfile-idopen
 *
 * @param {object} params - Result of an editor `/open` route
 * @param {string} instanceUri - Current instance uri
 * @returns {boolean}
 */
export const shouldBeOpenedOnOtherInstance = ({ data }, instanceUri) => {
  if (!instanceUri) return false
  const docHost = data.attributes.instance.split(':')[0]
  const currentHost = new URL(instanceUri).hostname
  return docHost !== currentHost
}

/**
 * Builds the URL where a shared document must be opened: the public Drive page
 * of the instance the stack resolved, with the sharecode that grants access.
 *
 * The three editor `/open` routes answer with the same attributes; only how the
 * target page is told which document to open differs, hence `hash` for the
 * editors mounted in Drive and `searchParams` for OnlyOffice.
 *
 * @param {object} params
 * @param {object} params.attributes - Attributes of an editor `/open` response
 * @param {string} [params.hash] - In-app route to open on the target page
 * @param {string[][]} [params.searchParams] - Extra query params for that page
 * @param {string} [params.redirectLink] - Where to send the user back to
 * @param {string} [params.shareUrl] - Where the visitor manages the sharing
 * @returns {string}
 */
export const makePublicEditorUrl = ({
  attributes,
  hash,
  searchParams = [],
  redirectLink,
  shareUrl
}) => {
  const { protocol, instance, subdomain, sharecode, public_name } = attributes

  const params = [['sharecode', sharecode], ...searchParams]
  if (public_name) params.push(['username', public_name])
  if (redirectLink) params.push(['redirectLink', redirectLink])
  if (shareUrl) params.push(['shareUrl', shareUrl])

  return generateWebLink({
    cozyUrl: `${protocol}://${instance}`,
    slug: 'drive',
    subDomainType: subdomain,
    pathname: '/public/',
    searchParams: params,
    hash
  })
}

/**
 * URL of the share modal, in the recipient's own Drive, of a file they edit
 * on its owner's instance, where their sharecode cannot manage the sharing.
 *
 * @param {object} client - cozy-client of the recipient's instance
 * @param {object} params
 * @param {string} params.fileId - Id of the file on the recipient's instance
 * @param {string} [params.driveId] - Shared drive the file belongs to
 * @param {string} [params.redirectLink] - Drive route the file was opened from
 * @returns {string|undefined}
 */
export const makeShareUrl = (client, { fileId, driveId, redirectLink }) => {
  if (!driveId) {
    return makeDriveWebLink(
      client,
      `${getSharingsTabRoute(SHARING_TAB_WITH_ME)}/file/${fileId}/share`
    )
  }
  // ponytail: a shared drive file opened by id has no folder to share over
  if (!redirectLink) return undefined
  const { hash } = deconstructRedirectLink(redirectLink)
  return makeDriveWebLink(client, `${hash}/file/${fileId}/share`)
}
