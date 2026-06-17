const mockShouldBeOpenedByOnlyOffice = jest.fn()

jest.mock('cozy-client/dist/models/file', () => ({
  shouldBeOpenedByOnlyOffice: (...args) =>
    mockShouldBeOpenedByOnlyOffice(...args)
}))

import {
  findEditorBySlug,
  findEditorForFile,
  findEditorForShortcutTarget
} from './registry'

const allEnabled = { isOfficeEnabled: true, isExcalidrawEnabled: true }

describe('editor registry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockShouldBeOpenedByOnlyOffice.mockReturnValue(false)
  })

  describe('findEditorForFile', () => {
    it('matches an Excalidraw file by name', () => {
      const file = { name: 'Drawing.excalidraw' }
      expect(findEditorForFile(file, allEnabled)?.slug).toBe('excalidraw')
    })

    it('matches an Office file by class', () => {
      mockShouldBeOpenedByOnlyOffice.mockReturnValue(true)
      const file = { name: 'Sheet.xlsx' }
      expect(findEditorForFile(file, allEnabled)?.slug).toBe('onlyoffice')
    })

    it('prefers Excalidraw over OnlyOffice for a text-class .excalidraw file', () => {
      mockShouldBeOpenedByOnlyOffice.mockReturnValue(true)
      const file = { name: 'Drawing.excalidraw' }
      expect(findEditorForFile(file, allEnabled)?.slug).toBe('excalidraw')
    })

    it('returns undefined when the matching editor is disabled', () => {
      const file = { name: 'Drawing.excalidraw' }
      expect(
        findEditorForFile(file, { isExcalidrawEnabled: false })
      ).toBeUndefined()
    })

    it('returns undefined for a plain file', () => {
      expect(
        findEditorForFile({ name: 'notes.txt' }, allEnabled)
      ).toBeUndefined()
    })
  })

  describe('findEditorForShortcutTarget', () => {
    const shortcutTo = target => ({ name: 'Shared.url', metadata: { target } })

    it('matches an Excalidraw shortcut target by mime', () => {
      const shortcut = shortcutTo({ mime: 'application/vnd.excalidraw+json' })
      expect(findEditorForShortcutTarget(shortcut, allEnabled)?.slug).toBe(
        'excalidraw'
      )
    })

    it('matches an Office shortcut target by class and mime, keeping the shortcut name', () => {
      mockShouldBeOpenedByOnlyOffice.mockReturnValue(true)
      const shortcut = shortcutTo({ class: 'spreadsheet', mime: 'text/csv' })
      expect(findEditorForShortcutTarget(shortcut, allEnabled)?.slug).toBe(
        'onlyoffice'
      )
      expect(mockShouldBeOpenedByOnlyOffice).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Shared.url',
          class: 'spreadsheet',
          mime: 'text/csv'
        })
      )
    })

    it('respects enablement', () => {
      const shortcut = shortcutTo({ mime: 'application/vnd.excalidraw+json' })
      expect(
        findEditorForShortcutTarget(shortcut, { isExcalidrawEnabled: false })
      ).toBeUndefined()
    })

    it('returns undefined for an unknown target', () => {
      expect(
        findEditorForShortcutTarget(shortcutTo({ class: 'image' }), allEnabled)
      ).toBeUndefined()
    })
  })

  describe('findEditorBySlug', () => {
    it('finds a descriptor by slug', () => {
      expect(findEditorBySlug('onlyoffice')?.slug).toBe('onlyoffice')
    })

    it('returns undefined for an unknown slug', () => {
      expect(findEditorBySlug('nope')).toBeUndefined()
    })
  })
})
