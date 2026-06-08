import PropTypes from 'prop-types'
import React, { useState } from 'react'

import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import FormControlLabel from 'cozy-ui/transpiled/react/FormControlLabel'
import RadioGroup from 'cozy-ui/transpiled/react/RadioGroup'
import Radios from 'cozy-ui/transpiled/react/Radios'
import Stack from 'cozy-ui/transpiled/react/Stack'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

import { uploadConflictStrategies } from '@/modules/upload/constants'

const UploadConflictDialog = ({ onCancel, onClose, onConfirm }) => {
  const { t } = useI18n()
  const [strategy, setStrategy] = useState(uploadConflictStrategies.REPLACE)

  const handleCancel = () => {
    onCancel()
    onClose()
  }

  const handleConfirm = () => {
    onConfirm(strategy)
    onClose()
  }

  return (
    <ConfirmDialog
      open
      onClose={handleCancel}
      title={t('upload.conflict.title')}
      content={
        <Stack spacing="s">
          <Typography>{t('upload.conflict.content')}</Typography>
          <Typography>{t('upload.conflict.apply_all')}</Typography>
          <RadioGroup
            value={strategy}
            onChange={event => setStrategy(event.target.value)}
          >
            <FormControlLabel
              value={uploadConflictStrategies.REPLACE}
              control={<Radios />}
              label={t('upload.conflict.replace')}
            />
            <FormControlLabel
              value={uploadConflictStrategies.KEEP_BOTH}
              control={<Radios />}
              label={t('upload.conflict.keep_both')}
            />
          </RadioGroup>
        </Stack>
      }
      actions={
        <>
          <Buttons
            variant="secondary"
            label={t('upload.conflict.cancel')}
            onClick={handleCancel}
          />
          <Buttons
            label={t('upload.conflict.confirm')}
            onClick={handleConfirm}
          />
        </>
      }
    />
  )
}

UploadConflictDialog.propTypes = {
  onCancel: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired
}

export default UploadConflictDialog
