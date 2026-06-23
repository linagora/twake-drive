import {
  getSharedDriveRootFilePath,
  getSharedDriveRootFilePathScope,
  getSharedDriveRootFileSharePath
} from '@/modules/routeUtils'
import { isSharedDriveDoc } from '@/modules/shareddrives/helpers'
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
    isSharedDriveDoc(file) &&
    file.drive_root_type === DRIVE_ROOT_TYPE.FILE
  )

/**
 * Detect a file-root shared drive as seen on the recipient, where the
 * file has been materialized as a `.url` shortcut (`class: 'shortcut'`,
 * mime `application/internet-shortcut`). It accepts the file with or
 * without a top-level `driveId`, since the recipient shortcut does not
 * carry it before `useTransformFolderListHasSharedDriveShortcuts` injects
 * it.
 */
export const isFileRootSharedDriveShortcut = file =>
  Boolean(
    file &&
    file.class === 'shortcut' &&
    file.metadata?.target?.drive_root_type === DRIVE_ROOT_TYPE.FILE
  )

/**
 * Only stack-enriched file-root shortcuts expose enough target metadata to
 * route to the dedicated file-root viewer. Legacy shortcuts deliberately fall
 * through to the regular `isShortcut` branch.
 */
export const isResolvableFileRootSharedDriveShortcut = file =>
  Boolean(
    isFileRootSharedDriveShortcut(file) &&
    typeof file.metadata?.target?.mime === 'string' &&
    file.metadata.target.mime.length > 0
  )

export const getFileRootSharePath = ({ file, pathname = '' }) =>
  getSharedDriveRootFileSharePath({
    driveId: file.driveId,
    fileId: file._id ?? file.id,
    scope: getSharedDriveRootFilePathScope(pathname)
  })

export const navigateToFileRootViewer = ({ navigate, file, pathname = '' }) => {
  navigate(
    getSharedDriveRootFilePath({
      driveId: file.driveId,
      fileId: file._id,
      scope: getSharedDriveRootFilePathScope(pathname)
    }),
    { state: { fromPathname: pathname } }
  )
}
