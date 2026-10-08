import {
  defaultFilePickerConfig,
  filePickerThemes
} from './FilePicker/constants'

export function getIntentData(intent, serviceData = null) {
  const intentData = intent?.attributes?.data
  return intentData || serviceData
    ? { ...(serviceData || {}), ...(intentData || {}) }
    : null
}

export function getPickerNavigationConfig(data, defaultTabs) {
  const restrictToDefaultDir = data.restrictToDefaultDir === true
  return {
    theme: {
      type: filePickerThemes.includes(data.theme?.type)
        ? data.theme.type
        : defaultFilePickerConfig.theme.type
    },
    defaultDirId: data.defaultDirId ?? null,
    restrictToDefaultDir,
    tabs:
      data.tabs === undefined
        ? restrictToDefaultDir
          ? ['drive']
          : defaultTabs
        : data.tabs
  }
}
