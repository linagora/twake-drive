import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import IntentDialogOpener from 'cozy-ui-plus/dist/Intent/IntentDialogOpener'

import { FilePickerButton } from './FilePickerButton'
import AppLike from 'test/components/AppLike'

import { buildFolderByPathQuery } from '@/queries'

jest.mock('cozy-ui-plus/dist/Intent/IntentDialogOpener', () => ({
  __esModule: true,
  default: jest.fn(({ children }) => children)
}))

const photosFolder = {
  _id: 'photos-folder-id',
  id: 'photos-folder-id',
  type: 'directory',
  name: 'Photos',
  path: '/Photos'
}

const makeClient = (data = [photosFolder]) => {
  const query = buildFolderByPathQuery('/Photos')

  return createMockClient({
    queries: {
      [query.options.as]: {
        definition: query.definition(),
        doctype: 'io.cozy.files',
        data
      }
    }
  })
}

describe('FilePickerButton', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses v2 accept filters for image-only and file-only examples', () => {
    render(
      <AppLike client={makeClient()}>
        <FilePickerButton />
      </AppLike>
    )

    expect(screen.queryByLabelText('Sharing link only')).toBe(null)
    expect(screen.queryByLabelText('Download link only')).toBe(null)

    fireEvent.click(screen.getByLabelText('Photos picker'))
    expect(IntentDialogOpener.mock.lastCall[0].options).toEqual(
      expect.objectContaining({
        defaultDirId: photosFolder.id,
        restrictToDefaultDir: true,
        multiple: false,
        documents: {},
        sharingLink: null,
        downloadLink: null
      })
    )

    fireEvent.click(screen.getByLabelText('Documents only'))
    expect(IntentDialogOpener.mock.lastCall[0].options).toEqual(
      expect.objectContaining({
        documents: {},
        sharingLink: null,
        downloadLink: null
      })
    )

    fireEvent.click(screen.getByLabelText('Image only'))
    expect(IntentDialogOpener.mock.lastCall[0].options.downloadLink).toEqual({
      label: 'Attach image',
      accept: ['image/*']
    })

    fireEvent.click(screen.getByLabelText('No folder sharing'))
    expect(IntentDialogOpener.mock.lastCall[0].options.sharingLink).toEqual({
      label: 'Share file only',
      accept: ['file']
    })
  })

  it('disables the Photos picker when /Photos is missing', () => {
    render(
      <AppLike client={makeClient([])}>
        <FilePickerButton />
      </AppLike>
    )

    expect(screen.getByLabelText('Photos picker')).toBeDisabled()
  })

  it.each([true, false])('sets full-screen dialog to %s', isMobile => {
    window.innerWidth = isMobile ? 500 : 1024

    render(
      <AppLike client={makeClient()}>
        <FilePickerButton />
      </AppLike>
    )

    expect(IntentDialogOpener).toHaveBeenCalledWith(
      expect.objectContaining({ fullScreen: isMobile }),
      expect.anything()
    )
  })

  it('updates options when selecting a v2 preset and setting directory controls', () => {
    render(
      <AppLike client={makeClient()}>
        <FilePickerButton />
      </AppLike>
    )

    fireEvent.click(screen.getByLabelText('All 3 actions'))
    expect(IntentDialogOpener.mock.lastCall[0].options.documents).toEqual({})
    expect(IntentDialogOpener.mock.lastCall[0].options.sharingLink).toEqual({
      label: 'Public link'
    })
    expect(IntentDialogOpener.mock.lastCall[0].options.downloadLink).toEqual({
      label: 'Download link'
    })

    fireEvent.change(screen.getByLabelText('Default directory ID'), {
      target: { value: 'custom-dir-123' }
    })
    fireEvent.click(screen.getByLabelText('Restrict to default directory'))

    expect(IntentDialogOpener.mock.lastCall[0].options.defaultDirId).toBe(
      'custom-dir-123'
    )
    expect(
      IntentDialogOpener.mock.lastCall[0].options.restrictToDefaultDir
    ).toBe(true)
  })
})
