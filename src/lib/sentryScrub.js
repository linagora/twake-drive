/**
 * URL redaction for anything leaving the browser through Sentry.
 *
 * Public pages authenticate with the sharecode read from the query string
 * (see src/targets/public/index.jsx), so it is a bearer token: a report
 * carrying the raw URL hands out access to the shared document. Download and
 * thumbnail links are capability URLs for the same reason, with their secret
 * in the path.
 */

const CAPABILITY_SEGMENTS = [
  /(\/downloads\/)[^/?#]+/g,
  /(\/thumbnails\/)[^/?#]+/g
]

const REDACTED = '[redacted]'

/**
 * Removes the query string and the fragment, then masks the secret segment of
 * capability URLs. Works on absolute and relative URLs alike.
 *
 * @param {unknown} url
 * @returns {unknown} the redacted URL, or the input untouched when it is not a
 * string
 */
export const redactUrl = url => {
  if (typeof url !== 'string') return url

  const separator = url.search(/[?#]/)
  const withoutParams = separator === -1 ? url : url.slice(0, separator)

  return CAPABILITY_SEGMENTS.reduce(
    (acc, segment) => acc.replace(segment, `$1${REDACTED}`),
    withoutParams
  )
}

const redactRequest = request => {
  if (!request) return
  if (request.url) request.url = redactUrl(request.url)
  if (request.query_string) delete request.query_string
  if (request.headers?.Referer) {
    request.headers.Referer = redactUrl(request.headers.Referer)
  }
}

// The browser tracing integration records a request URL twice: `url` as
// given, and `http.url` resolved against the origin by getFullURL, which keeps
// the query string. Redacting only `url` leaves the secret in `http.url`.
// `from` and `to` carry navigation breadcrumbs.
const URL_KEYS = ['url', 'http.url', 'from', 'to']

const redactBreadcrumbData = data => {
  if (!data) return
  URL_KEYS.forEach(key => {
    if (data[key]) data[key] = redactUrl(data[key])
  })
}

/**
 * Redacts every URL an event can carry: the request itself, the breadcrumb
 * trail and the tracing spans.
 *
 * @param {object} event a Sentry event or transaction
 * @returns {object} the same event, redacted in place
 */
export const redactEvent = event => {
  if (!event) return event

  redactRequest(event.request)

  event.breadcrumbs?.forEach(breadcrumb => {
    redactBreadcrumbData(breadcrumb.data)
  })

  event.spans?.forEach(span => {
    // The span label is `${method} ${url}`, so it carries the URL too.
    if (span.description) span.description = redactUrl(span.description)
    if (span.name) span.name = redactUrl(span.name)
    redactBreadcrumbData(span.data)
  })

  return event
}

/**
 * @param {object} breadcrumb
 * @returns {object} the same breadcrumb, redacted in place
 */
export const redactBreadcrumb = breadcrumb => {
  if (!breadcrumb) return breadcrumb
  redactBreadcrumbData(breadcrumb.data)
  return breadcrumb
}
