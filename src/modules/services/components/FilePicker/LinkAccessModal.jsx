import PropTypes from 'prop-types'
import React from 'react'

import {
  ShareLinkAccessModal,
  SharingContext,
  useSharingContext
} from 'cozy-sharing'

import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'

const renderDocumentIcon = (document, size) => (
  <FileThumbnail file={document} size={size} />
)

export const LinkAccessModal = ({
  selectedItems,
  onCancel,
  onConfirm,
  validateSelection
}) => {
  const sharingContext = useSharingContext()
  const ensureSharingLink = async (document, options) => {
    // Validate the entire batch before any permission can be persisted.
    const files = validateSelection
      ? await validateSelection(selectedItems)
      : selectedItems
    const file = files.find(
      item => (item._id ?? item.id) === (document._id ?? document.id)
    )
    return sharingContext.ensureSharingLink(file, options)
  }

  return (
    <SharingContext.Provider value={{ ...sharingContext, ensureSharingLink }}>
      <ShareLinkAccessModal
        documents={selectedItems}
        onCancel={onCancel}
        onSuccess={onConfirm}
        renderDocumentIcon={renderDocumentIcon}
      />
    </SharingContext.Provider>
  )
}

LinkAccessModal.propTypes = {
  selectedItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  validateSelection: PropTypes.func
}
