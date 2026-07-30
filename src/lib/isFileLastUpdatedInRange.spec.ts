import { isFileLastUpdatedInRange } from './isFileLastUpdatedInRange'

describe('isFileLastUpdatedInRange', () => {
  const now = new Date('2026-07-29T12:00:00.000Z')

  it.each([
    ['today', '2026-07-29T08:00:00.000Z'],
    ['last-7-days', '2026-07-23T08:00:00.000Z'],
    ['last-month', '2026-06-15T08:00:00.000Z'],
    ['this-year', '2026-01-01T08:00:00.000Z']
  ])('matches the %s date range', (range, lastUpdatedAt) => {
    expect(isFileLastUpdatedInRange(lastUpdatedAt, range, now)).toBe(true)
  })

  it.each([
    ['today', '2026-07-28T08:00:00.000Z'],
    ['last-7-days', '2026-07-22T08:00:00.000Z'],
    ['last-month', '2026-07-01T08:00:00.000Z'],
    ['this-year', '2025-12-31T08:00:00.000Z']
  ])('rejects dates outside the %s date range', (range, lastUpdatedAt) => {
    expect(isFileLastUpdatedInRange(lastUpdatedAt, range, now)).toBe(false)
  })

  it('rejects missing dates, malformed dates, and unknown ranges', () => {
    expect(isFileLastUpdatedInRange(null, 'today', now)).toBe(false)
    expect(isFileLastUpdatedInRange('not-a-date', 'today', now)).toBe(false)
    expect(
      isFileLastUpdatedInRange('2026-07-29T08:00:00.000Z', 'future-range', now)
    ).toBe(false)
  })
})
