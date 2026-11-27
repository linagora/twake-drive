import { models } from 'cozy-client'

import {
  makeNormalizedStackHit,
  resetStackSearchAvailability,
  isStackSearchUnavailable,
  searchFilesOnStack
} from './helpers'

models.file.shouldBeOpenedByOnlyOffice = jest.fn(() => false)

const makeClient = search => ({ collection: () => ({ search }) })

describe('makeNormalizedStackHit', () => {
  it('routes an own file to its folder', () => {
    expect(
      makeNormalizedStackHit({
        _id: 'f1',
        type: 'file',
        name: 'a.txt',
        mime: 'text/plain',
        dir_id: 'd1',
        path: '/Documents'
      })
    ).toEqual({
      id: 'f1',
      type: 'file',
      name: 'a.txt',
      mime: 'text/plain',
      class: undefined,
      path: '/Documents',
      url: '/folder/d1/file/f1',
      parentUrl: '/folder/d1',
      openOn: 'drive'
    })
  })

  it('routes shared drive files and folders to the shared drive', () => {
    const file = makeNormalizedStackHit({
      _id: 'f1',
      type: 'file',
      name: 'a.txt',
      dir_id: 'd1',
      drive_id: 's1'
    })
    expect(file.url).toBe('/shareddrive/s1/d1/file/f1')
    expect(file.parentUrl).toBe('/shareddrive/s1/d1')

    const dir = makeNormalizedStackHit({
      _id: 'd2',
      type: 'directory',
      name: 'Specs',
      dir_id: 'd1',
      drive_id: 's1'
    })
    expect(dir.url).toBe('/shareddrive/s1/d2')
  })

  it('routes the shortcuts and the own notes like the local index', () => {
    const shortcut = {
      _id: 'f1',
      type: 'file',
      class: 'shortcut',
      dir_id: 'd1'
    }
    expect(makeNormalizedStackHit(shortcut).url).toBe('/external/f1')
    expect(makeNormalizedStackHit({ ...shortcut, drive_id: 's1' }).url).toBe(
      '/external/s1/f1'
    )

    const note = { _id: 'f2', type: 'file', name: 'a.cozy-note', dir_id: 'd1' }
    expect(makeNormalizedStackHit(note)).toMatchObject({
      url: '/n/f2',
      openOn: 'notes'
    })
    expect(makeNormalizedStackHit({ ...note, drive_id: 's1' }).url).toBe(
      '/shareddrive/s1/d1/file/f2'
    )
  })

  it('routes the OnlyOffice files to the editor', () => {
    models.file.shouldBeOpenedByOnlyOffice.mockReturnValueOnce(true)
    const file = makeNormalizedStackHit(
      { _id: 'f1', type: 'file', name: 'a.docx', dir_id: 'd1' },
      true
    )
    expect(file.url).toContain('/onlyoffice/f1')
  })
})

describe('searchFilesOnStack', () => {
  beforeEach(() => {
    resetStackSearchAvailability()
  })

  it('returns a page of normalized files', async () => {
    const search = jest.fn().mockResolvedValue({
      data: [{ _id: 'f1', type: 'file', name: 'a.txt', dir_id: 'd1' }],
      cursor: 'next'
    })
    const page = await searchFilesOnStack(makeClient(search), 'a', {
      limit: 25,
      cursor: 'c1'
    })
    expect(search).toHaveBeenCalledWith('a', { limit: 25, cursor: 'c1' })
    expect(page.cursor).toBe('next')
    expect(page.files[0].url).toBe('/folder/d1/file/f1')
  })

  it.each([404, 503])(
    'returns null and stops asking the stack after a %s',
    async status => {
      const search = jest.fn().mockRejectedValue({ status })
      const client = makeClient(search)
      expect(await searchFilesOnStack(client, 'a')).toBe(null)
      expect(isStackSearchUnavailable()).toBe(true)
      expect(await searchFilesOnStack(client, 'b')).toBe(null)
      expect(search).toHaveBeenCalledTimes(1)
    }
  )

  it('returns null without the cozy-client method', async () => {
    expect(await searchFilesOnStack(makeClient(undefined), 'a')).toBe(null)
  })

  it('throws the other errors', async () => {
    const search = jest.fn().mockRejectedValue({ status: 500 })
    await expect(searchFilesOnStack(makeClient(search), 'a')).rejects.toEqual({
      status: 500
    })
  })
})
