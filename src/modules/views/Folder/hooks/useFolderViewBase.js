import { useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'

import { useClient } from 'cozy-client'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { useModalContext } from '@/lib/ModalContext'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

/**
 * Bundles the hook calls every folder-style view repeats verbatim: router,
 * breakpoints, i18n, cozy-client, modal stack, redux dispatch, alerts, and
 * selection context. Returned as a single `base` object so views read with
 * `base.t`, `base.navigate`, etc. and so `...base` can spread into
 * `actionsOptions` without restating each key.
 */
export const useFolderViewBase = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMobile } = useBreakpoints()
  const { t, lang } = useI18n()
  const client = useClient()
  const { pushModal, popModal } = useModalContext()
  const dispatch = useDispatch()
  const { showAlert } = useAlert()
  const { isSelectionBarVisible, toggleSelectAllItems, isSelectAll } =
    useSelectionContext()

  return {
    navigate,
    pathname,
    isMobile,
    t,
    lang,
    client,
    pushModal,
    popModal,
    dispatch,
    showAlert,
    isSelectionBarVisible,
    toggleSelectAllItems,
    isSelectAll
  }
}
