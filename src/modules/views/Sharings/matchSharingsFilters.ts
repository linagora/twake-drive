import {
  isDirectory,
  isDocs,
  isNote,
  isSharingShortcut
} from 'cozy-client/dist/models/file'
import type { IOCozyFile } from 'cozy-client/types/types'

import { isFileType } from '@/lib/fileTypes'
import type { FileType } from '@/lib/fileTypes'
import { getFileMimetype } from '@/lib/getFileMimetype'
import { isFileLastUpdatedInRange } from '@/lib/isFileLastUpdatedInRange'
import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'
import { EXCALIDRAW_MIME } from '@/modules/views/Excalidraw/helpers'

export type SharingsFilterValue = string | null
export type SharingsFilterValues = Record<string, SharingsFilterValue>

interface SharingsTarget {
  _type: string | null
  class: string | null
  drive_root_type: string | null
  mime: string | null
  name: string | null
  updated_at: string | null
}

type FilterMatcher = (entry: IOCozyFile, value: string) => boolean
type OptionalFileType = FileType | null

interface FileTypeContext {
  entry: IOCozyFile
  fileClass: string
  mime: string
  name: string
  target: SharingsTarget | null
  usesTargetType: boolean
}

type FileTypeClassifier = (context: FileTypeContext) => OptionalFileType

const FILTER_TYPE_BY_CLASS: Record<string, FileType> = {
  archive: 'zip',
  document: 'text',
  presentation: 'slide',
  spreadsheet: 'sheet'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStringProperty(
  value: Record<string, unknown>,
  property: string
): string | null {
  const propertyValue = value[property]
  return typeof propertyValue === 'string' ? propertyValue : null
}

function getTarget(entry: IOCozyFile): SharingsTarget | null {
  const target: unknown = entry.metadata?.target
  if (!isRecord(target)) return null

  return {
    _type: getStringProperty(target, '_type'),
    class: getStringProperty(target, 'class'),
    drive_root_type: getStringProperty(target, 'drive_root_type'),
    mime: getStringProperty(target, 'mime'),
    name: getStringProperty(target, 'name'),
    updated_at: getStringProperty(target, 'updated_at')
  }
}

function getTypedTarget(target: SharingsTarget | null): SharingsTarget | null {
  if (target === null) return null
  if (target.class !== null) return target
  if (target.mime !== null) return target
  return null
}

function getFileTypeContext(entry: IOCozyFile): FileTypeContext {
  const target = getTarget(entry)
  const typedTarget = getTypedTarget(target)
  const name = target?.name ?? entry.name ?? ''

  if (typedTarget !== null) {
    return {
      entry,
      fileClass: typedTarget.class ?? '',
      mime: typedTarget.mime ?? 'application/octet-stream',
      name,
      target,
      usesTargetType: true
    }
  }

  return {
    entry,
    fileClass: entry.class ?? '',
    mime: entry.mime ?? 'application/octet-stream',
    name,
    target,
    usesTargetType: false
  }
}

function isEntryDirectory(context: FileTypeContext): boolean {
  return isDirectory(context.entry)
}

function isDriveRootTargetDirectory(context: FileTypeContext): boolean {
  return context.target?.drive_root_type === DRIVE_ROOT_TYPE.DIRECTORY
}

function isSharingShortcutTargetDirectory(context: FileTypeContext): boolean {
  if (!isSharingShortcut(context.entry)) return false
  if (context.target?.mime !== '') return false
  return context.target._type === 'io.cozy.files'
}

const DIRECTORY_MATCHERS = [
  isEntryDirectory,
  isDriveRootTargetDirectory,
  isSharingShortcutTargetDirectory
]

function getFolderFileType(context: FileTypeContext): OptionalFileType {
  return DIRECTORY_MATCHERS.some(matcher => matcher(context))
    ? 'directory'
    : null
}

function getDrawFileType(context: FileTypeContext): OptionalFileType {
  if (context.mime === EXCALIDRAW_MIME) return 'excalidraw'
  if (context.name.toLowerCase().endsWith('.excalidraw')) return 'excalidraw'
  return null
}

function getShortcutFileType(context: FileTypeContext): OptionalFileType {
  if (context.fileClass === 'shortcut') return 'shortcut'
  if (context.mime === 'application/internet-shortcut') return 'shortcut'
  return null
}

function getDocumentFileType(context: FileTypeContext): OptionalFileType {
  if (context.usesTargetType) return null
  if (isNote(context.entry)) return 'text'
  if (isDocs(context.entry)) return 'text'
  return null
}

function getClassFileType(context: FileTypeContext): OptionalFileType {
  if (isFileType(context.fileClass)) return context.fileClass
  return FILTER_TYPE_BY_CLASS[context.fileClass] ?? null
}

function getMimeFileType(context: FileTypeContext): OptionalFileType {
  return getFileMimetype(context.mime, context.name)
}

const FILE_TYPE_CLASSIFIERS: FileTypeClassifier[] = [
  getFolderFileType,
  getDrawFileType,
  getShortcutFileType,
  getDocumentFileType,
  getClassFileType,
  getMimeFileType
]

function getSharingsEntryFileType(entry: IOCozyFile): OptionalFileType {
  const context = getFileTypeContext(entry)

  for (const classifier of FILE_TYPE_CLASSIFIERS) {
    const fileType = classifier(context)
    if (fileType !== null) return fileType
  }

  return null
}

function isSharingsEntryFileType(entry: IOCozyFile, fileType: string): boolean {
  const entryFileType = getSharingsEntryFileType(entry)
  return entryFileType === fileType
}

function isSharingsEntryModificationDate(
  entry: IOCozyFile,
  dateRangeValue: string
): boolean {
  const updatedAt = getTarget(entry)?.updated_at ?? entry.updated_at ?? null
  return isFileLastUpdatedInRange(updatedAt, dateRangeValue)
}

const FILTER_MATCHERS = {
  type: isSharingsEntryFileType,
  date: isSharingsEntryModificationDate
} satisfies Record<string, FilterMatcher>

function getFilterMatcher(filterName: string): FilterMatcher | null {
  if (filterName in FILTER_MATCHERS) {
    return FILTER_MATCHERS[filterName as keyof typeof FILTER_MATCHERS]
  }

  return null
}

export function isSharingsEntryMatchingFilters(
  entry: IOCozyFile,
  filters: Readonly<SharingsFilterValues>
): boolean {
  return Object.entries(filters).every(([filterName, value]) => {
    if (value === null) return true

    const matcher = getFilterMatcher(filterName)
    return matcher ? matcher(entry, value) : false
  })
}
