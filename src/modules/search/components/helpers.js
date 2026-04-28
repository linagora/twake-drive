import { models } from 'cozy-client'

import { ROOT_DIR_ID, SHARED_DRIVES_DIR_ID } from '@/constants/config'
import FuzzyPathSearch from '@/lib/FuzzyPathSearch.js'
import { makeOnlyOfficeFileRoute } from '@/modules/views/OnlyOffice/helpers'

export const TYPE_DIRECTORY = 'directory'

export const normalizeString = str =>
  str
    .toString()
    .toLowerCase()
    .replace(/\//g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(' ')

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
export const makeNormalizedFile = (client, folders, file) => {
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
    if (models.file.isNote(file)) {
      url = `/n/${file.id}`
      openOn = 'notes'
    } else if (models.file.shouldBeOpenedByOnlyOffice(file)) {
      url = makeOnlyOfficeFileRoute(file.id, { fromPathname: urlToFolder })
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
export const indexFiles = async client => {
  const resp = await client
    .getStackClient()
    .fetchJSON(
      'GET',
      '/data/io.cozy.files/_all_docs?Fields=_id,trashed,dir_id,name,path,type,mime,class,metadata.title,metadata.version&DesignDocs=false&include_docs=true'
    )
  const files = resp.rows.map(row => ({ id: row.id, ...row.doc }))
  const folders = files.filter(file => file.type === TYPE_DIRECTORY)

  const notInTrash = file => !file.trashed && !/^\/\.cozy_trash/.test(file.path)
  const notOrphans = file =>
    folders.find(folder => folder._id === file.dir_id) !== undefined
  const notRoot = file => file._id !== ROOT_DIR_ID
  // Shared drives folder to be hidden in search.
  // The files inside it though must appear. Thus only the file with the folder ID is filtered out.
  const notSharedDrivesDir = file => file._id !== SHARED_DRIVES_DIR_ID

  const normalizedFilesPrevious = files.filter(
    file =>
      notInTrash(file) &&
      notOrphans(file) &&
      notRoot(file) &&
      notSharedDrivesDir(file)
  )

  const normalizedFiles = normalizedFilesPrevious.map(file =>
    makeNormalizedFile(client, folders, file)
  )

  return new FuzzyPathSearch(normalizedFiles)
}
