import { joinPath } from '@/lib/path'
import { isSharedDriveDoc } from '@/modules/shareddrives/helpers'
import {
  getFileRootSharePath,
  isFileRootSharedDrive
} from '@/modules/shareddrives/rootFileNavigation'

export const makeFileSharePath = ({ file, pathname }) => {
  const fileId = file._id ?? file.id

  if (!isSharedDriveDoc(file)) {
    return joinPath(pathname, `file/${fileId}/share`)
  }

  // From the sharings list, layer the share modal over the list rather than
  // navigating into the shared-drive folder/file view. The driveId stays in
  // the path so the modal can still resolve a proxied (recipient) document.
  if (pathname === '/sharings') {
    return `/sharings/shareddrive/${file.driveId}/${fileId}/share`
  }

  if (isFileRootSharedDrive(file)) {
    return getFileRootSharePath({ file, pathname })
  }

  // For a folder-root shared drive recipient, the drive root IS the folder
  // itself: the route's `:folderId` segment and the share modal's `:fileId`
  // segment reference the same doc. Use one resolved id for both.
  return `/shareddrive/${file.driveId}/${fileId}/file/${fileId}/share`
}
