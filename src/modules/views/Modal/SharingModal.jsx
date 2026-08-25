import PropTypes from 'prop-types'
import React from 'react'

import flag from 'cozy-flags'
import {
  FederatedFolderModal,
  ShareModal,
  useSharingContext
} from 'cozy-sharing'

/**
 * Picks which modal a share opens.
 *
 * cozy-sharing routes to the federated (shared drive) flow only for documents
 * that already carry a `driveId`, so sharing a folder from My Drive would fall
 * back to the classic cozy-to-cozy dialog and never create a drive. Drive owns
 * the federated feature, so it selects that modal itself. The editable check
 * mirrors cozy-sharing's ShareModal, so a recipient who cannot reshare still
 * gets the read-only dialog instead of the editing one.
 */
export const SharingModal = ({ document, ...rest }) => {
  const { byDocId, isOwner, canReshare } = useSharingContext()

  const docId = document.id ?? document._id
  const isEditable = !byDocId[docId] || isOwner(docId) || canReshare(docId)

  if (flag('drive.federated-shared-folder.enabled') && isEditable) {
    return <FederatedFolderModal document={document} {...rest} />
  }

  return <ShareModal document={document} {...rest} />
}

SharingModal.propTypes = {
  document: PropTypes.object.isRequired
}
