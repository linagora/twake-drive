import { USERS, stackExec } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import {
  fetchFileBytes,
  fetchFileMetadataByPath,
  makeCozyClient,
  trashById
} from '../helpers/stack'
import {
  startUrlUploadSource,
  type UrlUploadSource
} from '../helpers/urlUploadSource'
import { UrlUploadIntentPage } from '../pages/UrlUploadIntentPage'

const content = Buffer.from([0, 255, 128, 42])
let source: UrlUploadSource

test.beforeAll(async () => {
  source = await startUrlUploadSource()
})

test.afterAll(async () => {
  await source.close()
})

test('Stack imports CORS-free bytes through hidden intents and keep-both never overwrites', async ({
  alicePage
}) => {
  const caller = new UrlUploadIntentPage(alicePage)
  await caller.open()
  await alicePage
    .context()
    .addCookies([
      { name: 'source-secret', value: 'must-not-forward', url: source.url }
    ])
  const browserSourceRequests: string[] = []
  const creationBodies: (string | null)[] = []
  alicePage.on('request', request => {
    if (new URL(request.url()).origin === source.url)
      browserSourceRequests.push(request.method())
    if (
      request.method() === 'POST' &&
      new URL(request.url()).searchParams.has('SourceURL')
    )
      creationBodies.push(request.postData())
  })
  const token = stackExec(
    'instances',
    'token-app',
    USERS.alice.instance,
    'drive'
  )
  const name = `url-upload-${stamp()}.bin`
  const created: string[] = []
  try {
    for (const folderId of [
      'io.cozy.files.root-dir',
      'io.cozy.apps/mail',
      'io.cozy.apps/notes'
    ]) {
      const first = await caller.upload({
        url: `${source.url}/bytes?signature=test%2Bvalue%25`,
        folderId,
        name
      })
      expect(first.error).toBeUndefined()
      expect(first.document).toMatchObject({
        name,
        mime: 'application/octet-stream'
      })
      expect(Number(first.document!.size)).toBe(content.length)
      created.push(first.document!._id)
      expect(await caller.inspectAndClose()).toEqual({
        hidden: true,
        content: ''
      })
      const second = await caller.upload({
        url: `${source.url}/bytes`,
        folderId,
        name
      })
      expect(second.error).toBeUndefined()
      created.push(second.document!._id)
      expect(second.document!.dir_id).toBe(first.document!.dir_id)
      expect(second.document!.name).toBe(name.replace('.bin', ' (1).bin'))
      expect(await caller.inspectAndClose()).toEqual({
        hidden: true,
        content: ''
      })
    }
    const chunked = await caller.upload({
      url: `${source.url}/chunked`,
      folderId: 'io.cozy.files.root-dir',
      name: `chunked-${stamp()}.bin`
    })
    expect(chunked.error).toBeUndefined()
    expect(Number(chunked.document!.size)).toBe(content.length)
    created.push(chunked.document!._id)
    expect(await caller.inspectAndClose()).toEqual({
      hidden: true,
      content: ''
    })
    const client = makeCozyClient(USERS.alice.instance, token)
    const { data: directory } = await client.create('io.cozy.files', {
      type: 'directory',
      dirId: 'io.cozy.files.root-dir',
      name: `folder-collision-${stamp()}.bin`
    })
    created.push(directory._id)
    const collision = await caller.upload({
      url: `${source.url}/redirect`,
      folderId: 'io.cozy.files.root-dir',
      name: directory.name
    })
    expect(collision.error).toBeUndefined()
    created.push(collision.document!._id)
    expect(collision.document!.name).toBe(
      directory.name.replace('.bin', ' (1).bin')
    )
    expect(await caller.inspectAndClose()).toEqual({
      hidden: true,
      content: ''
    })
    for (const id of created.filter(id => id !== directory._id)) {
      expect(
        Buffer.from(
          await fetchFileBytes({ instance: USERS.alice.instance, fileId: id })
        )
      ).toEqual(content)
    }
    expect(browserSourceRequests).toEqual([])
    expect(creationBodies.length).toBeGreaterThanOrEqual(7)
    expect(creationBodies.every(body => body === null || body === '')).toBe(
      true
    )
    const requests = source.getRequests()
    expect(
      requests.filter(request => request.path === '/bytes').length
    ).toBeGreaterThan(7)
    expect(
      requests.filter(request => request.hasExpectedSignature)
    ).toHaveLength(3)
    for (const request of requests) {
      expect(request.cookie).toBe(null)
      expect(request.authorization).toBe(null)
      expect(request.userAgent).toContain('Go-http-client')
    }
  } finally {
    for (const id of created.reverse())
      await trashById(USERS.alice.instance, id)
  }
})

test('manual caller displays actual metadata and a sanitized source failure', async ({
  alicePage
}) => {
  const caller = new UrlUploadIntentPage(alicePage)
  await caller.openManual()
  await caller.submitManual(`${source.url}/bytes`, `manual-${stamp()}.bin`)
  await expect.poll(() => caller.getManualResult()).toContain('"document"')
  const { document } = JSON.parse(await caller.getManualResult())
  try {
    expect(Number(document.size)).toBe(content.length)
    await caller.submitManual(
      `${source.url}/missing?signature=must-not-leak`,
      `failed-${stamp()}.bin`
    )
    await expect
      .poll(() => caller.getManualResult())
      .toContain('URL upload failed (HTTP 502)')
    expect(await caller.getManualResult()).not.toContain('must-not-leak')
  } finally {
    await trashById(USERS.alice.instance, document._id)
  }
})

test('Stack checks write permission before fetching the source', async () => {
  const token = stackExec(
    'instances',
    'token-cli',
    USERS.alice.instance,
    'io.cozy.files:GET'
  )
  const before = source.getRequests().length
  const name = `denied-${stamp()}.bin`
  await expect(
    makeCozyClient(USERS.alice.instance, token).create('io.cozy.files', {
      type: 'file',
      sourceURL: `${source.url}/denied`,
      dirId: 'io.cozy.files.root-dir',
      name
    })
  ).rejects.toMatchObject({ status: 403 })
  expect(source.getRequests()).toHaveLength(before)
  const absent = await fetchFileMetadataByPath({
    instance: USERS.alice.instance,
    path: `/${name}`
  })
  expect(absent.status).toBe(404)
})

test('source failures cross the iframe as sanitized HTTP errors, not temporary limit codes', async ({
  alicePage
}) => {
  const caller = new UrlUploadIntentPage(alicePage)
  await caller.open()
  const observations: {
    path: string
    status: number
    metadataStatus: number
  }[] = []
  for (const path of [
    '/missing',
    '/no-content',
    '/slow-headers',
    '/slow-body',
    '/link-local'
  ]) {
    const name = `failed-${stamp()}.bin`
    const result = await caller.upload({
      url:
        path === '/link-local'
          ? 'http://169.254.1.1/file?signature=must-not-leak'
          : `${source.url}${path}?signature=must-not-leak`,
      folderId: 'io.cozy.files.root-dir',
      name
    })
    expect(result.document).toBeUndefined()
    expect(result.error?.status).toBeGreaterThanOrEqual(400)
    if (path !== '/slow-body') expect(result.error?.status).toBe(502)
    expect(result.error?.message).toBe(
      `URL upload failed (HTTP ${result.error?.status})`
    )
    expect(JSON.stringify(result.error)).not.toContain('must-not-leak')
    expect(Object.keys(result.error!).sort()).toEqual([
      'message',
      'name',
      'status'
    ])
    expect(await caller.inspectAndClose()).toEqual({
      hidden: true,
      content: ''
    })
    const metadata = await fetchFileMetadataByPath({
      instance: USERS.alice.instance,
      path: `/${name}`
    })
    observations.push({
      path,
      status: result.error!.status!,
      metadataStatus: metadata.status
    })
    if (metadata.data) {
      const data = metadata.data
      try {
        // An error during body copying is not a guarantee of server rollback.
        expect(path).toBe('/slow-body')
        expect(data.attributes).toMatchObject({ name, type: 'file' })
        expect(
          await fetchFileBytes({
            instance: USERS.alice.instance,
            fileId: data.id
          })
        ).toHaveLength(0)
      } finally {
        await trashById(USERS.alice.instance, data.id)
      }
    } else {
      expect(metadata.status).toBe(404)
    }
  }
  await test.info().attach('server-source-failure-statuses', {
    body: JSON.stringify(observations),
    contentType: 'application/json'
  })
})
