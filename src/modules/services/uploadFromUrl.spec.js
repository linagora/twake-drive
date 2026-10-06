import { createServer } from 'http'

import fetch from 'node-fetch'

import CozyClient from 'cozy-client'
import { errorSerializer as errors } from 'cozy-interapp/dist/helpers'

import { normalizeUrlUploadError, uploadFileFromUrl } from './uploadFromUrl'

import { schema } from '@/lib/doctypes'

const sourceUrl = 'https://source.example/file?signature=a%2Bb%25&key=secret'
const config = { url: sourceUrl, folderId: 'folder', name: 'report.bin' }
const originalFetch = global.fetch

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/vnd.api+json' }
  })
}

function makeFixture({ folder = {}, status = null, onCreate = null } = {}) {
  const stored = new Map()
  const requests = []
  const client = new CozyClient({
    uri: 'https://stack.example',
    token: 'stack-token',
    schema
  })
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options })
    const endpoint = new URL(url)
    if (endpoint.origin !== 'https://stack.example')
      throw new Error('The browser must not fetch the source')
    if (options.method === 'GET') {
      return jsonResponse({
        data: {
          id: 'folder',
          type: 'io.cozy.files',
          attributes: { type: 'directory', name: 'Destination', ...folder }
        }
      })
    }
    if (options.method !== 'POST') throw new Error('Unexpected mutation')
    onCreate?.()
    const name = endpoint.searchParams.get('Name')
    if (status || stored.has(name)) {
      return jsonResponse(
        { errors: [{ status: String(status || 409), title: sourceUrl }] },
        status || 409
      )
    }
    const document = {
      id: `created-${stored.size}`,
      type: 'io.cozy.files',
      attributes: {
        type: 'file',
        name,
        dir_id: endpoint.pathname.split('/').pop(),
        size: 4
      }
    }
    stored.set(name, document)
    return jsonResponse({ data: document }, 201)
  }
  return { client, stored, requests }
}

function receivedError(error) {
  return JSON.parse(
    JSON.stringify(errors.serialize(normalizeUrlUploadError(error)))
  )
}

afterEach(() => {
  global.fetch = originalFetch
})

describe('uploadFileFromUrl through the real CozyClient creation boundary', () => {
  it('sends the intact SourceURL with no binary body and updates the store', async () => {
    const { client, stored, requests } = makeFixture()
    const result = await uploadFileFromUrl(
      client,
      config,
      new AbortController().signal
    )
    expect(result).toMatchObject({
      _id: 'created-0',
      _type: 'io.cozy.files',
      name: 'report.bin',
      dir_id: 'folder',
      size: 4
    })
    expect(stored.get(result.name).id).toBe(result._id)
    expect(
      client.getDocumentFromState('io.cozy.files', result._id)
    ).toMatchObject({
      name: result.name,
      size: 4
    })
    const request = requests.at(-1)
    expect(new URL(request.url).searchParams.get('SourceURL')).toBe(sourceUrl)
    expect(request.options.body).toBe('')
    expect(request.options.headers).toMatchObject({
      Authorization: 'Bearer stack-token',
      'Content-Type': 'application/octet-stream'
    })
    await uploadFileFromUrl(
      client,
      { ...config, name: 'cached-folder.bin' },
      new AbortController().signal
    )
    expect(stored.has('cached-folder.bin')).toBe(true)
    expect(
      requests.filter(request => request.options.method === 'GET')
    ).toHaveLength(1)
  })

  it.each(['io.cozy.apps/mail', 'io.cozy.apps/notes'])(
    'resolves %s to a concrete local id without browser folder creation',
    async folderId => {
      const { client, requests } = makeFixture()
      const result = await uploadFileFromUrl(
        client,
        { ...config, folderId },
        new AbortController().signal
      )
      expect(requests[0].url).toContain(encodeURIComponent(folderId))
      expect(result.dir_id).toBe('folder')
      expect(requests).toHaveLength(2)
    }
  )

  it('reuses the name-based collision loop without overwriting or fabricating a File', async () => {
    const { client, stored, requests } = makeFixture()
    stored.set('report.bin', { id: 'original' })
    stored.set('report (1).bin', { id: 'second-original' })
    const result = await uploadFileFromUrl(
      client,
      config,
      new AbortController().signal
    )
    expect(result.name).toBe('report (2).bin')
    expect(stored.get('report.bin').id).toBe('original')
    expect(stored.get('report (1).bin').id).toBe('second-original')
    for (const request of requests.filter(
      request => request.options.method === 'POST'
    )) {
      expect(new URL(request.url).searchParams.get('SourceURL')).toBe(sourceUrl)
      expect(request.options.body).toBe('')
    }
  })

  it.each([
    null,
    {},
    { ...config, name: '' },
    { ...config, name: '../file' },
    { ...config, url: 'https://user:secret@source.example/' },
    { ...config, url: 'data:text/plain,content' },
    { ...config, url: '/relative' },
    { ...config, folderId: 'io.cozy.apps/photos' }
  ])('rejects invalid data before any I/O: %j', async data => {
    const { client, stored, requests } = makeFixture()
    await expect(
      uploadFileFromUrl(client, data, new AbortController().signal)
    ).rejects.toThrow()
    expect(stored.size).toBe(0)
    expect(requests).toHaveLength(0)
  })

  it.each([
    { type: 'file' },
    { trashed: true },
    { _id: 'io.cozy.files.trash-dir' },
    { driveId: 'remote-drive' }
  ])('rejects a nonlocal or unavailable folder: %j', async folder => {
    const { client, stored, requests } = makeFixture({ folder })
    await expect(
      uploadFileFromUrl(client, config, new AbortController().signal)
    ).rejects.toThrow('local Drive folder')
    expect(stored.size).toBe(0)
    expect(requests).toHaveLength(1)
  })

  it.each([403, 413, 422, 502])(
    'returns sanitized HTTP %s errors without retries',
    async status => {
      const { client, stored, requests } = makeFixture({ status })
      let error = null
      try {
        await uploadFileFromUrl(client, config, new AbortController().signal)
      } catch (caught) {
        error = receivedError(caught)
      }
      expect(error).toEqual({
        name: 'Error',
        message: `URL upload failed (HTTP ${status})`,
        status
      })
      expect(stored.size).toBe(0)
      expect(requests).toHaveLength(2)
    }
  )

  it('does not begin a query after closure or retry a conflict after closure', async () => {
    const controller = new AbortController()
    const { client, stored, requests } = makeFixture({
      status: 409,
      onCreate: () => controller.abort()
    })
    await expect(
      uploadFileFromUrl(client, config, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(stored.size).toBe(0)
    expect(requests).toHaveLength(2)
    await expect(
      uploadFileFromUrl(client, config, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(requests).toHaveLength(2)
  })

  it('keeps existing binary creation on the same real client path', async () => {
    const { client, requests } = makeFixture()
    const { data } = await client.create('io.cozy.files', {
      type: 'file',
      data: 'binary content',
      dirId: 'folder',
      name: 'binary.txt'
    })
    expect(data.name).toBe('binary.txt')
    expect(client.getDocumentFromState('io.cozy.files', data._id).name).toBe(
      'binary.txt'
    )
    expect(requests[0].options.body).toBe('binary content')
    expect(new URL(requests[0].url).searchParams.has('SourceURL')).toBe(false)
  })

  it('strips signed URLs from a real FetchError with a nonempty Response.url', async () => {
    const server = createServer((request, response) => {
      response.writeHead(502, { 'Content-Type': 'application/vnd.api+json' })
      response.end(
        JSON.stringify({ errors: [{ title: sourceUrl, detail: sourceUrl }] })
      )
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const client = new CozyClient({
      uri: `http://127.0.0.1:${server.address().port}`,
      token: 'test-token',
      schema
    })
    global.fetch = fetch
    try {
      let rawError = null
      try {
        await client.create('io.cozy.files', {
          type: 'file',
          sourceURL: sourceUrl,
          dirId: 'folder',
          name: config.name
        })
      } catch (error) {
        rawError = error
      }
      expect(new URL(rawError.response.url).searchParams.get('SourceURL')).toBe(
        sourceUrl
      )
      expect(receivedError(rawError)).toEqual({
        name: 'Error',
        message: 'URL upload failed (HTTP 502)',
        status: 502
      })
      expect(JSON.stringify(receivedError(rawError))).not.toContain('secret')
    } finally {
      await new Promise((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      )
    }
  })
})
