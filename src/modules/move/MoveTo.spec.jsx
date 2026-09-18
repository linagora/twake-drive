import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { useDispatch } from 'react-redux'

import { useClient, useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { MoveTo } from './MoveTo'
import { getMoveDestinationDisabledReason } from './helpers'

import { ROOT_DIR_ID } from '@/constants/config'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import { createFolder } from '@/modules/navigation/duck'
import {
  SelectionProvider,
  useSelectionContext
} from '@/modules/selection/SelectionProvider'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import { useFilteredSharings } from '@/modules/views/Sharings/useFilteredSharings'
import { useSharingsQueryResult } from '@/modules/views/Sharings/useSharingsQueryResult'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn(),
  useQuery: jest.fn()
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: jest.fn()
}))
jest.mock('@/modules/navigation/duck', () => ({ createFolder: jest.fn() }))
jest.mock('twake-i18n', () => ({
  useI18n: jest.fn(),
  translate: () => Component => props => (
    <Component {...props} t={props.t ?? (key => key)} />
  ),
  withOnlyLocales: () => Component => Component
}))
jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  useAlert: jest.fn()
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: jest.fn(),
  useBreakpoints: jest.fn()
}))
jest.mock('@/modules/breadcrumb/hooks/useBreadcrumbPath', () => ({
  useBreadcrumbPath: jest.fn()
}))
jest.mock('@/modules/shareddrives/hooks/useSharedDriveFolder', () => ({
  useSharedDriveFolder: jest.fn()
}))
jest.mock('@/modules/views/Sharings/useFilteredSharings', () => ({
  useFilteredSharings: jest.fn()
}))
jest.mock('@/modules/views/Sharings/useSharingsQueryResult', () => ({
  ...jest.requireActual('@/modules/views/Sharings/useSharingsQueryResult'),
  useSharingsQueryResult: jest.fn()
}))
jest.mock('@/components/PickerView/PickerViewTable', () => ({
  PickerViewTable: ({
    items,
    isItemDisabled,
    getItemDisabledReason,
    onItemClick,
    onItemDoubleClick,
    onItemNavigate,
    fetchMore,
    beforeItems
  }) => (
    <div>
      {beforeItems}
      {items.map(item => (
        <div key={item._id}>
          <button
            type="button"
            disabled={isItemDisabled(item)}
            aria-label={
              getItemDisabledReason?.(item)
                ? `${item.name}. ${getItemDisabledReason(item)}`
                : item.name
            }
            onClick={event => onItemClick?.(item, event)}
            onDoubleClick={() => onItemDoubleClick?.(item)}
          >
            {item.name}
          </button>
          {onItemNavigate && (
            <button
              type="button"
              disabled={isItemDisabled(item)}
              onClick={() => onItemNavigate(item)}
            >
              Open {item.name}
            </button>
          )}
        </div>
      ))}
      {fetchMore && (
        <button type="button" onClick={fetchMore}>
          More
        </button>
      )}
    </div>
  )
}))
jest.mock('@/components/FolderPicker/FolderPickerHeader', () => ({
  FolderPickerHeader: () => <div>Move header</div>
}))
jest.mock('cozy-ui/transpiled/react/CozyDialogs', () => ({
  FixedDialog: ({ content, actions, title }) => (
    <div>
      {title}
      {content}
      {actions}
    </div>
  ),
  Dialog: () => null
}))
jest.mock('cozy-ui/transpiled/react/Buttons', () => ({
  __esModule: true,
  default: ({ label, onClick, disabled, className, startIcon }) => (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {startIcon}
      {label}
    </button>
  )
}))
jest.mock('cozy-ui/transpiled/react/styles', () => ({
  ...jest.requireActual('cozy-ui/transpiled/react/styles'),
  makeStyles: () => () => ({ paper: '' })
}))

const currentFolder = {
  _id: 'source-folder',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Source folder',
  path: '/Source folder'
}
const destinationFolder = {
  _id: 'child-folder',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Child folder',
  path: '/Source folder/Child folder'
}
let contentItems
let clientQuery

function getFolder(folderId) {
  if (folderId === currentFolder._id) return currentFolder
  if (folderId === destinationFolder._id) return destinationFolder
  if (folderId === ROOT_DIR_ID) {
    return {
      _id: ROOT_DIR_ID,
      _type: 'io.cozy.files',
      type: 'directory',
      name: 'My Drive',
      path: '/'
    }
  }
  return null
}

function DriveSelection() {
  const { selectedItems, setSelectedItems } = useSelectionContext()

  return (
    <>
      <button
        type="button"
        onClick={() => setSelectedItems({ file: destinationFolder })}
      >
        Select in Drive
      </button>
      <span data-testid="drive-selection-count">{selectedItems.length}</span>
    </>
  )
}

function setup(props = {}) {
  return render(
    <SelectionProvider clearOnLocationChange={false}>
      <DriveSelection />
      <MoveTo
        currentFolder={currentFolder}
        entries={[{ _id: 'file-id', dir_id: 'source-folder', name: 'File' }]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        {...props}
      />
    </SelectionProvider>
  )
}

describe('MoveTo', () => {
  it('detects descendants by path segments instead of string prefixes', () => {
    const source = {
      _id: 'source',
      type: 'directory',
      path: '/Photos/2025'
    }

    expect(
      getMoveDestinationDisabledReason(
        { _id: 'child', type: 'directory', path: '/Photos/2025/January' },
        [source],
        () => true
      )
    ).toBe('Move.destinationDescendant')
    expect(
      getMoveDestinationDisabledReason(
        { _id: 'sibling', type: 'directory', path: '/Photos/20250' },
        [source],
        () => true
      )
    ).toBe(null)
    expect(
      getMoveDestinationDisabledReason(
        { _id: 'other-sibling', type: 'directory', path: '/Photos-archive' },
        [source],
        () => true
      )
    ).toBe(null)
    expect(
      getMoveDestinationDisabledReason(
        { type: 'directory', path: '/Photos/2025' },
        [{ type: 'directory', path: '/Photos/2025' }],
        () => true
      )
    ).toBe('Move.destinationSource')
    expect(
      getMoveDestinationDisabledReason(
        {
          _id: 'child',
          type: 'directory',
          dir_id: 'source',
          path: '/StalePath'
        },
        [source],
        () => true
      )
    ).toBe('Move.destinationDescendant')
    expect(
      getMoveDestinationDisabledReason(
        {
          _id: 'local-child',
          type: 'directory',
          path: '/Documents/2024'
        },
        [
          {
            _id: 'shared-source',
            type: 'directory',
            driveId: 'shared-drive',
            path: '/Documents'
          }
        ],
        () => true
      )
    ).toBe(null)
    expect(
      getMoveDestinationDisabledReason(
        {
          _id: 'shared-child',
          type: 'directory',
          driveId: 'shared-drive',
          path: '/Documents/2024'
        },
        [
          {
            _id: 'shared-source',
            type: 'directory',
            driveId: 'shared-drive',
            path: '/Documents'
          }
        ],
        () => true
      )
    ).toBe('Move.destinationDescendant')
  })
  beforeEach(() => {
    useI18n.mockReturnValue({ t: key => key })
    clientQuery = jest.fn((_definition, options) => {
      const folderId = options.as.replace('move-confirm-', '')
      return Promise.resolve({ data: getFolder(folderId) })
    })
    useClient.mockReturnValue({ query: clientQuery })
    useDispatch.mockReturnValue(action => action())
    useAlert.mockReturnValue({ showAlert: jest.fn() })
    createFolder.mockReset()
    contentItems = [destinationFolder]
    useSharingContext.mockReturnValue({
      allLoaded: true,
      byDocId: {},
      isOwner: () => false,
      hasWriteAccess: jest.fn(() => true)
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
    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: { included: [] },
      fetchStatus: 'loaded',
      hasMore: false,
      fetchMore: null
    })
    useBreakpoints.mockReturnValue({ isMobile: false })
    require('cozy-ui/transpiled/react/providers/Breakpoints').default.mockReturnValue(
      { isMobile: false }
    )
    useBreadcrumbPath.mockImplementation(({ currentFolderId }) => {
      if (currentFolderId === destinationFolder._id) {
        return [
          { id: ROOT_DIR_ID, name: 'My Drive' },
          { id: currentFolder._id, name: currentFolder.name },
          { id: destinationFolder._id, name: destinationFolder.name }
        ]
      }
      return [
        { id: ROOT_DIR_ID, name: 'My Drive' },
        ...(currentFolderId === ROOT_DIR_ID
          ? []
          : [{ id: currentFolderId, name: getFolder(currentFolderId)?.name }])
      ]
    })
    useQuery.mockImplementation((_definition, options) => {
      if (options.as.startsWith('filePicker-folders-')) {
        const folderId = options.as.replace('filePicker-folders-', '')
        return {
          data: folderId === currentFolder._id ? contentItems : [],
          fetchStatus: 'loaded',
          hasMore: false
        }
      }

      const folderId = options.as.split('/').at(-1)
      return { data: getFolder(folderId), fetchStatus: 'loaded' }
    })
  })

  afterEach(() => jest.clearAllMocks())

  it('shows Drive and Sharing as move destination sections', () => {
    setup()

    expect(
      screen.getByRole('tab', { name: 'Nav.item_drive' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Nav.item_sharings' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Nav.item_recent' })).toBe(null)
  })

  it('keeps the move action disabled until permissions are loaded', () => {
    contentItems = [
      {
        _id: 'available-folder',
        _type: 'io.cozy.files',
        type: 'directory',
        name: 'Available folder',
        path: '/Available folder'
      }
    ]
    useSharingContext.mockReturnValue({
      allLoaded: false,
      byDocId: {},
      isOwner: () => false,
      hasWriteAccess: jest.fn(() => true)
    })

    setup({
      entries: [{ _id: 'file-id', dir_id: 'other-folder', name: 'File' }]
    })

    expect(screen.getByRole('button', { name: 'Move.action' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Move.addFolder' })).toBe(null)
    expect(
      screen.getByRole('button', {
        name: 'Available folder. Move.permissionsLoading'
      })
    ).toBeDisabled()
  })

  it('shows a move-in-progress reason while the move is busy', () => {
    setup({ isBusy: true })

    expect(
      screen.getByRole('button', { name: 'Child folder. Move.moveInProgress' })
    ).toBeDisabled()
  })

  it('keeps read-only destinations visible and disabled', () => {
    useSharingContext.mockReturnValue({
      allLoaded: true,
      byDocId: {},
      isOwner: () => false,
      hasWriteAccess: jest.fn(() => false)
    })

    setup()

    expect(
      screen.getByRole('button', {
        name: 'Child folder. Move.destinationReadOnly'
      })
    ).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Move.addFolder' })).toBe(null)
    expect(screen.getByRole('button', { name: 'Move.action' })).toBeDisabled()
  })

  it('keeps received shared folders visible for MoveTo validation', () => {
    const receivedFolder = {
      _id: 'received-folder',
      type: 'directory',
      name: 'Received folder',
      dir_id: 'source-folder',
      relationships: {
        referenced_by: {
          data: [{ type: 'io.cozy.sharings', id: 'sharing-id' }]
        }
      }
    }
    const hasWriteAccess = jest.fn(() => false)
    useSharingContext.mockReturnValue({
      allLoaded: true,
      byDocId: { 'received-folder': {} },
      isOwner: () => false,
      hasWriteAccess
    })
    useFilteredSharings.mockReturnValue({
      filteredResult: {
        data: [receivedFolder],
        fetchStatus: 'loaded',
        lastFetch: 1
      },
      sharedDrivesLoaded: true,
      sharedDrivesError: null
    })

    setup()
    fireEvent.click(screen.getByRole('tab', { name: 'Nav.item_sharings' }))

    expect(
      screen.getByRole('button', {
        name: 'Received folder. Move.destinationReadOnly'
      })
    ).toBeDisabled()
    expect(hasWriteAccess).toHaveBeenCalledWith('received-folder', undefined)
  })

  it('creates and confirms a destination inside a received federated folder', async () => {
    const receivedRoot = {
      _id: 'received-root',
      _type: 'io.cozy.files',
      type: 'directory',
      name: 'Received folder',
      path: '/Drives/Received folder',
      driveId: 'sharing-id',
      orgDrive: false,
      driveOwner: false
    }
    const receivedChild = {
      _id: 'received-child',
      _type: 'io.cozy.files',
      type: 'directory',
      name: 'Received child',
      path: '/Drives/Received folder/Received child',
      dir_id: receivedRoot._id
    }
    const createdFolder = {
      _id: 'created-folder',
      _type: 'io.cozy.files',
      type: 'directory',
      name: 'Created folder',
      dir_id: receivedRoot._id
    }
    const onConfirm = jest.fn()
    const hasWriteAccess = jest.fn(() => true)

    useSharingContext.mockReturnValue({
      allLoaded: true,
      byDocId: {},
      isOwner: () => false,
      hasWriteAccess
    })
    useFilteredSharings.mockReturnValue({
      filteredResult: {
        data: [receivedRoot],
        fetchStatus: 'loaded',
        lastFetch: 1
      },
      sharedDrivesLoaded: true,
      sharedDrivesError: null
    })
    useSharedDriveFolder.mockImplementation(({ folderId }) => ({
      sharedDriveResult: {
        included: folderId === receivedRoot._id ? [receivedChild] : []
      },
      fetchStatus: 'loaded',
      hasMore: false,
      fetchMore: null
    }))
    useQuery.mockImplementation((_definition, options) => {
      if (options.as.startsWith('filePicker-folders-')) {
        return { data: contentItems, fetchStatus: 'loaded', hasMore: false }
      }

      const folderId = options.as.split('/').at(-1)
      if (folderId === receivedRoot._id) {
        return { data: receivedRoot, fetchStatus: 'loaded' }
      }
      if (folderId === receivedChild._id) {
        return { data: receivedChild, fetchStatus: 'loaded' }
      }
      return { data: getFolder(folderId), fetchStatus: 'loaded' }
    })
    createFolder.mockImplementation((...args) => async () => {
      args[5]([createdFolder])
    })
    clientQuery.mockResolvedValue({ data: receivedChild })

    setup({ onConfirm })

    fireEvent.click(screen.getByRole('tab', { name: 'Nav.item_sharings' }))
    fireEvent.doubleClick(
      await screen.findByRole('button', { name: 'Received folder' })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Move.addFolder' }))
    const input = screen.getByRole('textbox', { name: 'Move.folderName' })
    fireEvent.change(input, { target: { value: 'Created folder' } })
    fireEvent.keyDown(input, { keyCode: 13 })

    expect(createFolder).toHaveBeenCalledWith(
      expect.anything(),
      'Created folder',
      receivedRoot._id,
      expect.anything(),
      'sharing-id',
      expect.any(Function)
    )
    expect(
      await screen.findByRole('button', { name: 'Created folder' })
    ).toBeInTheDocument()

    fireEvent.doubleClick(
      screen.getByRole('button', { name: 'Received child' })
    )
    expect(hasWriteAccess).toHaveBeenCalledWith(receivedChild._id, 'sharing-id')
    const moveButton = screen.getByRole('button', { name: 'Move.action' })
    await waitFor(() => expect(moveButton).toBeEnabled())
    fireEvent.click(moveButton)

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        ...receivedChild,
        driveId: 'sharing-id'
      })
    })
  })

  it('creates a folder inline, keeps it sorted and does not navigate', async () => {
    contentItems = [
      {
        _id: 'alpha',
        type: 'directory',
        name: 'Alpha',
        dir_id: 'source-folder'
      },
      {
        _id: 'charlie',
        type: 'directory',
        name: 'Charlie',
        dir_id: 'source-folder'
      }
    ]
    const createdFolder = {
      _id: 'bravo',
      type: 'directory',
      name: 'Bravo',
      dir_id: 'source-folder'
    }
    let resolveCreate
    const createPromise = new Promise(resolve => {
      resolveCreate = resolve
    })
    createFolder.mockImplementation((...args) => async () => {
      await createPromise
      args[5]([createdFolder])
    })
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'Move.addFolder' }))
    const input = screen.getByRole('textbox', { name: 'Move.folderName' })
    fireEvent.change(input, { target: { value: 'Bravo' } })
    fireEvent.keyDown(input, { keyCode: 13 })

    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move.cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move.action' })).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Alpha. Move.folderCreationInProgress'
      })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Open Alpha' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'My Drive' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'My Drive' }))
    expect(screen.getByTestId('file-picker-breadcrumb')).toHaveTextContent(
      'Source folder'
    )

    resolveCreate()
    await waitFor(() => {
      expect(screen.queryByTestId('folder-picker-add-folder-item')).toBe(null)
    })

    const alpha = screen.getByRole('button', { name: 'Alpha' })
    const bravo = screen.getByRole('button', { name: 'Bravo' })
    const charlie = screen.getByRole('button', { name: 'Charlie' })
    expect(alpha.compareDocumentPosition(bravo)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(bravo.compareDocumentPosition(charlie)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('keeps the folder name and focus after a creation error', async () => {
    let rejectCreate
    const createPromise = new Promise((resolve, reject) => {
      rejectCreate = reject
    })
    createFolder.mockImplementation(() => async () => {
      await createPromise
    })
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'Move.addFolder' }))
    const input = screen.getByRole('textbox', { name: 'Move.folderName' })
    expect(screen.queryByRole('alert')).toBe(null)
    fireEvent.change(input, { target: { value: 'Broken' } })
    fireEvent.keyDown(input, { keyCode: 13 })
    expect(createFolder.mock.calls[0][3]).toEqual({
      t: expect.any(Function)
    })
    rejectCreate(new Error('conflict'))

    const error = await screen.findByRole('alert')
    await waitFor(() => expect(input).toHaveFocus())
    expect(error).toHaveTextContent('Move.folderCreationError')
    expect(input).toHaveValue('Broken')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby')

    fireEvent.change(input, { target: { value: 'Fixed' } })
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).toBe(null)
  })

  it('keeps the destination locked and the Move action available after a partial success', () => {
    setup({
      currentFolder: destinationFolder,
      entries: [{ _id: 'file-id', dir_id: 'other-folder', name: 'File' }],
      isDestinationLocked: true
    })

    expect(screen.getByRole('button', { name: 'My Drive' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move.addFolder' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move.cancel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move.action' })).toBeEnabled()
  })

  it('does not select a folder and moves into the current folder after navigation', async () => {
    const onConfirm = jest.fn()
    setup({ onConfirm })

    const moveButton = screen.getByRole('button', { name: 'Move.action' })
    expect(moveButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Child folder' }))
    expect(moveButton).toBeDisabled()

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Child folder' }))

    expect(moveButton).toBeEnabled()
    fireEvent.click(moveButton)
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(destinationFolder)
    })
  })

  it('does not clear the Drive selection while navigating', () => {
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'Select in Drive' }))
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Child folder' }))

    expect(screen.getByTestId('drive-selection-count')).toHaveTextContent('1')
  })

  it('uses the current folder after breadcrumb navigation', async () => {
    const onConfirm = jest.fn()
    setup({
      currentFolder: destinationFolder,
      entries: [{ _id: 'file-id', dir_id: 'child-folder', name: 'File' }],
      onConfirm
    })

    const moveButton = screen.getByRole('button', { name: 'Move.action' })
    fireEvent.click(screen.getByRole('button', { name: 'My Drive' }))

    expect(moveButton).toBeEnabled()
    fireEvent.click(moveButton)
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ _id: ROOT_DIR_ID, path: '/' })
      )
    })
  })

  it('shows an error and keeps the action disabled when the destination cannot be loaded', () => {
    const onConfirm = jest.fn()
    useQuery.mockImplementation((_definition, options) => {
      if (options.as.startsWith('filePicker-folders-')) {
        const folderId = options.as.replace('filePicker-folders-', '')
        return {
          data: folderId === currentFolder._id ? [destinationFolder] : [],
          fetchStatus: 'loaded',
          hasMore: false
        }
      }

      const folderId = options.as.split('/').at(-1)
      if (folderId === destinationFolder._id) {
        return { data: undefined, fetchStatus: 'failed' }
      }
      return { data: getFolder(folderId), fetchStatus: 'loaded' }
    })

    setup({ onConfirm })

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Child folder' }))

    expect(screen.getByTestId('file-picker-error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move.action' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it.each(['loading', 'failed'])(
    'invalidates a loaded destination while the next folder is %s',
    status => {
      const onConfirm = jest.fn()
      let rootStatus = 'loaded'
      useQuery.mockImplementation((_definition, options) => {
        if (options.as.startsWith('filePicker-folders-')) {
          const folderId = options.as.replace('filePicker-folders-', '')
          return {
            data:
              folderId === currentFolder._id || folderId === ROOT_DIR_ID
                ? [destinationFolder]
                : [],
            fetchStatus: 'loaded',
            hasMore: false
          }
        }

        const folderId = options.as.split('/').at(-1)
        if (folderId === ROOT_DIR_ID && rootStatus !== 'loaded') {
          return { data: destinationFolder, fetchStatus: rootStatus }
        }
        return { data: getFolder(folderId), fetchStatus: 'loaded' }
      })

      setup({ onConfirm })
      fireEvent.doubleClick(
        screen.getByRole('button', { name: 'Child folder' })
      )
      expect(screen.getByRole('button', { name: 'Move.action' })).toBeEnabled()

      rootStatus = status
      fireEvent.click(screen.getByRole('button', { name: 'My Drive' }))

      expect(screen.getByRole('button', { name: 'Move.action' })).toBeDisabled()
      expect(onConfirm).not.toHaveBeenCalled()
    }
  )

  it('hides Nextcloud and team-drive destinations', () => {
    useQuery.mockImplementation((_definition, options) => {
      if (options.as.startsWith('filePicker-folders-')) {
        return {
          data: [
            destinationFolder,
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
              driveId: 'drive-id',
              orgDrive: true
            }
          ],
          fetchStatus: 'loaded',
          hasMore: false
        }
      }

      const folderId = options.as.split('/').at(-1)
      return { data: getFolder(folderId), fetchStatus: 'loaded' }
    })

    setup()

    expect(
      screen.getByRole('button', { name: 'Child folder' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nextcloud folder' })).toBe(
      null
    )
    expect(screen.queryByRole('button', { name: 'Shared Drive folder' })).toBe(
      null
    )
  })

  it('reloads and rechecks the destination when confirming', async () => {
    const onConfirm = jest.fn()
    clientQuery.mockRejectedValue(new Error('offline'))
    setup({
      currentFolder: destinationFolder,
      entries: [{ _id: 'file-id', dir_id: 'other-folder', name: 'File' }],
      onConfirm
    })

    fireEvent.click(screen.getByRole('button', { name: 'Move.action' }))

    await waitFor(() => {
      expect(screen.getByTestId('file-picker-error')).toBeInTheDocument()
    })
    expect(clientQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        as: 'move-confirm-child-folder',
        fetchPolicy: expect.any(Function)
      })
    )
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Move.cancel' })).toBeEnabled()
  })

  it('rechecks the destination policy before confirmation', () => {
    const onConfirm = jest.fn()
    let invalidDestination = false
    useQuery.mockImplementation((_definition, options) => {
      if (options.as.startsWith('filePicker-folders-')) {
        const folderId = options.as.replace('filePicker-folders-', '')
        return {
          data:
            folderId === currentFolder._id || folderId === ROOT_DIR_ID
              ? [destinationFolder]
              : [],
          fetchStatus: 'loaded',
          hasMore: false
        }
      }

      const folderId = options.as.split('/').at(-1)
      if (folderId === destinationFolder._id && invalidDestination) {
        return {
          data: {
            ...destinationFolder,
            cozyMetadata: { createdByApp: 'nextcloud' }
          },
          fetchStatus: 'loaded'
        }
      }
      return { data: getFolder(folderId), fetchStatus: 'loaded' }
    })

    setup({ onConfirm })
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Child folder' }))
    expect(screen.getByRole('button', { name: 'Move.action' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'My Drive' }))
    invalidDestination = true
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Child folder' }))

    expect(screen.getByRole('button', { name: 'Move.action' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Move.action' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('opens My Drive root when source entries have different parents', () => {
    setup({
      entries: [
        { _id: 'file-1', dir_id: 'source-folder', name: 'File 1' },
        { _id: 'file-2', dir_id: 'other-folder', name: 'File 2' }
      ]
    })

    expect(screen.getByTestId('file-picker-breadcrumb')).toHaveTextContent(
      'My Drive'
    )
    expect(screen.getByRole('button', { name: 'Move.action' })).toBeEnabled()
  })

  it('disables the action when entries have no location metadata', () => {
    setup({ entries: [{ _id: 'file-id', name: 'File' }] })

    expect(screen.getByRole('button', { name: 'Move.action' })).toBeDisabled()
  })

  it('disables the action when navigating back to the initial folder', () => {
    setup()

    const moveButton = screen.getByRole('button', { name: 'Move.action' })
    expect(moveButton).toBeDisabled()

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Child folder' }))
    expect(moveButton).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Source folder' }))
    expect(moveButton).toBeDisabled()
  })

  it('does not confirm the root when every source is already in the root', () => {
    setup({
      currentFolder: {
        _id: ROOT_DIR_ID,
        _type: 'io.cozy.files',
        type: 'directory',
        name: 'My Drive',
        path: '/'
      },
      entries: [{ _id: 'file-id', dir_id: ROOT_DIR_ID, name: 'File' }]
    })

    expect(screen.getByRole('button', { name: 'Move.action' })).toBeDisabled()
  })

  it('shows the folders being moved but disables them as destinations', () => {
    const folderToMove = {
      _id: 'folder-to-move',
      _type: 'io.cozy.files',
      type: 'directory',
      name: 'Folder to move',
      path: '/Source folder/Folder to move'
    }

    useQuery.mockImplementation((_definition, options) => {
      if (options.as.startsWith('filePicker-folders-')) {
        return {
          data: [destinationFolder, folderToMove],
          fetchStatus: 'loaded',
          hasMore: false
        }
      }

      const folderId = options.as.split('/').at(-1)
      if (folderId === folderToMove._id) {
        return { data: folderToMove, fetchStatus: 'loaded' }
      }
      return { data: getFolder(folderId), fetchStatus: 'loaded' }
    })

    setup({
      entries: [folderToMove]
    })

    expect(
      screen.getByRole('button', { name: 'Child folder' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Folder to move. Move.destinationSource'
      })
    ).toBeDisabled()
  })
})
