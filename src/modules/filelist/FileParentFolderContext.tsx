import React, {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

import type { File } from '@/components/FolderPicker/types'
import { makeParentFolderPath } from '@/modules/filelist/helpers'

export type GetParentFolderPath = (file: File) => string

const FileParentFolderContext =
  createContext<GetParentFolderPath>(makeParentFolderPath)

/**
 * Lets a view choose how the parent folder of its items is shown, without
 * forwarding it through rows and cells, as FileLastUpdatedProvider does for
 * dates.
 */
export function FileParentFolderProvider({
  children,
  getParentFolderPath
}: {
  children: ReactNode
  getParentFolderPath: GetParentFolderPath
}): ReactElement {
  return (
    <FileParentFolderContext.Provider value={getParentFolderPath}>
      {children}
    </FileParentFolderContext.Provider>
  )
}

export function useParentFolderPath(): GetParentFolderPath {
  return useContext(FileParentFolderContext)
}
