import {
  navigateToModal,
  navigateToModalWithMultipleFile,
  getContextMenuActions
} from './helpers'

jest.mock('@/lib/path', () => ({
  joinPath: jest.fn((...paths) => paths.join('/'))
}))

describe('actions helpers', () => {
  describe('navigateToModal', () => {
    let mockNavigate

    beforeEach(() => {
      mockNavigate = jest.fn()
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should navigate to modal with pathname and single file', () => {
      const params = {
        navigate: mockNavigate,
        pathname: '/folder/123',
        files: { id: 'file-123', name: 'test.pdf' },
        path: 'preview'
      }

      navigateToModal(params)

      expect(mockNavigate).toHaveBeenCalledWith(
        '/folder/123/file/file-123/preview'
      )
    })

    it('should navigate to modal with pathname and array of files', () => {
      const params = {
        navigate: mockNavigate,
        pathname: '/folder/456',
        files: [
          { id: 'file-1', name: 'first.pdf' },
          { id: 'file-2', name: 'second.pdf' }
        ],
        path: 'edit'
      }

      navigateToModal(params)

      expect(mockNavigate).toHaveBeenCalledWith('/folder/456/file/file-1/edit')
    })
  })

  describe('navigateToModalWithMultipleFile', () => {
    let mockNavigate

    beforeEach(() => {
      mockNavigate = jest.fn()
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should navigate with pathname, multiple files, and search params', () => {
      const params = {
        navigate: mockNavigate,
        pathname: '/folder/123',
        files: [
          { id: 'file-1', name: 'doc1.pdf' },
          { id: 'file-2', name: 'doc2.pdf' },
          { id: 'file-3', name: 'doc3.pdf' }
        ],
        path: 'share',
        search: 'tab=link'
      }

      navigateToModalWithMultipleFile(params)

      expect(mockNavigate).toHaveBeenCalledWith(
        {
          pathname: '/folder/123/share',
          search: '?tab=link'
        },
        {
          state: { fileIds: ['file-1', 'file-2', 'file-3'] }
        }
      )
    })

    it('should navigate with pathname and multiple files without search params', () => {
      const params = {
        navigate: mockNavigate,
        pathname: '/recent',
        files: [
          { id: 'file-a', name: 'image1.jpg' },
          { id: 'file-b', name: 'image2.jpg' }
        ],
        path: 'move'
      }

      navigateToModalWithMultipleFile(params)

      expect(mockNavigate).toHaveBeenCalledWith(
        {
          pathname: '/recent/move',
          search: ''
        },
        {
          state: { fileIds: ['file-a', 'file-b'] }
        }
      )
    })

    it('should handle empty search parameter', () => {
      const params = {
        navigate: mockNavigate,
        pathname: '/folder/456',
        files: [
          { id: 'file-1', name: 'test1.pdf' },
          { id: 'file-2', name: 'test2.pdf' }
        ],
        path: 'delete',
        search: ''
      }

      navigateToModalWithMultipleFile(params)

      expect(mockNavigate).toHaveBeenCalledWith(
        {
          pathname: '/folder/456/delete',
          search: ''
        },
        {
          state: { fileIds: ['file-1', 'file-2'] }
        }
      )
    })
  })

  describe('getContextMenuActions', () => {
    it('should return all actions when all have displayInContextMenu !== false', () => {
      const actions = [
        { download: { displayInContextMenu: true, name: 'Download' } },
        { share: { name: 'Share' } }, // undefined displayInContextMenu should be included
        { rename: { displayInContextMenu: undefined, name: 'Rename' } }
      ]

      const result = getContextMenuActions(actions)

      expect(result).toEqual(actions)
      expect(result).toHaveLength(3)
    })

    it('should filter out actions with displayInContextMenu: false', () => {
      const actions = [
        { download: { displayInContextMenu: true, name: 'Download' } },
        { share: { displayInContextMenu: false, name: 'Share' } },
        { rename: { name: 'Rename' } },
        { delete: { displayInContextMenu: false, name: 'Delete' } }
      ]

      const result = getContextMenuActions(actions)

      expect(result).toEqual([
        { download: { displayInContextMenu: true, name: 'Download' } },
        { rename: { name: 'Rename' } }
      ])
      expect(result).toHaveLength(2)
    })
  })
})
