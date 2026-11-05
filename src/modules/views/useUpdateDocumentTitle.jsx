import { useMemo, useEffect } from 'react'

import { useClient, models } from 'cozy-client'
import { useI18n } from 'twake-i18n'

import { TRASH_DIR_PATH } from '@/constants/config'
import { makeParentFolderPath } from '@/modules/filelist/helpers'
import { isInTrashDir } from '@/modules/trash/helpers'

export const makeTitle = (file, appFullName, t) => {
  if (!file) return

  const fileName =
    file && file.name && !TRASH_DIR_PATH.includes(file.name)
      ? `${file.name} `
      : ''

  const parentFolderPath = makeParentFolderPath(file)

  let path = ''
  if (models.file.isDirectory(file)) {
    if (file && file.path) {
      if (isInTrashDir(file.path)) {
        const trashSubDirectories = file.path.split(`${TRASH_DIR_PATH}/`)[1]
        path = trashSubDirectories
          ? `(${t('Nav.item_trash')}/${trashSubDirectories}) `
          : `${t('Nav.item_trash')} `
      } else if (file.path !== '/' && file.path !== `/${file.name}`) {
        path = `(${file.path.substring(1)}) `
      }
    }
  } else {
    if (file && parentFolderPath) {
      if (isInTrashDir(parentFolderPath)) {
        const trashSubDirectories = parentFolderPath.split(
          `${TRASH_DIR_PATH}/`
        )[1]
        path = trashSubDirectories
          ? `(${t('Nav.item_trash')}/${trashSubDirectories}) `
          : `(${t('Nav.item_trash')}) `
      } else {
        path = `(${parentFolderPath.substring(1)}) `
      }
    }
  }

  const separator = fileName || path ? '- ' : ''

  return `${fileName}${path}${separator}${appFullName}`
}

const useUpdateDocumentTitle = (file, fetchStatus, customTitle) => {
  const { t } = useI18n()
  const client = useClient()

  const appFullName = useMemo(
    () => `${client.appMetadata.prefix} ${client.appMetadata.name}`,
    [client.appMetadata]
  )

  const title = useMemo(() => {
    if (customTitle) {
      return `${customTitle} - ${appFullName}`
    }
    return makeTitle(file, appFullName, t)
  }, [file, appFullName, t, customTitle])

  useEffect(() => {
    const shouldUpdate = customTitle || fetchStatus === 'loaded'
    if (shouldUpdate && title && title !== document.title) {
      document.title = title
    }
  }, [fetchStatus, title, customTitle])
}

export default useUpdateDocumentTitle
