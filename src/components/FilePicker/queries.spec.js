import { filePickerItemTypes } from './constants'
import {
  buildContentFolderQuery,
  buildDisplayedContentFolderQuery
} from './queries'

describe('FilePicker queries', () => {
  it('preserves the intent content query identity', () => {
    const query = buildContentFolderQuery('io.cozy.files.root-dir')
    expect(query.options.as).toBe(
      'buildContentFolderQuery-io.cozy.files.root-dir'
    )
    expect(query.definition().limit).toBe(100)
  })

  it('filters folder-only content in the query before pagination', () => {
    const query = buildDisplayedContentFolderQuery('folder-id', [
      filePickerItemTypes.FOLDER
    ])
    const definition = query.definition()

    expect(definition.selector.type).toBe('directory')
    expect(definition.limit).toBe(100)
    expect(query.options.as).toBe('filePicker-folders-folder-id')
  })

  it('uses the selected sort in the selector, index, and ordering', () => {
    const query = buildDisplayedContentFolderQuery(
      'folder-id',
      [filePickerItemTypes.FOLDER],
      { attribute: 'updated_at', order: 'desc' }
    )
    const definition = query.definition()

    expect(definition.selector).toEqual({
      dir_id: 'folder-id',
      type: 'directory',
      updated_at: { $gt: null }
    })
    expect(definition.indexedFields).toEqual(['dir_id', 'type', 'updated_at'])
    expect(definition.sort).toEqual([
      { dir_id: 'desc' },
      { type: 'desc' },
      { updated_at: 'desc' }
    ])
    expect(query.options.as).toBe(
      'filePicker-folders-folder-id-updated_at-desc'
    )
  })
})
