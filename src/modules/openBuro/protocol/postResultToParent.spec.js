import {
  postReady,
  postDone,
  postError,
  postCancelled
} from './postResultToParent'

describe('postResultToParent', () => {
  const clientUrl = 'https://mail.alice.cozy'
  const id = 'abc-123'
  let postMessageSpy

  beforeEach(() => {
    postMessageSpy = jest
      .spyOn(window.parent, 'postMessage')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    postMessageSpy.mockRestore()
  })

  it('posts a READY message with the handler id', () => {
    postReady({ clientUrl, id })
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'READY', id },
      clientUrl
    )
  })

  it('posts a done result with the given results array', () => {
    const results = [{ name: 'photo.jpg', mimeType: 'image/jpeg', size: 123 }]
    postDone({ clientUrl, id, results })
    expect(postMessageSpy).toHaveBeenCalledWith(
      { status: 'done', id, results },
      clientUrl
    )
  })

  it('posts an error with the given message', () => {
    postError({ clientUrl, id, message: 'resolution-failed' })
    expect(postMessageSpy).toHaveBeenCalledWith(
      { status: 'error', id, message: 'resolution-failed' },
      clientUrl
    )
  })

  it('posts a cancelled error', () => {
    postCancelled({ clientUrl, id })
    expect(postMessageSpy).toHaveBeenCalledWith(
      { status: 'error', id, message: 'cancelled' },
      clientUrl
    )
  })

  it('never uses "*" as targetOrigin', () => {
    postDone({ clientUrl, id, results: [] })
    postError({ clientUrl, id, message: 'resolution-failed' })
    postCancelled({ clientUrl, id })
    postReady({ clientUrl, id })

    for (const call of postMessageSpy.mock.calls) {
      expect(call[1]).not.toBe('*')
      expect(call[1]).toBe(clientUrl)
    }
  })
})
