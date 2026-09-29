import { generateNewFileNameOnConflict } from 'cozy-client/dist/models/file'

import logger from '@/lib/logger'
import { updateFileNameQuery } from '@/modules/drive/RenameInput'
import {
  isUntitledFileName,
  makeTitleFromText
} from '@/modules/views/OnlyOffice/helpers'

const CONFLICT_ERROR = 409
const MAX_RENAME_ATTEMPTS = 100

/**
 * Renames a text document after a title, adding a " (1)", " (2)"… suffix
 * when the name is already taken
 *
 * @param {import('cozy-client/types/CozyClient').default} client
 * @param {object} file - io.cozy.files document
 * @param {string} title - File name without extension
 */
async function saveTitle(client, file, title) {
  let filename = title
  for (let attempt = 0; attempt < MAX_RENAME_ATTEMPTS; attempt++) {
    try {
      await updateFileNameQuery(client, file, `${filename}.docx`)
      return
    } catch (error) {
      if (error.status !== CONFLICT_ERROR) throw error
      filename = generateNewFileNameOnConflict(filename)
    }
  }
  throw new Error(`No available name after ${MAX_RENAME_ATTEMPTS} attempts`)
}

/**
 * Makes OnlyOffice editor events that retrieve the plain text of the document
 * through a txt conversion, each time it is saved on the document server
 *
 * @param {object} params
 * @param {{ current: object|null }} params.docEditorRef - Instance returned by `new DocsAPI.DocEditor()`
 * @param {Function} params.isTextNeeded - Whether to retrieve the text on this save
 * @param {Function} params.onText - Called with the text of the document
 * @returns {object} OnlyOffice `events` config entries
 */
const makeDownloadAsTextEvents = ({ docEditorRef, isTextNeeded, onText }) => ({
  // The event target is not the editor instance and lacks its methods
  onDocumentStateChange: ({ data: hasUnsavedChanges }) => {
    if (!hasUnsavedChanges && isTextNeeded()) {
      docEditorRef.current?.downloadAs('txt')
    }
  },
  onDownloadAs: async ({ data: { fileType, url } }) => {
    if (fileType !== 'txt') return

    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      await onText(await res.text())
    } catch (error) {
      logger.error(`Generating OnlyOffice document title failed: ${error}`)
    }
  }
})

/**
 * Makes OnlyOffice editor events that rename an untitled text document after
 * its first sentence
 *
 * @param {object} params
 * @param {import('cozy-client/types/CozyClient').default} params.client
 * @param {{ current: object|null }} params.docEditorRef - Instance returned by `new DocsAPI.DocEditor()`
 * @param {string} params.fileId
 * @param {string} params.untitledName - Localized name given at creation, without extension
 * @returns {object} OnlyOffice `events` config entries
 */
export const makeAutoTitleEvents = ({
  client,
  docEditorRef,
  fileId,
  untitledName
}) => {
  const findUntitledFile = () => {
    const file = client.getDocumentFromState('io.cozy.files', fileId)
    return file && isUntitledFileName(file.name, untitledName) ? file : null
  }

  const saveTitleFromText = async text => {
    const title = makeTitleFromText(text)
    const file = findUntitledFile()
    if (title && file) {
      await saveTitle(client, file, title)
    }
  }

  return makeDownloadAsTextEvents({
    docEditorRef,
    isTextNeeded: () => findUntitledFile() !== null,
    onText: saveTitleFromText
  })
}
