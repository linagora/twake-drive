import React, {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react'

import type { IOCozyFile } from 'cozy-client/types/types'

import type { Sort } from '@/hooks/useFolderSort'

export interface SharingsRootListContextValue {
  entries: IOCozyFile[]
  sortOrder: Sort
}

export interface SharingsRootListProviderProps extends SharingsRootListContextValue {
  children: ReactNode
}

const SharingsRootListContext =
  createContext<SharingsRootListContextValue | null>(null)

export function SharingsRootListProvider({
  children,
  entries,
  sortOrder
}: SharingsRootListProviderProps): ReactElement {
  return (
    <SharingsRootListContext.Provider value={{ entries, sortOrder }}>
      {children}
    </SharingsRootListContext.Provider>
  )
}

export function useSharingsRootList(): SharingsRootListContextValue | null {
  return useContext(SharingsRootListContext)
}
