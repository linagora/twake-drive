import { useCallback, useEffect, useState } from 'react'

import { useClient, useQuery } from 'cozy-client'
import flag from 'cozy-flags'

import { DEFAULT_SORT, SORT_BY_UPDATE_DATE } from '@/config/sort'
import { RECENT_FOLDER_ID, TRASH_DIR_ID } from '@/constants/config'
import logger from '@/lib/logger'
import { getDriveSettingQuery } from '@/queries'
import { usePublicContext } from '@/modules/public/PublicProvider'

export interface Sort {
  attribute: string
  order: string
}

interface DriveSettings {
  _type?: string
  attributes: Sort
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

  const settingsQuery = useQuery(getDriveSettingQuery.definition, {
    ...getDriveSettingQuery.options,
    enabled: flag('drive.save-sort-choice.enabled')
  }) as {
    data?: DriveSettings[]
  }

  useEffect(() => {
    if (!flag('drive.save-sort-choice.enabled') || isPublic) return

    if (settingsQuery.data?.length && settingsQuery.data[0]?.attributes) {
      setCurrentSort(settingsQuery.data[0].attributes)
    }

    setIsSettingsLoaded(true)
  }, [isPublic, settingsQuery.data])

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
        const existing = settingsQuery.data?.[0]
        const settingsToSave = {
          ...(existing || { _type: 'io.cozy.drive.settings' }),
          attributes: {
            ...(existing?.attributes || {}),
            attribute,
            order
          }
        }

        await client.save(settingsToSave)
        logger.info('Sort settings persisted', { attribute, order })
      } catch (error) {
        logger.error('Failed to save sorting preference:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [client, isSaving, setIsSaving, isPublic, settingsQuery.data]
  )

  return [currentSort, setSortOrder, isSettingsLoaded]
}

export { useFolderSort }
