import {
  findDownloadsSubfolderId,
  makeDriveNavRegExp,
  makeFoldersNavRegExp
} from './helpers'

describe('findDownloadsSubfolderId', () => {
  const downloadsFolder = { _id: 'downloads', path: '/Downloads' }

  it('should return the id of a folder inside the downloads folder', () => {
    expect(
      findDownloadsSubfolderId(downloadsFolder, {
        _id: 'invoices',
        path: '/Downloads/Mail/Invoices'
      })
    ).toBe('invoices')
  })

  it('should return nothing for a folder outside of the downloads folder', () => {
    expect(
      findDownloadsSubfolderId(downloadsFolder, {
        _id: 'other',
        path: '/Downloads 2/Mail'
      })
    ).toBe(null)
    expect(findDownloadsSubfolderId(downloadsFolder, downloadsFolder)).toBe(
      null
    )
  })

  it('should return nothing while a folder is unknown', () => {
    expect(findDownloadsSubfolderId(downloadsFolder, undefined)).toBe(null)
    expect(
      findDownloadsSubfolderId(null, { _id: 'mail', path: '/Downloads/Mail' })
    ).toBe(null)
  })
})

describe('makeDriveNavRegExp', () => {
  it('should match every folder when no folder is excluded', () => {
    const driveRegExp = makeDriveNavRegExp([])

    expect(driveRegExp.test('/folder')).toBe(true)
    expect(driveRegExp.test('/folder/abc')).toBe(true)
    expect(driveRegExp.test('/nextcloud/abc')).toBe(true)
    expect(driveRegExp.test('/recent')).toBe(false)
  })

  it('should leave the excluded folders to their own navigation item', () => {
    const driveRegExp = makeDriveNavRegExp(['abc', 'def'])

    expect(driveRegExp.test('/folder')).toBe(true)
    expect(driveRegExp.test('/folder/ghi')).toBe(true)
    expect(driveRegExp.test('/folder/abc')).toBe(false)
    expect(driveRegExp.test('/folder/def/file/ghi')).toBe(false)
  })
})

describe('makeFoldersNavRegExp', () => {
  it('should match the folders and the files opened in them', () => {
    const foldersRegExp = makeFoldersNavRegExp(['abc', 'def'])

    expect(foldersRegExp.test('/folder/abc')).toBe(true)
    expect(foldersRegExp.test('/folder/def/file/ghi')).toBe(true)
    expect(foldersRegExp.test('/folder/ghi')).toBe(false)
    expect(foldersRegExp.test('/folder')).toBe(false)
  })
})
