import { render, act } from '@testing-library/react'
import React from 'react'

import CozyClient from 'cozy-client'

import { FolderPickerHeader } from './FolderPickerHeader'
import AppLike from 'test/components/AppLike'

jest.mock('lib/logger', () => ({
  error: jest.fn()
}))

describe('FolderPickerHeader', () => {
  const setupComponent = async ({ entries = [], title, subTitle }) => {
    const props = {
      entries,

      title,
      subTitle
    }
    const client = new CozyClient({})

    let component
    await act(async () => {
      component = render(
        <AppLike client={client}>
          <FolderPickerHeader {...props} />
        </AppLike>
      )
    })
    return component
  }
  it('should fallback to Move title if no title is given', async () => {
    const { getByText } = await setupComponent({
      entries: [{ file: 1 }, { file: 2 }]
    })
    expect(getByText('2 elements'))
  })
  it('should display title if title is given and no file', async () => {
    const { getByText } = await setupComponent({
      title: 'My Title'
    })
    expect(getByText('My Title'))
  })
  it('should display the right title if only one io.cozy.files', async () => {
    const { getByText } = await setupComponent({
      title: 'My Title',
      entries: [
        {
          name: 'FileName.txt',
          class: 'file'
        }
      ]
    })
    expect(getByText('FileName.txt'))
  })

  it('should display the right title if it comes from the outside', async () => {
    const { getByText } = await setupComponent({
      title: 'My Title',
      entries: [
        {
          name: 'FileName.txt'
        }
      ]
    })
    expect(getByText('FileName.txt'))
  })
  it('should display the right title if more than one files', async () => {
    const { getByText } = await setupComponent({
      title: 'My Title',
      entries: [
        {
          name: 'FileName.txt'
        },
        {
          name: 'FileName2.txt'
        }
      ]
    })
    expect(getByText('My Title'))
  })
})
