import {
  getSharedDriveRootFileMetadata,
  getSharedDriveRootRule
} from '@/modules/shareddrives/rootFile'

// Local instances use `id`, while some transformed/federated sharing docs use
// `_id`. Accept both shapes at this boundary.
export const findSharedDriveById = ({ sharedDrives, driveId }) =>
  (sharedDrives ?? []).find(
    sharing => sharing.id === driveId || sharing._id === driveId
  )

export const makeSharedDriveRootFileViewerFile = ({
  file,
  driveId,
  fileId,
  sharedDrive
}) => {
  const metadata = getSharedDriveRootFileMetadata({
    file,
    rootRule: getSharedDriveRootRule(sharedDrive),
    fallbackName: fileId
  })
  const fileClass = metadata.class || 'file'

  return {
    ...file,
    _id: fileId ?? file._id ?? file.id,
    id: fileId ?? file.id ?? file._id,
    type: 'file',
    driveId: file.driveId ?? driveId,
    ...metadata,
    ...(fileClass ? { class: fileClass } : {}),
    attributes: {
      ...file.attributes,
      ...metadata,
      type: 'file'
    },
    // Display-only breadcrumb fallback for cozy-viewer's toolbar
    // (`showFilePath: true`). Mirrors the synthetic `/Drives/<name>` path
    // used by `useTransformFolderListHasSharedDriveShortcuts`; it is not a
    // canonical Cozy path and must not be used for navigation or audit URLs.
    ...(!file.path && metadata.name ? { path: `/Drives/${metadata.name}` } : {})
  }
}
