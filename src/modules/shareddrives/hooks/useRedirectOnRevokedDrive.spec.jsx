import { renderHook } from '@testing-library/react'

// --- router mock ---
const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

// --- alert / i18n mocks ---
const mockShowAlert = jest.fn()
const mockT = key => key

jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  useAlert: () => ({ showAlert: mockShowAlert })
}))

jest.mock('twake-i18n', () => ({
  useI18n: () => ({ t: mockT })
}))

// --- useSharedDrives mock ---
const mockUseSharedDrives = jest.fn()

jest.mock('@/modules/shareddrives/hooks/useSharedDrives', () => ({
  useSharedDrives: (...args) => mockUseSharedDrives(...args)
}))

import { useRedirectOnRevokedDrive } from './useRedirectOnRevokedDrive'

const DRIVE_ID = 'drive-1'

describe('useRedirectOnRevokedDrive', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to /sharings?tab=1 and shows an alert when driveId is no longer in recipientDriveIds', () => {
    mockUseSharedDrives.mockReturnValue({
      isLoaded: true,
      recipientDriveIds: ['other-drive']
    })

    renderHook(() => useRedirectOnRevokedDrive(DRIVE_ID))

    expect(mockNavigate).toHaveBeenCalledWith('/sharings?tab=1', {
      replace: true
    })
    expect(mockShowAlert).toHaveBeenCalledWith({
      message: 'SharedDrive.access_revoked',
      severity: 'secondary'
    })
  })

  it('does not redirect when driveId is still in recipientDriveIds', () => {
    mockUseSharedDrives.mockReturnValue({
      isLoaded: true,
      recipientDriveIds: [DRIVE_ID]
    })

    renderHook(() => useRedirectOnRevokedDrive(DRIVE_ID))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockShowAlert).not.toHaveBeenCalled()
  })

  it('does not redirect before shared drives finish loading (no premature redirect)', () => {
    mockUseSharedDrives.mockReturnValue({
      isLoaded: false,
      recipientDriveIds: []
    })

    renderHook(() => useRedirectOnRevokedDrive(DRIVE_ID))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockShowAlert).not.toHaveBeenCalled()
  })
})
