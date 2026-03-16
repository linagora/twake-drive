import { IOCozyFile } from 'cozy-client/types/types'

import {
  handleShiftArrow,
  handleShiftClick,
  FORWARD_DIRECTION,
  BACKWARD_DIRECTION,
  HandleShiftArrowParams,
  HandleShiftClickParams
} from './helpers'

import { SelectedItems } from '@/modules/selection/types'

const createMockFile = (id: string, name = `file-${id}`): IOCozyFile =>
  ({
    _id: id,
    _type: 'io.cozy.files',
    name,
    type: 'file',
    dir_id: 'root',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
    size: 1000,
    mime: 'text/plain',
    class: 'text',
    executable: false
  }) as IOCozyFile

const mockFiles: IOCozyFile[] = [
  createMockFile('1', 'file1.txt'),
  createMockFile('2', 'file2.txt'),
  createMockFile('3', 'file3.txt'),
  createMockFile('4', 'file4.txt'),
  createMockFile('5', 'file5.txt')
]

describe('handleShiftArrow', () => {
  let mockIsItemSelected: jest.Mock

  beforeEach(() => {
    mockIsItemSelected = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when no items are selected', () => {
    it('should select the first item when moving forward', () => {
      const params: HandleShiftArrowParams = {
        direction: FORWARD_DIRECTION,
        items: mockFiles,
        selectedItems: {},
        lastInteractedIdx: 0,
        isItemSelected: mockIsItemSelected
      }

      const result = handleShiftArrow(params)

      expect(result).toEqual({
        newSelectedItems: { '1': mockFiles[0] },
        lastInteractedItemId: '1'
      })
    })

    it('should select the last item when moving backward', () => {
      const params: HandleShiftArrowParams = {
        direction: BACKWARD_DIRECTION,
        items: mockFiles,
        selectedItems: {},
        lastInteractedIdx: 0,
        isItemSelected: mockIsItemSelected
      }

      const result = handleShiftArrow(params)

      expect(result).toEqual({
        newSelectedItems: { '5': mockFiles[4] },
        lastInteractedItemId: '5'
      })
    })
  })

  describe('when items are already selected', () => {
    it('should extend selection forward when moving from selected to unselected item', () => {
      const selectedItems: SelectedItems = { '2': mockFiles[1] }
      mockIsItemSelected.mockImplementation((id: string) => {
        if (id === '2') return true // Previous item is selected
        if (id === '3') return false // Current item is not selected
        return false
      })

      const params: HandleShiftArrowParams = {
        direction: FORWARD_DIRECTION,
        items: mockFiles,
        selectedItems,
        lastInteractedIdx: 1,
        isItemSelected: mockIsItemSelected
      }

      const result = handleShiftArrow(params)

      expect(result.newSelectedItems).toEqual({
        '2': mockFiles[1],
        '3': mockFiles[2]
      })
      expect(result.lastInteractedItemId).toBe('3')
    })

    it('should contract selection when moving from selected to selected item', () => {
      const selectedItems: SelectedItems = {
        '1': mockFiles[0],
        '2': mockFiles[1],
        '3': mockFiles[2]
      }
      mockIsItemSelected.mockImplementation((id: string) => {
        return ['1', '2', '3'].includes(id)
      })

      const params: HandleShiftArrowParams = {
        direction: BACKWARD_DIRECTION,
        items: mockFiles,
        selectedItems,
        lastInteractedIdx: 2,
        isItemSelected: mockIsItemSelected
      }

      const result = handleShiftArrow(params)

      expect(result.newSelectedItems).toEqual({
        '1': mockFiles[0],
        '2': mockFiles[1]
      })
      expect(result.lastInteractedItemId).toBe('2')
    })

    it('should handle boundary conditions at the start of the list', () => {
      const selectedItems: SelectedItems = { '1': mockFiles[0] }
      mockIsItemSelected.mockImplementation((id: string) => id === '1')

      const params: HandleShiftArrowParams = {
        direction: BACKWARD_DIRECTION,
        items: mockFiles,
        selectedItems,
        lastInteractedIdx: 0,
        isItemSelected: mockIsItemSelected
      }

      const result = handleShiftArrow(params)

      expect(result.newSelectedItems).toEqual({})
      expect(result.lastInteractedItemId).toBe('1')
    })

    it('should handle boundary conditions at the end of the list', () => {
      const selectedItems: SelectedItems = { '5': mockFiles[4] }
      mockIsItemSelected.mockImplementation((id: string) => id === '5')

      const params: HandleShiftArrowParams = {
        direction: FORWARD_DIRECTION,
        items: mockFiles,
        selectedItems,
        lastInteractedIdx: 4,
        isItemSelected: mockIsItemSelected
      }

      const result = handleShiftArrow(params)

      expect(result.newSelectedItems).toEqual({})
      expect(result.lastInteractedItemId).toBe('5')
    })
  })
})

describe('handleShiftClick', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('range selection behavior', () => {
    it('should select all items in range when end item is not selected', () => {
      const selectedItems: SelectedItems = {}

      const params: HandleShiftClickParams = {
        startIdx: 1,
        endIdx: 3,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '2': mockFiles[1],
          '3': mockFiles[2],
          '4': mockFiles[3]
        },
        lastInteractedItemId: '4'
      })
    })

    it('should deselect all items in range when end item is selected', () => {
      const selectedItems: SelectedItems = {
        '1': mockFiles[0],
        '2': mockFiles[1],
        '3': mockFiles[2],
        '4': mockFiles[3],
        '5': mockFiles[4]
      }

      const params: HandleShiftClickParams = {
        startIdx: 1,
        endIdx: 3,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '1': mockFiles[0],
          '5': mockFiles[4]
        },
        lastInteractedItemId: '4'
      })
    })

    it('should handle reverse range selection (endIdx < startIdx)', () => {
      const selectedItems: SelectedItems = {}

      const params: HandleShiftClickParams = {
        startIdx: 3,
        endIdx: 1,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '2': mockFiles[1],
          '3': mockFiles[2],
          '4': mockFiles[3]
        },
        lastInteractedItemId: '2'
      })
    })

    it('should handle single item selection (startIdx === endIdx)', () => {
      const selectedItems: SelectedItems = {}

      const params: HandleShiftClickParams = {
        startIdx: 2,
        endIdx: 2,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '3': mockFiles[2]
        },
        lastInteractedItemId: '3'
      })
    })
  })

  describe('boundary conditions', () => {
    it('should handle selection at the beginning of the list', () => {
      const selectedItems: SelectedItems = {}

      const params: HandleShiftClickParams = {
        startIdx: 0,
        endIdx: 2,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '1': mockFiles[0],
          '2': mockFiles[1],
          '3': mockFiles[2]
        },
        lastInteractedItemId: '3'
      })
    })

    it('should handle selection at the end of the list', () => {
      const selectedItems: SelectedItems = {}

      const params: HandleShiftClickParams = {
        startIdx: 2,
        endIdx: 4,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '3': mockFiles[2],
          '4': mockFiles[3],
          '5': mockFiles[4]
        },
        lastInteractedItemId: '5'
      })
    })

    it('should handle full list selection', () => {
      const selectedItems: SelectedItems = {}

      const params: HandleShiftClickParams = {
        startIdx: 0,
        endIdx: 4,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '1': mockFiles[0],
          '2': mockFiles[1],
          '3': mockFiles[2],
          '4': mockFiles[3],
          '5': mockFiles[4]
        },
        lastInteractedItemId: '5'
      })
    })
  })

  describe('mixed selection scenarios', () => {
    it('should handle partial existing selection', () => {
      const selectedItems: SelectedItems = {
        '1': mockFiles[0],
        '5': mockFiles[4]
      }

      const params: HandleShiftClickParams = {
        startIdx: 1,
        endIdx: 3,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '1': mockFiles[0],
          '2': mockFiles[1],
          '3': mockFiles[2],
          '4': mockFiles[3],
          '5': mockFiles[4]
        },
        lastInteractedItemId: '4'
      })
    })

    it('should preserve items outside the range when deselecting', () => {
      const selectedItems: SelectedItems = {
        '1': mockFiles[0],
        '2': mockFiles[1],
        '3': mockFiles[2],
        '4': mockFiles[3],
        '5': mockFiles[4]
      }

      const params: HandleShiftClickParams = {
        startIdx: 1,
        endIdx: 2,
        selectedItems,
        items: mockFiles
      }

      const result = handleShiftClick(params)

      expect(result).toEqual({
        newSelectedItems: {
          '1': mockFiles[0],
          '4': mockFiles[3],
          '5': mockFiles[4]
        },
        lastInteractedItemId: '3'
      })
    })
  })
})
