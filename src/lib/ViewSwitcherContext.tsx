import React, { useState, useContext, createContext, useEffect } from 'react'

import { useClient, useQuery } from 'cozy-client'

import logger from './logger'
import { getDriveSettingQuery } from '@/queries'
import { DOCTYPE_DRIVE_SETTINGS } from '@/lib/doctypes'

interface QueryResult {
  data: [
    {
      attributes: {
        preferredDriveViewType: string
      }
    }
  ]
}
// Constants
const DEFAULT_VIEW_TYPE = 'list'

interface ViewSwitcherContextProps {
  viewType: string
  switchView: (viewTypeParam: string) => Promise<void>
}

const ViewSwitcherContext = createContext<ViewSwitcherContextProps>({
  viewType: DEFAULT_VIEW_TYPE,
  switchView: async () => Promise.resolve()
})

const ViewSwitcherContextProvider: React.FC = ({ children }) => {
  const client = useClient()
  const [viewType, setViewType] = useState(DEFAULT_VIEW_TYPE)
  const settingsQuery = useQuery(
    getDriveSettingQuery.definition,
    getDriveSettingQuery.options
  ) as QueryResult

  useEffect(() => {
    if (settingsQuery.data?.length) {
      const preferred =
        settingsQuery.data[0]?.attributes?.preferredDriveViewType
      setViewType(preferred || DEFAULT_VIEW_TYPE)
    }
  }, [settingsQuery.data])

  const switchView = async (viewTypeParam: string): Promise<void> => {
    setViewType(viewTypeParam)
    if (!client) {
      logger.warn('Client not available')
      return
    }

    try {
      const existing = settingsQuery.data?.[0]

      await client.save({
        ...(existing || { _type: DOCTYPE_DRIVE_SETTINGS }),
        attributes: {
          ...(existing?.attributes || {}),
          preferredDriveViewType: viewTypeParam
        }
      })
    } catch (error) {
      logger.error('Failed to save view preference:', error)
    }
  }

  return (
    <ViewSwitcherContext.Provider value={{ viewType, switchView }}>
      {children}
    </ViewSwitcherContext.Provider>
  )
}

const useViewSwitcherContext = (): ViewSwitcherContextProps =>
  useContext(ViewSwitcherContext)

export {
  ViewSwitcherContext,
  ViewSwitcherContextProvider,
  useViewSwitcherContext
}
