import React, { useState, useCallback, useContext, createContext } from 'react'

interface ThumbnailSizeContextProps {
  isBigThumbnail: boolean
  toggleThumbnailSize: () => void
}

const ThumbnailSizeContext = createContext<ThumbnailSizeContextProps>({
  isBigThumbnail: false,
  toggleThumbnailSize: () => {}
})

const ThumbnailSizeContextProvider: React.FC = ({ children }) => {
  const [isBigThumbnail, setIsBigThumbnail] = useState(false)
  const toggleThumbnailSize = useCallback(
    () => setIsBigThumbnail(!isBigThumbnail),
    [isBigThumbnail, setIsBigThumbnail]
  )

  return (
    <ThumbnailSizeContext.Provider
      value={{ isBigThumbnail, toggleThumbnailSize }}
    >
      {children}
    </ThumbnailSizeContext.Provider>
  )
}

const useThumbnailSizeContext = (): ThumbnailSizeContextProps =>
  useContext(ThumbnailSizeContext)

export {
  ThumbnailSizeContext,
  ThumbnailSizeContextProvider,
  useThumbnailSizeContext
}
