import { FileTypePdf } from '@linagora/twake-icons'

import flag from 'cozy-flags'

import {
  isOfficeEnabled,
  makeOnlyOfficeIconByClass,
  shouldOpenWithOnlyOffice,
  showCreateCozyButton,
  showSharingBanner
} from '@/modules/views/OnlyOffice/helpers'

jest.mock('cozy-flags')

describe('PDF OnlyOffice support', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens PDFs with OnlyOffice only when Office is available', () => {
    const file = {
      _type: 'io.cozy.files',
      type: 'file',
      class: 'pdf',
      mime: 'application/pdf',
      name: 'contract.pdf'
    }

    expect(shouldOpenWithOnlyOffice(file, false)).toBe(false)
    expect(shouldOpenWithOnlyOffice(file, true)).toBe(true)
  })

  it('uses the desktop and touch-screen Office flags for PDF availability', () => {
    flag.mockImplementation(name => {
      if (name === 'drive.office.enabled') return true
      if (name === 'drive.office.touchScreen.enabled') return false
      return null
    })

    expect(isOfficeEnabled(true)).toBe(true)
    expect(isOfficeEnabled(false)).toBe(false)
  })

  it('uses the PDF icon in the OnlyOffice toolbar', () => {
    expect(makeOnlyOfficeIconByClass('pdf')).toBe(FileTypePdf)
  })
})

describe('showCreateCozyButton', () => {
  const baseProps = {
    isPublic: true,
    isMobile: false,
    isShareNotAdded: true,
    isCozyToCozySharingSynced: false
  }

  it('should show it on a public desktop view where the share is not added yet', () => {
    expect(showCreateCozyButton(baseProps)).toBe(true)
  })

  it('should not show it when not public', () => {
    expect(showCreateCozyButton({ ...baseProps, isPublic: false })).toBe(false)
  })

  it('should not show it on mobile', () => {
    expect(showCreateCozyButton({ ...baseProps, isMobile: true })).toBe(false)
  })

  it('should not show it when the share has already been added', () => {
    expect(showCreateCozyButton({ ...baseProps, isShareNotAdded: false })).toBe(
      false
    )
  })

  it('should not show it once cozy to cozy sharing is synced', () => {
    expect(
      showCreateCozyButton({ ...baseProps, isCozyToCozySharingSynced: true })
    ).toBe(false)
  })
})

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
