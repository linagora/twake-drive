import { useCallback, useEffect, useState } from 'react'

import { useClient, Q } from 'cozy-client'
import flag from 'cozy-flags'

import { DEFAULT_SORT, SORT_BY_UPDATE_DATE } from '@/config/sort'
import { RECENT_FOLDER_ID, TRASH_DIR_ID } from '@/constants/config'
import { DOCTYPE_DRIVE_SETTINGS } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { usePublicContext } from '@/modules/public/PublicProvider'

export interface Sort {
  attribute: string
  order: string
}

interface DriveSettings {
  _type?: string
  attributes: Sort
}

interface QueryResult {
  data?: DriveSettings[]
  fetchStatus?: string
}

const useFolderSort = (
  folderId: string
): [Sort, (props: Sort) => void, boolean] => {
  const defaultSort: Sort =
    folderId === TRASH_DIR_ID || folderId === RECENT_FOLDER_ID
      ? SORT_BY_UPDATE_DATE
      : DEFAULT_SORT

  const client = useClient()
  const { isPublic } = usePublicContext()
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false)
  const [currentSort, setCurrentSort] = useState<Sort>(defaultSort)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!client || !flag('drive.save-sort-choice.enabled') || isPublic) {
        setIsSettingsLoaded(true)
        return
      }

      try {
        const { data } = (await client.query(
          Q(DOCTYPE_DRIVE_SETTINGS)
        )) as QueryResult

        if (!data?.length) return

        setCurrentSort(data[0]?.attributes)
      } catch (error) {
        logger.error('Failed to load settings:', error)
      } finally {
        setIsSettingsLoaded(true)
      }
    }

    void load()
  }, [client, isPublic])

  const setSortOrder = useCallback(
    async ({ attribute, order }: Sort) => {
      setCurrentSort({ attribute, order })

      if (!flag('drive.save-sort-choice.enabled')) {
        logger.warn(
          'Cannot persist sort: flag drive.save-sort-choice.enabled is not enabled'
        )
        return
      }

      if (!client) {
        logger.warn('Cannot persist sort: client unavailable')
        return
      }

      if (isPublic) {
        logger.warn('Cannot persist sort: in public view')
        return
      }

      if (isSaving) {
        logger.warn('Cannot persist sort: already saving')
        return
      }

      setIsSaving(true)

      try {
        const { data } = (await client.query(
          Q(DOCTYPE_DRIVE_SETTINGS)
        )) as QueryResult

        const settingsToSave: DriveSettings = data?.length
          ? {
              ...data[0],
              attributes: { attribute, order }
            }
          : {
              _type: DOCTYPE_DRIVE_SETTINGS,
              attributes: { attribute, order }
            }

        await client.save(settingsToSave)
        logger.info('Sort settings persisted', { attribute, order })
      } catch (error) {
        logger.error('Failed to save sorting preference:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [client, isSaving, isPublic, setIsSaving]
  )

  return [currentSort, setSortOrder, isSettingsLoaded]
}

export { useFolderSort }
