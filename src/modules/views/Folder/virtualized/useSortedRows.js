import { useMemo } from 'react'

import { sortFiles } from '../sortFiles'

import { useFileLastUpdated } from '@/modules/filelist/FileLastUpdatedContext'

export const useSortedRows = ({ rows, sortOrder, keepQueryOrder = false }) => {
  const { getFileLastUpdatedAt, groupDirectoriesFirstByUpdatedAt } =
    useFileLastUpdated()
  const { order, attribute } = sortOrder

  return useMemo(() => {
    if (keepQueryOrder) return rows
    return sortFiles(
      rows,
      { order, attribute },
      { getFileLastUpdatedAt, groupDirectoriesFirstByUpdatedAt }
    )
  }, [
    keepQueryOrder,
    rows,
    order,
    attribute,
    getFileLastUpdatedAt,
    groupDirectoriesFirstByUpdatedAt
  ])
}
