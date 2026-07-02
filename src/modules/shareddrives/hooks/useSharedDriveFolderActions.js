import { useMemo } from 'react'

import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'

import {
  download,
  hr,
  infos,
  rename,
  share,
  trash,
  versions
} from '@/modules/actions'
import { duplicateTo } from '@/modules/actions/components/duplicateTo'
import { moveTo } from '@/modules/actions/components/moveTo'
import { personalizeFolder } from '@/modules/actions/components/personalizeFolder'

const ACTION_LIST = [
  share,
  download,
  hr,
  rename,
  moveTo,
  duplicateTo,
  personalizeFolder,
  infos,
  hr,
  versions,
  hr,
  trash
]

export const useSharedDriveFolderActions = ({
  client,
  t,
  vaultClient,
  pathname,
  isOwner,
  isMobile,
  driveId,
  canWriteToCurrentFolder,
  byDocId,
  dispatch,
  navigate,
  showAlert,
  pushModal,
  popModal,
  refresh,
  allLoaded
}) =>
  useMemo(
    () =>
      makeActions(ACTION_LIST, {
        client,
        t,
        vaultClient,
        pathname,
        isOwner,
        isMobile,
        driveId,
        hasWriteAccess: canWriteToCurrentFolder,
        byDocId,
        dispatch,
        canMove: canWriteToCurrentFolder,
        canDuplicate: canWriteToCurrentFolder,
        navigate,
        showAlert,
        pushModal,
        popModal,
        refresh,
        allLoaded
      }),
    [
      client,
      t,
      vaultClient,
      pathname,
      isOwner,
      isMobile,
      driveId,
      canWriteToCurrentFolder,
      byDocId,
      dispatch,
      navigate,
      showAlert,
      pushModal,
      popModal,
      refresh,
      allLoaded
    ]
  )
