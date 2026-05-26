import { useContext, useEffect } from 'react'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { FabContext } from '@/lib/FabProvider'

/**
 * Displays the floating action button on mobile and tablet (`!isDesktop`)
 * when the user can write in the current folder, and resets it on unmount so
 * other views don't inherit the displayed state. Returns the current
 * `isFabDisplayed` flag for convenient consumption by the caller.
 *
 * Views that gate the FAB on `isMobile` only (excluding tablet) should keep
 * their own effect rather than adopt this hook.
 */
export const useFabOnMobile = canWrite => {
  const { isDesktop } = useBreakpoints()
  const { isFabDisplayed, setIsFabDisplayed } = useContext(FabContext)

  useEffect(() => {
    setIsFabDisplayed(canWrite && !isDesktop)
    return () => {
      setIsFabDisplayed(false)
    }
  }, [setIsFabDisplayed, isDesktop, canWrite])

  return isFabDisplayed
}
