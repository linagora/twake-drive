import type { IOCozyFile } from 'cozy-client/types/types'

import { isSharingsEntryMatchingFilters } from './matchSharingsFilters'

const BASE_FILE: IOCozyFile = {
  _id: 'file-id',
  _rev: '1-revision',
  _type: 'io.cozy.files',
  dir_id: 'directory-id',
  name: 'File',
  metadata: {},
  type: 'file',
  class: '',
  mime: 'application/octet-stream',
  executable: false,
  encrypted: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  size: 0,
  trashed: false
}

function makeFile(overrides: Partial<IOCozyFile>): IOCozyFile {
  return {
    ...BASE_FILE,
    ...overrides,
    metadata: {
      ...BASE_FILE.metadata,
      ...overrides.metadata
    }
  }
}

describe('isSharingsEntryMatchingFilters', () => {
  const fileTypeCases: Array<[Partial<IOCozyFile>, string]> = [
    [{ type: 'directory', name: 'Folder' }, 'directory'],
    [
      {
        name: 'Report.docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      'text'
    ],
    [{ name: 'Budget.xlsx', class: 'spreadsheet' }, 'sheet'],
    [{ name: 'Deck.pptx', class: 'slide' }, 'slide'],
    [{ name: 'Photo.jpg', mime: 'image/jpeg' }, 'image'],
    [{ name: 'Manual.pdf' }, 'pdf'],
    [{ name: 'Movie.mp4', mime: 'video/mp4' }, 'video'],
    [{ name: 'Archive.zip' }, 'zip'],
    [{ name: 'Recording.mp3', mime: 'audio/mpeg' }, 'audio'],
    [{ name: 'Scene.excalidraw' }, 'excalidraw'],
    [
      {
        name: 'Website.url',
        class: 'shortcut',
        mime: 'application/internet-shortcut'
      },
      'shortcut'
    ]
  ]

  it.each(fileTypeCases)(
    'matches %p with the %s type filter',
    (overrides, type) => {
      expect(
        isSharingsEntryMatchingFilters(makeFile(overrides), { type })
      ).toBe(true)
    }
  )

  it('matches a pending shared folder using its target', () => {
    const target = {
      title: 'Shared folder',
      category: 'folder',
      _type: 'io.cozy.files',
      mime: ''
    }
    const metadata = {
      sharing: { status: 'new' },
      target
    }
    const entry = makeFile({
      metadata
    })

    expect(isSharingsEntryMatchingFilters(entry, { type: 'directory' })).toBe(
      true
    )
  })

  it('matches a shared file shortcut using its target type', () => {
    const target = {
      title: 'Shared document',
      category: 'file',
      class: 'text',
      mime: 'text/plain'
    }
    const entry = makeFile({
      class: 'shortcut',
      mime: 'application/internet-shortcut',
      metadata: {
        target
      }
    })

    expect(isSharingsEntryMatchingFilters(entry, { type: 'text' })).toBe(true)
  })

  it('matches only complete file type values', () => {
    const pdf = makeFile({ name: 'Manual.pdf' })
    const folder = makeFile({ type: 'directory', name: 'Folder' })

    expect(isSharingsEntryMatchingFilters(pdf, { type: 'pd' })).toBe(false)
    expect(isSharingsEntryMatchingFilters(folder, { type: 'pdf' })).toBe(false)
  })

  describe('modification date filter', () => {
    beforeAll(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-07-29T12:00:00.000Z'))
    })

    afterAll(() => {
      jest.useRealTimers()
    })

    it('matches files modified today', () => {
      const today = makeFile({ updated_at: '2026-07-29T08:00:00.000Z' })
      const yesterday = makeFile({ updated_at: '2026-07-28T08:00:00.000Z' })

      expect(isSharingsEntryMatchingFilters(today, { date: 'today' })).toBe(
        true
      )
      expect(isSharingsEntryMatchingFilters(yesterday, { date: 'today' })).toBe(
        false
      )
    })

    it('matches the last seven calendar days including today', () => {
      const withinRange = makeFile({
        updated_at: '2026-07-23T08:00:00.000Z'
      })
      const beforeRange = makeFile({
        updated_at: '2026-07-22T08:00:00.000Z'
      })

      expect(
        isSharingsEntryMatchingFilters(withinRange, {
          date: 'last-7-days'
        })
      ).toBe(true)
      expect(
        isSharingsEntryMatchingFilters(beforeRange, {
          date: 'last-7-days'
        })
      ).toBe(false)
    })

    it('matches only the previous calendar month', () => {
      const lastMonth = makeFile({
        updated_at: '2026-06-15T08:00:00.000Z'
      })
      const thisMonth = makeFile({
        updated_at: '2026-07-01T08:00:00.000Z'
      })

      expect(
        isSharingsEntryMatchingFilters(lastMonth, { date: 'last-month' })
      ).toBe(true)
      expect(
        isSharingsEntryMatchingFilters(thisMonth, { date: 'last-month' })
      ).toBe(false)
    })

    it('matches files modified during the current year', () => {
      const thisYear = makeFile({
        updated_at: '2026-01-01T08:00:00.000Z'
      })
      const lastYear = makeFile({
        updated_at: '2025-12-31T08:00:00.000Z'
      })

      expect(
        isSharingsEntryMatchingFilters(thisYear, { date: 'this-year' })
      ).toBe(true)
      expect(
        isSharingsEntryMatchingFilters(lastYear, { date: 'this-year' })
      ).toBe(false)
    })

    it('uses the supplied last-updated resolver', () => {
      const entry = makeFile({
        updated_at: '2025-01-01T08:00:00.000Z'
      })
      const getFileLastUpdatedAt = jest.fn(() => '2026-07-29T08:00:00.000Z')

      expect(
        isSharingsEntryMatchingFilters(
          entry,
          { date: 'today' },
          getFileLastUpdatedAt
        )
      ).toBe(true)
      expect(getFileLastUpdatedAt).toHaveBeenCalledWith(entry)
    })

    it('combines file type and modification date filters', () => {
      const recentPdf = makeFile({
        name: 'Manual.pdf',
        updated_at: '2026-07-29T08:00:00.000Z'
      })

      expect(
        isSharingsEntryMatchingFilters(recentPdf, {
          type: 'pdf',
          date: 'today'
        })
      ).toBe(true)
      expect(
        isSharingsEntryMatchingFilters(recentPdf, {
          type: 'image',
          date: 'today'
        })
      ).toBe(false)
    })

    it('rejects invalid ranges and modification dates', () => {
      const invalidDate = makeFile({ updated_at: 'not-a-date' })

      expect(
        isSharingsEntryMatchingFilters(invalidDate, { date: 'today' })
      ).toBe(false)
      expect(
        isSharingsEntryMatchingFilters(BASE_FILE, { date: 'future-range' })
      ).toBe(false)
    })
  })

  it('matches entries when filters are inactive', () => {
    const entry = makeFile({ name: 'Manual.pdf' })

    expect(isSharingsEntryMatchingFilters(entry, { type: null })).toBe(true)
    expect(isSharingsEntryMatchingFilters(entry, {})).toBe(true)
  })

  it('rejects active filters without a matcher', () => {
    const entry = makeFile({ name: 'Manual.pdf' })

    expect(isSharingsEntryMatchingFilters(entry, { future: 'value' })).toBe(
      false
    )
  })
})
