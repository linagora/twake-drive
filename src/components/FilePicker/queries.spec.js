import flag from 'cozy-flags'

import { filePickerItemTypes } from './constants'
import {
  buildContentFolderQuery,
  buildDisplayedContentFolderQuery
} from './queries'

import {
  ROOT_DIR_ID,
  SETTINGS_DIR_PATH,
  TRASH_DIR_ID
} from '@/constants/config'
import { buildDriveQuery } from '@/queries'

jest.mock('cozy-flags', () => jest.fn())

describe('FilePicker queries', () => {
  beforeEach(() => {
    flag.mockReturnValue(false)
  })
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

  it('orders directories before files in ascending mixed-content queries', () => {
    const query = buildDisplayedContentFolderQuery('folder-id', [
      filePickerItemTypes.FOLDER,
      filePickerItemTypes.FILE
    ])
    expect(query.definition().sort).toEqual([
      { dir_id: 'asc' },
      { type: 'asc' },
      { name: 'asc' }
    ])
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

  it.each([
    ['PICK', false],
    ['PICK', true],
    ['MOVE', false],
    ['MOVE', true]
  ])(
    'uses Drive visibility rules for %s with Settings hidden=%s',
    (mode, hidden) => {
      flag.mockReturnValue(hidden)
      const query =
        mode === 'PICK'
          ? buildContentFolderQuery(ROOT_DIR_ID)
          : buildDisplayedContentFolderQuery(ROOT_DIR_ID, [
              filePickerItemTypes.FOLDER
            ])
      const definition = query.definition()
      const driveDefinition = buildDriveQuery({
        currentFolderId: ROOT_DIR_ID,
        type: 'directory',
        sortAttribute: 'name',
        sortOrder: 'asc'
      }).definition()
      const expectedFilter = {
        _id: { $nin: [TRASH_DIR_ID] },
        ...(hidden
          ? {
              path: { $or: [{ $exists: false }, { $nin: [SETTINGS_DIR_PATH] }] }
            }
          : {})
      }

      expect(driveDefinition.partialFilter).toEqual(expectedFilter)
      expect(definition.partialFilter).toEqual(expectedFilter)
      expect(definition.limit).toBe(100)
    }
  )

  it('reads the same flag as Drive when the query definition is created', () => {
    const pickerQuery = buildContentFolderQuery(ROOT_DIR_ID)
    const driveQuery = buildDriveQuery({
      currentFolderId: ROOT_DIR_ID,
      type: 'directory',
      sortAttribute: 'name',
      sortOrder: 'asc'
    })
    flag.mockImplementation(
      name => name === 'home.wallpaper-personalization.enabled'
    )

    expect(pickerQuery.definition().partialFilter).toEqual(
      driveQuery.definition().partialFilter
    )
    expect(pickerQuery.definition().partialFilter.path).toEqual({
      $or: [{ $exists: false }, { $nin: ['/Settings'] }]
    })
  })

  it('keeps the document type filter for unsupported sort attributes', () => {
    const query = buildDisplayedContentFolderQuery(
      'folder-id',
      [filePickerItemTypes.FOLDER],
      { attribute: 'type', order: 'desc' }
    )
    const definition = query.definition()

    expect(definition.selector.type).toBe('directory')
    expect(definition.selector.name).toEqual({ $gt: null })
  })
})
