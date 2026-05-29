import { useQuery } from 'cozy-client'

import useCurrentFolderId from './useCurrentFolderId'
import useDisplayedFolder from './useDisplayedFolder'

import { ROOT_DIR_ID } from '@/constants/config'
import { usePublicContext } from '@/modules/public/PublicProvider'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))

jest.mock('./useCurrentFolderId')
jest.mock('@/modules/public/PublicProvider')

describe('useDisplayedFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    usePublicContext.mockReturnValue({ isPublic: false })
  })

  it('should return file folder if current folder exists', () => {
    const FOLDER = {
      id: 'folder-id',
      name: 'Folder name'
    }
    useQuery.mockReturnValue({ data: FOLDER })
    useCurrentFolderId.mockReturnValue(FOLDER.id)

    const { displayedFolder } = useDisplayedFolder()

    expect(displayedFolder).toBe(FOLDER)
  })

  it("should return root dir if current folder isn't found", () => {
    const FOLDER = {
      id: ROOT_DIR_ID,
      name: 'Root'
    }

    useQuery.mockReturnValue({ data: FOLDER })
    useCurrentFolderId.mockReturnValue(null)

    const { displayedFolder } = useDisplayedFolder()

    expect(displayedFolder).toBe(FOLDER)
  })

  it('does not query the instance root directory on the public route', () => {
    // Public-share tokens cannot read the instance root directory, so the query
    // would 403. cozy-client's useQuery does not catch that rejection, so it
    // surfaces as an unhandled promise rejection.
    useQuery.mockReturnValue({ data: null, fetchStatus: 'pending' })
    useCurrentFolderId.mockReturnValue(null) // falls back to ROOT_DIR_ID
    usePublicContext.mockReturnValue({ isPublic: true })

    useDisplayedFolder()

    expect(useQuery).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ enabled: false })
    )
  })

  it('reports isLoading while the folder query has not settled', () => {
    useQuery.mockReturnValue({ data: null, fetchStatus: 'loading' })
    useCurrentFolderId.mockReturnValue('folder-id')

    expect(useDisplayedFolder().isLoading).toBe(true)
  })

  it('reports not loading once the folder query has settled', () => {
    useQuery.mockReturnValue({
      data: null,
      fetchStatus: 'failed',
      lastError: { status: 403 }
    })
    useCurrentFolderId.mockReturnValue('folder-id')

    expect(useDisplayedFolder().isLoading).toBe(false)
  })

  it('still queries the root directory on the authenticated route', () => {
    useQuery.mockReturnValue({ data: null, fetchStatus: 'pending' })
    useCurrentFolderId.mockReturnValue(null) // falls back to ROOT_DIR_ID
    usePublicContext.mockReturnValue({ isPublic: false })

    useDisplayedFolder()

    expect(useQuery).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ enabled: true })
    )
  })
})
