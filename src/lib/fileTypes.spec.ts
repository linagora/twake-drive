import { FILE_TYPE_VALUES, isFileType } from './fileTypes'

describe('fileTypes', () => {
  it('recognizes every canonical file type', () => {
    expect(FILE_TYPE_VALUES.every(isFileType)).toBe(true)
  })

  it('rejects values outside the canonical file types', () => {
    expect(isFileType('folder')).toBe(false)
    expect(isFileType(null)).toBe(false)
  })
})
