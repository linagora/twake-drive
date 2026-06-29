import { buildRecentsScopedQuery } from '@/queries'
import {
  SHARED_DRIVES_DIR_ID,
  TRASH_DIR_ID
} from '@/constants/config'

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
      const q = buildRecentsScopedQuery({})
      const def = q.definition().toDefinition()
      expect(def.partialFilter).toMatchObject({
        dir_id: {
          $nin: expect.arrayContaining([SHARED_DRIVES_DIR_ID, TRASH_DIR_ID])
        }
      })
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
      const q = buildRecentsScopedQuery({ driveId: 'abc' })
      const def = q.definition().toDefinition()
      expect(def.partialFilter).toMatchObject({
        dir_id: {
          $nin: expect.arrayContaining([SHARED_DRIVES_DIR_ID, TRASH_DIR_ID])
        }
      })
    })
  })
})
