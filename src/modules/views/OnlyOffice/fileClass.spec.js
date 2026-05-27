import {
  getFileClassFromMime,
  getFileClassFromMimeOrName,
  getOnlyOfficeClassFromMime,
  getMimeFromName,
  ONLY_OFFICE_CLASS_BY_MIME
} from './fileClass'

describe('OnlyOffice file class helpers', () => {
  it.each([
    ['application/msword', 'text'],
    ['application/vnd.oasis.opendocument.text', 'text'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text'
    ],
    ['application/vnd.ms-excel', 'spreadsheet'],
    ['application/vnd.oasis.opendocument.spreadsheet', 'spreadsheet'],
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'spreadsheet'
    ],
    ['application/vnd.ms-powerpoint', 'slide'],
    ['application/vnd.oasis.opendocument.presentation', 'slide'],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'slide'
    ]
  ])('derives %s as %s', (mime, fileClass) => {
    expect(getOnlyOfficeClassFromMime(mime)).toBe(fileClass)
  })

  it('covers every MIME in the exported mapping', () => {
    expect(Object.keys(ONLY_OFFICE_CLASS_BY_MIME)).toHaveLength(9)
  })

  it('returns undefined for unsupported MIME types', () => {
    expect(getOnlyOfficeClassFromMime('image/jpeg')).toBeUndefined()
    expect(getOnlyOfficeClassFromMime()).toBeUndefined()
  })

  it.each([
    ['image/jpeg', 'image'],
    ['text/plain', 'text'],
    ['video/mp4', 'video'],
    ['audio/mpeg', 'audio'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text'
    ]
  ])('derives cozy file class %s as %s', (mime, fileClass) => {
    expect(getFileClassFromMime(mime)).toBe(fileClass)
  })

  it('returns undefined for unsupported cozy file class MIME types', () => {
    expect(getFileClassFromMime('application/pdf')).toBeUndefined()
    expect(getFileClassFromMime()).toBeUndefined()
  })

  it.each([
    ['note.txt', 'text/plain', 'text'],
    [
      'Document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text'
    ],
    ['Photo.jpg', 'image/jpeg', 'image'],
    ['Movie.mp4', 'video/mp4', 'video']
  ])('derives MIME and class from filename %s', (name, mime, fileClass) => {
    expect(getMimeFromName(name)).toBe(mime)
    expect(getFileClassFromMimeOrName({ name })).toBe(fileClass)
  })

  it('returns undefined when neither MIME nor name maps to a cozy class', () => {
    expect(getMimeFromName('unknown')).toBeUndefined()
    expect(getFileClassFromMimeOrName({ name: 'unknown' })).toBeUndefined()
  })
})
