import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import flag from 'cozy-flags'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'
import logger from '@/lib/logger'

const SHARINGS_TABS = [
  SHARING_TAB_WITH_ME,
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES
] as const

export type SharingsTab = (typeof SHARINGS_TABS)[number]

const TAB_SEARCH_PARAM = 'tab'

const isSharingsTab = (value: unknown): value is SharingsTab =>
  typeof value === 'string' &&
  (SHARINGS_TABS as readonly string[]).includes(value)

// Single definition of the availability rule, shared by the URL resolution
// and the setTab guard: the drives tab only exists while a shared-drive
// feature flag is on.
const isAvailableTab = (
  value: unknown,
  drivesAvailable: boolean
): value is SharingsTab =>
  isSharingsTab(value) && (value !== SHARING_TAB_DRIVES || drivesAvailable)

const areDrivesAvailable = (): boolean =>
  Boolean(flag('drive.shared-drive.enabled')) ||
  Boolean(flag('drive.federated-shared-folder.enabled'))

const withTab = (prev: URLSearchParams, tab: SharingsTab): URLSearchParams => {
  const next = new URLSearchParams(prev)
  next.set(TAB_SEARCH_PARAM, tab)
  return next
}

/**
 * Active tab of the Sharings view, persisted across reloads.
 *
 * The `?tab=` query param is the single source of truth (`with-me` | `by-me`
 * | `drives`): a reload keeps the URL and links are shareable. Missing,
 * unrecognized (including the legacy numeric `?tab=1`) or unavailable values
 * resolve to the default "With me" tab, and the URL is canonicalized with a
 * `replace` navigation so the back button is never trapped. User tab switches
 * push a history entry so browser back/forward moves between visited tabs.
 */
export const useSharingsTab = (): [SharingsTab, (tab: SharingsTab) => void] => {
  const [searchParams, setSearchParams] = useSearchParams()
  const drivesAvailable = areDrivesAvailable()

  const paramValue = searchParams.get(TAB_SEARCH_PARAM)
  const tab = isAvailableTab(paramValue, drivesAvailable)
    ? paramValue
    : SHARING_TAB_WITH_ME

  // Canonicalize the URL when the param is missing, unrecognized or points
  // to an unavailable tab. Canonicalization must never add history entries.
  useEffect(() => {
    if (paramValue !== tab) {
      setSearchParams(prev => withTab(prev, tab), { replace: true })
    }
  }, [paramValue, tab, setSearchParams])

  const setTab = useCallback(
    (nextTab: SharingsTab): void => {
      if (!isAvailableTab(nextTab, drivesAvailable)) {
        logger.warn(
          `useSharingsTab: ignoring unknown or unavailable tab value "${String(
            nextTab
          )}"`
        )
        return
      }
      // Re-selecting the active tab must not navigate: UI controls can fire
      // onChange for the selected item, and the resulting duplicate history
      // entry would make back a no-op and clear the current selection
      // (SelectionProvider clears on every location change).
      if (nextTab === tab) {
        return
      }
      // A user tab switch pushes a history entry so back/forward moves
      // between visited tabs; unrelated params (future filters) are kept.
      setSearchParams(prev => withTab(prev, nextTab))
    },
    [drivesAvailable, setSearchParams, tab]
  )

  return [tab, setTab]
}
