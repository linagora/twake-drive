import PropTypes from 'prop-types'
import React from 'react'

import { ShareLinkAccessModal } from 'cozy-sharing'

import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'

const renderDocumentIcon = document => <FileThumbnail file={document} />

export const LinkAccessModal = ({ selectedItems, onCancel, onConfirm }) => (
  <ShareLinkAccessModal
    documents={selectedItems}
    onCancel={onCancel}
    onSuccess={onConfirm}
    renderDocumentIcon={renderDocumentIcon}
  />
)

LinkAccessModal.propTypes = {
  selectedItems: PropTypes.arrayOf(PropTypes.object).isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired
}
