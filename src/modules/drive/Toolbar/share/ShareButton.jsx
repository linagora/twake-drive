import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ShareButton } from 'cozy-sharing'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useDisplayedFolder } from '@/hooks'
import { getPathToShareDisplayedFolder } from '@/modules/drive/Toolbar/share/helpers'

const ShareButtonWithProps = ({ isDisabled, className, useShortLabel }) => {
  const { displayedFolder } = useDisplayedFolder()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMobile } = useBreakpoints()

  const share = () => {
    navigate(getPathToShareDisplayedFolder(pathname))
  }

  if (!displayedFolder) return null

  return (
    <ShareButton
      docId={displayedFolder.id}
      disabled={isDisabled}
      useShortLabel={useShortLabel}
      className={className}
      onClick={() => share(displayedFolder)}
      size={isMobile ? 'small' : 'medium'}
    />
  )
}

export default ShareButtonWithProps
