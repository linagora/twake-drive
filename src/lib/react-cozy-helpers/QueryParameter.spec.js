import getQueryParameter from './QueryParameter'

describe('getQueryParameter', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('should decode URI string', () => {
    window.history.replaceState({}, '', '?username=N%C3%B6%C3%A9')
    const { username } = getQueryParameter()

    expect(username).toBe('Nöé')
  })

  it('should keep string with accent unchanged', () => {
    window.history.replaceState({}, '', '?username=N%C3%B6%C3%A9')
    const { username } = getQueryParameter()

    expect(username).toBe('Nöé')
  })

  it('should not modify string with special characters', () => {
    window.history.replaceState(
      {},
      '',
      '?sharecode=eyJ_hbGc%2FiOiJ.S3mJz-B90iu.8D0%23JwCK'
    )
    const { sharecode } = getQueryParameter()

    expect(sharecode).toBe('eyJ_hbGc/iOiJ.S3mJz-B90iu.8D0#JwCK')
  })
})
