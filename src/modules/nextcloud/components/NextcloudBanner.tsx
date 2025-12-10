import cx from 'classnames'
import React from 'react'
import { useI18n } from 'twake-i18n'

import Alert from 'cozy-ui/transpiled/react/Alert'
import Icon from 'cozy-ui/transpiled/react/Icon'
import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import NextcloudIcon from '@/assets/icons/icon-nextcloud.svg'

const NextcloudBanner = (): JSX.Element => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()

  return (
    <div className={cx(!isMobile ? 'u-mb-1 u-mh-2' : 'u-mb-half')}>
      <Alert
        icon={<Icon icon={NextcloudIcon} size={16} />}
        severity="secondary"
        square={isMobile}
      >
        <Typography variant="caption">{t('NextcloudBanner.title')}</Typography>
      </Alert>
    </div>
  )
}

export { NextcloudBanner }
