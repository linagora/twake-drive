import {
  getSharedDriveRootFilePath,
  getSharedDriveRootFilePathScope,
  getSharedDriveRootFileSharePath
} from '@/modules/routeUtils'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'
import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

/**
 * A file is a "file root" shared drive recipient when it is itself the
 * shared drive root (not a child inside a folder-root shared drive) and
 * has type `file`. This is the only shape that routes through the dedicated
 * `FilesViewerSharedDriveRootFile` viewer.
 */
export const isFileRootSharedDrive = file =>
  Boolean(
    file &&
    isFromSharedDriveRecipient(file) &&
    file.drive_root_type === DRIVE_ROOT_TYPE.FILE
  )

export const getFileRootViewerPath = ({ file, pathname = '' }) =>
  getSharedDriveRootFilePath({
    driveId: file.driveId,
    fileId: file._id,
    scope: getSharedDriveRootFilePathScope(pathname)
  })

export const getFileRootSharePath = ({ file, pathname = '' }) =>
  getSharedDriveRootFileSharePath({
    driveId: file.driveId,
    fileId: file._id ?? file.id,
    scope: getSharedDriveRootFilePathScope(pathname)
  })

export const navigateToFileRootViewer = ({ navigate, file, pathname = '' }) => {
  navigate(getFileRootViewerPath({ file, pathname }), {
    state: { fromPathname: pathname }
  })
}

export const navigateToFileRootShare = ({ navigate, file, pathname = '' }) => {
  navigate(getFileRootSharePath({ file, pathname }))
}
