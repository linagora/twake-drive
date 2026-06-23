export const getFolderPath = folderId => {
  return `/folder/${folderId}`
}

export const getViewerPath = (folderId, fileId) => {
  return `/folder/${folderId}/file/${fileId}`
}

export const getSharedDrivePath = (driveId, folderId) => {
  return `/shareddrive/${driveId}/${folderId}`
}

export const getSharedDriveViewerPath = (driveId, folderId, fileId) => {
  return `/shareddrive/${driveId}/${folderId}/file/${fileId}`
}

export const SHARED_DRIVE_ROOT_FILE_ROUTE = 'shareddrive/:driveId/file/:fileId'

export const SHARED_DRIVE_ROOT_FILE_PATH_SCOPE = {
  DIRECT: 'direct',
  SHARINGS: 'sharings'
}

export const getSharedDriveRootFilePathScope = pathname =>
  pathname === '/sharings' || pathname.startsWith('/sharings/')
    ? SHARED_DRIVE_ROOT_FILE_PATH_SCOPE.SHARINGS
    : SHARED_DRIVE_ROOT_FILE_PATH_SCOPE.DIRECT

export const getSharedDriveRootFilePath = ({
  driveId,
  fileId,
  scope = SHARED_DRIVE_ROOT_FILE_PATH_SCOPE.DIRECT
}) => {
  const route = `shareddrive/${driveId}/file/${fileId}`

  return scope === SHARED_DRIVE_ROOT_FILE_PATH_SCOPE.SHARINGS
    ? `/sharings/${route}`
    : `/${route}`
}

export const getSharedDriveRootFileSharePath = params =>
  `${getSharedDriveRootFilePath(params)}/share`
