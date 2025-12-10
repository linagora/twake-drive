import { useMemo, useEffect } from 'react'
import { useI18n } from 'twake-i18n'

import { useClient, models } from 'cozy-client'

import { TRASH_DIR_PATH } from '@/constants/config'
import { makeParentFolderPath } from '@/modules/filelist/helpers'

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
      if (file.path.startsWith(TRASH_DIR_PATH)) {
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
      if (parentFolderPath.startsWith(TRASH_DIR_PATH)) {
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

const useUpdateDocumentTitle = (file, fetchStatus) => {
  const { t } = useI18n()
  const client = useClient()

  const appFullName = useMemo(
    () => `${client.appMetadata.prefix} ${client.appMetadata.name}`,
    [client.appMetadata]
  )

  const title = useMemo(
    () => makeTitle(file, appFullName, t),
    [file, appFullName, t]
  )

  useEffect(() => {
    if (fetchStatus === 'loaded' && title !== document.title) {
      document.title = title
    }
  }, [fetchStatus, title])
}

export default useUpdateDocumentTitle
