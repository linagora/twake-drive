import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useI18n } from 'twake-i18n'

import FilePickerBody from './FilePickerBody'
import { filePickerSections } from './constants'

import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'

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
  useBreakpoints: () => ({ isMobile: false })
}))
jest.mock('./queries', () => ({
  buildContentFolderQuery: folderId => ({
    definition: jest.fn(),
    options: { as: folderId }
  })
}))
jest.mock('./FilePickerSharingsContent', () => ({
  FilePickerSharingsContent: () => <div>Sharings root</div>
}))
jest.mock('./useFilePickerSelection', () => ({
  useFilePickerSelection: () => ({
    handleItemClick: jest.fn(),
    handleMobileToggleSelect: jest.fn(),
    selectedItemIds: []
  })
}))
jest.mock('./FilePickerTable', () => ({
  FilePickerTable: ({ items, fetchMore, isItemDisabled }) => (
    <div>
      {items.map(item => (
        <button
          key={item._id}
          type="button"
          data-testid="source-item"
          disabled={isItemDisabled(item)}
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
  multiple: true,
  folderSelectable: true
}

describe('FilePickerBody', () => {
  beforeEach(() => {
    useI18n.mockReturnValue({ t: key => key })
    useSharingContext.mockReturnValue({ byDocId: { 'shared-root': {} } })
    useBreadcrumbPath.mockReturnValue([
      { id: 'file-picker-sharings-root', name: 'Nav.item_sharings' },
      { id: 'folder-id', name: 'Shared folder' }
    ])
  })

  afterEach(() => jest.clearAllMocks())

  it('loads descendants of a standard shared folder with a Sharings breadcrumb', () => {
    useQuery.mockReturnValue({
      data: [
        { _id: 'child-id', name: 'Child file', type: 'file' },
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
