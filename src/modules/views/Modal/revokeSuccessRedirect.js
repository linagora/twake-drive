import { SHARINGS_VIEW_ROUTE, SHARING_TAB_DRIVES } from '@/constants/config'

function makeRevokeSuccessRedirectPath({ document, driveId } = {}) {
  if (driveId || document?.driveId) {
    return `${SHARINGS_VIEW_ROUTE}?tab=${SHARING_TAB_DRIVES}`
  }

  return SHARINGS_VIEW_ROUTE
}

export { makeRevokeSuccessRedirectPath }
