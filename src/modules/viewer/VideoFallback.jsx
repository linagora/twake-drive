import React, { useMemo, useState } from 'react'

import NoViewerButton from './NoViewerButton'

const canPlayMime = mime => {
  if (!mime || typeof document === 'undefined') {
    return true
  }

  return document.createElement('video').canPlayType(mime) !== ''
}

const VideoFallback = ({ file, url, t }) => {
  const [hasPlaybackError, setHasPlaybackError] = useState(false)
  const canPlay = useMemo(() => canPlayMime(file.mime), [file.mime])
  const shouldShowVideo = canPlay && !hasPlaybackError

  return (
    <>
      {shouldShowVideo ? (
        <video
          src={url}
          controls
          className="u-w-100 u-mb-1"
          onError={() => setHasPlaybackError(true)}
        />
      ) : (
        <p className="u-mb-1">{t('Viewer.error.noapp')}</p>
      )}
      <NoViewerButton file={file} t={t} />
    </>
  )
}

export default VideoFallback
