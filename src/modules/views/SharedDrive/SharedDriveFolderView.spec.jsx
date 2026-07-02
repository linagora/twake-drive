import { render } from '@testing-library/react'
import React from 'react'

// --- navigate / router mocks ---
const mockNavigate = jest.fn()
const mockUseParams = jest.fn()

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
  useLocation: () => ({ pathname: '/shareddrive/drive-1/folder-1' }),
  Outlet: () => null
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

// --- useRedirectOnRevokedDrive is now a no-op in view tests; redirect
//     behaviour is covered by useRedirectOnRevokedDrive.spec.jsx ---
jest.mock('@/modules/shareddrives/hooks/useRedirectOnRevokedDrive', () => ({
  useRedirectOnRevokedDrive: jest.fn()
}))

jest.mock('@/modules/shareddrives/hooks/useSharedDriveFolderActions', () => ({
  useSharedDriveFolderActions: () => []
}))

jest.mock('@/modules/views/SharedDrive/SharedDriveFolderContent', () => ({
  SharedDriveFolderContent: () => null
}))

// --- stub out everything else the component imports so it can render ---
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn()
}))

jest.mock('cozy-client', () => ({
  useClient: () => ({})
}))

jest.mock('cozy-flags', () => ({
  __esModule: true,
  default: () => false
}))

jest.mock('cozy-keys-lib', () => ({
  useVaultClient: () => ({})
}))

jest.mock('cozy-sharing', () => ({
  useSharingContext: () => ({
    isOwner: () => false,
    byDocId: {},
    hasWriteAccess: () => false,
    refresh: jest.fn(),
    allLoaded: true
  })
}))

jest.mock('cozy-ui/transpiled/react/ActionsMenu/Actions', () => ({
  makeActions: () => []
}))

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: () => ({ isMobile: false })
}))

jest.mock('@/components/useHead', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@/constants/config', () => ({
  SHARED_DRIVES_DIR_ID: 'shared-drives-dir-id',
  SHARING_TAB_DRIVES: 1
}))

jest.mock('@/contexts/ClipboardProvider', () => ({
  useClipboardContext: () => ({ hasClipboardData: false })
}))

jest.mock('@/hooks', () => ({
  useDisplayedFolder: () => ({ displayedFolder: null }),
  useFolderSort: () => [{ attribute: 'name', order: 'asc' }, jest.fn(), true]
}))

jest.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn()
}))

jest.mock('@/lib/FabProvider', () => ({
  FabContext: React.createContext({
    isFabDisplayed: false,
    setIsFabDisplayed: jest.fn()
  })
}))

jest.mock('@/lib/ModalContext', () => ({
  useModalContext: () => ({ pushModal: jest.fn(), popModal: jest.fn() })
}))

jest.mock('@/modules/actions', () => ({
  download: {},
  infos: {},
  versions: {},
  rename: {},
  trash: {},
  hr: {},
  share: {}
}))

jest.mock('@/modules/actions/components/duplicateTo', () => ({
  duplicateTo: {}
}))

jest.mock('@/modules/actions/components/moveTo', () => ({
  moveTo: {}
}))

jest.mock('@/modules/actions/components/personalizeFolder', () => ({
  personalizeFolder: {}
}))

jest.mock('@/modules/drive/AddMenu/AddMenuProvider', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/drive/FabWithAddMenuContext', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('@/modules/drive/Toolbar', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('@/modules/selection/SelectionProvider', () => ({
  useSelectionContext: () => ({ isSelectionBarVisible: false })
}))

jest.mock('@/modules/shareddrives/components/SharedDriveBreadcrumb', () => ({
  SharedDriveBreadcrumb: () => null
}))

jest.mock('@/modules/shareddrives/components/SharedDriveFolderBody', () => ({
  SharedDriveFolderBody: () => null
}))

jest.mock('@/modules/shareddrives/hooks/useSharedDriveFolder', () => ({
  useSharedDriveFolder: () => ({
    sharedDriveResult: { data: [] },
    fetchStatus: 'loaded',
    lastUpdate: null,
    hasMore: false,
    fetchMore: jest.fn()
  })
}))

jest.mock('@/modules/upload/Dropzone', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/upload/DropzoneDnD', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/views/Folder/FolderView', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/views/Folder/FolderViewHeader', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>
}))

jest.mock('@/modules/views/Folder/virtualized/FolderViewBody', () => ({
  __esModule: true,
  default: () => null
}))

import { SharedDriveFolderView } from './SharedDriveFolderView'

const DRIVE_ID = 'drive-1'

describe('SharedDriveFolderView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseParams.mockReturnValue({ driveId: DRIVE_ID, folderId: 'folder-1' })
  })

  it('renders without errors', () => {
    render(<SharedDriveFolderView />)
  })
})
