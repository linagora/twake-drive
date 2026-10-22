import {
  PANEL_DEFAULT_WIDTH,
  clampPanelWidth,
  readPanelOpen,
  writePanelOpen
} from '@/modules/views/OnlyOffice/Scribe/panelState'

describe('panelState', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('reads false without a value', () => {
    expect(readPanelOpen()).toBe(false)
  })

  it('reads true after a write', () => {
    writePanelOpen(true)
    expect(readPanelOpen()).toBe(true)

    writePanelOpen(false)
    expect(readPanelOpen()).toBe(false)
  })

  it('opens without localStorage', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    // As in a private window of some browsers
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      }
    })

    try {
      expect(readPanelOpen()).toBe(false)
      expect(() => writePanelOpen(true)).not.toThrow()
    } finally {
      Object.defineProperty(window, 'localStorage', descriptor)
    }
  })

  it('clamps the width between 280 and 60% of the window', () => {
    expect(PANEL_DEFAULT_WIDTH).toBe(400)
    expect(clampPanelWidth(400, 1280)).toBe(400)
    expect(clampPanelWidth(100, 1280)).toBe(280)
    expect(clampPanelWidth(1000, 1280)).toBe(768)
  })

  it('gives the whole of a window too narrow for the panel and the document', () => {
    expect(clampPanelWidth(400, 400)).toBe(400)
    expect(clampPanelWidth(100, 466)).toBe(466)
    expect(clampPanelWidth(100, 467)).toBe(280)
    expect(clampPanelWidth(1000, 467)).toBeCloseTo(280.2)
  })
})
