import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import FilePickerBody from './FilePickerBody'
import {
  filePickerSections,
  FILE_PICKER_RECENTS_ROOT_ID,
  FILE_PICKER_SHARINGS_ROOT_ID
} from './constants'

import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
const mockHandleItemClick = jest.fn()
const mockHandleMobileToggleSelect = jest.fn()

jest.mock('cozy-client', () => ({
  isQueryLoading: result =>
    result.fetchStatus === 'pending' || result.fetchStatus === 'loading',
  models: { file: { isDirectory: item => item.type === 'directory' } },
  useQuery: jest.fn()
}))
jest.mock('cozy-client/dist/models/file', () => ({
  isSharingShortcutNew: item => item.metadata?.sharing?.status === 'new'
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('twake-i18n')
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))
jest.mock('./queries', () => ({
  buildContentFolderQuery: folderId => ({
    definition: jest.fn(),
    options: { as: folderId }
  })
}))
let mockRecentsSource = null
const mockFilePickerRecentsContent = jest.fn(props =>
  mockRecentsSource ? (
    props.renderContent(mockRecentsSource)
  ) : (
    <div>Recents root</div>
  )
)
const mockFilePickerSharingsContent = jest.fn(() => <div>Sharings root</div>)

jest.mock('./FilePickerRecentsContent', () => ({
  FilePickerRecentsContent: props => mockFilePickerRecentsContent(props)
}))
jest.mock('./FilePickerSharingsContent', () => ({
  FilePickerSharingsContent: props => mockFilePickerSharingsContent(props)
}))
jest.mock('./useFilePickerSelection', () => ({
  useFilePickerSelection: () => ({
    handleItemClick: mockHandleItemClick,
    handleMobileToggleSelect: mockHandleMobileToggleSelect,
    selectedItemIds: []
  })
}))
jest.mock('./FilePickerTable', () => ({
  FilePickerTable: ({
    items,
    fetchMore,
    isItemDisabled,
    onItemClick,
    onItemDoubleClick
  }) => (
    <div data-testid="file-picker-table">
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
  navigateTo: jest.fn(),
  itemTypesAccepted: [],
  multiple: true
}

const makeRecentsSource = overrides => ({
  items: [],
  fetchStatus: 'loaded',
  hasMore: false,
  fetchMore: null,
  breadcrumbPath: [
    { id: FILE_PICKER_RECENTS_ROOT_ID, name: 'Nav.item_recent' }
  ],
  isItemDisabled: () => false,
  isFetchingMore: false,
  ...overrides
})

describe('FilePickerBody', () => {
  beforeEach(() => {
    mockRecentsSource = null
    useI18n.mockReturnValue({ t: key => key })
    useSharingContext.mockReturnValue({
      allLoaded: true,
      byDocId: { 'shared-root': {} },
      isOwner: () => false
    })
    useBreadcrumbPath.mockReturnValue([
      { id: 'file-picker-sharings-root', name: 'Nav.item_sharings' },
      { id: 'folder-id', name: 'Shared folder' }
    ])
    useBreakpoints.mockReturnValue({ isMobile: false })
  })

  afterEach(() => jest.clearAllMocks())

  it('delegates the Recents root without running folder queries', () => {
    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.RECENTS}
        folderId={FILE_PICKER_RECENTS_ROOT_ID}
      />
    )

    expect(mockFilePickerRecentsContent).toHaveBeenCalledWith({
      rootBreadcrumbPath: {
        id: FILE_PICKER_RECENTS_ROOT_ID,
        name: 'Nav.item_recent'
      },
      renderContent: expect.any(Function)
    })
    expect(useQuery).not.toHaveBeenCalled()
    expect(useSharedDriveFolder).not.toHaveBeenCalled()
    expect(useBreadcrumbPath).not.toHaveBeenCalled()
  })

  it('renders partial Recents while loading and keeps the table on error', () => {
    const item = { _id: 'recent-id', name: 'Recent file', type: 'file' }
    mockRecentsSource = makeRecentsSource({
      items: [item],
      fetchStatus: 'loading',
      withFilePath: true,
      isFetchingMore: true,
      keepItemsOnError: true,
      emptyMessageKey: 'FilePicker.recents.empty',
      errorMessageKey: 'FilePicker.recents.error'
    })

    const { rerender } = render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.RECENTS}
        folderId={FILE_PICKER_RECENTS_ROOT_ID}
      />
    )

    expect(screen.getByTestId('file-picker-loading-more')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Recent file:local' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('file-picker-loading')).toBe(null)

    mockRecentsSource = {
      ...mockRecentsSource,
      fetchStatus: 'error',
      isFetchingMore: false
    }
    rerender(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.RECENTS}
        folderId={FILE_PICKER_RECENTS_ROOT_ID}
      />
    )

    expect(
      screen.getByRole('button', { name: 'Recent file:local' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('file-picker-loading-more')).toBe(null)
    expect(screen.queryByTestId('file-picker-source-error')).toBe(null)
  })

  it.each([
    ['loading', 'file-picker-loading', null],
    ['loaded', 'file-picker-empty', 'FilePicker.recents.empty'],
    ['error', 'file-picker-source-error', 'FilePicker.recents.error']
  ])(
    'renders the Recents %s state without results',
    (fetchStatus, testId, text) => {
      mockRecentsSource = makeRecentsSource({
        fetchStatus,
        emptyMessageKey: 'FilePicker.recents.empty',
        errorMessageKey: 'FilePicker.recents.error'
      })

      render(
        <FilePickerBody
          {...baseProps}
          section={filePickerSections.RECENTS}
          folderId={FILE_PICKER_RECENTS_ROOT_ID}
        />
      )

      const state = screen.getByTestId(testId)
      expect(state).toBeInTheDocument()
      if (text) expect(state).toHaveTextContent(text)
    }
  )

  it('shows partial Recents while a section change is completing', () => {
    const onSectionReady = jest.fn()
    mockRecentsSource = makeRecentsSource({
      items: [{ _id: 'recent-id', name: 'Recent file', type: 'file' }],
      fetchStatus: 'loading',
      isFetchingMore: true
    })

    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.RECENTS}
        folderId={FILE_PICKER_RECENTS_ROOT_ID}
        isSectionChanging
        onSectionReady={onSectionReady}
      />
    )

    expect(screen.queryByTestId('source-item')).toBe(null)
    expect(onSectionReady).toHaveBeenCalledTimes(1)
  })

  it('delegates the Sharings root without running folder queries', () => {
    render(
      <FilePickerBody
        {...baseProps}
        section={filePickerSections.SHARINGS}
        folderId={FILE_PICKER_SHARINGS_ROOT_ID}
      />
    )

    expect(mockFilePickerSharingsContent).toHaveBeenCalledWith({
      rootBreadcrumbPath: {
        id: FILE_PICKER_SHARINGS_ROOT_ID,
        name: 'Nav.item_sharings'
      },
      sharedDocumentIds: ['shared-root'],
      renderFilePickerContent: expect.any(Function)
    })
    expect(useQuery).not.toHaveBeenCalled()
    expect(useSharedDriveFolder).not.toHaveBeenCalled()
    expect(useBreadcrumbPath).not.toHaveBeenCalled()
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
