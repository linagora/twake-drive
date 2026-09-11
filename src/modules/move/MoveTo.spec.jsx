import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { MoveTo } from './MoveTo'

import { ROOT_DIR_ID } from '@/constants/config'
import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import {
  SelectionProvider,
  useSelectionContext
} from '@/modules/selection/SelectionProvider'

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
  )
}))
jest.mock('cozy-ui/transpiled/react/Buttons', () => ({
  __esModule: true,
  default: ({ label, onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
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
  beforeEach(() => {
    useI18n.mockReturnValue({ t: key => key })
    useSharingContext.mockReturnValue({
      allLoaded: true,
      byDocId: {},
      isOwner: () => false
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
          data: folderId === currentFolder._id ? [destinationFolder] : [],
          fetchStatus: 'loaded',
          hasMore: false
        }
      }

      const folderId = options.as.split('/').at(-1)
      return { data: getFolder(folderId), fetchStatus: 'loaded' }
    })
  })

  afterEach(() => jest.clearAllMocks())

  it('keeps the browser inside the content area below the file summary', () => {
    setup()

    expect(screen.getByTestId('move-to-browser')).toHaveClass(
      'u-pos-relative',
      'u-flex',
      'u-flex-column'
    )
  })

  it('does not select a folder and moves into the current folder after navigation', () => {
    const onConfirm = jest.fn()
    setup({ onConfirm })

    const moveButton = screen.getByRole('button', { name: 'Move.action' })
    expect(moveButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Child folder' }))
    expect(moveButton).toBeDisabled()

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Child folder' }))

    expect(moveButton).toBeEnabled()
    fireEvent.click(moveButton)
    expect(onConfirm).toHaveBeenCalledWith(destinationFolder)
  })

  it('does not clear the Drive selection while navigating', () => {
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'Select in Drive' }))
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Child folder' }))

    expect(screen.getByTestId('drive-selection-count')).toHaveTextContent('1')
  })

  it('uses the current folder after breadcrumb navigation', () => {
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
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ _id: ROOT_DIR_ID, path: '/' })
    )
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

  it('hides Nextcloud and shared-drive destinations', () => {
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
              driveId: 'drive-id'
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

  it('hides the folders being moved and does not allow selecting them as destination', () => {
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
    expect(screen.queryByRole('button', { name: 'Folder to move' })).toBeNull()
  })
})
