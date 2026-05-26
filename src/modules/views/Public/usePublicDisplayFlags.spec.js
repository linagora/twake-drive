import { renderHook } from '@testing-library/react'

import flag from 'cozy-flags'

import { usePublicDisplayFlags } from './usePublicDisplayFlags'

// cozy-flags is globally mocked by jestHelpers/setup.js to return false
// individual tests override with flag.mockReturnValue(...)

describe('usePublicDisplayFlags', () => {
  const defaultSharingInfos = {
    loading: false,
    isSharingShortcutCreated: true
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Default: all flags off
    flag.mockReturnValue(false)
    // Reset window.location to default test URL (not /preview)
    delete window.location
    window.location = { pathname: '/' }
  })

  describe('isOldBreadcrumb', () => {
    it('is true when the breadcrumb flag is false', () => {
      flag.mockReturnValue(false)

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: defaultSharingInfos,
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isOldBreadcrumb).toBe(true)
    })

    it('is false when the breadcrumb flag is true', () => {
      flag.mockReturnValue(true)

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: defaultSharingInfos,
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isOldBreadcrumb).toBe(false)
    })

    it('is true when the breadcrumb flag returns a non-true truthy value', () => {
      flag.mockReturnValue('yes') // truthy but not strictly true

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: defaultSharingInfos,
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      // showNewBreadcrumbFlag !== true, so isOldBreadcrumb should be true
      expect(result.current.isOldBreadcrumb).toBe(true)
    })
  })

  describe('isShareNotAdded', () => {
    it('is true when not loading and shortcut not created', () => {
      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: false },
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isShareNotAdded).toBe(true)
    })

    it('is false when not loading and shortcut was created', () => {
      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: true },
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isShareNotAdded).toBe(false)
    })

    it('is false while still loading (even if shortcut not created)', () => {
      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: true, isSharingShortcutCreated: false },
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isShareNotAdded).toBe(false)
    })
  })

  describe('isPreview', () => {
    it('is false on a non-preview pathname', () => {
      window.location = { pathname: '/public' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: defaultSharingInfos,
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isPreview).toBe(false)
    })

    it('is true on /preview pathname', () => {
      window.location = { pathname: '/preview' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: defaultSharingInfos,
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isPreview).toBe(true)
    })
  })

  describe('isSharingBannerPluginDisplayed', () => {
    it('is true when share is not added (regardless of isOnSharedFolder)', () => {
      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: false },
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isSharingBannerPluginDisplayed).toBe(true)
    })

    it('is true when on a shared folder and not in preview', () => {
      window.location = { pathname: '/public' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: true },
          isOnSharedFolder: true,
          isMobile: false
        })
      )

      expect(result.current.isSharingBannerPluginDisplayed).toBe(true)
    })

    it('is false when on a shared folder but in preview mode', () => {
      window.location = { pathname: '/preview' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: true },
          isOnSharedFolder: true,
          isMobile: false
        })
      )

      expect(result.current.isSharingBannerPluginDisplayed).toBe(false)
    })

    it('is false when share is added and not on shared folder', () => {
      window.location = { pathname: '/public' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: true },
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isSharingBannerPluginDisplayed).toBe(false)
    })
  })

  describe('isAddToMyCozyFabDisplayed', () => {
    it('is true when mobile, in preview, and share not added', () => {
      window.location = { pathname: '/preview' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: false },
          isOnSharedFolder: false,
          isMobile: true
        })
      )

      expect(result.current.isAddToMyCozyFabDisplayed).toBe(true)
    })

    it('is false when not mobile', () => {
      window.location = { pathname: '/preview' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: false },
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current.isAddToMyCozyFabDisplayed).toBe(false)
    })

    it('is false when not in preview', () => {
      window.location = { pathname: '/public' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: false },
          isOnSharedFolder: false,
          isMobile: true
        })
      )

      expect(result.current.isAddToMyCozyFabDisplayed).toBe(false)
    })

    it('is false when share is already added', () => {
      window.location = { pathname: '/preview' }

      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: { loading: false, isSharingShortcutCreated: true },
          isOnSharedFolder: false,
          isMobile: true
        })
      )

      expect(result.current.isAddToMyCozyFabDisplayed).toBe(false)
    })
  })

  describe('return shape', () => {
    it('returns all expected keys', () => {
      const { result } = renderHook(() =>
        usePublicDisplayFlags({
          sharingInfos: defaultSharingInfos,
          isOnSharedFolder: false,
          isMobile: false
        })
      )

      expect(result.current).toHaveProperty('isOldBreadcrumb')
      expect(result.current).toHaveProperty('isShareNotAdded')
      expect(result.current).toHaveProperty('isPreview')
      expect(result.current).toHaveProperty('isSharingBannerPluginDisplayed')
      expect(result.current).toHaveProperty('isAddToMyCozyFabDisplayed')
    })
  })
})