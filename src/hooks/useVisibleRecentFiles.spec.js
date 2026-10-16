import { renderHook } from '@testing-library/react'

import { useQuery } from 'cozy-client'
import flag from 'cozy-flags'

import useVisibleRecentFiles, {
  isInSettingsFolder
} from './useVisibleRecentFiles'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))

jest.mock('cozy-flags', () => ({
  __esModule: true,
  default: jest.fn()
}))

const settingsFolders = [
  { _id: 'settings', path: '/Settings' },
  { _id: 'settings-home', path: '/Settings/Home' },
  { _id: 'settings-2', path: '/Settings 2' }
]

const shortcut = { _id: 'meet', name: 'Meet.url', dir_id: 'settings-home' }
const settingsFile = { _id: 'conf', name: 'conf.json', dir_id: 'settings' }
const report = { _id: 'report', name: 'report.pdf', dir_id: 'root' }
const siblingFile = { _id: 'sibling', name: 'a.txt', dir_id: 'settings-2' }

const recents = {
  fetchStatus: 'loaded',
  data: [shortcut, report, settingsFile, siblingFile]
}

const setup = ({ flagEnabled = true, settingsResult }) => {
  flag.mockReturnValue(flagEnabled)
  useQuery.mockReturnValue(settingsResult)
  return renderHook(() => useVisibleRecentFiles(recents)).result.current
}

describe('useVisibleRecentFiles', () => {
  it('drops the files stored in the Settings folder and its subfolders', () => {
    const result = setup({
      settingsResult: { fetchStatus: 'loaded', data: settingsFolders }
    })

    expect(result.data).toEqual([report, siblingFile])
    expect(result.count).toBe(2)
  })

  it('keeps every file when the Settings folder is shown in Drive', () => {
    const result = setup({
      flagEnabled: false,
      settingsResult: { fetchStatus: 'loading', data: [] }
    })

    expect(result).toBe(recents)
    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    )
  })

  it('stays loading until the Settings folders are known', () => {
    const result = setup({
      settingsResult: { fetchStatus: 'loading', data: [] }
    })

    expect(result.fetchStatus).toBe('loading')
    expect(result.data).toEqual([])
  })
})

describe('isInSettingsFolder', () => {
  it('matches the Settings folder and its subfolders only', () => {
    expect(isInSettingsFolder({ path: '/Settings' })).toBe(true)
    expect(isInSettingsFolder({ path: '/Settings/Home' })).toBe(true)
    expect(isInSettingsFolder({ path: '/Settings 2' })).toBe(false)
    expect(isInSettingsFolder({ path: '/Documents/Settings' })).toBe(false)
  })
})
