import React from 'react'
import { useI18n } from 'twake-i18n'

import Empty from 'cozy-ui/transpiled/react/Empty'
import CloudBrokenIcon from 'cozy-ui/transpiled/react/Icons/CloudBroken'

export const ErrorShare = ({ errorType }) => {
  const { t } = useI18n()
  return (
    <Empty
      data-testid="empty-share"
      icon={CloudBrokenIcon}
      title={t(`Error.${errorType}_title`)}
      text={t(`Error.${errorType}_text`)}
      componentsProps={{
        icon: {
          style: { height: '2rem' }
        }
      }}
    />
  )
}

export default ErrorShare
