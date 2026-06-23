import { resolveShouldHideSharingActions } from './shouldHideSharingActions'

describe('resolveShouldHideSharingActions', () => {
  it.each`
    label                                             | viewerProps                                                                        | expected
    ${'undefined viewerProps'}                        | ${undefined}                                                                       | ${false}
    ${'empty viewerProps'}                            | ${{}}                                                                              | ${false}
    ${'panel.sharing.disabled true'}                  | ${{ panel: { sharing: { disabled: true } } }}                                      | ${true}
    ${'panel.sharing.disabled false'}                 | ${{ panel: { sharing: { disabled: false } } }}                                     | ${false}
    ${'sharingActions.disabled true'}                 | ${{ sharingActions: { disabled: true } }}                                          | ${true}
    ${'sharingActions.disabled false'}                | ${{ sharingActions: { disabled: false } }}                                         | ${false}
    ${'sharingActions.disabled wins over panel flag'} | ${{ panel: { sharing: { disabled: true } }, sharingActions: { disabled: false } }} | ${false}
  `('returns $expected for $label', ({ viewerProps, expected }) => {
    expect(resolveShouldHideSharingActions(viewerProps)).toBe(expected)
  })
})
