/**
 * Revokes the sharings of the given entries.
 *
 * Moving a shared folder into another shared folder is offered to the user as
 * "stop sharing". Both the move modal and the cut/paste path go through here,
 * so that the wording matches what actually happens, and so that a move never
 * proceeds on top of a revocation that failed.
 *
 * @param {Array<object>} entries - the entries being moved
 * @param {object} sharingContext - the cozy-sharing context
 * @returns {Promise<void>} resolves once every sharing is revoked, rejects on
 * the first failure
 */
export const revokeSharingsForEntries = async (entries, sharingContext) => {
  const { byDocId, isOwner, revokeAllRecipients, revokeSelf } =
    sharingContext ?? {}

  if (!byDocId) return

  const sharedEntries = entries.filter(
    entry => byDocId[entry._id] !== undefined
  )

  // Promise.all, not forEach: the move must wait for every revocation, and a
  // rejection has to reach the caller instead of being swallowed.
  await Promise.all(
    sharedEntries.map(entry =>
      isOwner(entry._id) ? revokeAllRecipients(entry) : revokeSelf(entry)
    )
  )
}
