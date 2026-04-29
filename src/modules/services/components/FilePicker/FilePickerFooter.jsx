import PropTypes from 'prop-types'
import React, { memo } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { createUseI18n } from 'twake-i18n'

import en from './locales/en.json'
import fr from './locales/fr.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'

const locales = { en, fr, ru, vi }
const useI18n = createUseI18n(locales)

const FilePickerFooter = ({ onConfirm, onClose, disabledConfirm }) => {
  const { t } = useI18n()

  return (
    <>
      <Button
        data-testid="close-btn"
        label={t('footer.buttons.cancel')}
        variant="secondary"
        onClick={onClose}
      />
      <Button
        data-testid="confirm-btn"
        label={t('footer.buttons.confirm')}
        onClick={onConfirm}
        disabled={disabledConfirm}
      />
    </>
  )
}

FilePickerFooter.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  disabledConfirm: PropTypes.bool.isRequired
}

export default memo(FilePickerFooter)
