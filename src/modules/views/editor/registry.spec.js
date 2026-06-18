const mockShouldBeOpenedByOnlyOffice = jest.fn()
const mockIsExcalidrawEnabled = jest.fn()
const mockIsOfficeEnabled = jest.fn()

jest.mock('cozy-client/dist/models/file', () => ({
  shouldBeOpenedByOnlyOffice: (...args) =>
    mockShouldBeOpenedByOnlyOffice(...args)
}))

jest.mock('@/modules/views/Excalidraw/helpers', () => ({
  ...jest.requireActual('@/modules/views/Excalidraw/helpers'),
  isExcalidrawEnabled: (...args) => mockIsExcalidrawEnabled(...args)
}))

jest.mock('@/modules/views/OnlyOffice/helpers', () => ({
  ...jest.requireActual('@/modules/views/OnlyOffice/helpers'),
  isOfficeEnabled: (...args) => mockIsOfficeEnabled(...args)
}))

import {
  findEditorBySlug,
  findEditorForFile,
  findEditorForShortcutTarget
} from './registry'

describe('editor registry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockShouldBeOpenedByOnlyOffice.mockReturnValue(false)
    mockIsExcalidrawEnabled.mockReturnValue(false)
    mockIsOfficeEnabled.mockReturnValue(false)
  })

  describe('findEditorForFile', () => {
    it('matches an Excalidraw file by name when the flag is on', () => {
      mockIsExcalidrawEnabled.mockReturnValue(true)
      expect(findEditorForFile({ name: 'Drawing.excalidraw' })?.slug).toBe(
        'excalidraw'
      )
    })

    it('matches an Office file by class when Office is enabled', () => {
      mockShouldBeOpenedByOnlyOffice.mockReturnValue(true)
      mockIsOfficeEnabled.mockReturnValue(true)
      expect(findEditorForFile({ name: 'Sheet.xlsx' })?.slug).toBe('onlyoffice')
    })

    it('prefers Excalidraw over OnlyOffice for a text-class .excalidraw file', () => {
      mockShouldBeOpenedByOnlyOffice.mockReturnValue(true)
      mockIsOfficeEnabled.mockReturnValue(true)
      mockIsExcalidrawEnabled.mockReturnValue(true)
      expect(findEditorForFile({ name: 'Drawing.excalidraw' })?.slug).toBe(
        'excalidraw'
      )
    })

    it('returns undefined when the matching editor is disabled', () => {
      expect(findEditorForFile({ name: 'Drawing.excalidraw' })).toBeUndefined()
    })

    it('forwards the device context to device-aware editors', () => {
      mockShouldBeOpenedByOnlyOffice.mockReturnValue(true)
      mockIsOfficeEnabled.mockReturnValue(true)
      findEditorForFile({ name: 'Sheet.xlsx' }, { isDesktop: true })
      expect(mockIsOfficeEnabled).toHaveBeenCalledWith(true)
    })

    it('never claims a PDF (it opens from the viewer)', () => {
      expect(
        findEditorForFile({ name: 'doc.pdf', class: 'pdf' })
      ).toBeUndefined()
    })
  })

  describe('findEditorForShortcutTarget', () => {
    it('matches an Excalidraw shortcut target by mime', () => {
      mockIsExcalidrawEnabled.mockReturnValue(true)
      expect(
        findEditorForShortcutTarget({
          mime: 'application/vnd.excalidraw+json'
        })?.slug
      ).toBe('excalidraw')
    })

    it('matches an Office shortcut target by class', () => {
      mockIsOfficeEnabled.mockReturnValue(true)
      expect(findEditorForShortcutTarget({ class: 'spreadsheet' })?.slug).toBe(
        'onlyoffice'
      )
    })

    it('respects enablement', () => {
      expect(
        findEditorForShortcutTarget({ mime: 'application/vnd.excalidraw+json' })
      ).toBeUndefined()
    })

    it('returns undefined for an unknown target', () => {
      mockIsOfficeEnabled.mockReturnValue(true)
      mockIsExcalidrawEnabled.mockReturnValue(true)
      expect(findEditorForShortcutTarget({ class: 'image' })).toBeUndefined()
    })
  })

  describe('findEditorBySlug', () => {
    it('finds a descriptor by slug', () => {
      expect(findEditorBySlug('onlyoffice')?.slug).toBe('onlyoffice')
      expect(findEditorBySlug('pdf')?.slug).toBe('pdf')
    })

    it('returns undefined for an unknown slug', () => {
      expect(findEditorBySlug('nope')).toBeUndefined()
    })
  })
})
