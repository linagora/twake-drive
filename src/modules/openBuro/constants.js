// OpenBuro capability action identifiers (URL path segment after /capabilities/).
export const ACTION_PICK = 'PICK'

// postMessage `type` identifier for the optional READY notification sent by the
// capability handler as soon as it mounts. Clients may ignore it.
export const MESSAGE_READY = 'READY'

// Result-representation tokens accepted in the `type` query-string param.
export const RESULT_SHARING_URL = 'sharingUrl'
export const RESULT_DOWNLOAD_URL = 'downloadUrl'
export const RESULT_PAYLOAD = 'payload'

// Known `message` values sent on `{status: 'error'}` replies.
export const ERROR_CANCELLED = 'cancelled'
export const ERROR_UNKNOWN_ACTION = 'unknown-action'
export const ERROR_MISSING_PARAMS = 'missing-params'
export const ERROR_RESOLUTION_FAILED = 'resolution-failed'

// Default for the `type` query-string param when absent. We return every
// supported representation so a client that didn't specify anything still
// gets a fully-populated result entry and can pick whichever field fits its
// use case. Callers that care about payload size MUST request types
// explicitly (payload is potentially large — see buildPickResult.js).
export const DEFAULT_RESULT_TYPES = [
  RESULT_SHARING_URL,
  RESULT_DOWNLOAD_URL,
  RESULT_PAYLOAD
]
