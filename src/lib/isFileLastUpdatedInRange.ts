import endOfDay from 'date-fns/endOfDay'
import isValid from 'date-fns/isValid'
import isWithinInterval from 'date-fns/isWithinInterval'
import parseISO from 'date-fns/parseISO'
import startOfDay from 'date-fns/startOfDay'
import startOfYear from 'date-fns/startOfYear'
import subDays from 'date-fns/subDays'
import subMonths from 'date-fns/subMonths'

interface ModificationDateRange {
  start: Date
  end: Date
}

type DateRangeGetter = (now: Date) => ModificationDateRange

const MODIFICATION_DATE_RANGE_GETTERS: Record<string, DateRangeGetter> = {
  today: now => ({
    start: startOfDay(now),
    end: endOfDay(now)
  }),
  'last-7-days': now => ({
    start: startOfDay(subDays(now, 6)),
    end: endOfDay(now)
  }),
  'last-month': now => ({
    start: startOfDay(subMonths(now, 1)),
    end: endOfDay(now)
  }),
  'this-year': now => ({
    start: startOfYear(now),
    end: endOfDay(now)
  })
}

export function isFileLastUpdatedInRange(
  lastUpdatedAt: string | null,
  dateRangeValue: string,
  now: Date = new Date()
): boolean {
  if (lastUpdatedAt === null) return false

  const lastUpdatedAtDate = parseISO(lastUpdatedAt)
  if (!isValid(lastUpdatedAtDate)) return false

  const getDateRange = MODIFICATION_DATE_RANGE_GETTERS[dateRangeValue]
  if (!getDateRange) return false

  return isWithinInterval(lastUpdatedAtDate, getDateRange(now))
}
