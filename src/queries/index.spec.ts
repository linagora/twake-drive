import {
  buildRecentsScopedQuery,
  buildSharedDriveFolderMangoQuery
} from '@/queries'
import { SHARED_DRIVES_DIR_ID, TRASH_DIR_ID } from '@/constants/config'

describe('buildSharedDriveFolderMangoQuery', () => {
  const params = {
    driveId: 'drive-abc',
    folderId: 'folder-xyz',
    sortAttribute: 'name',
    sortOrder: 'asc'
  }

  it('sets options.driveId to the provided driveId', () => {
    const q = buildSharedDriveFolderMangoQuery(params)
    expect(q.options.driveId).toBe('drive-abc')
  })

  it('sets options.forceLink to dataproxy', () => {
    const q = buildSharedDriveFolderMangoQuery(params)
    expect(q.options.forceLink).toBe('dataproxy')
  })

  it('generates a stable options.as keyed by all four params', () => {
    const q1 = buildSharedDriveFolderMangoQuery(params)
    const q2 = buildSharedDriveFolderMangoQuery(params)
    expect(q1.options.as).toBe(q2.options.as)
    expect(q1.options.as).toContain('drive-abc')
    expect(q1.options.as).toContain('folder-xyz')
    expect(q1.options.as).toContain('name')
    expect(q1.options.as).toContain('asc')
  })

  it('generates distinct as values for different param combinations', () => {
    const q1 = buildSharedDriveFolderMangoQuery(params)
    const q2 = buildSharedDriveFolderMangoQuery({
      ...params,
      sortOrder: 'desc'
    })
    expect(q1.options.as).not.toBe(q2.options.as)
  })

  it('includes driveId in the definition where clause', () => {
    const q = buildSharedDriveFolderMangoQuery(params)
    const def = q.definition().toDefinition()
    expect(def.selector).toMatchObject({ driveId: 'drive-abc' })
  })

  it('does not filter by type (returns both folders and files)', () => {
    const q = buildSharedDriveFolderMangoQuery(params)
    const def = q.definition().toDefinition()
    expect(def.selector).not.toHaveProperty('type')
  })

  it('definition includes dir_id and driveId in indexedFields', () => {
    const q = buildSharedDriveFolderMangoQuery(params)
    const def = q.definition().toDefinition()
    expect(def.indexedFields).toEqual(
      expect.arrayContaining(['dir_id', 'driveId', 'name'])
    )
  })
})

const expectPartialIndexExcludesDirs = (
  q: ReturnType<typeof buildRecentsScopedQuery>
): void => {
  const def = q.definition().toDefinition()
  expect(def.partialFilter).toMatchObject({
    dir_id: {
      $nin: expect.arrayContaining([
        SHARED_DRIVES_DIR_ID,
        TRASH_DIR_ID
      ]) as string[]
    }
  })
}

describe('buildRecentsScopedQuery', () => {
  describe('own scope (no driveId)', () => {
    it('sets options.as to recents-own', () => {
      const q = buildRecentsScopedQuery({})
      expect(q.options.as).toBe('recents-own')
    })

    it('leaves options.driveId undefined', () => {
      const q = buildRecentsScopedQuery({})
      expect(q.options.driveId).toBeUndefined()
    })

    it('leaves options.forceLink undefined', () => {
      const q = buildRecentsScopedQuery({})
      expect(q.options.forceLink).toBeUndefined()
    })

    it('definition sorts by updated_at desc and limits to 50', () => {
      const q = buildRecentsScopedQuery({})
      const def = q.definition().toDefinition()
      expect(def.sort).toEqual([{ updated_at: 'desc' }])
      expect(def.limit).toBe(50)
    })

    it('definition partialIndex excludes SHARED_DRIVES_DIR_ID and TRASH_DIR_ID', () => {
      expectPartialIndexExcludesDirs(buildRecentsScopedQuery({}))
    })
  })

  describe('drive scope (with driveId)', () => {
    it('sets options.as to recents-drive-{driveId}', () => {
      const q = buildRecentsScopedQuery({ driveId: 'abc' })
      expect(q.options.as).toBe('recents-drive-abc')
    })

    it('sets options.driveId to the provided driveId', () => {
      const q = buildRecentsScopedQuery({ driveId: 'abc' })
      expect(q.options.driveId).toBe('abc')
    })

    it('sets options.forceLink to dataproxy', () => {
      const q = buildRecentsScopedQuery({ driveId: 'abc' })
      expect(q.options.forceLink).toBe('dataproxy')
    })

    it('definition sorts by updated_at desc and limits to 50', () => {
      const q = buildRecentsScopedQuery({ driveId: 'abc' })
      const def = q.definition().toDefinition()
      expect(def.sort).toEqual([{ updated_at: 'desc' }])
      expect(def.limit).toBe(50)
    })

    it('definition partialIndex excludes SHARED_DRIVES_DIR_ID and TRASH_DIR_ID', () => {
      expectPartialIndexExcludesDirs(
        buildRecentsScopedQuery({ driveId: 'abc' })
      )
    })
  })
})
