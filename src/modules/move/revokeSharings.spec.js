import { revokeSharingsForEntries } from '@/modules/move/revokeSharings'

const makeContext = ({
  owned = [],
  shared = [],
  revokeAllRecipients,
  revokeSelf
} = {}) => ({
  byDocId: shared.reduce((acc, id) => ({ ...acc, [id]: {} }), {}),
  isOwner: id => owned.includes(id),
  revokeAllRecipients: revokeAllRecipients ?? jest.fn().mockResolvedValue(),
  revokeSelf: revokeSelf ?? jest.fn().mockResolvedValue()
})

describe('revokeSharingsForEntries', () => {
  it('should revoke all recipients when the user owns the sharing', async () => {
    const revokeAllRecipients = jest.fn().mockResolvedValue()
    const context = makeContext({
      owned: ['a'],
      shared: ['a'],
      revokeAllRecipients
    })

    await revokeSharingsForEntries([{ _id: 'a' }], context)

    expect(revokeAllRecipients).toHaveBeenCalledWith({ _id: 'a' })
    expect(context.revokeSelf).not.toHaveBeenCalled()
  })

  it('should revoke self when the user is a recipient', async () => {
    const revokeSelf = jest.fn().mockResolvedValue()
    const context = makeContext({ owned: [], shared: ['a'], revokeSelf })

    await revokeSharingsForEntries([{ _id: 'a' }], context)

    expect(revokeSelf).toHaveBeenCalledWith({ _id: 'a' })
    expect(context.revokeAllRecipients).not.toHaveBeenCalled()
  })

  it('should ignore entries that are not shared', async () => {
    const context = makeContext({ owned: ['a'], shared: ['a'] })

    await revokeSharingsForEntries(
      [{ _id: 'a' }, { _id: 'not-shared' }],
      context
    )

    expect(context.revokeAllRecipients).toHaveBeenCalledTimes(1)
  })

  it('should wait for every revocation before resolving', async () => {
    let resolveSecond
    const pending = new Promise(resolve => {
      resolveSecond = resolve
    })
    const revokeAllRecipients = jest
      .fn()
      .mockResolvedValueOnce()
      .mockReturnValueOnce(pending)
    const context = makeContext({
      owned: ['a', 'b'],
      shared: ['a', 'b'],
      revokeAllRecipients
    })

    let settled = false
    const promise = revokeSharingsForEntries(
      [{ _id: 'a' }, { _id: 'b' }],
      context
    ).then(() => {
      settled = true
      return null
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    resolveSecond()
    await promise
    expect(settled).toBe(true)
  })

  it('should reject when a revocation fails, so the caller can abort the move', async () => {
    const context = makeContext({
      owned: ['a'],
      shared: ['a'],
      revokeAllRecipients: jest.fn().mockRejectedValue(new Error('nope'))
    })

    await expect(
      revokeSharingsForEntries([{ _id: 'a' }], context)
    ).rejects.toThrow('nope')
  })

  it('should do nothing without a sharing context', async () => {
    await expect(
      revokeSharingsForEntries([{ _id: 'a' }], null)
    ).resolves.toBeUndefined()
  })
})
