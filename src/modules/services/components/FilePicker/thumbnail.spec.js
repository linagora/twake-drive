import { makeThumbnail } from './thumbnail'

describe('makeThumbnail', () => {
  it('should return audio thumbnail link for audio MIME types', () => {
    const file = { mime: 'audio/mpeg' }
    const result = makeThumbnail(file)
    expect(result).toEqual({
      thumbnail: {
        link: 'https://files.twake.app/email-assets/file-picker/audio.png'
      }
    })
  })

  it('should return image thumbnail link for image MIME types', () => {
    const file = { mime: 'image/png' }
    const result = makeThumbnail(file)
    expect(result).toEqual({
      thumbnail: {
        link: 'https://files.twake.app/email-assets/file-picker/image.png'
      }
    })
  })

  it('should return pdf thumbnail link for PDF MIME type', () => {
    const file = { mime: 'application/pdf' }
    const result = makeThumbnail(file)
    expect(result).toEqual({
      thumbnail: {
        link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
      }
    })
  })

  it('should return word thumbnail link for Word MIME types', () => {
    const file = {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    const result = makeThumbnail(file)
    expect(result).toEqual({
      thumbnail: {
        link: 'https://files.twake.app/email-assets/file-picker/word.png'
      }
    })
  })

  it('should return default thumbnail link for unknown MIME types', () => {
    const file = { mime: 'application/json' }
    const result = makeThumbnail(file)
    expect(result).toEqual({
      thumbnail: {
        link: 'https://files.twake.app/email-assets/file-picker/default.png'
      }
    })
  })

  it('should return default thumbnail link when file has no mime property', () => {
    const file = { name: 'test.txt' }
    const result = makeThumbnail(file)
    expect(result).toEqual({
      thumbnail: {
        link: 'https://files.twake.app/email-assets/file-picker/default.png'
      }
    })
  })

  it('should return empty object when file is undefined', () => {
    const result = makeThumbnail(undefined)
    expect(result).toEqual({})
  })

  it('should return empty object when file is null', () => {
    const result = makeThumbnail(null)
    expect(result).toEqual({})
  })
})
