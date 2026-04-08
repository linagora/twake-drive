import { isValidFile, isValidFolder, getCompliantTypes } from './helpers'

const makeMockFile = ({
  extension = '.pdf',
  mime = 'application/pdf'
} = {}) => ({
  _id: '123',
  type: 'file',
  mime: mime,
  name: `mockFile${extension}`
})
const makeMockFolder = () => ({
  _id: '789',
  type: 'directory',
  name: 'mockDir'
})

describe('getCompliantTypes', () => {
  it('should an array with all valid types', () => {
    const res = getCompliantTypes('.pdf, text/plain, .not')

    expect(res).toStrictEqual(['.pdf', 'text/plain'])
  })
})

describe('isValidFile', () => {
  it('should be valid when item has no type providen', () => {
    const item = makeMockFile()
    const validTypesAccepted = []

    expect(isValidFile(item, validTypesAccepted)).toBe(true)
  })

  it('should be valid when item has an accepted extension', () => {
    const item = makeMockFile({ extension: '.png' })
    const validTypesAccepted = ['.png', '.pdf']

    expect(isValidFile(item, validTypesAccepted)).toBe(true)
  })

  it('should not be valid when item has not an accepted extension', () => {
    const item = makeMockFile({ extension: '.png' })
    const validTypesAccepted = ['.pdf']

    expect(isValidFile(item, validTypesAccepted)).toBe(false)
  })

  it('should be valid when item has an accepted mime', () => {
    const item = makeMockFile({ mime: 'image/png' })
    const validTypesAccepted = ['application/pdf', 'image/png']

    expect(isValidFile(item, validTypesAccepted)).toBe(true)
  })

  it('should not be valid when item has not an accepted mime', () => {
    const item = makeMockFile({ mime: 'image/png' })
    const validTypesAccepted = ['application/pdf']

    expect(isValidFile(item, validTypesAccepted)).toBe(false)
  })

  it('should not be valid when item is not an file', () => {
    const item = makeMockFolder()
    const validTypesAccepted = []

    expect(isValidFile(item, validTypesAccepted)).toBe(false)
  })
})

describe('isValidFolder', () => {
  it('should be valid when item is an folder', () => {
    const item = makeMockFolder()
    const validTypesAccepted = ['folder']

    expect(isValidFolder(item, validTypesAccepted)).toBe(true)
  })

  it('should not be valid when item is not an folder', () => {
    const item = makeMockFile()
    const validTypesAccepted = ['folder']

    expect(isValidFolder(item, validTypesAccepted)).toBe(false)
  })
})
