import React from 'react'
import { useNavigate } from 'react-router-dom'

import SummarizeByAIButton from 'cozy-viewer/dist/components/SummarizeByAIButton'
import { withViewerLocales } from 'cozy-viewer/dist/hoc/withViewerLocales'

const SummarizeByAIButtonWrapper: React.FC<{ isLoaded: boolean }> = ({
  isLoaded
}) => {
  const navigate = useNavigate()

  const redirectToPaywall = (): void => {
    navigate('v/ai/paywall', { replace: true })
  }

  return (
    <>
      {isLoaded ? (
        <SummarizeByAIButton
          className="u-mr-half"
          onPaywallRedirect={redirectToPaywall}
        />
      ) : null}
    </>
  )
}

export default withViewerLocales(SummarizeByAIButtonWrapper)
