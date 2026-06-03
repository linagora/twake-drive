/**
 * Resolve whether the local viewer should hide Drive's own sharing affordances
 * (the "Share" button in the toolbar, the SharingButton in the footer, and
 * Drive's share entry in the MoreMenu).
 *
 * The cozy-viewer contract for read-only sharing is
 * `viewerProps.panel.sharing.disabled`. We honour that flag and also accept a
 * local `viewerProps.sharingActions.disabled` for callers that want to opt
 * out of the local UI without going through the panel configuration. When
 * neither is set, sharing is allowed.
 */
export const resolveShouldHideSharingActions = viewerProps => {
  const panelSharingDisabled = viewerProps?.panel?.sharing?.disabled
  const sharingActionsDisabled = viewerProps?.sharingActions?.disabled

  return sharingActionsDisabled ?? Boolean(panelSharingDisabled)
}
