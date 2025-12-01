import { hexToRgb, rgbToHex, mixWith, shadeColor } from './helpers'

// Mock locales to make labels deterministic in tests
jest.mock('@/locales', () => ({
  getDriveI18n: () => ({ t: k => k })
}))

describe('color helpers', () => {
  test('hexToRgb returns null on falsy/invalid inputs', () => {
    expect(hexToRgb('')).toBeNull()
    expect(hexToRgb(null)).toBeNull()
    expect(hexToRgb(undefined)).toBeNull()
    expect(hexToRgb('zzz')).toBeNull()
    expect(hexToRgb('#1234')).toBeNull()
  })

  test('hexToRgb parses 6-digit hex with or without #', () => {
    expect(hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 })
    expect(hexToRgb('ff8800')).toEqual({ r: 255, g: 136, b: 0 })
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  test('rgbToHex converts and clamps values into #rrggbb', () => {
    expect(rgbToHex({ r: 255, g: 136, b: 0 })).toBe('#ff8800')
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff')
    // Clamp below 0 and above 255
    expect(rgbToHex({ r: -20, g: 500, b: 10 })).toBe('#00ff0a')
  })

  test('mixWith blends two colors linearly by factor', () => {
    const red = { r: 255, g: 0, b: 0 }
    const blue = { r: 0, g: 0, b: 255 }
    expect(mixWith(red, blue, 0)).toEqual({ r: 255, g: 0, b: 0 })
    expect(mixWith(red, blue, 1)).toEqual({ r: 0, g: 0, b: 255 })
    expect(mixWith(red, blue, 0.5)).toEqual({ r: 128, g: 0, b: 128 })
    // Factor is clamped to [0, 1]
    expect(mixWith(red, blue, -1)).toEqual({ r: 255, g: 0, b: 0 })
    expect(mixWith(red, blue, 2)).toEqual({ r: 0, g: 0, b: 255 })
  })

  test('shadeColor mixes towards white or black', () => {
    expect(shadeColor('#000000', { to: 'white', factor: 0.5 })).toBe('#808080')
    expect(shadeColor('#ffffff', { to: 'black', factor: 0.5 })).toBe('#808080')
    expect(shadeColor('#ff0000', { to: 'white', factor: 0.5 })).toBe('#ff8080')
    expect(shadeColor('#00ff00', { to: 'black', factor: 0.5 })).toBe('#008000')
    // Fallback to input if base is invalid
    expect(shadeColor('zzz', { to: 'white', factor: 0.5 })).toBe('zzz')
  })
})
