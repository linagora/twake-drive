import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import PublicToolbarByLink from './PublicToolbarByLink'
import AppLike from 'test/components/AppLike'

import { useDisplayedFolder } from '@/hooks'
import { download } from '@/modules/actions/download'

jest.mock('@/hooks', () => ({
  ...jest.requireActual('@/hooks'),
  useDisplayedFolder: jest.fn()
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  ...jest.requireActual('cozy-ui/transpiled/react/providers/Breakpoints'),
  __esModule: true,
  default: jest.fn()
}))

const files = [
  { id: 'a', _id: 'a', type: 'file', name: 'a.txt' },
  { id: 'b', _id: 'b', type: 'directory', name: 'b' }
]

function setup(folder, isMobile = false) {
  const client = createMockClient({})
  client.stackClient.uri = 'http://cozy.tools'
  client.stackClient.fetchJSON = jest.fn().mockResolvedValue({
    links: { related: '/files/archive/secret/files.zip' }
  })
  const collection = client.collection('io.cozy.files')
  collection.forceFileDownload = jest.fn()
  client.collection = () => collection
  useDisplayedFolder.mockReturnValue({ displayedFolder: folder })
  useBreakpoints.mockReturnValue({ isMobile, isDesktop: !isMobile })
  render(
    <AppLike client={client}>
      <PublicToolbarByLink files={files} hasWriteAccess={false} />
    </AppLike>
  )
  fireEvent.click(within(screen.getByTestId('more-menu')).getByRole('button'))
  return { client, collection }
}

describe('PublicToolbarByLink', () => {
  it.each([
    ['root', false],
    ['subfolder', false],
    ['root', true]
  ])('downloads the displayed %s folder on mobile=%s', async (id, isMobile) => {
    if (isMobile) jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, collection } = setup({ id, type: 'directory' }, isMobile)
    fireEvent.click(screen.getByText('Download'))
    await waitFor(() => {
      expect(client.stackClient.fetchJSON).toHaveBeenCalledWith(
        'POST',
        '/files/archive',
        {
          data: {
            type: 'io.cozy.archives',
            attributes: { name: 'files', ids: [id] }
          }
        }
      )
    })
    expect(collection.forceFileDownload).toHaveBeenCalledWith(
      'http://cozy.tools/files/archive/secret/files.zip',
      'files.zip'
    )
  })

  it('keeps explicit selection downloads scoped to the selected documents', async () => {
    const { client } = setup({ id: 'root', type: 'directory' })
    const action = download({ client, t: key => key })
    await action.action(files)
    expect(client.stackClient.fetchJSON).toHaveBeenCalledWith(
      'POST',
      '/files/archive',
      {
        data: {
          type: 'io.cozy.archives',
          attributes: { name: 'files', ids: ['a', 'b'] }
        }
      }
    )
  })

  it.each([null, { type: 'directory' }])(
    'does not offer download before the displayed folder has an id',
    folder => {
      const { client } = setup(folder)
      expect(screen.queryByText('Download')).toBe(null)
      expect(screen.getByText('Select items')).toBeInTheDocument()
      expect(client.stackClient.fetchJSON).not.toHaveBeenCalled()
    }
  )
})
