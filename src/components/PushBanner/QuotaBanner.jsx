import React, { useEffect, useState } from 'react'
import { useI18n } from 'twake-i18n'

import { useInstanceInfo } from 'cozy-client'
import {
  arePremiumLinksEnabled,
  buildPremiumLink
} from 'cozy-client/dist/models/instance'
import { isFlagshipApp } from 'cozy-device-helper'
import flag from 'cozy-flags'
import { useWebviewIntent } from 'cozy-intent'
import Banner from 'cozy-ui/transpiled/react/Banner'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CloudSyncIcon from 'cozy-ui/transpiled/react/Icons/CloudSync'

import { usePushBannerContext } from './PushBannerProvider'

/**
 * Banner to inform users that they have reached more than 80% of their disk space
 */
const QuotaBanner = () => {
  const { t } = useI18n()
  const { dismissPushBanner } = usePushBannerContext()
  const instanceInfo = useInstanceInfo()
  const webviewIntent = useWebviewIntent()
  const [hasIAP, setIAP] = useState(false)

  useEffect(() => {
    const fetchIapAvailability = async () => {
      const isAvailable =
        (await webviewIntent?.call('isAvailable', 'iap')) ?? false
      const isEnabled = !!flag('flagship.iap.enabled')
      setIAP(isAvailable && isEnabled)
    }

    if (isFlagshipApp()) {
      fetchIapAvailability()
    }
  }, [webviewIntent])

  const onAction = () => {
    const link = buildPremiumLink(instanceInfo)
    window.open(link, '_self')
  }

  const onDismiss = () => {
    dismissPushBanner('quota')
  }

  const canOpenPremiumLink =
    arePremiumLinksEnabled(instanceInfo) && (!isFlagshipApp() || hasIAP)

  return (
    <div className="u-pos-relative">
      <Banner
        inline
        icon={<Icon icon={CloudSyncIcon} />}
        bgcolor="var(--defaultBackgroundColor)"
        text={t('PushBanner.quota.text')}
        buttonOne={
          <Button
            label={t('PushBanner.quota.actions.first')}
            variant="text"
            onClick={onDismiss}
          />
        }
        buttonTwo={
          canOpenPremiumLink ? (
            <Button
              label={t('PushBanner.quota.actions.second')}
              variant="text"
              onClick={onAction}
            />
          ) : null
        }
      />
    </div>
  )
}

export default QuotaBanner
