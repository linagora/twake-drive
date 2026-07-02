const mockShouldBeOpenedByOnlyOffice = jest.fn()
const mockIsDocs = jest.fn()
const mockIsExcalidrawEnabled = jest.fn()
const mockIsOfficeEnabled = jest.fn()
const mockIsOfficeEditingEnabled = jest.fn()
const mockFlag = jest.fn()

jest.mock('cozy-client/dist/models/file', () => ({
  isDocs: (...args) => mockIsDocs(...args),
  shouldBeOpenedByOnlyOffice: (...args) =>
    mockShouldBeOpenedByOnlyOffice(...args)
}))

jest.mock('cozy-flags', () => ({
  __esModule: true,
  default: (...args) => mockFlag(...args)
}))

jest.mock('@/modules/views/Excalidraw/helpers', () => ({
  ...jest.requireActual('@/modules/views/Excalidraw/helpers'),
  isExcalidrawEnabled: (...args) => mockIsExcalidrawEnabled(...args)
}))

jest.mock('@/modules/views/OnlyOffice/helpers', () => ({
  ...jest.requireActual('@/modules/views/OnlyOffice/helpers'),
  isOfficeEnabled: (...args) => mockIsOfficeEnabled(...args),
  isOfficeEditingEnabled: (...args) => mockIsOfficeEditingEnabled(...args)
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
    mockIsDocs.mockReturnValue(false)
    mockIsExcalidrawEnabled.mockReturnValue(false)
    mockIsOfficeEnabled.mockReturnValue(false)
    mockIsOfficeEditingEnabled.mockReturnValue(false)
    mockFlag.mockReturnValue(false)
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

    it('matches a Docs handle as a bridge document', () => {
      mockIsDocs.mockReturnValue(true)
      expect(findEditorForFile({ name: 'Memo' })?.slug).toBe('docs')
    })

    it('matches a Grist handle by extension and external id', () => {
      expect(
        findEditorForFile({
          name: 'Budget.grist',
          metadata: { externalId: 'doc-1' }
        })?.slug
      ).toBe('grist')
    })

    it('does not claim a .grist file without an external id', () => {
      expect(findEditorForFile({ name: 'Budget.grist' })).toBeUndefined()
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

  describe('document kinds and bridge routes', () => {
    it('marks in-app editors as kind "editor" and bridge apps as kind "bridge"', () => {
      expect(findEditorBySlug('excalidraw')?.kind).toBe('editor')
      expect(findEditorBySlug('onlyoffice')?.kind).toBe('editor')
      expect(findEditorBySlug('pdf')?.kind).toBe('editor')
      expect(findEditorBySlug('docs')?.kind).toBe('bridge')
      expect(findEditorBySlug('grist')?.kind).toBe('bridge')
    })

    it('names the bridge app that opens each bridge document', () => {
      expect(findEditorBySlug('docs')?.app).toBe('docs')
      expect(findEditorBySlug('grist')?.app).toBe('grist')
    })

    it('builds a bridge route from the document external id', () => {
      const file = { _id: 'f1', metadata: { externalId: 'doc-42' } }
      expect(findEditorBySlug('grist').makeRoute(file)).toBe(
        '/bridge/grist/doc-42'
      )
      expect(findEditorBySlug('docs').makeRoute(file)).toBe(
        '/bridge/docs/doc-42'
      )
    })
  })

  describe('create.isAvailable', () => {
    const canCreate = (slug, context) =>
      findEditorBySlug(slug).create.isAvailable(context)

    it('has no create entry for the PDF editor', () => {
      expect(findEditorBySlug('pdf').create).toBeUndefined()
    })

    it('offers Docs only privately and behind its flag', () => {
      mockFlag.mockReturnValue(true)
      expect(canCreate('docs', { isPublic: false })).toBe(true)
      expect(canCreate('docs', { isPublic: true })).toBe(false)
      mockFlag.mockReturnValue(false)
      expect(canCreate('docs', { isPublic: false })).toBe(false)
    })

    it('offers Grist only privately and behind its flag', () => {
      mockFlag.mockReturnValue(true)
      expect(canCreate('grist', { isPublic: false })).toBe(true)
      expect(canCreate('grist', { isPublic: true })).toBe(false)
      mockFlag.mockReturnValue(false)
      expect(canCreate('grist', { isPublic: false })).toBe(false)
    })

    it('offers Excalidraw publicly only when the visitor can upload', () => {
      mockIsExcalidrawEnabled.mockReturnValue(true)
      expect(canCreate('excalidraw', { isPublic: false })).toBe(true)
      expect(canCreate('excalidraw', { isPublic: true, canUpload: true })).toBe(
        true
      )
      expect(
        canCreate('excalidraw', { isPublic: true, canUpload: false })
      ).toBe(false)
      mockIsExcalidrawEnabled.mockReturnValue(false)
      expect(canCreate('excalidraw', { isPublic: false })).toBe(false)
    })

    it('offers OnlyOffice when upload is allowed and office editing is enabled', () => {
      mockIsOfficeEditingEnabled.mockReturnValue(true)
      expect(
        canCreate('onlyoffice', { canUpload: true, isDesktop: true })
      ).toBe(true)
      expect(canCreate('onlyoffice', { canUpload: false })).toBe(false)
      mockIsOfficeEditingEnabled.mockReturnValue(false)
      expect(canCreate('onlyoffice', { canUpload: true })).toBe(false)
    })

    it('forwards the device to OnlyOffice office-editing enablement', () => {
      mockIsOfficeEditingEnabled.mockReturnValue(true)
      canCreate('onlyoffice', { canUpload: true, isDesktop: true })
      expect(mockIsOfficeEditingEnabled).toHaveBeenCalledWith(true)
    })
  })
})
