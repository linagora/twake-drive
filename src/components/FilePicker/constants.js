export const filePickerModes = {
  SELECTION: 'selection',
  CURRENT_FOLDER: 'current-folder'
}

export const filePickerSections = {
  DRIVE: 'drive',
  RECENTS: 'recents',
  SHARINGS: 'sharings'
}

export const filePickerItemTypes = {
  FILE: 'file',
  FOLDER: 'folder'
}

export const FILE_PICKER_RECENTS_ROOT_ID = 'file-picker-recents-root'
export const FILE_PICKER_SHARINGS_ROOT_ID = 'file-picker-sharings-root'

/**
 * Surfaced when the picker is scoped to a root folder that cannot be
 * read (deleted, or outside the granted permissions). Falling back to
 * the whole Drive would widen the scope the caller asked for, so the
 * picker shows this error instead.
 */
export const ROOT_DIR_UNAVAILABLE_ERROR = 'ROOT_DIR_UNAVAILABLE'
