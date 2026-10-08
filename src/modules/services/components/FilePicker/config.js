import { defaultFilePickerConfig } from './constants'
import { getIntentData, getPickerNavigationConfig } from '../intentConfig'

/**
 * Read the FilePickerConfig carried in the intent data and merge it
 * over the defaults, preserving disabled actions as null.
 *
 * The intent client places the config inside `intent.attributes.data`.
 * At runtime, cozy-interapp also sends configuration through the service
 * ready handshake, exposed by `service.getData()`. Intent data takes
 * precedence over handshake data at the top level. When neither source
 * provides data, the defaults are returned as-is.
 *
 * For documents, sharingLink and downloadLink, null or false hides the
 * action, true enables its default options, and an object is shallow-merged
 * over those options. An absent action keeps its default: documents is
 * opt-in, while both link actions are enabled by default.
 *
 * defaultDirId is a local starting folder ID, not a navigation restriction.
 * restrictToDefaultDir defaults to false; true restricts navigation and
 * selection to that folder and defaults tabs to ['drive']. Explicit tabs
 * are preserved for initialization to validate, as is defaultDirId.
 * Initialization resolves the folder locally only when Drive opens first.
 *
 * @param {object|null|undefined} intent - The intent object returned
 *   by `service.getIntent()`. Null-safe.
 * @param {object|null} [serviceData=null] - Configuration from `service.getData()`.
 * @returns {{
 *   theme: { type: 'light'|'dark'|undefined },
 *   multiple: boolean,
 *   defaultDirId: string|null,
 *   restrictToDefaultDir: boolean,
 *   tabs: Array<'drive'|'recents'|'sharings'>|null,
 *   documents: object|null,
 *   sharingLink: object|null,
 *   downloadLink: object|null
 * }}
 */
export function getFilePickerConfig(intent, serviceData = null) {
  const data = getIntentData(intent, serviceData)

  if (!data) {
    return defaultFilePickerConfig
  }

  const resolveActionConfig = (clientAction, defaultAction) => {
    if (clientAction === null || clientAction === false) return null
    if (clientAction === undefined) return defaultAction
    const enabledDefault = defaultAction ?? {}
    if (clientAction === true) return enabledDefault
    return { ...enabledDefault, ...clientAction }
  }

  return {
    ...getPickerNavigationConfig(data, defaultFilePickerConfig.tabs),
    multiple: data.multiple ?? defaultFilePickerConfig.multiple,
    documents: resolveActionConfig(data.documents, null),
    sharingLink: resolveActionConfig(
      data.sharingLink,
      defaultFilePickerConfig.sharingLink
    ),
    downloadLink: resolveActionConfig(
      data.downloadLink,
      defaultFilePickerConfig.downloadLink
    )
  }
}
