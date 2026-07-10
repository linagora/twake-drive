import { ReactNode } from 'react'

import { IOCozyFile } from 'cozy-client/types/types'

export type SelectedItems = Record<string, IOCozyFile>

export interface SelectionContextType {
  /** Show the SelectionBar */
  showSelectionBar: () => void

  /** Hide the SelectionBar */
  hideSelectionBar: () => void

  /** Clear all the selected items */
  clearSelection: () => void

  /** Whether the SelectionBar is visible or not */
  isSelectionBarVisible: boolean

  /** List of selected items as an array */
  selectedItems: IOCozyFile[]

  /** Select an item if it is not selected, otherwise deselect it */
  toggleSelectedItem: (item: IOCozyFile) => void

  /** Select all items */
  selectAll: (items: IOCozyFile[]) => void

  /** Find out if an item is selected by its id */
  isItemSelected: (id: string) => boolean

  /** Whether all the items are selected or not */
  isSelectAll: boolean

  /** Toggle selects all items */
  toggleSelectAllItems: (items: IOCozyFile[]) => void

  /** Set selected items directly (used internally) */
  setSelectedItems: (
    items: SelectedItems | ((prev: SelectedItems) => SelectedItems)
  ) => void

  /** Set select all status */
  setIsSelectAll: (isSelectAll: boolean) => void
}

export interface SelectionProviderProps {
  children: ReactNode
  clearOnLocationChange?: boolean
}
