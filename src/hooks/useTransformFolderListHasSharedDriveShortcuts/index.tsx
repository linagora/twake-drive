import { useMemo } from 'react'

import { IOCozyFile } from 'cozy-client/types/types'
import { useSharingContext } from 'cozy-sharing'

import { SHARED_DRIVES_DIR_ID, TRASH_DIR_PATH } from '@/constants/config'
import { isNextcloudShortcut } from '@/modules/nextcloud/helpers'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'
import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'
import type {
  DriveRootType,
  SharedDriveFile,
  SharingRule
} from '@/modules/shareddrives/types'

interface SharedDrive {
  id: string
  drive_root_type?: DriveRootType
  owner?: boolean
  rules: SharingRule[]
}

interface TransformedSharedDrive extends SharedDriveFile {
  driveId: string
  owner?: boolean
}

interface UseTransformFolderListReturn {
  sharedDrives: TransformedSharedDrive[]
  nonSharedDriveList: IOCozyFile[]
  sharedDrivesLoaded: boolean
}

const useTransformFolderListHasSharedDriveShortcuts = (
  folderList?: IOCozyFile[],
  showNextcloudFolder = false
): UseTransformFolderListReturn => {
  const { isOwner } = useSharingContext() as unknown as {
    isOwner: (fileId: string) => boolean
  }

  const { sharedDrives, isLoaded: sharedDrivesLoaded } = useSharedDrives()

  /**
   * Filter out Nextcloud shortcuts from shared drives.
   */
  const filteredSharedDrives = useMemo(
    () =>
      sharedDrives.filter(
        sharing => !isNextcloudShortcut(sharing as unknown as IOCozyFile)
      ),
    [sharedDrives]
  )

  /**
   * The recipient's shared drives are displayed as shortcuts which cannot accessible
   * In some cases (like open shared drive from folder picker or sharing section...),
   *  we want to access to shared drives as directories for both owner and recipient
   * The codes below help us to transform the shared drives shortcuts into directory-like objects
   */
  const transformedSharedDrives = useMemo(
    () =>
      filteredSharedDrives.flatMap((sharing: SharedDrive) => {
        const rootId = sharing.rules[0]?.values?.[0]
        // A sharing rule without a root id cannot resolve to a file/folder doc,
        // so skip it rather than emit an entry with _id/id = undefined that
        // would later build broken routes like shareddrive/<driveId>/undefined.
        if (!rootId) return []

        const driveName = sharing.rules[0]?.title ?? ''
        const isFileDriveRoot = sharing.drive_root_type === DRIVE_ROOT_TYPE.FILE
        const fileMetadata = {
          name: driveName,
          ...(sharing.rules[0]?.mime ? { mime: sharing.rules[0].mime } : {})
        }

        const sharedDriveData = {
          type: isFileDriveRoot ? ('file' as const) : ('directory' as const),
          name: driveName,
          dir_id: SHARED_DRIVES_DIR_ID,
          driveId: sharing.id,
          ...(isFileDriveRoot
            ? {
                ...fileMetadata,
                drive_root_type: DRIVE_ROOT_TYPE.FILE
              }
            : {})
        }

        const fileInSharingSection = folderList?.find(item =>
          item.relationships?.referenced_by?.data?.some(
            ref => ref.id === sharing.id
          )
        )

        if (
          fileInSharingSection &&
          isOwner(fileInSharingSection._id ?? fileInSharingSection.id ?? '')
        )
          return [
            {
              ...fileInSharingSection,
              driveId: sharing.id,
              owner: sharing.owner,
              ...(isFileDriveRoot
                ? {
                    ...fileMetadata,
                    drive_root_type: DRIVE_ROOT_TYPE.FILE
                  }
                : {})
            } as TransformedSharedDrive
          ]

        return [
          {
            ...fileInSharingSection,
            _id: rootId,
            id: rootId,
            _type: 'io.cozy.files' as const,
            owner: sharing.owner,
            path: `/Drives/${driveName}`,
            ...sharedDriveData,
            attributes: sharedDriveData
          } as TransformedSharedDrive
        ]
      }),
    [filteredSharedDrives, folderList, isOwner]
  )

  /**
   * Create a Set of shared drive IDs for efficient lookup
   */
  const sharedDriveIds = useMemo(
    () => new Set(filteredSharedDrives.map((drive: SharedDrive) => drive.id)),
    [filteredSharedDrives]
  )

  /**
   * Exclude shared drives from the folderList,
   * since it will be replaced with transformed ones above.
   * Also exclude files that are referenced by a shared drive to avoid duplicates.
   */
  const nonSharedDriveList = useMemo(
    () =>
      folderList?.filter(item => {
        const referencedByData = item.relationships?.referenced_by?.data ?? []
        const isReferencedBySharedDrive = referencedByData.some(ref =>
          sharedDriveIds.has(ref.id)
        )
        return (
          item.dir_id !== SHARED_DRIVES_DIR_ID &&
          !item.path?.startsWith(TRASH_DIR_PATH) &&
          !isReferencedBySharedDrive &&
          (!showNextcloudFolder ? !isNextcloudShortcut(item) : true)
        )
      }) ?? [],
    [folderList, sharedDriveIds, showNextcloudFolder]
  )

  return {
    sharedDrives: transformedSharedDrives,
    nonSharedDriveList,
    sharedDrivesLoaded
  }
}

export { useTransformFolderListHasSharedDriveShortcuts }
