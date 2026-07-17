import { get, has, isEmpty, omit, sortBy } from 'lodash'

import { models, Q } from 'cozy-client'
import log from 'cozy-logger'

const { Qualification } = models.document
const { saveFileQualification } = models.file

/**
 * Query the files indexed on their updatedAt date.
 *
 * @param {object} client - The CozyClient instance
 * @param {string} date - The starting date to query
 * @param {number} limit - The maximum number of files to return
 */
export const queryFilesFromDate = async (client, date, limit) => {
  const query = Q('io.cozy.files')
    .where({
      type: 'file',
      'cozyMetadata.updatedAt': { $gt: date },
      trashed: false
    })
    .indexFields(['type', 'cozyMetadata.updatedAt'])
    .limitBy(limit)
    .sortBy([{ type: 'asc' }, { 'cozyMetadata.updatedAt': 'asc' }])
  return client.query(query)
}

/**
 * From a list of files, find the most recent updatedAt value
 *
 * @param {object} files - The unsorted files
 * @returns {string} The most recent updatedAt value
 */
export const getMostRecentUpdatedDate = files => {
  const filesWithDate = files.filter(file =>
    get(file, 'data.attributes.cozyMetadata.updatedAt')
  )
  const sortedFiles = sortBy(filesWithDate, [
    'data.attributes.cozyMetadata.updatedAt'
  ])
  return sortedFiles.length > 0
    ? get(
        sortedFiles[sortedFiles.length - 1],
        'data.attributes.cozyMetadata.updatedAt'
      )
    : null
}

/**
 * Extract the old qualification attributes from a file.
 *
 * @param {object} file - The file to extract old attributes from
 * @returns {object} The old qualification attributes
 */
const oldQualificationAttributes = file => {
  const oldQualification = {}
  Object.assign(
    oldQualification,
    has(file, 'metadata.id') ? { id: file.metadata.id } : null,
    has(file, 'metadata.label') ? { label: file.metadata.label } : null,
    has(file, 'metadata.classification')
      ? { classification: file.metadata.classification }
      : null,
    has(file, 'metadata.subClassification')
      ? { subClassification: file.metadata.subClassification }
      : null,
    has(file, 'metadata.categorie')
      ? { categorie: file.metadata.categorie }
      : null,
    has(file, 'metadata.category')
      ? { category: file.metadata.category }
      : null,
    has(file, 'metadata.categories')
      ? { categories: file.metadata.categories }
      : null,
    has(file, 'metadata.subject') ? { subject: file.metadata.subject } : null,
    has(file, 'metadata.subjects') ? { subjects: file.metadata.subjects } : null
  )
  return isEmpty(oldQualification) ? null : oldQualification
}

/**
 * Keep only the files with old qualification attributes
 *
 * @param {Array} files - The files to process
 * @returns {Array} The list of files having old qualification attributes
 */
export const extractFilesToMigrate = files => {
  return files.filter(file => {
    const oldAttributes = oldQualificationAttributes(file)
    // This case can happen when a file was previously migrated, as we keep
    // the id for retro-compatibility
    if (has(oldAttributes, 'id') && !has(oldAttributes, 'label')) {
      return false
    }
    return oldAttributes
  })
}

/**
 * We changed some labels set by cozy-scanner: this method
 * transform them with the new one.
 *
 * @param {string} oldLabel - The old qualification label
 * @returns {string} The new qualification label
 */
const getNewLabelSetFromCozyScanner = oldLabel => {
  if (oldLabel === 'registration') {
    return 'vehicle_registration'
  }
  if (oldLabel === 'insurance_card') {
    return 'national_health_insurance_card'
  }
  return oldLabel
}

/**
 * Remove the old qualification attributes from a file.
 *
 * @param {object} file - The file with old attributes
 * @returns {object} The file without the old attributes
 */
export const removeOldQualificationAttributes = file => {
  const oldAttributes = oldQualificationAttributes(file)
  // keep the id for retro-compatibility: it is used by cozy-scanner to display the label
  if (has(oldAttributes, 'id')) {
    delete oldAttributes.id
  }
  if (oldAttributes) {
    const attributesPath = Object.keys(oldAttributes).map(oldAttribute => {
      return `metadata.${oldAttribute}`
    })
    return omit(file, attributesPath)
  }
  return file
}

/**
 * Takes a file with an old qualification set by cozy-scanner and
 * returns the new qualification, by the label.
 *
 * @param {object} file - The file qualified by cozy-scanner
 * @returns {Qualification} The new qualification
 */
const getNewQualificationSetFromCozyScanner = file => {
  const qualificationLabel = get(file, 'metadata.label')
  const label = getNewLabelSetFromCozyScanner(qualificationLabel)
  return Qualification.getByLabel(label)
}

/**
 * Get the new qualification from a file with old qualification attributes.
 *
 * @param {object} file - The file to requalify
 * @returns {object} The new qualification
 */
export const getFileRequalification = file => {
  try {
    const hasQualificationLabel = has(file, 'metadata.label')
    return hasQualificationLabel
      ? getNewQualificationSetFromCozyScanner(file)
      : null
  } catch (e) {
    log('error', `The file cannot be migrated. ${e}`)
    return null
  }
}

/**
 * Migrate files by removing old qualification attributes and
 * setting the new qualification.
 *
 * @param {object} client - The CozyClient instance
 * @param {Array} files - The files to migrate
 * @returns {Array} The saved files
 */
export const migrateQualifiedFiles = async (client, files) => {
  let updatedFiles = []
  for (const file of files) {
    const newQualification = getFileRequalification(file)
    if (newQualification) {
      const cleanedFile = removeOldQualificationAttributes(file)
      const newFile = await saveFileQualification(
        client,
        cleanedFile,
        newQualification
      )
      updatedFiles.push(newFile)
    } else {
      log('warn', `No migration case found for the file ${file._id}`)
    }
  }
  return updatedFiles
}
