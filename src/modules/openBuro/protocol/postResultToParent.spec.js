import {
  postReady,
  postDone,
  postError,
  postCancelled
} from './postResultToParent'

describe('postResultToParent', () => {
  const clientUrl = 'https://mail.alice.cozy'
  const id = 'abc-123'

  describe('iframe mode (no window.opener)', () => {
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

  describe('popup mode (window.opener set)', () => {
    let openerPostMessage
    let parentPostMessageSpy
    let closeSpy

    beforeEach(() => {
      openerPostMessage = jest.fn()
      Object.defineProperty(window, 'opener', {
        configurable: true,
        writable: true,
        value: { postMessage: openerPostMessage }
      })
      parentPostMessageSpy = jest
        .spyOn(window.parent, 'postMessage')
        .mockImplementation(() => {})
      closeSpy = jest.spyOn(window, 'close').mockImplementation(() => {})
    })

    afterEach(() => {
      parentPostMessageSpy.mockRestore()
      closeSpy.mockRestore()
      delete window.opener
    })

    it('routes postDone to window.opener and closes the popup', () => {
      const results = [{ name: 'photo.jpg', mimeType: 'image/jpeg', size: 123 }]
      postDone({ clientUrl, id, results })
      expect(openerPostMessage).toHaveBeenCalledWith(
        { status: 'done', id, results },
        clientUrl
      )
      expect(parentPostMessageSpy).not.toHaveBeenCalled()
      expect(closeSpy).toHaveBeenCalled()
    })

    it('routes postError to window.opener and closes the popup', () => {
      postError({ clientUrl, id, message: 'resolution-failed' })
      expect(openerPostMessage).toHaveBeenCalledWith(
        { status: 'error', id, message: 'resolution-failed' },
        clientUrl
      )
      expect(closeSpy).toHaveBeenCalled()
    })

    it('routes postCancelled to window.opener and closes the popup', () => {
      postCancelled({ clientUrl, id })
      expect(openerPostMessage).toHaveBeenCalledWith(
        { status: 'error', id, message: 'cancelled' },
        clientUrl
      )
      expect(closeSpy).toHaveBeenCalled()
    })

    it('routes postReady to window.opener but does NOT close the popup', () => {
      postReady({ clientUrl, id })
      expect(openerPostMessage).toHaveBeenCalledWith(
        { type: 'READY', id },
        clientUrl
      )
      expect(closeSpy).not.toHaveBeenCalled()
    })
  })
})
