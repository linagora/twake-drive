import {
  act,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import React from 'react'

import CozyClient from 'cozy-client'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'

import { removeNonASCII } from '../testUtils'
import RecentView from './index'
import AppLike from 'test/components/AppLike'
import { setupStore } from 'test/setup'

import { ROOT_DIR_ID } from '@/constants/config'
import { schema } from '@/lib/doctypes'
import { buildPersonalRecentsQuery } from '@/queries'

jest.mock('cozy-flags', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('components/pushClient', () => ({
  isMacOS: jest.fn(() => false),
  isIOS: jest.fn(() => false),
  isLinux: jest.fn(() => false),
  isAndroid: jest.fn(() => false)
}))
jest.mock('components/pushClient/Banner', () => () => <div>Banner</div>)
jest.mock('components/useHead', () => jest.fn())
jest.mock('cozy-sharing', () => ({
  __esModule: true,
  ...jest.requireActual('cozy-sharing'),
  useSharingContext: jest.fn()
}))
jest.mock('cozy-dataproxy-lib', () => ({ useDataProxy: jest.fn(() => ({})) }))
jest.mock('cozy-ui-plus/dist/FileImageLoader', () => ({ file, linkType }) => (
  <div data-testid="FileImageLoader" data-link={file.links?.[linkType]} />
))
jest.mock('@/modules/views/Folder/CustomizedIcon', () => ({
  CustomizedIcon: ({ selectedColor }) => (
    <div data-testid="CustomizedIcon" data-color={selectedColor} />
  )
}))

// The whole view renders: give it time when the full suite loads the machine.
configure({ asyncUtilTimeout: 4000 })

const recent = (id, { name, type = 'file', mime, readable = true } = {}) => ({
  type: 'io.cozy.files.recents',
  id,
  meta: { rev: `1-${id}` },
  attributes: {
    last_activity_at: '2026-11-08T10:00:00Z',
    name: name ?? `old-${id}`,
    type,
    ...(mime ? { mime, class: mime.split('/')[0] } : {})
  },
  relationships: {
    file: { data: readable ? { type: 'io.cozy.files', id } : null }
  }
})

const file = (id, attributes, links) => ({
  type: 'io.cozy.files',
  id,
  meta: { rev: `2-${id}` },
  attributes: { type: 'file', dir_id: 'dir-1', ...attributes },
  ...(links ? { links } : {})
})

const PHOTO_TINY = '/files/photo/thumbnails/secret/tiny'

const firstPage = {
  data: [
    recent('photo', { mime: 'image/jpeg' }),
    recent('folder-1', { type: 'directory' }),
    recent('drive-file'),
    recent('note'),
    recent('docs'),
    recent('grist'),
    recent('shortcut'),
    recent('gone', { name: 'secret.jpg', mime: 'image/jpeg', readable: false })
  ],
  included: [
    file(
      'photo',
      {
        name: 'photo.jpg',
        class: 'image',
        mime: 'image/jpeg',
        path: '/Work/2026/photo.jpg'
      },
      { tiny: PHOTO_TINY, small: '/files/photo/thumbnails/secret/small' }
    ),
    file('folder-1', {
      type: 'directory',
      name: 'Projects',
      dir_id: ROOT_DIR_ID,
      path: '/Projects',
      metadata: { decorations: { color: '#ff0000' } }
    }),
    file('drive-file', {
      name: 'spec.txt',
      dir_id: 'drive-root',
      driveId: 'drive-1',
      path: '/spec.txt'
    }),
    file('note', {
      name: 'meeting.cozy-note',
      path: '/meeting.cozy-note',
      metadata: { title: 'Meeting', version: 3 },
      cozyMetadata: { createdOn: 'http://test.cloud/' }
    }),
    file('docs', {
      name: 'plan.docs-note',
      path: '/plan.docs-note',
      metadata: { externalId: 'docs-ext' }
    }),
    file('grist', {
      name: 'table.grist',
      path: '/table.grist',
      metadata: { externalId: 'grist-ext' }
    }),
    file('shortcut', {
      name: 'site.url',
      class: 'shortcut',
      path: '/site.url'
    })
  ]
}

const page = (ids, nextCursor) => ({
  data: ids.map(id => recent(id)),
  included: ids.map(id => file(id, { name: `${id}.txt`, path: `/${id}.txt` })),
  ...(nextCursor
    ? { links: { next: `/files/recents?page%5Bcursor%5D=${nextCursor}` } }
    : {})
})

const sharedDrives = {
  data: [
    {
      type: 'io.cozy.sharings',
      id: 'drive-1',
      attributes: { description: 'Team drive', drive: true }
    }
  ]
}

const setup = ({ pages = [firstPage] } = {}) => {
  const client = new CozyClient({ useCustomStore: true, schema })
  client.getStackClient().setUri('http://test.cloud')
  const store = setupStore({ client })
  client.plugins.realtime = { subscribe: jest.fn(), unsubscribe: jest.fn() }

  const remainingPages = [...pages]
  client.stackClient.fetchJSON = jest.fn(async (method, path) => {
    if (path.startsWith('/files/recents')) {
      return remainingPages.length > 1
        ? remainingPages.shift()
        : remainingPages[0]
    }
    if (path === '/sharings/drives') return sharedDrives
    if (path.startsWith('/settings/')) {
      return { data: { type: 'io.cozy.settings', id: path, attributes: {} } }
    }
    if (path === `/files/${ROOT_DIR_ID}`) {
      return {
        data: file(ROOT_DIR_ID, { type: 'directory', name: '', path: '/' })
      }
    }
    return { data: [], rows: [] }
  })

  const modalContextValue = {
    pushModal: jest.fn(),
    popModal: jest.fn(),
    modalStack: []
  }

  window.history.pushState({}, '', '/#/recent')
  render(
    <AppLike
      client={client}
      store={store}
      modalContextValue={modalContextValue}
    >
      <RecentView />
    </AppLike>
  )
  return { client, pushModal: modalContextValue.pushModal }
}

const linkOf = name => screen.getByText(name).closest('a')

const expectInOrder = names => {
  const nodes = names.map(name => screen.getByText(name))
  nodes.slice(1).forEach((node, index) => {
    expect(
      nodes[index].compareDocumentPosition(node) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
}

const requestedPaths = client =>
  client.stackClient.fetchJSON.mock.calls.map(([, path]) => path)

describe('Recent view with the personal recents of the stack', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    flag.mockImplementation(name => name === 'drive.recents.enabled')
    useSharingContext.mockReturnValue({
      byDocId: {},
      allLoaded: true,
      refresh: jest.fn()
    })
    // The "Load more" button of cozy-ui observes its own visibility.
    window.IntersectionObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('shows the files of the recents in the order of the stack', async () => {
    setup()

    await screen.findByText('photo')
    expectInOrder(['photo', 'Projects', 'spec', 'meeting'])
    expect(screen.queryByText('old-photo')).toBe(null)
  })

  it('shows only the name of the parent folder', async () => {
    setup()

    await screen.findByText('photo')
    await waitFor(() =>
      expect(
        [...document.querySelectorAll('.fil-file-path')].map(node =>
          removeNonASCII(node.textContent)
        )
      ).toEqual(expect.arrayContaining(['2026', '/', 'Team drive']))
    )
  })

  it('opens each kind of item where the folder views open it', async () => {
    setup()

    await screen.findByText('photo')
    expect(linkOf('Projects').getAttribute('href')).toBe('#/folder/folder-1')
    expect(linkOf('spec').getAttribute('href')).toBe('#/recent/file/drive-file')
    expect(linkOf('meeting').getAttribute('href')).toContain('/n/note')
    expect(linkOf('plan').getAttribute('href')).toContain(
      '/bridge/docs/docs-ext'
    )
    expect(linkOf('table').getAttribute('href')).toContain(
      '/bridge/grist/grist-ext'
    )
    expect(linkOf('site').getAttribute('href')).toBe('#/external/shortcut')
  })

  it('shows thumbnails and badges from the files, without a request per item', async () => {
    const { client } = setup()

    await screen.findByText('photo')
    expect(
      screen
        .getAllByTestId('FileImageLoader')
        .map(node => node.getAttribute('data-link'))
    ).toEqual([PHOTO_TINY])
    expect(
      screen.getByTestId('CustomizedIcon').getAttribute('data-color')
    ).toBe('#ff0000')
    const recentIds = firstPage.data.map(({ id }) => id)
    const fileRequests = client.stackClient.fetchJSON.mock.calls.filter(
      ([, path]) => {
        const [root, id] = path.split(/[/?]/).filter(Boolean)
        return root === 'files' && recentIds.includes(id)
      }
    )
    expect(fileRequests).toEqual([])
  })

  it('shows an unreadable item with its last known name, without opening it', async () => {
    setup()

    await screen.findByText('secret')
    expect(linkOf('secret')).toBe(null)
  })

  it('offers item actions on readable items only', async () => {
    setup()

    await screen.findByText('secret')
    const rowActionOf = name =>
      within(
        screen.getByText(name).closest('.fil-content-row')
      ).queryByLabelText('More')
    expect(rowActionOf('photo')).toBeInTheDocument()
    expect(rowActionOf('spec')).toBeInTheDocument()
    expect(rowActionOf('secret')).toBe(null)
  })

  it('leaves unreadable items out when selecting all', async () => {
    const { pushModal } = setup()

    await screen.findByText('secret')
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'Delete' })

    await waitFor(() => expect(pushModal).toHaveBeenCalled())
    const [deleteConfirm] = pushModal.mock.calls[0]
    const trashedIds = deleteConfirm.props.files.map(({ _id }) => _id)
    expect(trashedIds).toContain('photo')
    expect(trashedIds).not.toContain('gone')
  })

  it('offers no write action on the items of a drive the user can only read', async () => {
    useSharingContext.mockReturnValue({
      byDocId: {},
      allLoaded: true,
      refresh: jest.fn(),
      hasWriteAccess: (docId, driveId) => driveId !== 'drive-1'
    })
    const { pushModal } = setup()

    await screen.findByText('spec')
    fireEvent.click(
      within(
        screen.getByText('spec').closest('.fil-content-row')
      ).getByLabelText('More')
    )
    await screen.findByText('Download')
    expect(screen.queryByText('Rename')).toBe(null)
    expect(screen.queryByText('Move to…')).toBe(null)
    expect(screen.queryByText('Remove')).toBe(null)

    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(pushModal).not.toHaveBeenCalled()
  })

  it('downloads the selected items after selecting all', async () => {
    const { client } = setup({ pages: [page(['one', 'two'])] })

    await screen.findByText('two')
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true })
    fireEvent.click(await screen.findByText('Download'))

    await waitFor(() =>
      expect(client.stackClient.fetchJSON).toHaveBeenCalledWith(
        'POST',
        '/files/archive',
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: expect.objectContaining({ ids: ['one', 'two'] })
          })
        })
      )
    )
  })

  it('drops a selected file that a refresh shows as unreadable', async () => {
    const unreadableTwo = {
      ...page(['one', 'two']),
      data: [recent('one'), recent('two', { readable: false })],
      included: [file('one', { name: 'one.txt', path: '/one.txt' })]
    }
    const { client, pushModal } = setup({
      pages: [page(['one', 'two']), unreadableTwo]
    })

    await screen.findByText('two')
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true })
    const { definition, options } = buildPersonalRecentsQuery()
    await act(() =>
      client.query(definition(), { ...options, fetchPolicy: null })
    )
    await screen.findByText('old-two')
    fireEvent.keyDown(document.body, { key: 'Delete' })

    await waitFor(() => expect(pushModal).toHaveBeenCalled())
    const [deleteConfirm] = pushModal.mock.calls[0]
    expect(deleteConfirm.props.files.map(({ _id }) => _id)).toEqual(['one'])
  })

  it('selects all again after a refresh brought a recent', async () => {
    const { client, pushModal } = setup({
      pages: [page(['one']), page(['new', 'one'])]
    })

    await screen.findByText('one')
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true })
    const { definition, options } = buildPersonalRecentsQuery()
    await act(() =>
      client.query(definition(), { ...options, fetchPolicy: null })
    )
    await screen.findByText('new')
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'Delete' })

    await waitFor(() => expect(pushModal).toHaveBeenCalled())
    const [deleteConfirm] = pushModal.mock.calls[0]
    expect(deleteConfirm.props.files.map(({ _id }) => _id)).toEqual([
      'new',
      'one'
    ])
  })

  it('adds the file of a recent to favorites, not the recent', async () => {
    const { client } = setup()

    await screen.findByText('photo')
    const photoRow = screen.getByText('photo').closest('.fil-content-row')
    fireEvent.click(within(photoRow).getByLabelText('More'))
    fireEvent.click(await screen.findByText('Add to favorites'))

    await waitFor(() =>
      expect(client.stackClient.fetchJSON).toHaveBeenCalledWith(
        'PATCH',
        '/files/photo',
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: expect.objectContaining({
              name: 'photo.jpg',
              cozyMetadata: expect.objectContaining({ favorite: true })
            })
          })
        }),
        expect.anything()
      )
    )
  })

  it('loads the next page instead of showing an empty first page', async () => {
    const emptyPage = {
      data: [],
      links: { next: '/files/recents?page%5Bcursor%5D=next-cursor' }
    }
    const { client } = setup({ pages: [emptyPage, firstPage] })

    await waitFor(() =>
      expect(requestedPaths(client)).toContainEqual(
        expect.stringContaining('next-cursor')
      )
    )
    await screen.findByText('photo')
  })

  it('appends the next page after the loaded recents', async () => {
    const { client } = setup({
      pages: [page(['one', 'two'], 'cursor-2'), page(['three', 'four'])]
    })

    await screen.findByText('two')
    fireEvent.click(screen.getByText('Load More'))

    await screen.findByText('four')
    expectInOrder(['one', 'two', 'three', 'four'])
    expect(requestedPaths(client)).toContainEqual(
      expect.stringContaining('cursor-2')
    )
  })

  it('loads past an empty page that has a next one', async () => {
    const { client } = setup({
      pages: [page(['one'], 'cursor-2'), page([], 'cursor-3'), page(['three'])]
    })

    await screen.findByText('one')
    fireEvent.click(screen.getByText('Load More'))

    await screen.findByText('three')
    expect(requestedPaths(client)).toContainEqual(
      expect.stringContaining('cursor-3')
    )
  })

  it('starts again from the first page on a refresh', async () => {
    const { client } = setup({
      pages: [page(['one'], 'cursor-2'), page(['two']), page(['zero', 'one'])]
    })

    await screen.findByText('one')
    fireEvent.click(screen.getByText('Load More'))
    await screen.findByText('two')

    const { definition, options } = buildPersonalRecentsQuery()
    await act(() =>
      client.query(definition(), { ...options, fetchPolicy: null })
    )

    await screen.findByText('zero')
    expectInOrder(['zero', 'one'])
    expect(screen.queryByText('two')).toBe(null)
  })

  it('loads more from the cursor of a refresh running when asked', async () => {
    const { client } = setup({
      pages: [
        page(['one'], 'old-cursor'),
        page(['zero', 'one'], 'new-cursor'),
        page(['two'])
      ]
    })
    await screen.findByText('one')

    // The refresh answers only once "Load More" has been clicked.
    const fetchJSON = client.stackClient.fetchJSON.getMockImplementation()
    let answerRefresh
    const refreshAnswered = new Promise(resolve => {
      answerRefresh = resolve
    })
    client.stackClient.fetchJSON.mockImplementationOnce(async (...args) => {
      const response = await fetchJSON(...args)
      await refreshAnswered
      return response
    })

    const { definition, options } = buildPersonalRecentsQuery()
    let refresh
    act(() => {
      refresh = client.query(definition(), { ...options, fetchPolicy: null })
    })
    await waitFor(() =>
      expect(
        requestedPaths(client).filter(path => path.startsWith('/files/recents'))
      ).toHaveLength(2)
    )

    fireEvent.click(screen.getByText('Load More'))
    await act(async () => {
      answerRefresh()
      await refresh
    })

    await screen.findByText('two')
    expectInOrder(['zero', 'one', 'two'])
    expect(requestedPaths(client)).toContainEqual(
      expect.stringContaining('new-cursor')
    )
    expect(requestedPaths(client)).not.toContainEqual(
      expect.stringContaining('old-cursor')
    )
  })
})
