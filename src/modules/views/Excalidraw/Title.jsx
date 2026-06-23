import PropTypes from 'prop-types'
import React from 'react'

import ExcalidrawIcon from '@/assets/icons/icon-excalidraw.svg'
import EditorTitle from '@/modules/views/editor/EditorTitle'

const Title = ({ file, flushRef, isPublic = false, isReadOnly = false }) => (
  <EditorTitle
    file={file}
    flushRef={flushRef}
    icon={ExcalidrawIcon}
    dataTestId="excalidraw-title"
    isPublic={isPublic}
    isReadOnly={isReadOnly}
  />
)

Title.propTypes = {
  file: PropTypes.object.isRequired,
  flushRef: PropTypes.object,
  isPublic: PropTypes.bool,
  isReadOnly: PropTypes.bool
}

export default React.memo(Title)
