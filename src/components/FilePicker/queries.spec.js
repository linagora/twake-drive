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
})
