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

const redactBreadcrumbData = data => {
  if (!data) return
  if (data.url) data.url = redactUrl(data.url)
  if (data.from) data.from = redactUrl(data.from)
  if (data.to) data.to = redactUrl(data.to)
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
    if (span.description) span.description = redactUrl(span.description)
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
