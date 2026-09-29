const API_PATH = '/web-apps/apps/api/documents/api.js'

const ALLOWED_PROTOCOLS = ['https:', 'http:']

/**
 * Builds the URL of the OnlyOffice editor API from the document server URL.
 *
 * The server URL comes from an `/open` response. For a file in a shared
 * drive, the stack does not answer that request itself: it proxies it to the
 * drive owner, which may be a federated instance. The value is therefore
 * attacker-controlled, and it ends up as the `src` of a script tag in the
 * Drive origin.
 *
 * Concatenating the API path let a URL ending in `?` or `#` swallow it, so the
 * attacker chose the whole URL. Resolving an absolute path against the origin
 * drops any query, fragment or path the server URL carried, which leaves the
 * attacker having to serve the editor API from an origin the CSP allows.
 *
 * @param {unknown} serverUrl - `onlyoffice.url` from the `/open` response
 * @returns {string|null} the API URL, or null when the server URL cannot be
 * trusted
 */
export const makeOfficeApiUrl = serverUrl => {
  if (typeof serverUrl !== 'string' || serverUrl === '') return null

  let parsed
  try {
    parsed = new URL(serverUrl)
  } catch {
    return null
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null

  return new URL(API_PATH, parsed.origin).toString()
}
