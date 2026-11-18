import type { IOCozyFile } from 'cozy-client/types/types'

import { DOCTYPE_APPS } from '@/lib/doctypes'

const APP_FOLDER_IDS = [
  'io.cozy.apps/calendar',
  'io.cozy.apps/chat',
  'io.cozy.apps/mail',
  'io.cozy.apps/meetings'
] as const

type AppFolderId = (typeof APP_FOLDER_IDS)[number]

const APP_FOLDER_ICONS: Record<AppFolderId, string> = {
  'io.cozy.apps/calendar': 'CalendarToday',
  'io.cozy.apps/chat': 'Discuss',
  'io.cozy.apps/mail': 'Email',
  'io.cozy.apps/meetings': 'Videos'
}

export const UPLOAD_MAGIC_FOLDER_IDS: string[] = [
  'io.cozy.apps/notes',
  ...APP_FOLDER_IDS
]

const isAppFolderId = (id: string): id is AppFolderId =>
  APP_FOLDER_IDS.some(appFolderId => appFolderId === id)

// Reads the root field only: the store keeps the relationships of a folder
// that lost its references through realtime.
export const findAppFolderIcon = (folder: IOCozyFile): string | null => {
  const appReferences = (folder.referenced_by ?? []).filter(
    reference => reference.type === DOCTYPE_APPS
  )
  const appFolderId = appReferences
    .map(reference => reference.id)
    .find(isAppFolderId)
  return appFolderId ? APP_FOLDER_ICONS[appFolderId] : null
}
