import { useEffect } from 'react'

/**
 * Flushes pending editor changes when the tab is hidden and on unmount, so an
 * edit is not lost when the user switches tab or leaves. Pass a flush that
 * no-ops in read-only mode.
 *
 * @param {() => void | Promise<void>} flush
 */
export const useSaveOnHideAndUnmount = flush => {
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', handleHide)
    return () => {
      document.removeEventListener('visibilitychange', handleHide)
      flush()
    }
  }, [flush])
}
