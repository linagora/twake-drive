import React from 'react'
import { useNavigate } from 'react-router-dom'

import { AiAssistantPaywall } from 'cozy-ui-plus/dist/Paywall'

const AIAssistantPaywallView = (): JSX.Element => {
  const navigate = useNavigate()

  const onClose = (): void => {
    navigate('..')
  }

  return <AiAssistantPaywall onClose={onClose} />
}

export default AIAssistantPaywallView
