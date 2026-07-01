import { errorSerializer } from 'cozy-interapp/dist/helpers'

import { filePickerErrorCodes, makeFilePickerError } from './errors'

describe('FilePicker errors', () => {
  describe('makeFilePickerError', () => {
    it('should return an Error with the given code, message, id and fileName', () => {
      const error = makeFilePickerError(
        filePickerErrorCodes.SHARING_LINK_FAILED,
        {
          message: 'sharing failed',
          id: 'io.cozy.files/abc',
          fileName: 'invoice.pdf'
        }
      )

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('sharing failed')
      expect(error.code).toBe('SHARING_LINK_FAILED')
      expect(error.id).toBe('io.cozy.files/abc')
      expect(error.fileName).toBe('invoice.pdf')
      // Standard Error.name must NOT be clobbered by the file name.
      expect(error.name).toBe('Error')
    })

    it('should omit id and fileName when not provided', () => {
      const error = makeFilePickerError(filePickerErrorCodes.ITEM_NOT_FOUND, {
        message: 'not found'
      })

      expect(error.code).toBe('ITEM_NOT_FOUND')
      expect(error.message).toBe('not found')
      expect(error.id).toBeUndefined()
      expect(error.fileName).toBeUndefined()
    })

    it('should preserve code, id and fileName across postMessage serialize/deserialize', () => {
      const error = makeFilePickerError(
        filePickerErrorCodes.DOWNLOAD_LINK_FAILED,
        {
          message: 'no sharecode',
          id: 'io.cozy.files/abc',
          fileName: 'invoice.pdf'
        }
      )

      const serialized = errorSerializer.serialize(error)
      const restored = errorSerializer.deserialize(serialized)

      expect(restored).toBeInstanceOf(Error)
      expect(restored.code).toBe('DOWNLOAD_LINK_FAILED')
      expect(restored.id).toBe('io.cozy.files/abc')
      expect(restored.fileName).toBe('invoice.pdf')
      expect(restored.message).toBe('no sharecode')
      expect(restored.name).toBe('Error')
    })
  })
})
