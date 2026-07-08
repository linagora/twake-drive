import { FileTypePdf } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React, { useCallback, useState } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { useI18n } from 'twake-i18n'

import EditorTitle from '@/modules/views/editor/EditorTitle'

const Title = ({ file, flushRef, isPublic = false, isReadOnly = false }) => {
  const { t } = useI18n()
  const [isSaving, setIsSaving] = useState(false)

  // Give feedback while the save runs and block a second click until it
  // finishes; concurrent saves are also serialized in usePdfSave.
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await flushRef?.current?.()
    } finally {
      setIsSaving(false)
    }
  }, [flushRef])

  return (
    <EditorTitle
      file={file}
      flushRef={flushRef}
      icon={FileTypePdf}
      dataTestId="pdf-title"
      isPublic={isPublic}
      isReadOnly={isReadOnly}
    >
      {!isReadOnly && (
        <Button
          variant="secondary"
          label={t('Pdf.save')}
          onClick={handleSave}
          busy={isSaving}
          disabled={isSaving}
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
