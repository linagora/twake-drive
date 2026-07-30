import React, {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode
} from 'react'

import type { IOCozyFile } from 'cozy-client/types/types'

export type GetFileLastUpdatedAt = (file: IOCozyFile) => string | null

export interface FileLastUpdatedContextValue {
  getFileLastUpdatedAt: GetFileLastUpdatedAt
  groupDirectoriesFirstByUpdatedAt: boolean
  showDirectoryLastUpdated: boolean
}

export interface FileLastUpdatedProviderProps {
  children: ReactNode
  getFileLastUpdatedAt: GetFileLastUpdatedAt
  groupDirectoriesFirstByUpdatedAt?: boolean
  showDirectoryLastUpdated?: boolean
}

export function getDefaultFileLastUpdatedAt(file: IOCozyFile): string | null {
  return file.updated_at || file.created_at || null
}

const DEFAULT_CONTEXT_VALUE: FileLastUpdatedContextValue = {
  getFileLastUpdatedAt: getDefaultFileLastUpdatedAt,
  groupDirectoriesFirstByUpdatedAt: true,
  showDirectoryLastUpdated: false
}

const FileLastUpdatedContext = createContext<FileLastUpdatedContextValue>(
  DEFAULT_CONTEXT_VALUE
)

/**
 * Shares one last-updated policy with both file-list implementations.
 *
 * Passing the policy as props would require forwarding it through sorting,
 * rows and cells. Calling a view-specific hook in those components would
 * couple the reusable file list to that view. Context keeps the list generic
 * while regular, virtualized and nested-route consumers use the same policy.
 */
export function FileLastUpdatedProvider({
  children,
  getFileLastUpdatedAt,
  groupDirectoriesFirstByUpdatedAt = true,
  showDirectoryLastUpdated = false
}: FileLastUpdatedProviderProps): ReactElement {
  const value = useMemo(
    () => ({
      getFileLastUpdatedAt,
      groupDirectoriesFirstByUpdatedAt,
      showDirectoryLastUpdated
    }),
    [
      getFileLastUpdatedAt,
      groupDirectoriesFirstByUpdatedAt,
      showDirectoryLastUpdated
    ]
  )

  return (
    <FileLastUpdatedContext.Provider value={value}>
      {children}
    </FileLastUpdatedContext.Provider>
  )
}

export function useFileLastUpdated(): FileLastUpdatedContextValue {
  return useContext(FileLastUpdatedContext)
}
