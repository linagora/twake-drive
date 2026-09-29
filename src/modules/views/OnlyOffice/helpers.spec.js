import {
  isUntitledFileName,
  makeTitleFromText,
  showCreateCozyButton,
  showSharingBanner
} from '@/modules/views/OnlyOffice/helpers'

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

describe('makeTitleFromText', () => {
  it('should use the first complete sentence without its punctuation', () => {
    expect(makeTitleFromText('\uFEFF  Meeting notes. Second sentence')).toBe(
      'Meeting notes'
    )
    expect(makeTitleFromText('Is it done?! Yes')).toBe('Is it done')
  })

  it('should not end a sentence after a number, an initial or a short abbreviation', () => {
    expect(makeTitleFromText('1. Introduction\r\nBody')).toBe('1. Introduction')
    expect(makeTitleFromText('Dr. Smith is here. Next')).toBe(
      'Dr. Smith is here'
    )
    expect(makeTitleFromText('The U.S. market grows. Next')).toBe(
      'The U.S. market grows'
    )
  })

  it('should keep the closing quote or bracket of the sentence', () => {
    expect(makeTitleFromText('He said "hello." Then')).toBe('He said "hello"')
    expect(makeTitleFromText('Draft (to review.) Then')).toBe(
      'Draft (to review)'
    )
  })

  it('should use the first paragraph once another one is started', () => {
    expect(makeTitleFromText('Roadmap\r\n\r\nQ1 goals')).toBe('Roadmap')
  })

  it('should wait for the first sentence to be complete', () => {
    expect(makeTitleFromText('Roadmap in progr')).toBe(null)
    expect(makeTitleFromText('Roadmap\r\n')).toBe(null)
    expect(makeTitleFromText('Version 1.5 of')).toBe(null)
  })

  it('should not make a title from an empty document', () => {
    expect(makeTitleFromText('')).toBe(null)
    expect(makeTitleFromText(' \r\n\r\n')).toBe(null)
    expect(makeTitleFromText('... next')).toBe(null)
  })

  it('should make a valid file name of at most 100 characters', () => {
    expect(makeTitleFromText('Pros and/or  cons.')).toBe('Pros and or cons')
    expect(makeTitleFromText(`${'a'.repeat(150)}.`)).toBe('a'.repeat(100))
  })
})

describe('isUntitledFileName', () => {
  it('should match the name given at creation', () => {
    expect(
      isUntitledFileName('New text document.docx', 'New text document')
    ).toBe(true)
    expect(
      isUntitledFileName('New text document (2).docx', 'New text document')
    ).toBe(true)
  })

  it('should not match a renamed file', () => {
    expect(isUntitledFileName('Roadmap.docx', 'New text document')).toBe(false)
    expect(
      isUntitledFileName('New text document v2.docx', 'New text document')
    ).toBe(false)
    expect(
      isUntitledFileName('New text document.odt', 'New text document')
    ).toBe(false)
  })
})
