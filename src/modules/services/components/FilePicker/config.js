import { defaultFilePickerConfig, filePickerThemes } from './constants'

export function getFilePickerConfig(intent, serviceData = null) {
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

  const themeType = data.theme?.type
  const restrictToDefaultDir = data.restrictToDefaultDir === true
  const tabs =
    data.tabs === undefined
      ? restrictToDefaultDir
        ? ['drive']
        : defaultFilePickerConfig.tabs
      : data.tabs

  return {
    theme: {
      type: filePickerThemes.includes(themeType)
        ? themeType
        : defaultFilePickerConfig.theme.type
    },
    multiple: data.multiple ?? defaultFilePickerConfig.multiple,
    defaultDirId: data.defaultDirId ?? null,
    restrictToDefaultDir,
    tabs,
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
