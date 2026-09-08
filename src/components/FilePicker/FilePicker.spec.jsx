import { fireEvent, render, screen } from '@testing-library/react'
import React, { useState } from 'react'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { FilePicker } from './FilePicker'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections,
  FILE_PICKER_SHARINGS_ROOT_ID
} from './constants'

import { ROOT_DIR_ID } from '@/constants/config'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import {
  SelectionProvider,
  useSelectionContext
} from '@/modules/selection/SelectionProvider'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import { useFilteredSharings } from '@/modules/views/Sharings/useFilteredSharings'
import {
  getSharingsFetchStatus,
  useSharingsQueryResult
} from '@/modules/views/Sharings/useSharingsQueryResult'

const file = {
  _id: 'file-id',
  id: 'file-id',
  type: 'file',
  name: 'File.pdf'
}
const folder = {
  _id: 'folder-id',
  id: 'folder-id',
  type: 'directory',
  name: 'Folder'
}

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('twake-i18n')
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
jest.mock('@/modules/views/Sharings/useSharingsQueryResult', () => ({
  getSharingsFetchStatus: jest.fn(),
  useSharingsQueryResult: jest.fn()
}))
jest.mock('@/modules/views/Sharings/useFilteredSharings', () => ({
  useFilteredSharings: jest.fn()
}))
jest.mock('@/components/PickerView/PickerViewTable', () => ({
  PickerViewTable: ({
    items,
    isItemDisabled,
    onItemClick,
    onItemDoubleClick,
    onItemNavigate,
    fetchMore
  }) => (
    <div>
      {items.map(item => (
        <div key={item._id}>
          <button
            type="button"
            data-testid={`item-${item._id}`}
            disabled={isItemDisabled(item)}
            onClick={event => onItemClick?.(item, event)}
            onDoubleClick={() => onItemDoubleClick?.(item)}
          >
            {item.name}
          </button>
          {onItemNavigate && (
            <button type="button" onClick={() => onItemNavigate(item)}>
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

function SelectionPicker({ testId }) {
  const [selectedItems, setSelectedItems] = useState([])

  return (
    <div data-testid={testId}>
      <span data-testid={`${testId}-count`}>{selectedItems.length}</span>
      <FilePicker
        mode={filePickerModes.SELECTION}
        availableSections={[filePickerSections.DRIVE]}
        displayedTypes={Object.values(filePickerItemTypes)}
        selectableTypes={Object.values(filePickerItemTypes)}
        selectedItems={selectedItems}
        onSelectionChange={setSelectedItems}
        multiple
      />
    </div>
  )
}

function DriveSelection() {
  const { selectedItems, setSelectedItems } = useSelectionContext()
  return (
    <>
      <button type="button" onClick={() => setSelectedItems({ drive: file })}>
        Select in Drive
      </button>
      <span data-testid="drive-count">{selectedItems.length}</span>
    </>
  )
}

describe('FilePicker', () => {
  const fetchMore = jest.fn()

  beforeEach(() => {
    useI18n.mockReturnValue({ t: key => key })
    useSharingContext.mockReturnValue({
      allLoaded: true,
      byDocId: {},
      isOwner: () => false
    })
    useBreakpoints.mockReturnValue({ isMobile: false })
    useSharedDriveFolder.mockReturnValue({
      sharedDriveResult: { included: [] },
      fetchStatus: 'loaded',
      hasMore: false,
      fetchMore: null
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
    require('cozy-ui/transpiled/react/providers/Breakpoints').default.mockReturnValue(
      { isMobile: false }
    )
    useBreadcrumbPath.mockImplementation(({ currentFolderId }) => [
      { id: ROOT_DIR_ID, name: 'My Drive' },
      ...(currentFolderId === ROOT_DIR_ID
        ? []
        : [{ id: currentFolderId, name: 'Folder' }])
    ])
    useQuery.mockImplementation((_definition, options) => {
      if (options.as === `buildContentFolderQuery-${ROOT_DIR_ID}`) {
        return {
          data: [folder, file],
          fetchStatus: 'loaded',
          hasMore: true,
          fetchMore
        }
      }
      if (options.as === 'buildContentFolderQuery-folder-id') {
        return { data: [], fetchStatus: 'loaded', hasMore: false }
      }
      if (options.as === `filePicker-folders-${ROOT_DIR_ID}`) {
        return {
          data: [folder],
          fetchStatus: 'loaded',
          hasMore: true,
          fetchMore
        }
      }
      if (options.as === 'filePicker-folders-folder-id') {
        return { data: [], fetchStatus: 'loaded', hasMore: false }
      }
      if (options.as === 'io.cozy.files/folder-id') {
        return { data: folder, fetchStatus: 'loaded' }
      }
      return { data: [], fetchStatus: 'loaded', hasMore: false }
    })
  })

  afterEach(() => jest.clearAllMocks())

  it('keeps each picker selection local and preserves the Drive selection', () => {
    render(
      <SelectionProvider clearOnLocationChange={false}>
        <DriveSelection />
        <SelectionPicker testId="first-picker" />
        <SelectionPicker testId="second-picker" />
      </SelectionProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select in Drive' }))
    const fileRows = screen.getAllByTestId('item-file-id')
    fireEvent.click(fileRows[0])

    expect(screen.getByTestId('drive-count')).toHaveTextContent('1')
    expect(screen.getByTestId('first-picker-count')).toHaveTextContent('1')
    expect(screen.getByTestId('second-picker-count')).toHaveTextContent('0')

    const folderRows = screen.getAllByTestId('item-folder-id')
    fireEvent.doubleClick(folderRows[0])

    expect(screen.getByTestId('drive-count')).toHaveTextContent('1')
    expect(screen.getByTestId('first-picker-count')).toHaveTextContent('0')
    expect(screen.getByTestId('second-picker-count')).toHaveTextContent('0')
  })

  it('reports the loaded current folder and exposes source pagination', () => {
    const onCurrentFolderChange = jest.fn()

    render(
      <FilePicker
        mode={filePickerModes.CURRENT_FOLDER}
        initialLocation={{
          section: filePickerSections.DRIVE,
          folderId: ROOT_DIR_ID,
          driveId: null
        }}
        availableSections={[filePickerSections.DRIVE]}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        onCurrentFolderChange={onCurrentFolderChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(fetchMore).toHaveBeenCalledTimes(1)

    fireEvent.doubleClick(screen.getByTestId('item-folder-id'))

    expect(onCurrentFolderChange).not.toHaveBeenCalledWith({
      folder: null,
      location: {
        section: filePickerSections.DRIVE,
        folderId: folder._id,
        driveId: null
      },
      status: 'loading'
    })
    expect(onCurrentFolderChange).toHaveBeenLastCalledWith({
      folder,
      location: {
        section: filePickerSections.DRIVE,
        folderId: folder._id,
        driveId: null
      },
      status: 'loaded'
    })
  })

  it('reports loading folder resolution without stale data', () => {
    useQuery.mockImplementation((_definition, options) => {
      if (options.as === 'filePicker-folders-folder-id') {
        return { data: [], fetchStatus: 'loaded', hasMore: false }
      }
      return { data: folder, fetchStatus: 'loading', hasMore: false }
    })
    const onCurrentFolderChange = jest.fn()

    render(
      <FilePicker
        mode={filePickerModes.CURRENT_FOLDER}
        initialLocation={{
          section: filePickerSections.DRIVE,
          folderId: folder._id,
          driveId: null
        }}
        availableSections={[filePickerSections.DRIVE]}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        onCurrentFolderChange={onCurrentFolderChange}
      />
    )

    expect(onCurrentFolderChange).toHaveBeenLastCalledWith({
      folder: null,
      location: {
        section: filePickerSections.DRIVE,
        folderId: folder._id,
        driveId: null
      },
      status: 'loading'
    })
  })

  it('keeps a stale cached folder in loading state', () => {
    const destinationFolderId = 'destination-folder-id'
    useQuery.mockImplementation((_definition, options) => {
      if (options.as === `io.cozy.files/${destinationFolderId}`) {
        return { data: folder, fetchStatus: 'loaded' }
      }
      return { data: [], fetchStatus: 'loaded', hasMore: false }
    })
    const onCurrentFolderChange = jest.fn()

    render(
      <FilePicker
        mode={filePickerModes.CURRENT_FOLDER}
        initialLocation={{
          section: filePickerSections.DRIVE,
          folderId: destinationFolderId,
          driveId: null
        }}
        availableSections={[filePickerSections.DRIVE]}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        onCurrentFolderChange={onCurrentFolderChange}
      />
    )

    expect(onCurrentFolderChange).toHaveBeenLastCalledWith({
      folder: null,
      location: {
        section: filePickerSections.DRIVE,
        folderId: destinationFolderId,
        driveId: null
      },
      status: 'loading'
    })
  })

  it('reports failed folder resolution without stale data', () => {
    useQuery.mockImplementation((_definition, options) => {
      if (options.as === 'filePicker-folders-folder-id') {
        return { data: [], fetchStatus: 'loaded', hasMore: false }
      }
      if (options.as === 'io.cozy.files/folder-id') {
        return { data: folder, fetchStatus: 'failed' }
      }
      return { data: [], fetchStatus: 'loading', hasMore: false }
    })
    const onCurrentFolderChange = jest.fn()

    render(
      <FilePicker
        mode={filePickerModes.CURRENT_FOLDER}
        initialLocation={{
          section: filePickerSections.DRIVE,
          folderId: folder._id,
          driveId: null
        }}
        availableSections={[filePickerSections.DRIVE]}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        onCurrentFolderChange={onCurrentFolderChange}
      />
    )

    expect(onCurrentFolderChange).toHaveBeenLastCalledWith({
      folder: null,
      location: {
        section: filePickerSections.DRIVE,
        folderId: folder._id,
        driveId: null
      },
      status: 'failed'
    })
  })

  it('treats the Sharings root as virtual and non-confirmable', () => {
    const onCurrentFolderChange = jest.fn()

    render(
      <FilePicker
        mode={filePickerModes.CURRENT_FOLDER}
        initialLocation={{
          section: filePickerSections.SHARINGS,
          folderId: FILE_PICKER_SHARINGS_ROOT_ID,
          driveId: null
        }}
        availableSections={[filePickerSections.SHARINGS]}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        onCurrentFolderChange={onCurrentFolderChange}
      />
    )

    expect(onCurrentFolderChange).toHaveBeenLastCalledWith({
      folder: null,
      location: {
        section: filePickerSections.SHARINGS,
        folderId: FILE_PICKER_SHARINGS_ROOT_ID,
        driveId: null
      },
      status: 'loaded'
    })
    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        as: `io.cozy.files/${FILE_PICKER_SHARINGS_ROOT_ID}`,
        enabled: false
      })
    )
  })

  it('reports the virtual folder after changing section', () => {
    const onCurrentFolderChange = jest.fn()
    const renderHeader = ({ onSectionChange }) => (
      <button
        type="button"
        onClick={() => onSectionChange(filePickerSections.SHARINGS)}
      >
        Sharings
      </button>
    )

    render(
      <FilePicker
        mode={filePickerModes.CURRENT_FOLDER}
        availableSections={Object.values(filePickerSections)}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        onCurrentFolderChange={onCurrentFolderChange}
        renderHeader={renderHeader}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sharings' }))

    expect(onCurrentFolderChange).toHaveBeenCalledWith({
      folder: null,
      location: {
        section: filePickerSections.SHARINGS,
        folderId: FILE_PICKER_SHARINGS_ROOT_ID,
        driveId: null
      },
      status: 'loaded'
    })
    expect(onCurrentFolderChange).not.toHaveBeenCalledWith({
      folder: null,
      location: {
        section: filePickerSections.SHARINGS,
        folderId: FILE_PICKER_SHARINGS_ROOT_ID,
        driveId: null
      },
      status: 'loading'
    })
  })

  it('preserves driveId when navigating into a shared folder', () => {
    const rootFolder = {
      _id: ROOT_DIR_ID,
      id: ROOT_DIR_ID,
      type: 'directory',
      name: 'My Drive'
    }
    const driveFolder = {
      _id: 'shared-folder-id',
      id: 'shared-folder-id',
      type: 'directory',
      name: 'Shared folder',
      driveId: 'drive-id'
    }
    const onCurrentFolderChange = jest.fn()
    useQuery.mockImplementation((_definition, options) => {
      if (options.as === `filePicker-folders-${ROOT_DIR_ID}`) {
        return { data: [driveFolder], fetchStatus: 'loaded' }
      }
      if (options.as === 'io.cozy.files/drive-id/shared-folder-id') {
        return { data: driveFolder, fetchStatus: 'loaded' }
      }
      if (options.as === `io.cozy.files/${ROOT_DIR_ID}`) {
        return { data: rootFolder, fetchStatus: 'loaded' }
      }
      return { data: [], fetchStatus: 'loaded' }
    })

    render(
      <FilePicker
        mode={filePickerModes.CURRENT_FOLDER}
        availableSections={[filePickerSections.DRIVE]}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        onCurrentFolderChange={onCurrentFolderChange}
      />
    )

    fireEvent.doubleClick(screen.getByTestId('item-shared-folder-id'))

    expect(onCurrentFolderChange).toHaveBeenLastCalledWith({
      folder: driveFolder,
      location: {
        section: filePickerSections.DRIVE,
        folderId: driveFolder._id,
        driveId: 'drive-id'
      },
      status: 'loaded'
    })

    fireEvent.click(screen.getByRole('button', { name: 'My Drive' }))

    expect(onCurrentFolderChange).toHaveBeenLastCalledWith({
      folder: rootFolder,
      location: {
        section: filePickerSections.DRIVE,
        folderId: ROOT_DIR_ID,
        driveId: null
      },
      status: 'loaded'
    })
  })

  it('navigates current-folder mobile row taps', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })
    require('cozy-ui/transpiled/react/providers/Breakpoints').default.mockReturnValue(
      { isMobile: true }
    )
    const onCurrentFolderChange = jest.fn()

    render(
      <FilePicker
        mode={filePickerModes.CURRENT_FOLDER}
        availableSections={[filePickerSections.DRIVE]}
        displayedTypes={[filePickerItemTypes.FOLDER]}
        selectableTypes={[]}
        onCurrentFolderChange={onCurrentFolderChange}
      />
    )

    fireEvent.click(screen.getByTestId('item-folder-id'))
    expect(onCurrentFolderChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        folder,
        location: expect.objectContaining({ folderId: folder._id })
      })
    )
  })
})
