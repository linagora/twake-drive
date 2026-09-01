import PropTypes from 'prop-types'
import React from 'react'

import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

import { filePickerSections } from './constants'

export const EmptyMessage = ({ section, isRoot }) => {
  const { t } = useI18n()
  const messageKey =
    section === filePickerSections.SHARINGS && isRoot
      ? 'empty.sharing_text'
      : 'empty.title'

  return (
    <Typography
      className="u-ta-center u-pa-2"
      color="textSecondary"
      data-testid="file-picker-empty"
    >
      {t(messageKey)}
    </Typography>
  )
}

EmptyMessage.propTypes = {
  section: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
  isRoot: PropTypes.bool
}

EmptyMessage.defaultProps = {
  isRoot: false
}
