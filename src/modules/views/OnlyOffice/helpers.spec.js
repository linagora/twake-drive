import { showSharingBanner } from '@/modules/views/OnlyOffice/helpers'

describe('showSharingBanner', () => {
  describe('for 1 entry in history', () => {
    it('should not show the banner when it comes from a synchronized cozy to cozy sharing', () => {
      expect(window.history.length).toBe(1)

      expect(
        showSharingBanner({
          isFromSharing: true,
          isPublic: false,
          isInSharedFolder: false
        })
      ).toBe(false)
    })

    it('should show the banner - preview for cozy to cozy sharing - coming from mail', () => {
      expect(window.history.length).toBe(1)

      expect(
        showSharingBanner({
          isFromSharing: false,
          isPublic: true,
          isInSharedFolder: false
        })
      ).toBe(true)
    })
  })

  describe('for 2 entries in history', () => {
    beforeAll(() => {
      window.history.pushState('data', 'title', 'url')
    })

    it('should not show the banner when it comes from a synchronized cozy to cozy sharing', () => {
      expect(window.history.length).toBe(2)

      expect(
        showSharingBanner({
          isFromSharing: true,
          isPublic: false,
          isInSharedFolder: false
        })
      ).toBe(false)
    })

    it('should show the banner - preview for sharing by link, or cozy to cozy coming from shortcut', () => {
      expect(window.history.length).toBe(2)

      expect(
        showSharingBanner({
          isFromSharing: false,
          isPublic: true,
          isInSharedFolder: false
        })
      ).toBe(true)
    })

    it('should not show the banner - preview for cozy to cozy shared folder - coming from mail', () => {
      expect(window.history.length).toBe(2)

      expect(
        showSharingBanner({
          isFromSharing: false,
          isPublic: true,
          isInSharedFolder: true
        })
      ).toBe(false)
    })
  })

  describe('for 3 entries in history', () => {
    beforeAll(() => {
      window.history.pushState('data', 'title', 'url')
    })

    it('should not show the banner when it comes from a synchronized cozy to cozy sharing', () => {
      expect(window.history.length).toBe(3)

      expect(
        showSharingBanner({
          isFromSharing: true,
          isPublic: false,
          isInSharedFolder: false
        })
      ).toBe(false)
    })

    it('should not show the banner - preview for cozy to cozy shared folder coming from shortcut, or for a folder shared by link', () => {
      expect(window.history.length).toBe(3)

      expect(
        showSharingBanner({
          isFromSharing: false,
          isPublic: true,
          isInSharedFolder: true
        })
      ).toBe(false)
    })
  })
})
