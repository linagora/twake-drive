import React from 'react'
import { useNavigate } from 'react-router-dom'

import flag from 'cozy-flags'
import { OnlyOfficePaywall } from 'cozy-ui-plus/dist/Paywall'

const OnlyOfficePaywallView = ({ isPublic = false }) => {
  const navigate = useNavigate()

  const onClose = () => {
    navigate('..')
  }

  return (
    <OnlyOfficePaywall
      isPublic={isPublic}
      isIapEnabled={flag('flagship.iap.enabled')}
      onClose={onClose}
    />
  )
}

export default OnlyOfficePaywallView
