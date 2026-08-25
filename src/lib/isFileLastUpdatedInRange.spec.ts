import { isFileLastUpdatedInRange } from './isFileLastUpdatedInRange'

function makeLocalTimestamp(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 8).toISOString()
}

describe('isFileLastUpdatedInRange', () => {
  const now = new Date(2026, 6, 29, 12)

  it.each([
    ['today', makeLocalTimestamp(2026, 7, 29)],
    ['last-7-days', makeLocalTimestamp(2026, 7, 23)],
    ['this-year', makeLocalTimestamp(2026, 1, 1)]
  ])('matches the %s date range', (range, lastUpdatedAt) => {
    expect(isFileLastUpdatedInRange(lastUpdatedAt, range, now)).toBe(true)
  })

  it.each([
    ['today', makeLocalTimestamp(2026, 7, 28)],
    ['last-7-days', makeLocalTimestamp(2026, 7, 22)],
    ['this-year', makeLocalTimestamp(2025, 12, 31)]
  ])('rejects dates outside the %s date range', (range, lastUpdatedAt) => {
    expect(isFileLastUpdatedInRange(lastUpdatedAt, range, now)).toBe(false)
  })

  it('matches a rolling month including both boundary dates', () => {
    expect(
      isFileLastUpdatedInRange(
        makeLocalTimestamp(2026, 6, 29),
        'last-month',
        now
      )
    ).toBe(true)
    expect(
      isFileLastUpdatedInRange(
        makeLocalTimestamp(2026, 7, 29),
        'last-month',
        now
      )
    ).toBe(true)
    expect(
      isFileLastUpdatedInRange(
        makeLocalTimestamp(2026, 6, 28),
        'last-month',
        now
      )
    ).toBe(false)
    expect(
      isFileLastUpdatedInRange(
        makeLocalTimestamp(2026, 7, 30),
        'last-month',
        now
      )
    ).toBe(false)
  })

  it('rejects missing dates, malformed dates, and unknown ranges', () => {
    expect(isFileLastUpdatedInRange(null, 'today', now)).toBe(false)
    expect(isFileLastUpdatedInRange('not-a-date', 'today', now)).toBe(false)
    expect(
      isFileLastUpdatedInRange(
        makeLocalTimestamp(2026, 7, 29),
        'future-range',
        now
      )
    ).toBe(false)
  })
})
