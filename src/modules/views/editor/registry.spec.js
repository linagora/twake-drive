const mockShouldBeOpenedByOnlyOffice = jest.fn()

jest.mock('cozy-client/dist/models/file', () => ({
  shouldBeOpenedByOnlyOffice: (...args) => mockShouldBeOpenedByOnlyOffice(...args)
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
      expect(findEditorForFile({ name: 'notes.txt' }, allEnabled)).toBeUndefined()
    })
  })

  describe('findEditorForShortcutTarget', () => {
    it('matches an Excalidraw shortcut target by mime', () => {
      const target = { mime: 'application/vnd.excalidraw+json' }
      expect(findEditorForShortcutTarget(target, allEnabled)?.slug).toBe(
        'excalidraw'
      )
    })

    it('matches an Office shortcut target by class', () => {
      expect(
        findEditorForShortcutTarget({ class: 'spreadsheet' }, allEnabled)?.slug
      ).toBe('onlyoffice')
    })

    it('respects enablement', () => {
      const target = { mime: 'application/vnd.excalidraw+json' }
      expect(
        findEditorForShortcutTarget(target, { isExcalidrawEnabled: false })
      ).toBeUndefined()
    })

    it('returns undefined for an unknown target', () => {
      expect(
        findEditorForShortcutTarget({ class: 'image' }, allEnabled)
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
