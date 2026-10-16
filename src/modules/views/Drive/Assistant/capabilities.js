// What the LLM reads (the *_FOR_LLM objects) stays in English whatever the
// language of the user: only `label`, the button that confirms the call, is
// translated.

export const CREATE_FOLDER = 'create_folder'
export const CREATE_DOCUMENT = 'create_document'

const MAX_NAME_LENGTH = 100

const CREATE_FOLDER_FOR_LLM = {
  description:
    'create a folder in the folder of Drive the user is looking at. Pick it when the user asks for a new folder, a directory or a place to put files, with the name they give or one that fits what they describe.',
  examples: [
    { message: 'Crée un dossier Factures 2026', needs_documents: false },
    { message: 'Make a folder for the Atlas project', needs_documents: false }
  ],
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'the name of the folder, short, without a path'
      }
    },
    required: ['name']
  },
  instructions:
    'The name is in the language of the user, without quotes, slashes or a trailing dot.'
}

const CREATE_DOCUMENT_FOR_LLM = {
  description:
    'write a text document (OnlyOffice, like Word) saved in the folder of Drive the user is looking at: a report, a meeting summary, an article, a document on a subject, from the conversation or from the files of the user. Pick it when the user asks for a document, a doc, a report, a Word or OnlyOffice file. Do not pick it for a plain question or a summary to read in the conversation.',
  examples: [
    {
      message: 'Écris un document sur les bonnes pratiques du télétravail',
      needs_documents: false
    },
    {
      message:
        "Rédige un rapport d'avancement du projet Atlas à partir de mes fichiers",
      needs_documents: true
    },
    {
      message:
        'Write a report on the progress of the Atlas project from my files',
      needs_documents: true
    }
  ],
  content: { max_tokens: 2048 },
  instructions:
    'A document is complete: after the title, write an introduction, then "##" sections developed in full sentences, with lists where they help, and a short conclusion.'
}

export const makeCapabilities = ({ t }) => [
  {
    name: CREATE_FOLDER,
    label: t('Assistant.createFolder'),
    ...CREATE_FOLDER_FOR_LLM
  },
  {
    name: CREATE_DOCUMENT,
    label: t('Assistant.createDocument'),
    ...CREATE_DOCUMENT_FOR_LLM
  }
]

/**
 * @param {unknown} params - parameters of a `create_folder` call, as the LLM
 * wrote them
 * @returns {string | null} the cleaned name, or null when there is none
 */
export const normalizeFolderName = params => {
  const { name } = params ?? {}
  if (typeof name !== 'string') return null

  // cozy-stack refuses a "/" in a name (checkFileName, model/vfs/vfs.go)
  const cleaned = name
    .replace(/[/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .replace(/[.\s]+$/, '')
  return cleaned === '' ? null : cleaned
}

/**
 * @param {string} text - Markdown content
 * @returns {{ title: string | null, body: string }} the text of its first
 * "# " line, null without one, and the rest of the content
 */
export const splitTitle = text => {
  const match = /^\s*#\s+(.+)\r?\n?/.exec(text)
  if (!match) return { title: null, body: text.trim() }
  return {
    title: match[1].replace(/[*_]/g, '').trim(),
    body: text.slice(match[0].length).trim()
  }
}

export const makeFileName = (title, extension) => {
  const name = title
    .replace(/[/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim()
  return `${name || 'Document'}.${extension}`
}
