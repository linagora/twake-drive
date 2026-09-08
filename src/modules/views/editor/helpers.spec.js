import { shouldBeOpenedOnOtherInstance } from '@/modules/views/editor/helpers'

describe('shouldBeOpenedOnOtherInstance', () => {
  it('should return true if current instance is different from document instance', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'alice.cozy.localhost:8080'
            }
          }
        },
        'http://bob.cozy.localhost:8080'
      )
    ).toBe(true)
  })

  it('should return true if current instance is different from document instance without port', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'alice.cozy.localhost'
            }
          }
        },
        'http://bob.cozy.localhost'
      )
    ).toBe(true)
  })

  it('should return true if current instance is different from document instance with org instance', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'myorgc81729.example.com:8080'
            }
          }
        },
        ' http://myusermyorgc81729.example.com:8080'
      )
    ).toBe(true)
  })

  it('should return false if current instance is equal to document instance', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'alice.cozy.localhost:8080'
            }
          }
        },
        'http://alice.cozy.localhost:8080'
      )
    ).toBe(false)
  })

  it('should return false if current instance is equal to document instance without port', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        {
          data: {
            attributes: {
              instance: 'alice.cozy.localhost'
            }
          }
        },
        'http://alice.cozy.localhost'
      )
    ).toBe(false)
  })

  it('should return false without a current instance uri', () => {
    expect(
      shouldBeOpenedOnOtherInstance(
        { data: { attributes: { instance: 'alice.cozy.localhost' } } },
        undefined
      )
    ).toBe(false)
  })
})
