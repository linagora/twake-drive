import { renderHook, act } from '@testing-library/react-hooks'

import { useRecentIcons, addRecentIcon } from './useRecentIcons'

import logger from '@/lib/logger'

jest.mock('@/lib/logger', () => ({
  error: jest.fn()
}))

const STORAGE_KEY = 'iconPicker_recent_icons'
const MAX_RECENT_ICONS = 8

describe('useRecentIcons', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should return [] initially', () => {
    const { result } = renderHook(() => useRecentIcons())

    expect(result.current).toEqual([])
  })

  it('should return [] when localStorage is empty', () => {
    const { result } = renderHook(() => useRecentIcons())
    expect(result.current).toEqual([])
  })

  it('should return parsed array when localStorage has valid data', async () => {
    const icons = ['icon1', 'icon2', 'icon3']
    localStorage.setItem(STORAGE_KEY, JSON.stringify(icons))

    let result
    await act(async () => {
      const hook = renderHook(() => useRecentIcons())
      result = hook.result
    })

    expect(result.current).toEqual(icons)
  })

  it('should return empty array when localStorage has invalid JSON', async () => {
    localStorage.setItem(STORAGE_KEY, 'invalid json')

    let result
    await act(async () => {
      const hook = renderHook(() => useRecentIcons())
      result = hook.result
    })

    expect(result.current).toEqual([])
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to load recent icons from localStorage:',
      expect.any(SyntaxError)
    )
  })

  it('should return empty array when localStorage has non-array data', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }))

    let result
    await act(async () => {
      const hook = renderHook(() => useRecentIcons())
      result = hook.result
    })

    expect(result.current).toEqual([])
  })

  it('should handle localStorage.getItem errors gracefully', async () => {
    const error = new Error('localStorage error')
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw error
      })

    let result
    await act(async () => {
      const hook = renderHook(() => useRecentIcons())
      result = hook.result
      // Wait a bit for useEffect to run and state to update
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    expect(result.current).toEqual([])
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to load recent icons from localStorage:',
      error
    )

    getItemSpy.mockRestore()
  })
})

describe('addRecentIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should do nothing when iconName is falsy', () => {
    addRecentIcon(null)
    addRecentIcon(undefined)
    addRecentIcon('')

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('should do nothing when iconName is "none"', () => {
    addRecentIcon('none')

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('should add icon to empty localStorage', () => {
    addRecentIcon('icon1')

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBe(JSON.stringify(['icon1']))
  })

  it('should add icon to existing localStorage', () => {
    const existingIcons = ['icon1', 'icon2']
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingIcons))

    addRecentIcon('icon3')

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBe(JSON.stringify(['icon3', 'icon1', 'icon2']))
  })

  it('should move existing icon to the beginning', () => {
    const existingIcons = ['icon1', 'icon2', 'icon3']
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingIcons))

    addRecentIcon('icon2')

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBe(JSON.stringify(['icon2', 'icon1', 'icon3']))
  })

  it('should limit to MAX_RECENT_ICONS', () => {
    const existingIcons = Array.from(
      { length: MAX_RECENT_ICONS },
      (_, i) => `icon${i + 1}`
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingIcons))

    addRecentIcon('newIcon')

    const stored = localStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(stored)
    expect(parsed).toHaveLength(MAX_RECENT_ICONS)
    expect(parsed[0]).toBe('newIcon')
    expect(parsed).not.toContain(existingIcons[existingIcons.length - 1])
  })

  it('should handle localStorage.getItem errors gracefully', () => {
    const error = new Error('localStorage error')
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw error
      })

    addRecentIcon('icon1')

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to save recent icons to localStorage:',
      error
    )

    getItemSpy.mockRestore()
  })

  it('should handle localStorage.setItem errors gracefully', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['icon1']))

    const error = new Error('localStorage setItem error')
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw error
      })

    addRecentIcon('icon2')

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to save recent icons to localStorage:',
      error
    )

    setItemSpy.mockRestore()
  })

  it('should handle invalid JSON in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid json')

    addRecentIcon('icon1')

    // When JSON.parse fails, error is caught and logged, but localStorage is not updated
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to save recent icons to localStorage:',
      expect.any(SyntaxError)
    )
    // localStorage still contains the invalid JSON because the error happened before setItem
    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBe('invalid json')
  })

  it('should handle non-array data in localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an array' }))

    addRecentIcon('icon1')

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBe(JSON.stringify(['icon1']))
  })

  it('should maintain order when adding same icon multiple times', () => {
    addRecentIcon('icon1')
    addRecentIcon('icon2')
    addRecentIcon('icon3')
    addRecentIcon('icon1')

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBe(JSON.stringify(['icon1', 'icon3', 'icon2']))
  })
})
