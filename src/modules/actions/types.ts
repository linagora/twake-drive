import type { ForwardRefExoticComponent, RefAttributes } from 'react'

import type { IOCozyFile } from 'cozy-client/types/types'
import type { Action as CozyAction } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'

/**
 * Policy properties for actions.
 * These determine when an action should be available based on file characteristics.
 */
export interface ActionPolicy {
  /**
   * Whether this action can be performed on infected files.
   * Default: false - action will be hidden when any selected file is infected.
   *
   * Set to `true` for actions that should remain available for infected files
   * (e.g., trash, as users need to be able to delete infected files).
   */
  allowInfectedFiles?: boolean
}

/**
 * Context passed to action handlers and components.
 */
export interface ActionContext {
  client?: unknown
  t?: (key: string, options?: Record<string, unknown>) => string
  lang?: string
  vaultClient?: unknown
  pushModal?: (modal: React.ReactNode) => void
  popModal?: () => void
  refresh?: () => void
  navigate?: (
    path: string | { pathname: string; search?: string },
    options?: unknown
  ) => void
  hasWriteAccess?: boolean
  canMove?: boolean
  isPublic?: boolean
  allLoaded?: boolean
  showAlert?: (options: { message: string; severity: string }) => void
  isOwner?: (docId: string) => boolean
  byDocId?: Record<string, unknown>
  isNativeFileSharingAvailable?: boolean
  shareFilesNative?: (files: IOCozyFile[]) => void
  isSharingShortcutCreated?: boolean
  openSharingLinkDisplayed?: boolean
  syncSharingLink?: () => void
  isMobile?: boolean
  fetchBlobFileById?: (client: unknown, fileId: string) => Promise<Blob>
  isFile?: (file: IOCozyFile) => boolean
  addSharingLink?: () => void
  driveId?: string
  pathname?: string
  search?: string
  canDuplicate?: boolean
  isSelectAll?: boolean
  displayedFolder?: IOCozyFile
}

/**
 * Props passed to action menu item components.
 */
export interface ActionComponentProps {
  docs?: IOCozyFile[]
  onClick?: (context?: unknown) => void
}

/**
 * Drive action definition with policy support.
 */
export interface DriveAction extends ActionPolicy {
  /** Unique identifier for the action */
  name: string
  /** Display label for the action */
  label?: string
  /** Icon component or icon name */
  icon?: React.ComponentType | string
  /**
   * Function to determine if the action should be displayed.
   * This is checked AFTER policy checks (allowInfectedFiles, etc.).
   */
  displayCondition?: (docs: IOCozyFile[]) => boolean
  /** Whether to show this action in the selection bar. Default: true */
  displayInSelectionBar?: boolean
  /** Whether to show this action in context menus. Default: true */
  displayInContextMenu?: boolean
  /** The action handler */
  action?: (docs: IOCozyFile[], context?: ActionContext) => void
  /** React component to render the action menu item */
  Component?: ForwardRefExoticComponent<
    ActionComponentProps & RefAttributes<HTMLLIElement>
  >
}

/**
 * Extended Action type that includes policy properties.
 * Use this type when you need to return an action that is compatible
 * with cozy-ui's Action type but also includes our policy properties.
 */
export type ActionWithPolicy<T = IOCozyFile> = CozyAction<T> & ActionPolicy
