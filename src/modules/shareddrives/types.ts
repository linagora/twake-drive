import { IOCozyFile } from 'cozy-client/types/types'

export const DRIVE_ROOT_TYPE = {
  DIRECTORY: 'directory',
  FILE: 'file'
} as const

export type DriveRootType =
  (typeof DRIVE_ROOT_TYPE)[keyof typeof DRIVE_ROOT_TYPE]

export interface SharingRule {
  title?: string
  mime?: string
  values?: string[]
}

export interface SharedDriveFile extends IOCozyFile {
  driveId?: string
  drive_root_type?: DriveRootType
}
