import flag from 'cozy-flags'

/**
 * Whether Drive offers the scribe in this view: a public link has no
 * assistant, and a read-only document cannot take its answers
 */
export const isScribeAllowed = ({ isPublic, isReadOnly }) =>
  !isPublic && !isReadOnly && Boolean(flag('cozy.assistant.enabled'))
