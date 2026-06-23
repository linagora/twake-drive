import React, { useContext } from 'react'
import { useLocation } from 'react-router-dom'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useRightClick } from '@/components/RightClick/RightClickProvider'
import { useDisplayedFolder } from '@/hooks'
import useCurrentFolderWriteAccess from '@/hooks/useCurrentFolderWriteAccess'
import AddMenuProvider, {
  AddMenuContext
} from '@/modules/drive/AddMenu/AddMenuProvider'

const AddMenu = ({ children, isFolderReadOnly, ...props }) => {
  const { isDesktop } = useBreakpoints()
  const { onOpen } = useRightClick()
  const { handleToggle, handleOfflineClick, isOffline } =
    useContext(AddMenuContext)
  const location = useLocation()

  const isInViewerMode = location.pathname.includes('/file/')

  if (!children) return null
  if (!isDesktop || isInViewerMode || isFolderReadOnly)
    return React.Children.map(children, child =>
      React.isValidElement(child)
        ? React.cloneElement(child, {
            ...props
          })
        : null
    )

  return React.Children.map(children, child =>
    React.isValidElement(child)
      ? React.cloneElement(child, {
          ...props,
          onContextMenu: ev => {
            if (isOffline) {
              handleOfflineClick()
            } else {
              onOpen(ev, `AddMenu`)
              handleToggle()
            }
          }
        })
      : null
  )
}

const RightClickAddMenu = ({ children, ...props }) => {
  const { isOpen, position } = useRightClick()
  const { displayedFolder } = useDisplayedFolder()
  const location = useLocation()

  const isFolderReadOnly = !useCurrentFolderWriteAccess()

  const isInViewerMode = location.pathname.includes('/file/')
  const shouldShowAddMenu = isOpen('AddMenu') && !isInViewerMode

  return (
    <AddMenuProvider
      canCreateFolder={true}
      canUpload={true}
      disabled={false}
      displayedFolder={displayedFolder}
      isSelectionBarVisible={false}
      isReadOnly={isFolderReadOnly}
      componentsProps={{
        AddMenu: {
          anchorReference: 'anchorPosition',
          anchorPosition: shouldShowAddMenu
            ? { top: position.mouseY, left: position.mouseX }
            : undefined
        }
      }}
    >
      <AddMenu {...props} isFolderReadOnly={isFolderReadOnly}>
        {children}
      </AddMenu>
    </AddMenuProvider>
  )
}

export default RightClickAddMenu
