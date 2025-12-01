import { useEffect, useRef } from 'react'

import { IOCozyFile } from 'cozy-client/types/types'
import flag from 'cozy-flags'

import { updateFavicon } from './helpers'
import { getFileMimetype } from '@/lib/getFileMimetype'
import { FAVICON_BY_MIMETYPE } from '@/hooks/useUpdateFavicon/constants'

const useUpdateFavicon = (
  file: IOCozyFile | undefined,
  fetchStatus: string
): void => {
  const originalFaviconUrlRef = useRef<string>()

  useEffect(() => {
    if (!flag('drive.update-favicon.enabled')) return

    const originalFavicon =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']")

    if (originalFavicon) {
      originalFaviconUrlRef.current = originalFavicon.href
    }

    return () => {
      const originalUrl = originalFaviconUrlRef.current

      if (originalUrl) {
        updateFavicon(originalUrl)
      }
    }
  }, [])

  useEffect(() => {
    if (
      fetchStatus !== 'loaded' ||
      !file ||
      !flag('drive.update-favicon.enabled')
    ) {
      return
    }

    const type = getFileMimetype(FAVICON_BY_MIMETYPE)(
      file.mime,
      file.name
    ) as string

    const faviconUrl =
      FAVICON_BY_MIMETYPE[type] ?? originalFaviconUrlRef.current

    if (faviconUrl) {
      updateFavicon(faviconUrl)
    }
  }, [file, fetchStatus])
}

export default useUpdateFavicon
