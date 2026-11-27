import {
  getLookupReferences,
  lookupReferencedFiles
} from '@/modules/services/lookupReferences'

const attachment = id => ({ type: 'io.cozy.mails.attachments', id })

function fakeClient(filesByReference) {
  const findReferencedBy = jest.fn(async ({ _id }) => ({
    data: [],
    included: filesByReference[_id] ?? []
  }))
  return {
    client: { collection: jest.fn(() => ({ findReferencedBy })) },
    findReferencedBy
  }
}

describe('getLookupReferences', () => {
  it('keeps each reference once', () => {
    expect(
      getLookupReferences({
        references: [attachment('a:e:b1'), attachment('a:e:b1')]
      })
    ).toEqual([attachment('a:e:b1')])
  })

  it.each([
    ['no data', undefined],
    ['no references', {}],
    ['an empty list', { references: [] }],
    [
      'more than 100 references',
      {
        references: Array.from({ length: 101 }, (_, index) =>
          attachment(`a:e:b${index}`)
        )
      }
    ]
  ])('refuses %s', (_, data) => {
    expect(() => getLookupReferences(data)).toThrow(
      'references must hold 1 to 100 references'
    )
  })

  it.each([
    ['another doctype', { type: 'io.cozy.photos.albums', id: 'a:e:b' }],
    ['an id of another shape', attachment('a/e/b')],
    ['an id too long', attachment(`a:e:${'b'.repeat(256)}`)],
    ['no object', 'a:e:b'],
    ['null', null]
  ])('refuses %s', (_, reference) => {
    expect(() =>
      getLookupReferences({ references: [attachment('a:e:b1'), reference] })
    ).toThrow('Unsupported reference')
  })
})

describe('lookupReferencedFiles', () => {
  it('gives the file of each reference, or null', async () => {
    const { client, findReferencedBy } = fakeClient({
      'a:e:b1': [
        {
          _id: 'file-1',
          name: 'report.pdf',
          dir_id: 'dir-mail',
          size: '1044',
          path: '/Mail/report.pdf',
          trashed: false
        }
      ]
    })

    const result = await lookupReferencedFiles(client, {
      references: [attachment('a:e:b1'), attachment('a:e:b2')]
    })

    expect(client.collection).toHaveBeenCalledWith('io.cozy.files')
    expect(findReferencedBy).toHaveBeenCalledWith({
      _type: 'io.cozy.mails.attachments',
      _id: 'a:e:b1'
    })
    expect(result).toEqual({
      files: {
        'a:e:b1': {
          fileId: 'file-1',
          name: 'report.pdf',
          dirId: 'dir-mail',
          trashed: false
        },
        'a:e:b2': null
      }
    })
  })

  it('prefers a file out of the trash, and says when there is only a trashed one', async () => {
    const trashed = {
      _id: 'old',
      name: 'r.pdf',
      dir_id: 'trash',
      trashed: true
    }
    const { client } = fakeClient({
      'a:e:b1': [trashed, { _id: 'kept', name: 'r.pdf', dir_id: 'd' }],
      'a:e:b2': [trashed]
    })

    const { files } = await lookupReferencedFiles(client, {
      references: [attachment('a:e:b1'), attachment('a:e:b2')]
    })

    expect(files['a:e:b1']).toEqual({
      fileId: 'kept',
      name: 'r.pdf',
      dirId: 'd',
      trashed: false
    })
    expect(files['a:e:b2']).toEqual({
      fileId: 'old',
      name: 'r.pdf',
      dirId: 'trash',
      trashed: true
    })
  })

  it('reads 5 references at a time at most', async () => {
    let running = 0
    let mostRunning = 0
    const findReferencedBy = jest.fn(async () => {
      running += 1
      mostRunning = Math.max(mostRunning, running)
      await new Promise(resolve => setTimeout(resolve, 0))
      running -= 1
      return { data: [], included: [] }
    })
    const client = { collection: () => ({ findReferencedBy }) }
    const references = Array.from({ length: 12 }, (_, index) =>
      attachment(`a:e:b${index}`)
    )

    const { files } = await lookupReferencedFiles(client, { references })

    expect(findReferencedBy).toHaveBeenCalledTimes(12)
    expect(mostRunning).toBe(5)
    expect(Object.keys(files)).toHaveLength(12)
  })

  it('reads nothing for an invalid list', async () => {
    const { client, findReferencedBy } = fakeClient({})

    await expect(
      lookupReferencedFiles(client, { references: [attachment('a/e/b')] })
    ).rejects.toThrow('Unsupported reference')
    expect(findReferencedBy).not.toHaveBeenCalled()
  })
})
