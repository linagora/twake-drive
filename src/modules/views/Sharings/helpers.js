export const buildSharingsActionsOptions = ({
  base,
  nativeSharing,
  sharingContext,
  filteredResult
}) => {
  const { allLoaded, refresh, isOwner } = sharingContext

  return {
    ...base,
    ...nativeSharing,
    refresh,
    isOwner,
    hasWriteAccess: true,
    canMove: true,
    isPublic: false,
    shouldHideIfSharedDriveRecipient: true,
    allLoaded,
    // Select All has to match the rendered list, not the raw query: the
    // rendered list excludes the magic shared-drives dir when the feature
    // flags are off and substitutes transformed shortcut entries when on.
    selectAll: () => base.toggleSelectAllItems(filteredResult.data)
  }
}
