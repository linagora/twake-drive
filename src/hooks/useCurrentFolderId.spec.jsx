import ReactRouter from 'react-router-dom'

import useCurrentFolderId from './useCurrentFolderId'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useLocation: jest.fn()
}))

describe('useCurrentFolderId', () => {
  it('should return file id if in params', () => {
    jest
      .spyOn(ReactRouter, 'useParams')
      .mockReturnValue({ folderId: 'folder-id' })
    jest.spyOn(ReactRouter, 'useLocation').mockReturnValue({})

    const currentFolderId = useCurrentFolderId()

    expect(currentFolderId).toBe('folder-id')
  })

  it('should return ROOT_DIR_ID if in /folder', () => {
    jest.spyOn(ReactRouter, 'useParams').mockReturnValue({})
    jest
      .spyOn(ReactRouter, 'useLocation')
      .mockReturnValue({ pathname: '/folder' })

    const currentFolderId = useCurrentFolderId()

    expect(currentFolderId).toBe(ROOT_DIR_ID)
  })

  it('should return TRASH_DIR_ID if in /trash', () => {
    jest.spyOn(ReactRouter, 'useParams').mockReturnValue({})
    jest
      .spyOn(ReactRouter, 'useLocation')
      .mockReturnValue({ pathname: '/trash' })

    const currentFolderId = useCurrentFolderId()

    expect(currentFolderId).toBe(TRASH_DIR_ID)
  })

  it('should return io.cozy.files.shared-drives-dir if in /folder/io.cozy.files.shared-drives-dir', () => {
    jest.spyOn(ReactRouter, 'useParams').mockReturnValue({
      folderId: 'io.cozy.files.shared-drives-dir'
    })
    jest
      .spyOn(ReactRouter, 'useLocation')
      .mockReturnValue({ pathname: '/folder/io.cozy.files.shared-drives-dir' })

    const currentFolderId = useCurrentFolderId()

    expect(currentFolderId).toBe('io.cozy.files.shared-drives-dir')
  })

  it('should return null', () => {
    jest.spyOn(ReactRouter, 'useParams').mockReturnValue({})
    jest.spyOn(ReactRouter, 'useLocation').mockReturnValue({})

    const currentFolderId = useCurrentFolderId()

    expect(currentFolderId).toBe(null)
  })
})
