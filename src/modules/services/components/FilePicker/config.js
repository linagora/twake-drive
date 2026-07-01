import { defaultFilePickerConfig } from './constants'

/**
 * Read the FilePickerConfig carried in the intent data and merge it
 * over the defaults so every action always has a defined config object.
 *
 * The intent client places the config inside `intent.attributes.data`.
 * At runtime, cozy-interapp also sends the same payload through the service
 * ready handshake, exposed by `service.getData()`.
 * If the data is missing or empty, the defaults are returned as-is.
 *
 * An action key explicitly set to `null` by the client is preserved as
 * `null` and means the action is not offered (the corresponding button
 * must not render). An action key set to an object is shallow-merged
 * over the default for that action. An action key absent falls back to
 * the default.
 *
 * @param {object|null|undefined} intent - The intent object returned
 *   by `service.getIntent()`. Null-safe.
 * @returns {{
 *   sharingLink: object|null,
 *   downloadLink: object|null
 * }}
 */
export const getFilePickerConfig = (intent, serviceData = null) => {
  const intentData = intent?.attributes?.data
  const data =
    intentData || serviceData
      ? { ...(serviceData || {}), ...(intentData || {}) }
      : null

  if (!data) {
    return defaultFilePickerConfig
  }

  const resolveActionConfig = (clientAction, defaultAction) => {
    if (clientAction === null) return null
    if (clientAction === undefined) return defaultAction
    return { ...defaultAction, ...clientAction }
  }

  return {
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
