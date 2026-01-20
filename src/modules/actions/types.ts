import type { ForwardRefExoticComponent, RefAttributes } from 'react'

import type { IOCozyFile } from 'cozy-client/types/types'
import type { Action as CozyAction } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'

/**
 * Context containing computed information about the selected files.
 * This is built once and passed to all policy checks for efficiency.
 */
export interface ActionPolicyContext {
  /** The files being acted upon */
  files: IOCozyFile[]
  /** Whether any file in the selection is infected */
  hasInfectedFile: boolean
  /** Whether multiple files are selected */
  hasMultipleFiles: boolean
  /** Whether any file is a folder */
  hasFolder: boolean
  /** Whether any file is shared */
  hasSharedFile: boolean
  /** Whether all files are in the trash */
  allInTrash: boolean
}

/**
 * Interface for defining a policy that determines if an action is allowed.
 * Each policy checks a specific aspect (infection, read-only, etc.).
 */
export interface ActionPolicyDefinition {
  /** Unique name for the policy (for debugging/logging) */
  name: string
  /**
   * Checks if the action is allowed given the policy context.
   * @param action - The action being checked
   * @param ctx - The policy context with computed file information
   * @returns true if the action is allowed, false otherwise
   */
  allows: (action: DriveActionPolicyFlags, ctx: ActionPolicyContext) => boolean
}

/**
 * Policy flags that can be set on actions to control their availability.
 * Each flag corresponds to a policy check.
 */
export interface DriveActionPolicyFlags {
  allowInfectedFiles?: boolean
  allowMultiple?: boolean
  allowFolders?: boolean
  allowTrashed?: boolean
}

/**
 * Context passed to action handlers and components at runtime.
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
export interface DriveAction extends DriveActionPolicyFlags {
  /** Unique identifier for the action */
  name: string
  /** Display label for the action */
  label?: string
  /** Icon component or icon name */
  icon?: React.ComponentType | string
  /**
   * Function to determine if the action should be displayed.
   * This is checked AFTER policy checks.
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
export type ActionWithPolicy<T = IOCozyFile> = CozyAction<T> &
  DriveActionPolicyFlags
