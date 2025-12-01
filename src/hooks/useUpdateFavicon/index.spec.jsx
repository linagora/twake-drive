import { renderHook } from '@testing-library/react-hooks'

import flag from 'cozy-flags'

import useUpdateFavicon from '.'

jest.mock('cozy-flags')
jest.mock('@/lib/getFileMimetype', () => ({
  getFileMimetype: jest.fn()
}))

const mockFlag = flag

const mockQuerySelector = jest.fn()
const mockQuerySelectorAll = jest.fn()

const createMockLinkElement = (href = '/assets/favicon.ico') => ({
  rel: '',
  type: '',
  href
})

describe('useUpdateFavicon', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    Object.defineProperty(document, 'querySelector', {
      value: mockQuerySelector,
      writable: true
    })

    Object.defineProperty(document, 'querySelectorAll', {
      value: mockQuerySelectorAll,
      writable: true
    })

    mockFlag.mockReturnValue(true)
    mockQuerySelector.mockReturnValue(createMockLinkElement())
  })

  it('should update favicon for OnlyOffice text documents', () => {
    const file = {
      _id: '1',
      name: 'document.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    const { getFileMimetype } = require('@/lib/getFileMimetype')
    getFileMimetype.mockReturnValue(() => 'text')

    const originalLink = createMockLinkElement('/assets/favicon.ico')
    const mockLink = createMockLinkElement('/assets/favicon.ico')

    mockQuerySelector.mockReturnValue(originalLink)
    mockQuerySelectorAll.mockReturnValue([mockLink])

    renderHook(() => useUpdateFavicon(file, 'loaded'))

    expect(mockLink.href).toBe('/favicons/icon-onlyoffice-text.ico')
  })

  it('should update favicon for OnlyOffice spreadsheet documents', () => {
    const file = {
      _id: '1',
      name: 'spreadsheet.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }

    const { getFileMimetype } = require('@/lib/getFileMimetype')
    getFileMimetype.mockReturnValue(() => 'sheet')

    const originalLink = createMockLinkElement('/assets/favicon.ico')
    const mockLink = createMockLinkElement('/assets/favicon.ico')

    mockQuerySelector.mockReturnValue(originalLink)
    mockQuerySelectorAll.mockReturnValue([mockLink])

    renderHook(() => useUpdateFavicon(file, 'loaded'))

    expect(mockLink.href).toBe('/favicons/icon-onlyoffice-sheet.ico')
  })

  it('should update favicon for OnlyOffice presentation documents', () => {
    const file = {
      _id: '1',
      name: 'presentation.pptx',
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }

    const { getFileMimetype } = require('@/lib/getFileMimetype')
    getFileMimetype.mockReturnValue(() => 'slide')

    const originalLink = createMockLinkElement('/assets/favicon.ico')
    const mockLink = createMockLinkElement('/assets/favicon.ico')

    mockQuerySelector.mockReturnValue(originalLink)
    mockQuerySelectorAll.mockReturnValue([mockLink])

    renderHook(() => useUpdateFavicon(file, 'loaded'))

    expect(mockLink.href).toBe('/favicons/icon-onlyoffice-slide.ico')
  })

  it('should use original favicon for non-OnlyOffice files', () => {
    const file = {
      _id: '1',
      name: 'image.jpg',
      mime: 'image/jpeg'
    }

    const { getFileMimetype } = require('@/lib/getFileMimetype')
    getFileMimetype.mockReturnValue(() => 'image')

    const originalFaviconLink = createMockLinkElement('/custom/favicon.ico')
    const mockLink = createMockLinkElement('/custom/favicon.ico')

    mockQuerySelector.mockReturnValue(originalFaviconLink)
    mockQuerySelectorAll.mockReturnValue([mockLink])

    renderHook(() => useUpdateFavicon(file, 'loaded'))

    expect(mockLink.href).toBe('/custom/favicon.ico')
  })

  it('should restore original favicon on cleanup', () => {
    const file = {
      _id: '1',
      name: 'document.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    const { getFileMimetype } = require('@/lib/getFileMimetype')
    getFileMimetype.mockReturnValue(() => 'text')

    const originalFaviconLink = createMockLinkElement('/original/favicon.ico')
    const mockLink = createMockLinkElement('/original/favicon.ico')

    mockQuerySelector.mockReturnValue(originalFaviconLink)
    mockQuerySelectorAll.mockReturnValue([mockLink])

    const { unmount } = renderHook(() => useUpdateFavicon(file, 'loaded'))

    // Favicon should be updated to OnlyOffice icon
    expect(mockLink.href).toBe('/favicons/icon-onlyoffice-text.ico')

    unmount()

    // Favicon should be restored to original
    expect(mockLink.href).toBe('/original/favicon.ico')
  })

  it('should not update favicon when flag is disabled', () => {
    mockFlag.mockReturnValue(false)

    const file = {
      _id: '1',
      name: 'document.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    const { getFileMimetype } = require('@/lib/getFileMimetype')
    getFileMimetype.mockReturnValue(() => 'text')

    const mockLink = createMockLinkElement('/assets/favicon.ico')
    mockQuerySelectorAll.mockReturnValue([mockLink])

    renderHook(() => useUpdateFavicon(file, 'loaded'))

    expect(mockLink.href).toBe('/assets/favicon.ico')
  })

  it('should not update favicon when fetchStatus is not loaded', () => {
    const file = {
      _id: '1',
      name: 'document.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    const { getFileMimetype } = require('@/lib/getFileMimetype')
    getFileMimetype.mockReturnValue(() => 'text')

    const mockLink = createMockLinkElement('/assets/favicon.ico')
    mockQuerySelectorAll.mockReturnValue([mockLink])

    renderHook(() => useUpdateFavicon(file, 'loading'))

    expect(mockLink.href).toBe('/assets/favicon.ico')
  })

  it('should not update favicon when file is undefined', () => {
    const mockLink = createMockLinkElement('/assets/favicon.ico')
    mockQuerySelectorAll.mockReturnValue([mockLink])

    renderHook(() => useUpdateFavicon(undefined, 'loaded'))

    expect(mockLink.href).toBe('/assets/favicon.ico')
  })
})
