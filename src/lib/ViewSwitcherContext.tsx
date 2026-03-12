import React, { useState, useContext, createContext, useEffect } from 'react'

import { useClient, Q } from 'cozy-client'

import logger from './logger'

import { DOCTYPE_FILES_SETTINGS } from '@/lib/doctypes'

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

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!client) return

      try {
        const result = (await client.query(
          Q(DOCTYPE_FILES_SETTINGS)
        )) as QueryResult

        if (!result?.data) return

        const preferred = result?.data?.[0]?.attributes?.preferredDriveViewType

        setViewType(preferred || DEFAULT_VIEW_TYPE)
      } catch (error) {
        logger.error('Failed to load settings:', error)
        setViewType(DEFAULT_VIEW_TYPE)
      }
    }

    void load()
  }, [client])

  const switchView = async (viewTypeParam: string): Promise<void> => {
    setViewType(viewTypeParam)
    if (!client) {
      logger.warn('Client not available')

      return
    }

    try {
      const { data } = (await client.query(
        Q(DOCTYPE_FILES_SETTINGS)
      )) as QueryResult

      if (!data) {
        logger.warn('Settings not found')

        return
      }

      const existing = data?.[0]

      await client.save({
        ...(existing || { _type: DOCTYPE_FILES_SETTINGS }),
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
