import {
  createContext,
  createElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import flag from 'cozy-flags'

import { getSharingsRouteForTab } from './routes'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'
import logger from '@/lib/logger'

export const SHARINGS_TABS = [
  SHARING_TAB_WITH_ME,
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES
] as const

export type SharingsTab = (typeof SHARINGS_TABS)[number]
type SetTabOptions = { replace?: boolean }
type SetSharingsTab = (tab: SharingsTab, options?: SetTabOptions) => void
type SharingsTabContextValue = [SharingsTab, SetSharingsTab]
type SharingsTabProviderProps = {
  children: ReactNode
  tab: SharingsTab
}

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

export const areDrivesAvailable = (): boolean =>
  Boolean(flag('drive.shared-drive.enabled')) ||
  Boolean(flag('drive.federated-shared-folder.enabled'))

const SharingsTabContext = createContext<SharingsTabContextValue | null>(null)

export const SharingsTabProvider = ({
  children,
  tab
}: SharingsTabProviderProps): JSX.Element => {
  const location = useLocation()
  const navigate = useNavigate()
  const drivesAvailable = areDrivesAvailable()
  const activeTab = isAvailableTab(tab, drivesAvailable)
    ? tab
    : SHARING_TAB_WITH_ME
  const search = location.search

  useEffect(() => {
    if (activeTab !== tab) {
      navigate(
        {
          pathname: getSharingsRouteForTab(location.pathname, activeTab),
          search
        },
        { replace: true }
      )
    }
  }, [activeTab, location.pathname, navigate, search, tab])

  const setTab = useCallback(
    (nextTab: SharingsTab, options: SetTabOptions = {}): void => {
      if (!isAvailableTab(nextTab, drivesAvailable)) {
        logger.warn(
          `useSharingsTab: ignoring unknown or unavailable tab value "${String(
            nextTab
          )}"`
        )
        return
      }
      if (nextTab === activeTab) {
        return
      }
      navigate(
        {
          pathname: getSharingsRouteForTab(location.pathname, nextTab),
          search
        },
        { replace: options.replace }
      )
    },
    [activeTab, drivesAvailable, location.pathname, navigate, search]
  )

  const contextValue = useMemo<SharingsTabContextValue>(
    () => [activeTab, setTab],
    [activeTab, setTab]
  )

  return createElement(
    SharingsTabContext.Provider,
    { value: contextValue },
    children
  )
}

export const useSharingsTab = (): SharingsTabContextValue => {
  const context = useContext(SharingsTabContext)

  if (context === null) {
    throw new Error('useSharingsTab must be used within a SharingsTabProvider')
  }

  return context
}
