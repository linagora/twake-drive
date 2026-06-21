export const GRIST_EXTENSION = 'grist'

/**
 * Checks whether a file is a Grist document handle, based on its extension and
 * the Grist doc id kept in its metadata.
 *
 * @param {object} file - An io.cozy.files document
 * @returns {boolean}
 */
export const isGrist = file =>
  Boolean(
    file?.name?.endsWith(`.${GRIST_EXTENSION}`) && file?.metadata?.externalId
  )
