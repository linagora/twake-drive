import { render, screen } from '@testing-library/react'
import React from 'react'

import { FolderPickerBody } from '@/components/FolderPicker/FolderPickerBody'
import { ROOT_DIR_ID, SHARED_DRIVES_DIR_ID } from '@/constants/config'

jest.mock('components/FolderPicker/FolderPickerContentCozy', () => ({
  FolderPickerContentCozy: () => <div>FolderPickerContentCozy</div>
}))
jest.mock('components/FolderPicker/FolderPickerContentNextcloud', () => ({
  FolderPickerContentNextcloud: () => <div>FolderPickerContentNextcloud</div>
}))
jest.mock('components/FolderPicker/FolderPickerContentSharedDrive', () => ({
  FolderPickerContentSharedDrive: () => (
    <div>FolderPickerContentSharedDrive</div>
  )
}))
jest.mock('components/FolderPicker/FolderPickerContentSharedDriveRoot', () => ({
  FolderPickerContentSharedDriveRoot: () => (
    <div>FolderPickerContentSharedDriveRoot</div>
  )
}))

describe('FolderPickerBody', () => {
  const defaultProps = {
    entries: [],
    navigateTo: jest.fn(),
    isFolderCreationDisplayed: false,
    hideFolderCreation: jest.fn()
  }

  it('return cozy folder', () => {
    const cozyFolder = {
      _type: 'io.cozy.files'
    }
    render(<FolderPickerBody folder={cozyFolder} {...defaultProps} />)
    expect(screen.getByText('FolderPickerContentCozy')).toBeInTheDocument()
  })

  it('return Nextcloud folder', () => {
    const nextcloudFolder = {
      _type: 'io.cozy.remote.nextcloud.files'
    }
    render(<FolderPickerBody folder={nextcloudFolder} {...defaultProps} />)
    expect(screen.getByText('FolderPickerContentNextcloud')).toBeInTheDocument()
  })

  it("should display content of recipient's shared drive folder", () => {
    const sharedDriveFolder = {
      _type: 'io.cozy.files',
      _id: 'folder-123',
      name: 'Shared Team Folder',
      driveId: 'sharing-456',
      dir_id: 'parent-folder'
    }

    render(<FolderPickerBody folder={sharedDriveFolder} {...defaultProps} />)
    expect(
      screen.getByText('FolderPickerContentSharedDrive')
    ).toBeInTheDocument()
  })

  it('should display content of `Drives` folder', () => {
    const drivesFolder = {
      _type: 'io.cozy.files',
      _id: SHARED_DRIVES_DIR_ID,
      dir_id: ROOT_DIR_ID,
      name: 'Drives'
    }

    render(
      <FolderPickerBody
        folder={drivesFolder}
        {...defaultProps}
        showSharedDriveFolder={true}
      />
    )
    expect(
      screen.getByText('FolderPickerContentSharedDriveRoot')
    ).toBeInTheDocument()
  })

  it('should fallback to cozy content for regular folders without driveId', () => {
    const regularFolder = {
      _type: 'io.cozy.files',
      _id: 'regular-folder-123',
      name: 'My Documents',
      dir_id: 'parent-folder'
    }

    render(<FolderPickerBody folder={regularFolder} {...defaultProps} />)
    expect(screen.getByText('FolderPickerContentCozy')).toBeInTheDocument()
  })
})
