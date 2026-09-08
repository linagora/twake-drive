import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { FilePickerBody } from './FilePickerBody'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections,
  FILE_PICKER_SHARINGS_ROOT_ID
} from './constants'

import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import { useFilteredSharings } from '@/modules/views/Sharings/useFilteredSharings'
import {
  getSharingsFetchStatus,
  useSharingsQueryResult
} from '@/modules/views/Sharings/useSharingsQueryResult'

const mockHandleItemClick = jest.fn()
const mockHandleMobileToggleSelect = jest.fn()

jest.mock('cozy-client', () => ({
  isQueryLoading: result =>
    result.fetchStatus === 'pending' || result.fetchStatus === 'loading',
  models: { file: { isDirectory: item => item.type === 'directory' } },
  useQuery: jest.fn()
}))
jest.mock('cozy-client/dist/models/file', () => ({
  isDirectory: item => item.type === 'directory',
  isFile: item => item.type === 'file',
  isSharingShortcutNew: item => item.metadata?.sharing?.status === 'new'
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('twake-i18n')
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))
jest.mock('./queries', () => ({
  buildDisplayedContentFolderQuery: folderId => ({
    definition: jest.fn(),
    options: { as: folderId }
  })
}))
jest.mock(
  '@/modules/services/components/FilePicker/FilePickerRecentsContent',
  () => ({ FilePickerRecentsContent: () => null })
)
jest.mock('@/modules/views/Sharings/useFilteredSharings', () => ({
  useFilteredSharings: jest.fn()
}))
jest.mock('@/modules/views/Sharings/useSharingsQueryResult', () => ({
  getSharingsFetchStatus: jest.fn(),
  useSharingsQueryResult: jest.fn()
}))
jest.mock('./useFilePickerSelection', () => ({
  useFilePickerSelection: () => ({
    handleItemClick: mockHandleItemClick,
    handleMobileToggleSelect: mockHandleMobileToggleSelect,
    selectedItemIds: []
  })
}))
jest.mock('@/components/PickerView/PickerViewTable', () => ({
  PickerViewTable: ({
    items,
    fetchMore,
    isItemDisabled,
    onItemClick,
    onItemDoubleClick
  }) => (
    <div>
      {items.map(item => (
        <button
          key={item._id}
          type="button"
          data-testid="source-item"
          disabled={isItemDisabled(item)}
          onClick={event => onItemClick?.(item, event)}
          onDoubleClick={() => onItemDoubleClick?.(item)}
        >
          {item.name}:{item.driveId ?? 'local'}
        </button>
      ))}
      {fetchMore && (
        <button type="button" onClick={fetchMore}>
          More
        </button>
      )}
    </div>
  )
}))
jest.mock('@/modules/breadcrumb/hooks/useBreadcrumbPath', () => ({
  useBreadcrumbPath: jest.fn()
}))
jest.mock('@/modules/shareddrives/hooks/useSharedDriveFolder', () => ({
  useSharedDriveFolder: jest.fn()
}))

const baseProps = {
  mode: filePickerModes.SELECTION,
  navigateTo: jest.fn(),
  displayedTypes: Object.values(filePickerItemTypes),
  selectableTypes: Object.values(filePickerItemTypes),
  multiple: true
}

describe('FilePickerBody', () => {
  beforeEach(() => {
    useI18n.mockReturnValue({ t: key => key })
    useSharingContext.mockReturnValue({
      allLoaded: true,
      byDocId: { 'shared-root': {} },
      isOwner: () => false
    })
    useSharingsQueryResult.mockReturnValue({
      data: [],
      fetchStatus: 'loaded'
    })
    useFilteredSharings.mockReturnValue({
      filteredResult: { data: [], fetchStatus: 'loaded', lastFetch: 1 },
      sharedDrivesLoaded: true,
      sharedDrivesError: null
    })
    getSharingsFetchStatus.mockReturnValue('loaded')
    useBreadcrumbPath.mockReturnValue([
      { id: 'file-picker-sharings-root', name: 'Nav.item_sharings' },
      { id: 'folder-id', name: 'Shared folder' }
    ])
    useBreakpoints.mockReturnValue({ isMobile: false })
  })

  afterEach(() => jest.clearAllMocks())

  it('delegates the Sharings root without running folder queries', () => {
    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId={FILE_PICKER_SHARINGS_ROOT_ID}
      />
    )

    expect(useSharingsQueryResult).toHaveBeenCalledWith(['shared-root'], true)
    expect(useFilteredSharings).toHaveBeenCalledWith(
      expect.objectContaining({
        sharedDocumentIds: ['shared-root'],
        tab: expect.any(String)
      })
    )
    expect(useQuery).not.toHaveBeenCalled()
    expect(useSharedDriveFolder).not.toHaveBeenCalled()
    expect(useBreadcrumbPath).not.toHaveBeenCalled()
  })

  it.each([
    ['loading', 'file-picker-loading'],
    ['failed', 'file-picker-source-error']
  ])('renders the Sharings root %s state', (fetchStatus, testId) => {
    getSharingsFetchStatus.mockReturnValue(fetchStatus)

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId={FILE_PICKER_SHARINGS_ROOT_ID}
      />
    )

    expect(screen.getByTestId(testId)).toBeInTheDocument()
    expect(screen.queryByTestId('file-picker-empty')).toBe(null)
  })

  it('renders the empty Sharings root state', () => {
    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId={FILE_PICKER_SHARINGS_ROOT_ID}
      />
    )

    expect(screen.getByTestId('file-picker-empty')).toHaveTextContent(
      'empty.sharing_text'
    )
  })

  it.each([
    ['loading', 'file-picker-loading'],
    ['loaded', 'file-picker-empty']
  ])('renders the shared drive %s state', (fetchStatus, testId) => {
    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: { included: [] },
      fetchStatus,
      hasMore: false,
      fetchMore: null
    })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
        driveId="drive-id"
      />
    )

    expect(screen.getByTestId(testId)).toBeInTheDocument()
  })

  it('renders a shared drive source error', () => {
    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: { included: [] },
      fetchStatus: 'failed',
      hasMore: false,
      fetchMore: null
    })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
        driveId="drive-id"
      />
    )

    expect(screen.getByTestId('file-picker-source-error')).toHaveTextContent(
      'error.open_folder'
    )
    expect(screen.queryByTestId('file-picker-empty')).toBe(null)
  })

  it('renders My Drive items with their breadcrumb and query', () => {
    useQuery.mockReturnValue({
      data: [{ _id: 'file-id', name: 'My file', type: 'file' }],
      fetchStatus: 'loaded'
    })
    useBreadcrumbPath.mockReturnValue([{ id: 'root-id', name: 'My Drive' }])

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.DRIVE}
        folderId="root-id"
      />
    )

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ as: 'root-id' })
    )
    expect(screen.getByRole('button', { name: 'My file:local' })).toBeEnabled()
    expect(screen.getByTestId('file-picker-breadcrumb')).toHaveTextContent(
      'My Drive'
    )
  })

  it('navigates when clicking an ancestor segment in the breadcrumb', () => {
    const navigateTo = jest.fn()
    useQuery.mockReturnValue({ data: [], fetchStatus: 'loaded' })
    useBreadcrumbPath.mockReturnValue([
      { id: 'root-id', name: 'My Drive' },
      { id: 'folder-id', name: 'Subfolder' }
    ])

    render(
      <FilePickerBody
        {...baseProps}
        navigateTo={navigateTo}
        section={filePickerSections.DRIVE}
        folderId="folder-id"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'My Drive' }))
    expect(navigateTo).toHaveBeenCalledWith({
      id: 'root-id',
      name: 'My Drive'
    })
  })

  it('navigates on directory double-click and triggers onFileDoubleClick on file double-click on desktop', () => {
    const navigateTo = jest.fn()
    const onFileDoubleClick = jest.fn()
    const folderItem = {
      _id: 'subfolder-id',
      name: 'Subfolder',
      type: 'directory'
    }
    const fileItem = { _id: 'file-id', name: 'My file', type: 'file' }

    useQuery.mockReturnValue({
      data: [folderItem, fileItem],
      fetchStatus: 'loaded'
    })
    useBreadcrumbPath.mockReturnValue([{ id: 'root-id', name: 'My Drive' }])

    render(
      <FilePickerBody
        {...baseProps}
        navigateTo={navigateTo}
        onFileDoubleClick={onFileDoubleClick}
        section={filePickerSections.DRIVE}
        folderId="root-id"
      />
    )

    fireEvent.doubleClick(
      screen.getByRole('button', { name: 'Subfolder:local' })
    )
    expect(navigateTo).toHaveBeenCalledWith(folderItem)
    expect(onFileDoubleClick).not.toHaveBeenCalled()

    fireEvent.doubleClick(screen.getByRole('button', { name: 'My file:local' }))
    expect(onFileDoubleClick).toHaveBeenCalledWith(fileItem)
  })

  it('handles mobile tap navigation for directories, selection toggle for files, and disables double-click', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })
    const navigateTo = jest.fn()
    const onFileDoubleClick = jest.fn()
    const folderItem = {
      _id: 'subfolder-id',
      name: 'Subfolder',
      type: 'directory'
    }
    const fileItem = { _id: 'file-id', name: 'My file', type: 'file' }

    useQuery.mockReturnValue({
      data: [folderItem, fileItem],
      fetchStatus: 'loaded'
    })
    useBreadcrumbPath.mockReturnValue([{ id: 'root-id', name: 'My Drive' }])

    render(
      <FilePickerBody
        {...baseProps}
        navigateTo={navigateTo}
        onFileDoubleClick={onFileDoubleClick}
        section={filePickerSections.DRIVE}
        folderId="root-id"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Subfolder:local' }))
    expect(navigateTo).toHaveBeenCalledWith(folderItem)
    expect(mockHandleMobileToggleSelect).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'My file:local' }))
    expect(mockHandleMobileToggleSelect).toHaveBeenCalledWith(
      fileItem,
      expect.anything()
    )

    fireEvent.doubleClick(screen.getByRole('button', { name: 'My file:local' }))
    expect(onFileDoubleClick).not.toHaveBeenCalled()
  })

  it('renders an inline picker error', () => {
    useQuery.mockReturnValue({ data: [], fetchStatus: 'loaded' })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.DRIVE}
        folderId="root-id"
        error="ITEM_NOT_FOUND"
      />
    )

    expect(screen.getByTestId('file-picker-error')).toHaveTextContent(
      'FilePicker.errors.ITEM_NOT_FOUND'
    )
  })

  it('shows a source error when loading a folder fails', () => {
    const onReadyToUse = jest.fn()
    useQuery.mockReturnValue({ data: [], fetchStatus: 'failed' })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.DRIVE}
        folderId="root-id"
        onReadyToUse={onReadyToUse}
      />
    )

    expect(screen.getByTestId('file-picker-source-error')).toHaveTextContent(
      'error.open_folder'
    )
    expect(screen.queryByTestId('file-picker-loading')).toBe(null)
    expect(screen.queryByTestId('file-picker-empty')).toBe(null)
    expect(onReadyToUse).toHaveBeenCalledTimes(1)
  })

  it('loads descendants of a standard shared folder with a Sharings breadcrumb', () => {
    useQuery.mockReturnValue({
      data: [
        { _id: 'child-id', name: 'Child file', type: 'file' },
        {
          _id: 'nested-share-id',
          name: 'Nested shared folder',
          type: 'directory',
          relationships: {
            referenced_by: {
              data: [{ id: 'nested-sharing-id', type: 'io.cozy.sharings' }]
            }
          }
        },
        {
          _id: 'pending-id',
          name: 'Pending invitation',
          type: 'directory',
          metadata: { sharing: { status: 'new' } }
        }
      ],
      fetchStatus: 'loaded'
    })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
      />
    )

    expect(
      screen.getByRole('button', { name: 'Child file:local' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Nested shared folder:local' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Pending invitation:local' })
    ).toBeDisabled()
    expect(screen.getByTestId('file-picker-breadcrumb')).toHaveTextContent(
      'Nav.item_sharings'
    )
    expect(useBreadcrumbPath).toHaveBeenCalledWith(
      expect.objectContaining({
        currentFolderId: 'folder-id',
        sharedDocumentIds: ['shared-root']
      })
    )
  })

  it('shows the folder empty state inside a shared folder', () => {
    useQuery.mockReturnValue({ data: [], fetchStatus: 'loaded' })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
      />
    )

    expect(screen.getByTestId('file-picker-empty')).toHaveTextContent(
      'empty.title'
    )
  })

  it('keeps all visible folders in current-folder mode by default', () => {
    useQuery.mockReturnValue({
      data: [
        { _id: 'local-folder', name: 'Local folder', type: 'directory' },
        {
          _id: 'nextcloud-folder',
          name: 'Nextcloud folder',
          type: 'directory',
          cozyMetadata: { createdByApp: 'nextcloud' }
        },
        {
          _id: 'shared-drive-folder',
          name: 'Shared Drive folder',
          type: 'directory',
          driveId: 'drive-id'
        }
      ],
      fetchStatus: 'loaded'
    })

    render(
      <FilePickerBody
        {...baseProps}
        mode={filePickerModes.CURRENT_FOLDER}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        section={filePickerSections.DRIVE}
        folderId="root-id"
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Local folder:local' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Nextcloud folder:local' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Shared Drive folder:drive-id' })
    ).toBeInTheDocument()
  })

  it('applies the visibility predicate to local folders', () => {
    useQuery.mockReturnValue({
      data: [
        { _id: 'visible-folder', name: 'Visible folder', type: 'directory' },
        { _id: 'hidden-folder', name: 'Hidden folder', type: 'directory' }
      ],
      fetchStatus: 'loaded'
    })

    render(
      <FilePickerBody
        {...baseProps}
        isItemVisible={item => item._id !== 'hidden-folder'}
        section={filePickerSections.DRIVE}
        folderId="root-id"
      />
    )

    expect(
      screen.getByRole('button', { name: 'Visible folder:local' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hidden folder:local' })).toBe(
      null
    )
  })

  it('applies the visibility predicate to sharings and shared-drive items', () => {
    useFilteredSharings.mockReturnValue({
      filteredResult: {
        data: [
          { _id: 'visible-sharing', name: 'Visible sharing', type: 'file' },
          { _id: 'hidden-sharing', name: 'Hidden sharing', type: 'file' }
        ],
        fetchStatus: 'loaded',
        lastFetch: 1
      },
      sharedDrivesLoaded: true,
      sharedDrivesError: null
    })

    const isItemVisible = item => !item._id.startsWith('hidden')
    render(
      <FilePickerBody
        {...baseProps}
        isItemVisible={isItemVisible}
        section={filePickerSections.SHARINGS}
        folderId={FILE_PICKER_SHARINGS_ROOT_ID}
      />
    )

    expect(
      screen.getByRole('button', { name: 'Visible sharing:local' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hidden sharing:local' })).toBe(
      null
    )

    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: {
        included: [
          { _id: 'visible-drive', name: 'Visible drive', type: 'file' },
          { _id: 'hidden-drive', name: 'Hidden drive', type: 'file' }
        ]
      },
      fetchStatus: 'loaded',
      hasMore: false,
      fetchMore: null
    })
    render(
      <FilePickerBody
        {...baseProps}
        isItemVisible={isItemVisible}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
        driveId="drive-id"
      />
    )

    expect(
      screen.getByRole('button', { name: 'Visible drive:drive-id' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Hidden drive:drive-id' })
    ).toBe(null)
  })

  it('normalizes shared-drive items before applying visibility', () => {
    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: {
        included: [
          { _id: 'drive-folder', name: 'Drive folder', type: 'directory' }
        ]
      },
      fetchStatus: 'loaded',
      hasMore: false,
      fetchMore: null
    })

    render(
      <FilePickerBody
        {...baseProps}
        isItemVisible={item => !item.driveId}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
        driveId="drive-id"
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Drive folder:drive-id' })
    ).toBe(null)
  })

  it('filters received shares from the My Drive listing', () => {
    useSharingContext.mockReturnValue({
      allLoaded: true,
      isOwner: () => false,
      byDocId: {}
    })
    useQuery.mockReturnValue({
      data: [
        {
          _id: 'received-share',
          name: 'Received share',
          type: 'directory',
          relationships: {
            referenced_by: {
              data: [{ id: 'sharing-id', type: 'io.cozy.sharings' }]
            }
          }
        },
        { _id: 'own-folder', name: 'Own folder', type: 'directory' }
      ],
      fetchStatus: 'loaded'
    })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.DRIVE}
        folderId="root-id"
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Received share:local' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Own folder:local' })
    ).toBeInTheDocument()
  })

  it('clears the previous section content until the new query is ready', () => {
    const onSectionReady = jest.fn()
    useQuery.mockReturnValue({
      data: [{ _id: 'cached-id', name: 'Cached file', type: 'file' }],
      fetchStatus: 'loaded'
    })

    const { rerender } = render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
        isSectionChanging
        onSectionReady={onSectionReady}
      />
    )

    expect(screen.queryByTestId('source-item')).not.toBeInTheDocument()
    expect(screen.queryByTestId('file-picker-loading')).not.toBeInTheDocument()
    expect(onSectionReady).toHaveBeenCalledTimes(1)

    rerender(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
        onSectionReady={onSectionReady}
      />
    )

    expect(
      screen.getByRole('button', { name: 'Cached file:local' })
    ).toBeInTheDocument()
  })

  it('waits for the initial My Drive query before notifying readiness', () => {
    const onReadyToUse = jest.fn()
    useQuery.mockReturnValue({ data: [], fetchStatus: 'pending' })

    const { rerender } = render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.DRIVE}
        folderId="root-id"
        onReadyToUse={onReadyToUse}
      />
    )

    expect(screen.getByTestId('file-picker-loading')).toBeInTheDocument()
    expect(onReadyToUse).not.toHaveBeenCalled()

    useQuery.mockReturnValue({ data: [], fetchStatus: 'loaded' })
    rerender(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.DRIVE}
        folderId="root-id"
        onReadyToUse={onReadyToUse}
      />
    )

    expect(screen.getByTestId('file-picker-empty')).toBeInTheDocument()
    expect(onReadyToUse).toHaveBeenCalledTimes(1)
  })

  it('propagates driveId to federated descendants and pagination', () => {
    const fetchMore = jest.fn()
    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: {
        included: [
          { _id: 'child-id', name: 'Child file', type: 'file' },
          {
            _id: 'pending-id',
            name: 'Pending invitation',
            type: 'directory',
            metadata: { sharing: { status: 'new' } }
          }
        ]
      },
      fetchStatus: 'loaded',
      hasMore: true,
      fetchMore
    })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId="folder-id"
        driveId="drive-id"
      />
    )

    expect(
      screen.getByRole('button', { name: 'Child file:drive-id' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Pending invitation:drive-id' })
    ).toBeDisabled()
    expect(useSharedDriveFolder).toHaveBeenCalledWith({
      driveId: 'drive-id',
      folderId: 'folder-id'
    })
    expect(useBreadcrumbPath).toHaveBeenCalledWith(
      expect.objectContaining({ driveId: 'drive-id' })
    )

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(fetchMore).toHaveBeenCalled()
  })
})
