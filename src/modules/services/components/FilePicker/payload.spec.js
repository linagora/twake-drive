import { makeFilePickerFileEntry } from './payload'

describe('FilePicker payload', () => {
  describe('makeFilePickerFileEntry', () => {
    it('should map a Cozy file document to the payload entry shape', () => {
      const file = {
        _id: 'io.cozy.files/abc',
        name: 'invoice.pdf',
        type: 'file',
        size: '1024',
        mime: 'application/pdf'
      }

      const entry = makeFilePickerFileEntry(file, { sharingLink: 'https://x' })

      expect(entry).toEqual({
        id: 'io.cozy.files/abc',
        name: 'invoice.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        sharingLink: 'https://x'
      })
    })

    it('should expose a numeric size for files', () => {
      const file = {
        _id: '1',
        name: 'a.txt',
        type: 'file',
        size: '42',
        mime: 'text/plain'
      }
      expect(makeFilePickerFileEntry(file).size).toBe(42)
    })

    it('should not expose a mime type for folders', () => {
      const folder = { _id: '1', name: 'docs', type: 'directory' }
      const entry = makeFilePickerFileEntry(folder, {
        sharingLink: 'https://x'
      })

      expect(entry.mimeType).toBeNull()
      expect(entry.size).toBe(0)
      expect(entry.id).toBe('1')
      expect(entry.name).toBe('docs')
      expect(entry.sharingLink).toBe('https://x')
    })

    it('should build a reference entry with type and doctype, no link fields', () => {
      const folder = {
        _id: 'folder-id',
        name: 'Knowledge base',
        type: 'directory'
      }

      const entry = makeFilePickerFileEntry(folder, { reference: true })

      expect(entry).toEqual({
        id: 'folder-id',
        name: 'Knowledge base',
        size: 0,
        mimeType: null,
        type: 'directory',
        doctype: 'io.cozy.files'
      })
      expect(entry.sharingLink).toBeUndefined()
      expect(entry.downloadLink).toBeUndefined()
    })

    it('should not add type/doctype when reference is falsy', () => {
      const file = {
        _id: '1',
        name: 'a.txt',
        type: 'file',
        size: '1',
        mime: 'text/plain'
      }

      const entry = makeFilePickerFileEntry(file, { reference: false })

      expect(entry).not.toHaveProperty('type')
      expect(entry).not.toHaveProperty('doctype')
    })

    it('should only include the links that are actually provided', () => {
      const file = {
        _id: '1',
        name: 'a.txt',
        type: 'file',
        size: '1',
        mime: 'text/plain'
      }

      expect(makeFilePickerFileEntry(file).sharingLink).toBeUndefined()
      expect(makeFilePickerFileEntry(file).downloadLink).toBeUndefined()

      expect(
        makeFilePickerFileEntry(file, { sharingLink: 's' }).sharingLink
      ).toBe('s')
      expect(
        makeFilePickerFileEntry(file, { downloadLink: 'd' }).downloadLink
      ).toBe('d')
    })
  })
})
