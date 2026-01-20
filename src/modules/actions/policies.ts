import { isDirectory } from 'cozy-client/dist/models/file'
import type { IOCozyFile } from 'cozy-client/types/types'

import type {
  ActionPolicyContext,
  ActionPolicyDefinition,
  DriveAction,
  DriveActionPolicyFlags
} from './types'

import { isInfected } from '@/modules/filelist/helpers'

/**
 * Builds the policy context from the selected files.
 * This computes all the information needed for policy checks once,
 * so we don't have to recompute it for each policy.
 *
 * @param {IOCozyFile[]} files - The files being acted upon
 * @returns {ActionPolicyContext} The policy context with computed file information
 */
export const buildPolicyContext = (
  files: IOCozyFile[]
): ActionPolicyContext => {
  return {
    files,
    hasInfectedFile: files.some(file => isInfected(file)),
    hasMultipleFiles: files.length > 1,
    hasFolder: files.some(file => isDirectory(file)),
    hasSharedFile: files.some(
      file =>
        file.referenced_by?.some(ref => ref.type === 'io.cozy.sharings') ??
        false
    ),
    allInTrash: files.length > 0 && files.every(file => file.trashed)
  }
}

/**
 * Policy for infected files.
 * Actions are blocked for infected files unless they explicitly allow it.
 */
const infectionPolicy: ActionPolicyDefinition = {
  name: 'infection',
  allows: (action: DriveActionPolicyFlags, ctx: ActionPolicyContext): boolean =>
    !ctx.hasInfectedFile || action.allowInfectedFiles === true
}

/**
 * Policy for multiple file selection.
 * Actions are blocked for multiple files unless they explicitly allow it.
 * Default is true (most actions support multiple files).
 */
const multipleFilesPolicy: ActionPolicyDefinition = {
  name: 'multipleFiles',
  allows: (action: DriveActionPolicyFlags, ctx: ActionPolicyContext): boolean =>
    !ctx.hasMultipleFiles || action.allowMultiple !== false
}

/**
 * Policy for folders.
 * Actions are blocked for folders unless they explicitly allow it.
 * Default is true (most actions support folders).
 */
const foldersPolicy: ActionPolicyDefinition = {
  name: 'folders',
  allows: (action: DriveActionPolicyFlags, ctx: ActionPolicyContext): boolean =>
    !ctx.hasFolder || action.allowFolders !== false
}

/**
 * Policy for trashed files.
 * Actions are blocked for trashed files unless they explicitly allow it.
 */
const trashedPolicy: ActionPolicyDefinition = {
  name: 'trashed',
  allows: (action: DriveActionPolicyFlags, ctx: ActionPolicyContext): boolean =>
    !ctx.allInTrash || action.allowTrashed === true
}

/**
 * All registered policies that will be checked for each action.
 * Add new policies here to have them automatically applied.
 */
export const ACTION_POLICIES: ActionPolicyDefinition[] = [
  infectionPolicy,
  multipleFilesPolicy,
  foldersPolicy,
  trashedPolicy
]

/**
 * Extracts the action object from a drive action wrapper.
 * Actions from makeActions are wrapped as { [actionName]: actionObject }
 */
const getActionFromWrapper = (
  wrappedAction: Record<string, DriveAction>
): DriveAction | null => {
  const values = Object.values(wrappedAction)
  return values.length > 0 ? values[0] : null
}

/**
 * Checks if an action is allowed by all policies.
 *
 * @param action - The action to check
 * @param ctx - The policy context
 * @returns true if all policies allow the action
 */
const isActionAllowedByPolicies = (
  action: DriveAction,
  ctx: ActionPolicyContext
): boolean => {
  return ACTION_POLICIES.every(policy => policy.allows(action, ctx))
}

/**
 * Filters actions based on all registered policies.
 * This is the single source of truth for determining which actions
 * are available for a given set of files based on their characteristics.
 *
 * @param actions - Array of wrapped actions from makeActions
 * @param files - Array of files to check policies against
 * @returns Filtered array of actions that are allowed for the given files
 *
 * @example
 * ```typescript
 * const filteredActions = filterActionsByPolicy(actions, selectedFiles)
 * ```
 */
export const filterActionsByPolicy = <T extends Record<string, DriveAction>>(
  actions: T[],
  files: IOCozyFile[]
): T[] => {
  // Build the policy context once for all checks
  const ctx = buildPolicyContext(files)

  return actions.filter(wrappedAction => {
    // makeActions guarantees wrappers contain an action, so empty wrappers
    // cannot occur. This fail-open behavior is safe and intentional.
    const action = getActionFromWrapper(wrappedAction)
    if (!action) return true

    return isActionAllowedByPolicies(action, ctx)
  })
}

/**
 * Checks if any of the provided files are infected.
 * Useful for UI components that need to show infection indicators.
 *
 * @param files - Array of files to check
 * @returns true if any file is infected
 */
export const hasAnyInfectedFile = (files: IOCozyFile[]): boolean => {
  return files.some(file => isInfected(file))
}

/**
 * Gets the policy context for the given files.
 * Useful for UI components that need to access policy information.
 *
 * @param files - Array of files to build context for
 * @returns The policy context
 */
export const getPolicyContext = (files: IOCozyFile[]): ActionPolicyContext => {
  return buildPolicyContext(files)
}
