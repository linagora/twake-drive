import PropTypes from 'prop-types'
import React, { useCallback } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import PdfIcon from 'cozy-ui/transpiled/react/Icons/FileTypePdf'
import { useI18n } from 'twake-i18n'

import EditorTitle from '@/modules/views/editor/EditorTitle'

const Title = ({ file, flushRef, isPublic = false, isReadOnly = false }) => {
  const { t } = useI18n()

  const handleSave = useCallback(() => {
    flushRef?.current?.()
  }, [flushRef])

  return (
    <EditorTitle
      file={file}
      flushRef={flushRef}
      icon={PdfIcon}
      dataTestId="pdf-title"
      isPublic={isPublic}
      isReadOnly={isReadOnly}
    >
      {!isReadOnly && (
        <Button
          variant="secondary"
          label={t('Pdf.save')}
          onClick={handleSave}
          className="u-mr-half"
        />
      )}
    </EditorTitle>
  )
}

Title.propTypes = {
  file: PropTypes.object.isRequired,
  flushRef: PropTypes.object,
  isPublic: PropTypes.bool,
  isReadOnly: PropTypes.bool
}

export default React.memo(Title)
