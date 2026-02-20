import cx from 'classnames'
import { filesize } from 'filesize'
import get from 'lodash/get'
import PropTypes from 'prop-types'
import React, { useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useI18n } from 'twake-i18n'

import { isDirectory } from 'cozy-client/dist/models/file'
import Card from 'cozy-ui/transpiled/react/Card'
import { TableRow, TableCell } from 'cozy-ui/transpiled/react/deprecated/Table'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import {
  SelectBox,
  FileName,
  LastUpdate,
  Size,
  Status,
  FileAction,
  SharingShortcutBadge
} from './cells'

import styles from '@/styles/filelist.styl'

import { useClipboardContext } from '@/contexts/ClipboardProvider'
import { useShell } from '@/hooks/useShell'
import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import { ActionMenuWithHeader } from '@/modules/actionmenu/ActionMenuWithHeader'
import { getContextMenuActions } from '@/modules/actions/helpers'
import { extraColumnsPropTypes } from '@/modules/certifications'
import {
  isRenaming as isRenamingReducer,
  getRenamingFile
} from '@/modules/drive/rename'
import FileOpener from '@/modules/filelist/FileOpener'
import FileThumbnail from '@/modules/filelist/icons/FileThumbnail'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const FileWrapper = ({ children, viewType, className, onContextMenu }) =>
  viewType === 'list' ? (
    <TableRow className={className} onContextMenu={onContextMenu}>
      {children}
    </TableRow>
  ) : (
    <Card className={className} onContextMenu={onContextMenu}>
      {children}
    </Card>
  )

const ThumbnailWrapper = ({ children, viewType, className }) =>
  viewType === 'list' ? (
    <TableCell className={className}>{children}</TableCell>
  ) : (
    <div className={className}>{children}</div>
  )

const File = ({
  t,
  f,
  attributes,
  actions,
  isRenaming,
  withSelectionCheckbox,
  withFilePath,
  disabled,
  styleDisabled,
  refreshFolderContent,
  isInSyncFromSharing,
  extraColumns,
  breakpoints: { isExtraLarge, isMobile },
  disableSelection = false,
  canInteractWith,
  onContextMenu,
  onToggleSelect
}) => {
  const { viewType } = useViewSwitcherContext()
  const { runsInShell, selectedFile } = useShell()

  const [actionMenuVisible, setActionMenuVisible] = useState(false)
  const filerowMenuToggleRef = useRef()
  const { toggleSelectedItem, isItemSelected } = useSelectionContext()

  const { isItemCut } = useClipboardContext()

  const toggleActionMenu = () => {
    if (actionMenuVisible) return hideActionMenu()
    else showActionMenu()
  }
  const showActionMenu = () => {
    setActionMenuVisible(true)
  }

  const hideActionMenu = () => {
    setActionMenuVisible(false)
  }

  const toggle = e => {
    toggleSelectedItem(attributes)
    onToggleSelect?.(attributes?._id, e)
  }

  const isRowDisabledOrInSyncFromSharing = disabled || isInSyncFromSharing
  const isCut = isItemCut(attributes._id)

  const selected = isItemSelected(attributes._id)
  const selectedInShell =
    runsInShell && selectedFile && selectedFile === attributes._id

  const filContentRowSelected = cx(styles['fil-content-row'], {
    [styles['fil-content-row-selected']]: selected || selectedInShell,
    [styles['fil-content-row-actioned']]: actionMenuVisible,
    [styles['fil-content-row-disabled']]: styleDisabled || isCut
  })

  const filContentColumnSelected = cx(styles['fil-content-column'], {
    [styles['fil-content-column-selected']]: selected,
    [styles['fil-content-column-actioned']]: actionMenuVisible,
    [styles['fil-content-column-disabled']]: styleDisabled || isCut
  })

  const formattedSize =
    !isDirectory(attributes) && attributes.size
      ? filesize(attributes.size, { base: 10 })
      : undefined

  const updatedAt = attributes.updated_at || attributes.created_at
  const formattedUpdatedAt = f(
    updatedAt,
    isExtraLarge
      ? t('table.row_update_format_full')
      : t('table.row_update_format')
  )

  // We don't allow any action on shared drives and trash
  // because they are magic folder created by the stack
  let canInteractWithFile =
    attributes._id &&
    attributes._id !== 'io.cozy.files.shared-drives-dir' &&
    !attributes._id.endsWith('.trash-dir')
  if (typeof canInteractWith === 'function') {
    canInteractWithFile &&= canInteractWith(attributes)
  }

  const contextMenuActions = getContextMenuActions(actions)

  return (
    <FileWrapper
      viewType={viewType}
      className={
        viewType === 'list' ? filContentRowSelected : filContentColumnSelected
      }
      onContextMenu={onContextMenu}
    >
      <SelectBox
        viewType={viewType}
        withSelectionCheckbox={
          withSelectionCheckbox && contextMenuActions?.length > 0
        }
        selected={selected}
        onClick={toggle}
        disabled={
          !canInteractWithFile ||
          isRowDisabledOrInSyncFromSharing ||
          disableSelection ||
          isCut
        }
      />
      <FileOpener
        file={attributes}
        disabled={
          isRowDisabledOrInSyncFromSharing || isCut || actionMenuVisible
        }
        toggle={toggle}
        isRenaming={isRenaming}
        onInteractWithFile={onToggleSelect}
      >
        <ThumbnailWrapper
          viewType={viewType}
          className={cx(
            styles['fil-content-cell'],
            styles['fil-file-thumbnail'],
            {
              'u-pl-0': !isMobile,
              [styles['fil-content-grid-view']]: viewType === 'grid',
              'u-ml-half':
                !canInteractWithFile ||
                isRowDisabledOrInSyncFromSharing ||
                disableSelection
            }
          )}
        >
          <FileThumbnail
            file={attributes}
            size={viewType === 'grid' ? 96 : undefined}
            isInSyncFromSharing={isInSyncFromSharing}
            showSharedBadge={isMobile}
            componentsProps={{
              sharedBadge: {
                className:
                  styles[
                    `fil-content-shared${viewType === 'grid' ? '-grid' : ''}`
                  ]
              }
            }}
          />
          {viewType === 'grid' && (
            <Status
              file={attributes}
              disabled={isRowDisabledOrInSyncFromSharing}
              isInSyncFromSharing={isInSyncFromSharing}
            />
          )}
        </ThumbnailWrapper>
        <FileName
          attributes={attributes}
          isRenaming={isRenaming}
          interactive={!isRowDisabledOrInSyncFromSharing}
          withFilePath={withFilePath}
          isMobile={isMobile}
          formattedSize={formattedSize}
          formattedUpdatedAt={formattedUpdatedAt}
          refreshFolderContent={refreshFolderContent}
          isInSyncFromSharing={isInSyncFromSharing}
        />
        {viewType === 'list' && (
          <>
            <LastUpdate
              date={updatedAt}
              formatted={
                isDirectory(attributes) ? undefined : formattedUpdatedAt
              }
            />
            <Size filesize={formattedSize} />
            {extraColumns &&
              extraColumns.map(column => (
                <column.CellComponent key={column.label} file={attributes} />
              ))}
            <Status
              file={attributes}
              disabled={isRowDisabledOrInSyncFromSharing}
              isInSyncFromSharing={isInSyncFromSharing}
            />
          </>
        )}
        <SharingShortcutBadge file={attributes} />
      </FileOpener>
      {contextMenuActions && canInteractWithFile && (
        <FileAction
          t={t}
          ref={filerowMenuToggleRef}
          disabled={isRowDisabledOrInSyncFromSharing || isCut}
          isInSyncFromSharing={isInSyncFromSharing}
          onClick={() => {
            toggleActionMenu()
          }}
        />
      )}
      {contextMenuActions && actionMenuVisible && (
        <ActionMenuWithHeader
          file={attributes}
          anchorElRef={filerowMenuToggleRef}
          actions={contextMenuActions}
          onClose={hideActionMenu}
        />
      )}
    </FileWrapper>
  )
}

File.propTypes = {
  t: PropTypes.func,
  f: PropTypes.func,
  attributes: PropTypes.object.isRequired,
  actions: PropTypes.array,
  isRenaming: PropTypes.bool,
  withSelectionCheckbox: PropTypes.bool.isRequired,
  withFilePath: PropTypes.bool,
  /** Disables row actions */
  disabled: PropTypes.bool,
  /** Apply disabled style on row */
  styleDisabled: PropTypes.bool,
  breakpoints: PropTypes.object.isRequired,
  refreshFolderContent: PropTypes.func,
  isInSyncFromSharing: PropTypes.bool,
  extraColumns: extraColumnsPropTypes,
  /** Disables the ability to select a file */
  disableSelection: PropTypes.bool,
  onToggleSelect: PropTypes.func
}

export const DumbFile = props => {
  const { t, f } = useI18n()
  const breakpoints = useBreakpoints()

  return <File t={t} f={f} breakpoints={breakpoints} {...props} />
}

export const FileWithSelection = props => {
  const isRenaming = useSelector(
    state =>
      isRenamingReducer(state) &&
      get(getRenamingFile(state), '_id') === props.attributes._id
  )

  return <DumbFile isRenaming={isRenaming} {...props} />
}
