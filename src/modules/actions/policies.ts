import type { IOCozyFile } from 'cozy-client/types/types'

import type { DriveAction } from './types'

import { isInfected } from '@/modules/filelist/helpers'

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
 * Checks if an action is allowed based on file infection status.
 * Returns true if the action should be displayed, false otherwise.
 */
const isActionAllowedForInfectedFiles = (
  action: DriveAction,
  hasInfectedFile: boolean
): boolean => {
  // If no infected files, action is allowed
  if (!hasInfectedFile) {
    return true
  }

  // If there are infected files, check the policy
  // Default is false (action is NOT allowed for infected files)
  return action.allowInfectedFiles === true
}

/**
 * Filters actions based on file policies.
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
  const hasInfectedFile = files.some(file => isInfected(file))

  // If no infected files, return all actions (no policy filtering needed)
  if (!hasInfectedFile) {
    return actions
  }

  return actions.filter(wrappedAction => {
    const action = getActionFromWrapper(wrappedAction)
    if (!action) return true

    return isActionAllowedForInfectedFiles(action, hasInfectedFile)
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
