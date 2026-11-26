import { getMoveIntentConfig } from './initialization'

const intentWith = data => ({ attributes: { data } })

describe('getMoveIntentConfig', () => {
  it('reads the confirm label of the caller', () => {
    expect(
      getMoveIntentConfig(
        intentWith({ fileIds: ['f1'], confirmLabel: 'Save to' })
      ).confirmLabel
    ).toBe('Save to')
  })

  it.each([undefined, '', '  ', 42, 'a'.repeat(257)])(
    'keeps the label of Drive for %p',
    confirmLabel => {
      expect(
        getMoveIntentConfig(intentWith({ fileIds: ['f1'], confirmLabel }))
          .confirmLabel
      ).toBe(null)
    }
  )
})
