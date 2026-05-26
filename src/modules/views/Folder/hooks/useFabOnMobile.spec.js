import { renderHook, act } from '@testing-library/react'
import React from 'react'

import { FabContext } from '@/lib/FabProvider'

// Will be controlled per-test via mockReturnValue
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useFabOnMobile } from './useFabOnMobile'

const makeFabContextWrapper =
  (contextValue) =>
  ({ children }) =>
    (
      <FabContext.Provider value={contextValue}>
        {children}
      </FabContext.Provider>
    )

describe('useFabOnMobile', () => {
  let setIsFabDisplayed

  beforeEach(() => {
    setIsFabDisplayed = jest.fn()
    jest.clearAllMocks()
  })

  const renderWithContext = (canWrite, isFabDisplayed = false) => {
    const wrapper = makeFabContextWrapper({ isFabDisplayed, setIsFabDisplayed })
    return renderHook(() => useFabOnMobile(canWrite), { wrapper })
  }

  describe('when user can write and is not on desktop', () => {
    beforeEach(() => {
      useBreakpoints.mockReturnValue({ isDesktop: false })
    })

    it('calls setIsFabDisplayed(true)', () => {
      renderWithContext(true)
      expect(setIsFabDisplayed).toHaveBeenCalledWith(true)
    })

    it('returns isFabDisplayed from context', () => {
      const { result } = renderWithContext(true, true)
      expect(result.current).toBe(true)
    })
  })

  describe('when user can write but is on desktop', () => {
    beforeEach(() => {
      useBreakpoints.mockReturnValue({ isDesktop: true })
    })

    it('calls setIsFabDisplayed(false)', () => {
      renderWithContext(true)
      expect(setIsFabDisplayed).toHaveBeenCalledWith(false)
    })
  })

  describe('when user cannot write', () => {
    beforeEach(() => {
      useBreakpoints.mockReturnValue({ isDesktop: false })
    })

    it('calls setIsFabDisplayed(false) even on mobile', () => {
      renderWithContext(false)
      expect(setIsFabDisplayed).toHaveBeenCalledWith(false)
    })
  })

  describe('cleanup on unmount', () => {
    beforeEach(() => {
      useBreakpoints.mockReturnValue({ isDesktop: false })
    })

    it('calls setIsFabDisplayed(false) when unmounted', () => {
      const { unmount } = renderWithContext(true)
      jest.clearAllMocks()
      unmount()
      expect(setIsFabDisplayed).toHaveBeenCalledWith(false)
    })

    it('resets FAB display even if canWrite was true', () => {
      const { unmount } = renderWithContext(true)
      unmount()
      // The cleanup should always reset to false regardless of canWrite
      expect(setIsFabDisplayed).toHaveBeenLastCalledWith(false)
    })
  })

  describe('reactivity to prop changes', () => {
    it('updates FAB display when canWrite changes from true to false', () => {
      useBreakpoints.mockReturnValue({ isDesktop: false })
      const wrapper = makeFabContextWrapper({ isFabDisplayed: false, setIsFabDisplayed })

      const { rerender } = renderHook(
        ({ canWrite }) => useFabOnMobile(canWrite),
        { wrapper, initialProps: { canWrite: true } }
      )
      jest.clearAllMocks()

      rerender({ canWrite: false })
      expect(setIsFabDisplayed).toHaveBeenCalledWith(false)
    })

    it('updates FAB display when isDesktop changes from false to true', () => {
      useBreakpoints.mockReturnValue({ isDesktop: false })
      const wrapper = makeFabContextWrapper({ isFabDisplayed: false, setIsFabDisplayed })

      const { rerender } = renderHook(
        ({ canWrite }) => useFabOnMobile(canWrite),
        { wrapper, initialProps: { canWrite: true } }
      )
      jest.clearAllMocks()
      useBreakpoints.mockReturnValue({ isDesktop: true })

      rerender({ canWrite: true })
      expect(setIsFabDisplayed).toHaveBeenCalledWith(false)
    })
  })

  describe('boundary: both canWrite=false and isDesktop=true', () => {
    it('calls setIsFabDisplayed(false)', () => {
      useBreakpoints.mockReturnValue({ isDesktop: true })
      renderWithContext(false)
      expect(setIsFabDisplayed).toHaveBeenCalledWith(false)
    })
  })
})