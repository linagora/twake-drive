import MockDate from 'mockdate'

import flag from 'cozy-flags'

import { handlePress, handleClick } from './helpers'

jest.mock('cozy-flags', () => jest.fn())

const mockToggle = jest.fn()
const mockOpenLink = jest.fn()
const ev = { preventDefault: jest.fn() }

describe('handlePress', () => {
  const setup = ({
    event = ev,
    disabled = false,
    selectionModeActive = false,
    isLongPress = { current: false },
    isRenaming = false
  }) => {
    return {
      params: {
        event,
        disabled,
        selectionModeActive,
        isLongPress,
        isRenaming,
        openLink: mockOpenLink,
        toggle: mockToggle
      }
    }
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should only toggle if selectionModeActive', () => {
    const { params } = setup({ selectionModeActive: true })
    handlePress(params)

    expect(mockToggle).toHaveBeenCalledWith(ev)
    expect(mockOpenLink).not.toHaveBeenCalled()
  })

  it('should only open link if not renaming', () => {
    const { params } = setup({ isRenaming: false })
    handlePress(params)

    expect(mockToggle).not.toHaveBeenCalledWith()
    expect(mockOpenLink).toHaveBeenCalledWith(ev)
  })

  describe('should do nothing if', () => {
    it('disabled is true', () => {
      const { params } = setup({ disabled: true })
      handlePress(params)

      expect(mockToggle).not.toHaveBeenCalled()
      expect(mockOpenLink).not.toHaveBeenCalled()
    })

    it('isRenaming is true', () => {
      const { params } = setup({ isRenaming: true })
      handlePress(params)

      expect(mockToggle).not.toHaveBeenCalledWith()
      expect(mockOpenLink).not.toHaveBeenCalled()
    })

    it('isLongPress is true', () => {
      const { params } = setup({ isLongPress: { current: true } })
      handlePress(params)

      expect(mockToggle).not.toHaveBeenCalledWith()
      expect(mockOpenLink).not.toHaveBeenCalled()
    })
  })
})

describe('handleClick', () => {
  const setup = ({
    event = ev,
    disabled = false,
    isRenaming = false,
    lastClickTime = new Date('2025-01-01T12:00:00.000Z').getTime() // date of the first click
  }) => {
    return {
      params: {
        event,
        disabled,
        isRenaming,
        openLink: mockOpenLink,
        toggle: mockToggle,
        lastClickTime,
        setLastClickTime: jest.fn(),
        onInteractWithFile: jest.fn()
      }
    }
  }

  afterEach(() => {
    jest.clearAllMocks()
    MockDate.reset()
  })

  // should create a real life test to replace toggle by final func
  xit('should only toggle by default', () => {
    const { params } = setup({})
    handleClick(params)

    expect(mockToggle).toHaveBeenCalledWith(ev)
    expect(mockOpenLink).not.toHaveBeenCalled()
  })

  describe('should do nothing if', () => {
    it('disabled is true', () => {
      const { params } = setup({ disabled: true })
      handleClick(params)

      expect(mockToggle).not.toHaveBeenCalled()
      expect(mockOpenLink).not.toHaveBeenCalled()
    })

    it('isRenaming is true', () => {
      const { params } = setup({ isRenaming: true })
      handleClick(params)

      expect(mockToggle).not.toHaveBeenCalledWith()
      expect(mockOpenLink).not.toHaveBeenCalled()
    })
  })

  describe('with dynamic-selection enabled and selectionModeActive', () => {
    const file = { _id: 'file-1' }
    const mockSetSelectedItems = jest.fn()
    const mockOnInteractWithFile = jest.fn()

    const setupDynamic = (eventOverrides = {}) => {
      flag.mockImplementation(name => {
        if (name === 'drive.dynamic-selection.enabled') return true
        if (name === 'drive.doubleclick.enabled') return false
        return false
      })

      const event = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        ...eventOverrides
      }

      return {
        params: {
          event,
          file,
          disabled: false,
          isRenaming: false,
          openLink: mockOpenLink,
          toggle: mockToggle,
          selectionModeActive: true,
          lastClickTime: 0,
          setLastClickTime: jest.fn(),
          setSelectedItems: mockSetSelectedItems,
          onInteractWithFile: mockOnInteractWithFile,
          clearHighlightedItems: jest.fn()
        },
        event
      }
    }

    afterEach(() => {
      flag.mockReset()
    })

    it('should replace selection on simple click', () => {
      const { params } = setupDynamic()
      handleClick(params)

      expect(mockSetSelectedItems).toHaveBeenCalledWith({
        [file._id]: file
      })
      expect(mockToggle).not.toHaveBeenCalled()
    })

    it('should toggle item on Ctrl+Click', () => {
      const { params, event } = setupDynamic({ ctrlKey: true })
      handleClick(params)

      expect(mockToggle).toHaveBeenCalledWith(event)
      expect(mockSetSelectedItems).not.toHaveBeenCalled()
    })

    it('should toggle item on Cmd+Click (metaKey)', () => {
      const { params, event } = setupDynamic({ metaKey: true })
      handleClick(params)

      expect(mockToggle).toHaveBeenCalledWith(event)
      expect(mockSetSelectedItems).not.toHaveBeenCalled()
    })
  })

  describe('with doubleclick enabled', () => {
    const file = { _id: 'file-1' }
    const mockSetSelectedItems = jest.fn()
    const mockOnInteractWithFile = jest.fn()

    const setupDoubleClick = (eventOverrides = {}) => {
      flag.mockImplementation(name => {
        if (name === 'drive.doubleclick.enabled') return true
        return false
      })

      const event = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        ...eventOverrides
      }

      return {
        params: {
          event,
          file,
          disabled: false,
          isRenaming: false,
          openLink: mockOpenLink,
          toggle: mockToggle,
          selectionModeActive: true,
          lastClickTime: 0,
          setLastClickTime: jest.fn(),
          setSelectedItems: mockSetSelectedItems,
          onInteractWithFile: mockOnInteractWithFile,
          clearHighlightedItems: jest.fn()
        },
        event
      }
    }

    afterEach(() => {
      flag.mockReset()
    })

    it('should replace selection on simple click', () => {
      const { params } = setupDoubleClick()
      handleClick(params)

      expect(mockSetSelectedItems).toHaveBeenCalledWith({
        [file._id]: file
      })
      expect(mockToggle).not.toHaveBeenCalled()
    })

    it('should toggle item on Ctrl+Click', () => {
      const { params, event } = setupDoubleClick({ ctrlKey: true })
      handleClick(params)

      expect(mockToggle).toHaveBeenCalledWith(event)
      expect(mockSetSelectedItems).not.toHaveBeenCalled()
    })

    it('should toggle item on Cmd+Click (metaKey)', () => {
      const { params, event } = setupDoubleClick({ metaKey: true })
      handleClick(params)

      expect(mockToggle).toHaveBeenCalledWith(event)
      expect(mockSetSelectedItems).not.toHaveBeenCalled()
    })
  })

  describe('for double click', () => {
    beforeEach(() => {
      MockDate.set('2025-01-01T12:00:00.300Z') // date of the second click
    })

    it('it should do nothing when renainming', () => {
      const { params } = setup({ isRenaming: true })
      handleClick(params)

      expect(mockToggle).not.toHaveBeenCalled()
      expect(mockOpenLink).not.toHaveBeenCalled()
    })

    it('it should only open link', () => {
      const { params } = setup({})
      handleClick(params)

      expect(mockToggle).not.toHaveBeenCalled()
      expect(mockOpenLink).toHaveBeenCalledWith(ev)
    })
  })
})
