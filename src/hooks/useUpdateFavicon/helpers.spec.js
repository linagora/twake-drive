import { updateFavicon } from './helpers'

const mockQuerySelectorAll = jest.fn()
const mockAppendChild = jest.fn()
const mockCreateElement = jest.fn()

const createMockLinkElement = (href = '/assets/favicon.ico') => ({
  rel: '',
  type: '',
  href,
  setAttribute: jest.fn()
})

describe('updateFavicon', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    Object.defineProperty(document, 'querySelectorAll', {
      value: mockQuerySelectorAll,
      writable: true
    })

    Object.defineProperty(document, 'createElement', {
      value: mockCreateElement,
      writable: true
    })

    Object.defineProperty(document.head, 'appendChild', {
      value: mockAppendChild,
      writable: true
    })

    mockCreateElement.mockReturnValue(createMockLinkElement())
  })

  it('should return early when faviconUrl is empty', () => {
    updateFavicon('')

    expect(mockQuerySelectorAll).not.toHaveBeenCalled()
    expect(mockAppendChild).not.toHaveBeenCalled()
  })

  it('should create new favicon link when no links exist in DOM', () => {
    const mockNewLink = createMockLinkElement()
    mockCreateElement.mockReturnValue(mockNewLink)
    mockQuerySelectorAll.mockReturnValue([])

    updateFavicon('/favicons/icon-onlyoffice-text.ico')

    expect(mockCreateElement).toHaveBeenCalledWith('link')
    expect(mockNewLink.rel).toBe('icon')
    expect(mockNewLink.type).toBe('image/svg+xml')
    expect(mockNewLink.href).toBe('/favicons/icon-onlyoffice-text.ico')
    expect(mockAppendChild).toHaveBeenCalledWith(mockNewLink)
  })

  it('should not update favicon when correct favicon is already applied', () => {
    const mockLink = createMockLinkElement('/favicons/icon-onlyoffice-text.ico')
    mockQuerySelectorAll.mockReturnValue([mockLink])

    updateFavicon('/favicons/icon-onlyoffice-text.ico')

    expect(mockLink.href).toBe('/favicons/icon-onlyoffice-text.ico')
  })

  it('should update favicon when current favicon differs from target', () => {
    const mockLink = createMockLinkElement(
      '/favicons/icon-onlyoffice-sheet.ico'
    )
    mockQuerySelectorAll.mockReturnValue([mockLink])

    updateFavicon('/favicons/icon-onlyoffice-text.ico')

    expect(mockLink.href).toBe('/favicons/icon-onlyoffice-text.ico')
  })

  it('should update all favicon links when multiple exist', () => {
    const mockLink1 = createMockLinkElement('/assets/favicon.ico')
    const mockLink2 = createMockLinkElement('/assets/favicon.ico')
    mockQuerySelectorAll.mockReturnValue([mockLink1, mockLink2])

    updateFavicon('/favicons/icon-onlyoffice-text.ico')

    expect(mockLink1.href).toBe('/favicons/icon-onlyoffice-text.ico')
    expect(mockLink2.href).toBe('/favicons/icon-onlyoffice-text.ico')
  })

  it('should restore original favicon', () => {
    const mockLink = createMockLinkElement('/favicons/icon-onlyoffice-text.ico')
    mockQuerySelectorAll.mockReturnValue([mockLink])

    updateFavicon('/assets/favicon.ico')

    expect(mockLink.href).toBe('/assets/favicon.ico')
  })
})
