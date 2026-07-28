import { getFileMimetype } from './getFileMimetype'

describe('getFileMimetype', () => {
  it.each([
    ['audio/mpeg', 'recording.mp3', 'audio'],
    ['image/jpeg', 'photo.jpg', 'image'],
    ['text/plain', 'notes.txt', 'text'],
    ['video/mp4', 'movie.mp4', 'video'],
    ['application/pdf', 'manual.pdf', 'pdf'],
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'budget.xlsx',
      'sheet'
    ],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'deck.pptx',
      'slide'
    ],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'report.docx',
      'text'
    ],
    ['application/zip', 'archive.zip', 'zip']
  ])('classifies %s as %s', (mime, name, expectedType) => {
    expect(getFileMimetype(mime, name)).toBe(expectedType)
  })

  it('falls back to the filename for generic binary MIME types', () => {
    expect(
      getFileMimetype('application/octet-stream', 'presentation.pptx')
    ).toBe('slide')
  })

  it('returns null for unsupported MIME types', () => {
    expect(getFileMimetype('application/json', 'data.json')).toBe(null)
  })

  it.each(['application', 'application/'])(
    'returns null for malformed MIME type %s',
    mime => {
      expect(getFileMimetype(mime)).toBe(null)
    }
  )
})
