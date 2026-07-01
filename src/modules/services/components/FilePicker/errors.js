/**
 * Error codes used by the File Picker when sending an error to the
 * intent client.
 *
 * Each code is stable across versions so external apps (e.g. Mail) can
 * react to a known failure category by switching on `.code` instead of
 * parsing the human readable `.message`.
 *
 * The error is sent through `service.throw(error)`, separately from the
 * success document. `.code`, `.id` and `.fileName` are attached to the
 * Error so the consumer receives structured context. `.fileName` is used
 * (not `.name`) to avoid colliding with the standard `Error.name`.
 */
export const filePickerErrorCodes = {
  /**
   * The selected io.cozy.files document could not be retrieved from
   * the stack (deleted, missing permissions, network failure...).
   */
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',

  /**
   * The permanent public sharing link could not be generated
   * (stack rejected the permission creation, network failure...).
   */
  SHARING_LINK_FAILED: 'SHARING_LINK_FAILED',

  /**
   * The temporary download link could not be generated
   * (stack rejected the permission creation, network failure...).
   */
  DOWNLOAD_LINK_FAILED: 'DOWNLOAD_LINK_FAILED'
}

/**
 * Build a File Picker error to be sent through the intent "error"
 * channel via `service.throw(...)`.
 *
 * The returned Error carries:
 *  - `message`  (the standard Error field)
 *  - `code`     (one of `filePickerErrorCodes`)
 *  - `id`       (io.cozy.files id of the failing item, when known)
 *  - `fileName` (display name of the failing item, when known)
 *
 * @param {string} code   - One of `filePickerErrorCodes`
 * @param {object} [opts]
 * @param {string} [opts.message]  - Human readable error message
 * @param {string} [opts.id]       - io.cozy.files id of the failing item
 * @param {string} [opts.fileName] - Display name of the failing item
 * @returns {Error & {code: string, id?: string, fileName?: string}}
 */
export const makeFilePickerError = (code, { message, id, fileName } = {}) => {
  const error = new Error(message)
  error.code = code
  if (id !== undefined) error.id = id
  if (fileName !== undefined) error.fileName = fileName
  return error
}
