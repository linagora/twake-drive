import MockDate from 'mockdate'

import { handlePress, handleClick } from './helpers'

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
    file = { _id: 'file-id' },
    lastClickTime = new Date('2025-01-01T12:00:00.000Z').getTime() // date of the first click
  }) => {
    return {
      params: {
        event,
        disabled,
        isRenaming,
        file,
        openLink: mockOpenLink,
        toggle: mockToggle,
        lastClickTime,
        setLastClickTime: jest.fn(),
        setSelectedItems: jest.fn(),
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
