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

/**
 * Detect a file-root shared drive as seen on the recipient, where the
 * file has been materialized as a `.url` shortcut (`class: 'shortcut'`,
 * mime `application/internet-shortcut`) with the real class of the
 * shared file exposed under `metadata.target.class` by the stack.
 *
 * This is the shape that `computeFileType` needs to dispatch before the
 * generic `isShortcut` branch (which would otherwise route the click to
 * `/external/<id>`). It accepts the file with or without a top-level
 * `driveId`, since the recipient shortcut does not carry it before
 * `useTransformFolderListHasSharedDriveShortcuts` injects it.
 *
 * Requires `metadata.target.mime` as a proxy for "the stack that created
 * this shortcut knows the real class": legacy shortcuts created before
 * the stack started populating `metadata.target.mime` (and
 * `metadata.target.class`) are intentionally left to fall through to the
 * regular `isShortcut` branch.
 */
export const isFileRootSharedDriveShortcut = file =>
  Boolean(
    file &&
    file.class === 'shortcut' &&
    file.metadata?.target?.drive_root_type === DRIVE_ROOT_TYPE.FILE &&
    typeof file.metadata?.target?.mime === 'string' &&
    file.metadata.target.mime.length > 0
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
