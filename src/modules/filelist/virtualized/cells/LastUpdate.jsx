import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

const LastUpdate = ({ date, formatted }) => {
  const { f, t } = useI18n()

  return (
    <time dateTime={date} title={f(date, t('LastUpdate.titleFormat'))}>
      {formatted}
    </time>
  )
}

LastUpdate.propTypes = {
  date: PropTypes.string,
  formatted: PropTypes.string
}

export default React.memo(LastUpdate)
