import PropTypes from 'prop-types'
import React from 'react'

import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

export const EmptyMessage = ({ message, messageKey = 'empty.title' }) => {
  const { t } = useI18n()

  return (
    <Typography
      className="u-ta-center u-pa-2"
      color="textSecondary"
      data-testid="file-picker-empty"
    >
      {message ?? t(messageKey)}
    </Typography>
  )
}

EmptyMessage.propTypes = {
  message: PropTypes.node,
  messageKey: PropTypes.string
}

export default EmptyMessage
