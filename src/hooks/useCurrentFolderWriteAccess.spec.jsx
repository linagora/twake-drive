import ReactRouter from 'react-router-dom'

import { useSharingContext } from 'cozy-sharing'

import useCurrentFolderId from './useCurrentFolderId'
import useCurrentFolderWriteAccess from './useCurrentFolderWriteAccess'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn()
}))
jest.mock('cozy-sharing', () => ({
  useSharingContext: jest.fn()
}))
jest.mock('./useCurrentFolderId')

describe('useCurrentFolderWriteAccess', () => {
  const setup = ({ driveId, folderId, hasWriteAccess, allLoaded = true }) => {
    ReactRouter.useParams.mockReturnValue({ driveId })
    useCurrentFolderId.mockReturnValue(folderId)
    const hasWriteAccessMock = jest.fn().mockReturnValue(hasWriteAccess)
    useSharingContext.mockReturnValue({
      hasWriteAccess: hasWriteAccessMock,
      allLoaded
    })
    return { hasWriteAccessMock }
  }

  it('is not writable for a viewer in a shared drive folder', () => {
    const { hasWriteAccessMock } = setup({
      driveId: 'drive-1',
      folderId: 'folder-1',
      hasWriteAccess: false
    })

    expect(useCurrentFolderWriteAccess()).toBe(false)
    // The driveId from the route must be forwarded so write access resolves even
    // though shared drive folders have no local io.cozy.files doc.
    expect(hasWriteAccessMock).toHaveBeenCalledWith('folder-1', 'drive-1')
  })

  it('is writable for an editor in a shared drive folder', () => {
    setup({ driveId: 'drive-1', folderId: 'folder-1', hasWriteAccess: true })

    expect(useCurrentFolderWriteAccess()).toBe(true)
  })

  it('is writable in a regular owned folder without a driveId', () => {
    const { hasWriteAccessMock } = setup({
      driveId: undefined,
      folderId: 'my-folder',
      hasWriteAccess: true
    })

    expect(useCurrentFolderWriteAccess()).toBe(true)
    expect(hasWriteAccessMock).toHaveBeenCalledWith('my-folder', undefined)
  })

  it.each([
    { desc: 'there is no current folder', folderId: null, allLoaded: true },
    {
      desc: 'the sharing context is still loading',
      folderId: 'folder-1',
      allLoaded: false
    }
  ])(
    'is writable, without checking access, when $desc',
    ({ folderId, allLoaded }) => {
      const { hasWriteAccessMock } = setup({
        driveId: 'drive-1',
        folderId,
        hasWriteAccess: false,
        allLoaded
      })

      expect(useCurrentFolderWriteAccess()).toBe(true)
      expect(hasWriteAccessMock).not.toHaveBeenCalled()
    }
  )
})
