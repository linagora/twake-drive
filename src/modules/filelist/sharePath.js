import { joinPath } from '@/lib/path'
import {
  getSharedDriveRootFilePathScope,
  getSharedDriveRootFileSharePath
} from '@/modules/routeUtils'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'
import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

export const makeFileSharePath = ({ file, pathname }) => {
  const fileId = file._id ?? file.id

  if (!isFromSharedDriveRecipient(file)) {
    return joinPath(pathname, `file/${fileId}/share`)
  }

  if (file.drive_root_type === DRIVE_ROOT_TYPE.FILE) {
    return getSharedDriveRootFileSharePath({
      driveId: file.driveId,
      fileId,
      scope: getSharedDriveRootFilePathScope(pathname)
    })
  }

  // For a folder-root shared drive recipient, the drive root IS the folder
  // itself: the route's `:folderId` segment and the share modal's `:fileId`
  // segment reference the same doc. Use one resolved id for both.
  return `/shareddrive/${file.driveId}/${fileId}/file/${fileId}/share`
}
