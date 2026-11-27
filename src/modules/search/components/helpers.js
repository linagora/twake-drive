import { models } from 'cozy-client'

import { ROOT_DIR_ID } from '@/constants/config'
import FuzzyPathSearch from '@/lib/FuzzyPathSearch.js'
import { normalizeSearchText } from '@/lib/normalizeSearchText'
import { isNextcloudShortcut } from '@/modules/nextcloud/helpers'
import {
  makeOnlyOfficeFileRoute,
  shouldOpenWithOnlyOffice
} from '@/modules/views/OnlyOffice/helpers'

export const TYPE_DIRECTORY = 'directory'

export const normalizeString = str =>
  normalizeSearchText(str).replace(/\//g, ' ').split(' ')

/**
 * Normalize file for Front usage in <AutoSuggestion> component inside <BarSearchAutosuggest>
 *
 * To reduce API call, the fetching of Note URL has been delayed
 * inside an onSelect function called only if provided to <BarSearchAutosuggest>
 * see https://github.com/cozy/cozy-drive/pull/2663#discussion_r938671963
 *
 * @param {CozyClient} client - cozy client instance
 * @param {[IOCozyFile]} folders - all the folders returned by API
 * @param {IOCozyFile} file - file to normalize
 * @returns file with normalized field to be used in AutoSuggestion
 */
export const makeNormalizedFile = (
  client,
  folders,
  file,
  officeEnabled = false
) => {
  const isDir = file.type === TYPE_DIRECTORY
  const dirId = isDir ? file._id : file.dir_id
  const urlToFolder = `/folder/${dirId}`

  let path, url, parentUrl
  let openOn = 'drive'
  if (isDir) {
    path = file.path
    url = urlToFolder
    parentUrl = urlToFolder
  } else {
    const parentDir = folders.find(folder => folder._id === file.dir_id)
    path = parentDir && parentDir.path ? parentDir.path : ''
    parentUrl = parentDir && parentDir._id ? `/folder/${parentDir._id}` : ''
    if (isNextcloudShortcut(file)) {
      url = `/nextcloud/${file.cozyMetadata?.sourceAccount ?? 'unknown'}`
    } else if (models.file.isShortcut(file)) {
      url = file.driveId
        ? `/external/${file.driveId}/${file._id}`
        : `/external/${file._id}`
    } else if (models.file.isNote(file)) {
      url = `/n/${file.id}`
      openOn = 'notes'
    } else if (shouldOpenWithOnlyOffice(file, officeEnabled)) {
      url = makeOnlyOfficeFileRoute(file.id, {
        driveId: file.driveId,
        fromPathname: urlToFolder
      })
    } else {
      url = `${urlToFolder}/file/${file._id}`
    }
  }

  return {
    id: file._id,
    type: file.type,
    name: file.name,
    mime: file.mime,
    class: file.class,
    path,
    url,
    parentUrl,
    openOn
  }
}

/**
 * Fetches all files without trashed and preloads FuzzyPathSearch
 *
 * Using _all_docs route
 *
 * Also, this method:
 * - removing trashed data directly
 * - removes orphan file
 * - normalize file to match <SearchBar> expectation
 * - preloads FuzzyPathSearch
 *
 * @returns {Promise<void>} nothing
 */
export const indexFiles = async (client, officeEnabled = false) => {
  const resp = await client
    .getStackClient()
    .fetchJSON(
      'GET',
      '/data/io.cozy.files/_all_docs?Fields=_id,trashed,dir_id,name,path,type,mime,class,driveId,metadata.title,metadata.version,cozyMetadata.createdByApp,cozyMetadata.sourceAccount&DesignDocs=false&include_docs=true'
    )
  const files = resp.rows.map(row => ({ id: row.id, ...row.doc }))
  const folders = files.filter(file => file.type === TYPE_DIRECTORY)

  const notInTrash = file => !file.trashed && !/^\/\.cozy_trash/.test(file.path)
  const notOrphans = file =>
    folders.find(folder => folder._id === file.dir_id) !== undefined
  const notRoot = file => file._id !== ROOT_DIR_ID
  const normalizedFilesPrevious = files.filter(
    file => notInTrash(file) && notOrphans(file) && notRoot(file)
  )

  const normalizedFiles = normalizedFilesPrevious.map(file =>
    makeNormalizedFile(client, folders, file, officeEnabled)
  )

  return new FuzzyPathSearch(normalizedFiles)
}

// Set once the stack has answered that it cannot search
let stackSearchUnavailable = false

export const isStackSearchUnavailable = () => stackSearchUnavailable

// For the tests
export const resetStackSearchAvailability = () => {
  stackSearchUnavailable = false
}

/**
 * Normalize a hit of the stack search (POST /files/search) like
 * makeNormalizedFile does for the local index.
 *
 * shortcut: the hits have no metadata, so a note is found by its name, a
 * note of a shared drive opens in the viewer, and a Nextcloud entry opens as
 * a shortcut; add the fields to the hits if they need the exact routes.
 *
 * @param {object} file - a hit of FileCollection.search
 * @param {boolean} officeEnabled - whether OnlyOffice is enabled
 * @returns {object} the normalized file
 */
export const makeNormalizedStackHit = (file, officeEnabled = false) => {
  const isDir = file.type === TYPE_DIRECTORY
  const driveId = file.drive_id
  const folderUrl = id =>
    driveId ? `/shareddrive/${driveId}/${id}` : `/folder/${id}`
  const dirUrl = folderUrl(isDir ? file._id : file.dir_id)

  let url = dirUrl
  let openOn = 'drive'
  if (isDir) {
    // The folder itself
  } else if (models.file.isShortcut(file)) {
    url = driveId ? `/external/${driveId}/${file._id}` : `/external/${file._id}`
  } else if (!driveId && file.name?.endsWith('.cozy-note')) {
    url = `/n/${file._id}`
    openOn = 'notes'
  } else if (shouldOpenWithOnlyOffice(file, officeEnabled)) {
    url = makeOnlyOfficeFileRoute(file._id, { driveId, fromPathname: dirUrl })
  } else {
    url = `${dirUrl}/file/${file._id}`
  }

  return {
    id: file._id,
    type: file.type,
    name: file.name,
    mime: file.mime,
    class: file.class,
    path: file.path,
    url,
    parentUrl: isDir ? dirUrl : folderUrl(file.dir_id),
    openOn
  }
}

/**
 * Searches the files with the stack.
 *
 * @param {CozyClient} client - cozy client instance
 * @param {string} query - the searched text
 * @param {object} options - limit, cursor and officeEnabled
 * @returns {Promise<{files: Array<object>, cursor: string|null}|null>} a page of normalized files, or null when the stack cannot search
 */
export const searchFilesOnStack = async (
  client,
  query,
  { limit, cursor, officeEnabled = false } = {}
) => {
  const collection = client.collection('io.cozy.files')
  if (stackSearchUnavailable || typeof collection.search !== 'function') {
    return null
  }
  try {
    const resp = await collection.search(query, { limit, cursor })
    return {
      files: resp.data.map(file => makeNormalizedStackHit(file, officeEnabled)),
      cursor: resp.cursor
    }
  } catch (err) {
    // 404: the stack has no search route, 503: search is not configured
    if (err?.status === 404 || err?.status === 503) {
      stackSearchUnavailable = true
      return null
    }
    throw err
  }
}
