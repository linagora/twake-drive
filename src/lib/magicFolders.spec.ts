import type { IOCozyFile } from 'cozy-client/types/types'

import { findAppFolderIcon } from './magicFolders'

const mailReference = { type: 'io.cozy.apps', id: 'io.cozy.apps/mail' }

const makeFolder = (attributes: object): IOCozyFile =>
  ({ _id: 'folder-id', type: 'directory', ...attributes }) as IOCozyFile

describe('findAppFolderIcon', () => {
  it('should return the icon of the app the folder is referenced by', () => {
    const folder = makeFolder({
      referenced_by: [{ type: 'io.cozy.sharings', id: 'abc' }, mailReference]
    })

    expect(findAppFolderIcon(folder)).toBe('Email')
  })

  it('should return nothing for a folder of another app or without reference', () => {
    expect(
      findAppFolderIcon(
        makeFolder({
          referenced_by: [{ type: 'io.cozy.apps', id: 'io.cozy.apps/notes' }]
        })
      )
    ).toBe(null)
    expect(findAppFolderIcon(makeFolder({}))).toBe(null)
  })

  it('should ignore the relationships left by a reference the folder lost', () => {
    const folder = makeFolder({
      referenced_by: [],
      relationships: { referenced_by: { data: [mailReference] } }
    })

    expect(findAppFolderIcon(folder)).toBe(null)
  })
})
