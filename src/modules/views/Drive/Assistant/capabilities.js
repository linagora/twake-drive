// What the LLM reads (the *_FOR_LLM objects) stays in English whatever the
// language of the user: only `label`, the button that confirms the call, is
// translated.

export const CREATE_FOLDER = 'create_folder'

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

export const makeCapabilities = ({ t }) => [
  {
    name: CREATE_FOLDER,
    label: t('Assistant.createFolder'),
    ...CREATE_FOLDER_FOR_LLM
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
