import isValid from 'date-fns/isValid'
import parseISO from 'date-fns/parseISO'

import type { IOCozyFile } from 'cozy-client/types/types'
import {
  getComparator,
  stableSort
} from 'cozy-ui/transpiled/react/Table/Virtualized/helpers'

import { secondarySort } from './helpers'

import type { Sort } from '@/hooks/useFolderSort'
import {
  getDefaultFileLastUpdatedAt,
  type GetFileLastUpdatedAt
} from '@/modules/filelist/FileLastUpdatedContext'

export interface SortFilesOptions {
  getFileLastUpdatedAt?: GetFileLastUpdatedAt
  groupDirectoriesFirstByUpdatedAt?: boolean
}

type FileComparator = (first: IOCozyFile, second: IOCozyFile) => number

const getFileComparator = getComparator as (
  order: string,
  attribute: string
) => FileComparator
const stableSortFiles = stableSort as (
  files: IOCozyFile[],
  comparator: FileComparator
) => IOCozyFile[]
const sortDirectoriesFirst = secondarySort as (
  files: IOCozyFile[]
) => IOCozyFile[]

function getTimestamp(timestamp: string | null): number | null {
  if (timestamp === null) return null

  const date = parseISO(timestamp)
  return isValid(date) ? date.getTime() : null
}

function getLastUpdatedComparator(
  order: string,
  getFileLastUpdatedAt: GetFileLastUpdatedAt
): (first: IOCozyFile, second: IOCozyFile) => number {
  return (first, second) => {
    const firstTimestamp = getTimestamp(getFileLastUpdatedAt(first))
    const secondTimestamp = getTimestamp(getFileLastUpdatedAt(second))

    if (firstTimestamp === null) return secondTimestamp === null ? 0 : 1
    if (secondTimestamp === null) return -1

    return order === 'desc'
      ? secondTimestamp - firstTimestamp
      : firstTimestamp - secondTimestamp
  }
}

export function sortFiles(
  files: ReadonlyArray<IOCozyFile>,
  sortOrder: Sort,
  {
    getFileLastUpdatedAt = getDefaultFileLastUpdatedAt,
    groupDirectoriesFirstByUpdatedAt = true
  }: SortFilesOptions = {}
): IOCozyFile[] {
  const { attribute, order } = sortOrder
  if (!attribute || !order) return sortDirectoriesFirst([...files])

  const resolvedComparator =
    attribute === 'updated_at'
      ? getLastUpdatedComparator(order, getFileLastUpdatedAt)
      : getFileComparator(order, attribute)
  const sortedFiles = stableSortFiles([...files], resolvedComparator)

  if (attribute === 'updated_at' && !groupDirectoriesFirstByUpdatedAt) {
    return sortedFiles
  }

  return sortDirectoriesFirst(sortedFiles)
}
