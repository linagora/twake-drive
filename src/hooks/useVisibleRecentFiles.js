import { useMemo } from 'react'

import { useQuery } from 'cozy-client'
import flag from 'cozy-flags'

import { SETTINGS_DIR_PATH } from '@/constants/config'
import { buildSettingsFoldersQuery } from '@/queries'

export const isInSettingsFolder = folder =>
  folder.path === SETTINGS_DIR_PATH ||
  folder.path?.startsWith(`${SETTINGS_DIR_PATH}/`)

/**
 * Drops from a recent files result the files stored in the Settings folder
 * (e.g. the Home shortcuts in /Settings/Home), with the same flag the Drive
 * root uses to hide that folder. The result stays loading until the Settings
 * folders are known, so hidden files never flash in the list.
 */
const useVisibleRecentFiles = result => {
  const shouldHideSettingsFolder = !!flag(
    'home.wallpaper-personalization.enabled'
  )
  const settingsQuery = buildSettingsFoldersQuery()
  const settingsFolders = useQuery(settingsQuery.definition, {
    ...settingsQuery.options,
    enabled: shouldHideSettingsFolder
  })
  const areSettingsFoldersLoaded =
    !shouldHideSettingsFolder ||
    settingsFolders.fetchStatus === 'loaded' ||
    settingsFolders.fetchStatus === 'failed'
  const settingsFoldersData = settingsFolders.data

  return useMemo(() => {
    if (!shouldHideSettingsFolder || !result) return result
    if (!areSettingsFoldersLoaded) {
      return { ...result, data: [], fetchStatus: 'loading' }
    }

    const hiddenFolderIds = new Set(
      (settingsFoldersData ?? [])
        .filter(isInSettingsFolder)
        .map(folder => folder._id)
    )
    if (hiddenFolderIds.size === 0) return result

    const data = (result.data ?? []).filter(
      file => !hiddenFolderIds.has(file.dir_id)
    )
    return { ...result, data, count: data.length }
  }, [
    result,
    shouldHideSettingsFolder,
    areSettingsFoldersLoaded,
    settingsFoldersData
  ])
}

export default useVisibleRecentFiles
