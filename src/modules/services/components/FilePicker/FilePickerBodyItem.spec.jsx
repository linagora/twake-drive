import { render, fireEvent } from '@testing-library/react'
import { filesize } from 'filesize'
import React from 'react'

import FilePickerBodyItem from './FilePickerBodyItem'
import DemoProvider from './docs/DemoProvider'
import { isValidFile, isValidFolder } from './helpers'

const mockFile01 = {
  _id: '001',
  type: 'file',
  name: 'Filename.pdf',
  mime: 'application/pdf',
  updated_at: '2021-01-01T12:00:00.000000+01:00'
}
const mockFolder01 = {
  _id: '002',
  type: 'directory',
  name: 'Foldername',
  updated_at: '2021-01-01T12:00:00.000000+01:00'
}

jest.mock('filesize', () => ({ filesize: jest.fn() }))
jest.mock('./helpers', () => ({
  ...jest.requireActual('./helpers'),
  isValidFile: jest.fn(),
  isValidFolder: jest.fn()
}))

describe('FilePickerBodyItem components:', () => {
  const mockHandleChoiceClick = jest.fn()
  const mockHandleListItemClick = jest.fn()
  filesize.mockReturnValue('111Ko')

  const setup = ({
    item = mockFile01,
    multiple = false,
    validFile = false,
    validFolder = false
  } = {}) => {
    isValidFile.mockReturnValue(validFile)
    isValidFolder.mockReturnValue(validFolder)

    return render(
      <DemoProvider>
        <FilePickerBodyItem
          item={item}
          itemTypesAccepted={[]}
          multiple={multiple}
          handleChoiceClick={mockHandleChoiceClick}
          handleListItemClick={mockHandleListItemClick}
          itemsIdsSelected={[]}
          hasDivider={false}
        />
      </DemoProvider>
    )
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be rendered correctly', () => {
    const { container } = setup()

    expect(container).toBeDefined()
  })

  it('should display filename', () => {
    const { getByText } = setup()

    expect(getByText('Filename.pdf'))
  })

  it('should display foldername', () => {
    const { getByText } = setup({ item: mockFolder01 })

    expect(getByText('Foldername'))
  })

  it("should item's line is not disabled when has not valid type & is File", () => {
    const { getByTestId } = setup({
      item: mockFile01,
      validFile: false,
      validFolder: false
    })
    const listItem = getByTestId('list-item')

    expect(listItem).toHaveAttribute('aria-disabled', 'true')
  })

  it("should item's line is not disabled when has not valid type & is Folder", () => {
    const { getByTestId } = setup({
      item: mockFolder01,
      validFile: false,
      validFolder: false
    })
    const listItem = getByTestId('list-item')

    expect(listItem).toHaveAttribute('aria-disabled', 'false')
  })

  describe('Functions called', () => {
    it('should call "handleChoiceClick" function when click on checkbox/radio area', () => {
      const { getByTestId } = setup({ validFile: true })
      fireEvent.click(getByTestId('choice-onclick'))

      expect(mockHandleChoiceClick).toHaveBeenCalled()
    })

    it('should NOT call "handleChoiceClick" function when click on checkbox/radio area, if is Folder & not accepted', () => {
      const { getByTestId } = setup({
        item: mockFolder01,
        validFolder: false
      })
      fireEvent.click(getByTestId('choice-onclick'))

      expect(mockHandleChoiceClick).not.toHaveBeenCalled()
    })
    it('should NOT call "handleChoiceClick" function when click on checkbox/radio area, if is File & not accepted', () => {
      const { getByTestId } = setup({ validFile: false })
      fireEvent.click(getByTestId('choice-onclick'))

      expect(mockHandleChoiceClick).not.toHaveBeenCalled()
    })

    it('should call "handleListItemClick" function when click on ListItem node', () => {
      const { getByTestId } = setup()
      fireEvent.click(getByTestId('listitem-onclick'))

      expect(mockHandleListItemClick).toHaveBeenCalled()
    })
  })

  describe('Attribute "multiple"', () => {
    it('should radio button exists if "multiple" atribute is False', () => {
      const { getByTestId } = setup()
      const radioBtn = getByTestId('radio-btn')
      expect(radioBtn).not.toBeNull()
    })

    it('should checkbox button exists if "multiple" atribute is True', () => {
      const { getByTestId } = setup({ multiple: true })
      const checkboxBtn = getByTestId('checkbox-btn')
      expect(checkboxBtn).not.toBeNull()
    })
  })

  describe('Radio/Checkbox button', () => {
    it('should disable and not display the Radio button if it is a File and is not accepted', () => {
      const { getByTestId } = setup({ validFile: false })
      const radioBtn = getByTestId('radio-btn')

      expect(radioBtn.getAttribute('disabled')).toBe(null)
    })

    it('should disable and not display the Radio button if it is a Folder and is not accepted', () => {
      const { getByTestId } = setup({ item: mockFolder01 })
      const radioBtn = getByTestId('radio-btn')

      expect(radioBtn.getAttribute('disabled')).toBe(null)
    })
  })
})
