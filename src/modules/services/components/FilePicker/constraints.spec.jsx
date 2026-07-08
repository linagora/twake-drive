import { matchMimeType, getActionDisabledState } from './constraints'

jest.mock('cozy-client', () => ({
  models: {
    file: {
      isDirectory: item => (item ? item.type === 'directory' : false),
      isFile: item => (item ? item.type === 'file' : false)
    }
  }
}))

describe('FilePicker constraints', () => {
  describe('matchMimeType', () => {
    it('should return false when mime is missing', () => {
      expect(matchMimeType(undefined, ['image/*'])).toBe(false)
      expect(matchMimeType('', ['image/*'])).toBe(false)
    })

    it('should return false when patterns is empty', () => {
      expect(matchMimeType('image/png', [])).toBe(false)
      expect(matchMimeType('image/png', undefined)).toBe(false)
    })

    it('should match an exact mime', () => {
      expect(matchMimeType('image/png', ['image/png'])).toBe(true)
      expect(matchMimeType('image/png', ['application/pdf'])).toBe(false)
    })

    it('should match a wildcard subtype', () => {
      expect(matchMimeType('image/png', ['image/*'])).toBe(true)
      expect(matchMimeType('image/jpeg', ['image/*'])).toBe(true)
      expect(matchMimeType('application/pdf', ['image/*'])).toBe(false)
    })

    it('should match the global wildcard', () => {
      expect(matchMimeType('application/pdf', ['*/*'])).toBe(true)
      expect(matchMimeType('image/png', ['*/*'])).toBe(true)
    })
  })

  describe('getActionDisabledState', () => {
    const filePdf = {
      _id: '1',
      type: 'file',
      name: 'a.pdf',
      mime: 'application/pdf',
      size: '1024'
    }
    const fileBig = {
      _id: '2',
      type: 'file',
      name: 'big.pdf',
      mime: 'application/pdf',
      size: '99999999'
    }
    const folder = { _id: '3', type: 'directory', name: 'docs' }

    it('should disable when action config is missing', () => {
      expect(getActionDisabledState(null, filePdf)).toEqual({
        disabled: true,
        reasonKey: null
      })
      expect(getActionDisabledState(undefined, filePdf)).toEqual({
        disabled: true,
        reasonKey: null
      })
    })

    it('should enable a folder when allowFolder is true', () => {
      expect(getActionDisabledState({ allowFolder: true }, folder)).toEqual({
        disabled: false,
        reasonKey: null
      })
    })

    it('should disable a folder when allowFolder is false', () => {
      expect(getActionDisabledState({ allowFolder: false }, folder)).toEqual({
        disabled: true,
        reasonKey: 'FilePicker.constraints.disabledReasons.folderNotAllowed'
      })
    })

    it('should disable a file when onlyFolder is true', () => {
      expect(
        getActionDisabledState({ allowFolder: true, onlyFolder: true }, filePdf)
      ).toEqual({
        disabled: true,
        reasonKey: 'FilePicker.constraints.disabledReasons.fileNotAllowed'
      })
    })

    it('should allow a folder when onlyFolder is true', () => {
      expect(
        getActionDisabledState({ allowFolder: true, onlyFolder: true }, folder)
      ).toEqual({ disabled: false, reasonKey: null })
    })

    it('should not disable a file when onlyFolder is false or absent', () => {
      expect(
        getActionDisabledState(
          { allowFolder: true, onlyFolder: false },
          filePdf
        )
      ).toEqual({ disabled: false, reasonKey: null })
      expect(getActionDisabledState({ allowFolder: true }, filePdf)).toEqual({
        disabled: false,
        reasonKey: null
      })
    })

    it('should disable when allowedMimeTypes is set and the file mime does not match', () => {
      expect(
        getActionDisabledState(
          { allowFolder: true, allowedMimeTypes: ['image/*'] },
          filePdf
        )
      ).toEqual({
        disabled: true,
        reasonKey: 'FilePicker.constraints.disabledReasons.mimeTypeNotAllowed'
      })
    })

    it('should allow when allowedMimeTypes is empty (no constraint)', () => {
      expect(
        getActionDisabledState(
          { allowFolder: true, allowedMimeTypes: [] },
          filePdf
        )
      ).toEqual({ disabled: false, reasonKey: null })
    })

    it('should allow when the file mime matches allowedMimeTypes', () => {
      expect(
        getActionDisabledState(
          { allowFolder: true, allowedMimeTypes: ['image/*', 'application/*'] },
          filePdf
        )
      ).toEqual({ disabled: false, reasonKey: null })
    })

    it('should disable when the file is larger than maxFileSize', () => {
      expect(
        getActionDisabledState(
          { allowFolder: true, maxFileSize: 1024 },
          fileBig
        )
      ).toEqual({
        disabled: true,
        reasonKey: 'FilePicker.constraints.disabledReasons.fileTooLarge'
      })
    })

    it('should not enforce maxFileSize when undefined', () => {
      expect(getActionDisabledState({ allowFolder: true }, fileBig)).toEqual({
        disabled: false,
        reasonKey: null
      })
    })

    it('should return enabled when no selection', () => {
      expect(getActionDisabledState({ allowFolder: true }, null)).toEqual({
        disabled: false,
        reasonKey: null
      })
    })
  })
})
