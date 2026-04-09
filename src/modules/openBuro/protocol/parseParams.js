import { DEFAULT_RESULT_TYPES, ERROR_MISSING_PARAMS } from '../constants'

/**
 * Parse a `window.location.search` string into OpenBuro capability params.
 *
 * Returns either a fully-populated params object or `{ error: 'missing-params' }`
 * if the caller did not provide the required `clientUrl` and `id`.
 *
 * @param {string} [search] - query string including leading '?' (or '' / undefined)
 * @returns {object}
 */
export const parseParams = search => {
  const usp = new URLSearchParams(search || '')
  const clientUrl = usp.get('clientUrl')
  const id = usp.get('id')

  if (!clientUrl || !id) {
    return { error: ERROR_MISSING_PARAMS }
  }

  const rawType = usp.get('type')
  const type = rawType
    ? rawType.split(',').filter(Boolean)
    : [...DEFAULT_RESULT_TYPES]

  return {
    clientUrl,
    id,
    type,
    allowedMimeType: usp.get('allowedMimeType') || '',
    multiple: usp.get('multiple') === 'true'
  }
}
