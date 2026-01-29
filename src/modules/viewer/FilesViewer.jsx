import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { RemoveScroll } from 'react-remove-scroll'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { Q, useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { useVaultClient } from 'cozy-keys-lib'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Viewer, {
  FooterActionButtons,
  ForwardOrDownloadButton,
  ToolbarButtons,
  SharingButton
} from 'cozy-viewer'

import { ensureFileHasPath } from '@/components/FilesRealTimeQueries'
import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import RightClickFileMenu from '@/components/RightClick/RightClickFileMenu'
import { useCurrentFileId } from '@/hooks'
import { useMoreMenuActions } from '@/hooks/useMoreMenuActions'
import {
  isEncryptedFile,
  getEncryptionKeyFromDirId,
  getDecryptedFileURL
} from '@/lib/encryption'
import logger from '@/lib/logger'
import { navigateToModal } from '@/modules/actions/helpers'
import Fallback from '@/modules/viewer/Fallback'
import MoreMenu from '@/modules/viewer/MoreMenu'
import {
  isOfficeEnabled,
  makeOnlyOfficeFileRoute
} from '@/modules/views/OnlyOffice/helpers'

/**
 * Shows a set of files through cozy-ui's Viewer
 *
 * - Re-uses the cozy-client's Query for the current directory files
 *   with the same sort order.
 * - If the file to show is not present in the query results, will call
 *   fetchMore() on the query
 */
const FilesViewer = ({ filesQuery, files, onClose, onChange, viewerProps }) => {
  const [currentFile, setCurrentFile] = useState(null)
  const [currentDecryptedFileURL, setCurrentDecryptedFileURL] = useState(null)
  const [fetchingMore, setFetchingMore] = useState(false)
  const { isDesktop } = useBreakpoints()
  const fileId = useCurrentFileId()
  const client = useClient()
  const { t } = useI18n()
  const vaultClient = useVaultClient()
  const navigate = useNavigate()
  const { driveId } = useParams()

  const handleOnClose = useCallback(() => {
    if (onClose) {
      onClose()
    }
  }, [onClose])

  const handleOnChange = useCallback(
    nextFile => {
      if (onChange) {
        onChange(nextFile.id)
      }
    },
    [onChange]
  )

  const currentIndex = useMemo(() => {
    return files.findIndex(f => f.id === fileId)
  }, [files, fileId])
  const hasCurrentIndex = useMemo(() => currentIndex != -1, [currentIndex])
  const viewerFiles = useMemo(
    () => (hasCurrentIndex ? files : [currentFile]),
    [hasCurrentIndex, files, currentFile]
  )

  useEffect(() => {
    let isMounted = true

    // If we can't find the file in the loaded files, that's probably because the user
    // is trying to open a direct link to a file that wasn't in the first 50 files of
    // the containing folder (it comes from a fetchMore...) ; we load the file attributes
    // directly as a contingency measure
    const fetchFileIfNecessary = async () => {
      if (hasCurrentIndex) return
      if (currentFile && isMounted) {
        setCurrentFile(null)
      }

      try {
        const { data } = await client.query(
          Q('io.cozy.files').getById(fileId).sharingById(driveId)
        )
        const fileWithPath = await ensureFileHasPath(data, client)
        isMounted && setCurrentFile(fileWithPath)
      } catch (e) {
        logger.warn("can't find the file")
        handleOnClose()
      }
    }

    fetchFileIfNecessary()

    return () => {
      isMounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const getDecryptedURLIfNecessary = async () => {
      const file = files[currentIndex]
      if (file && isEncryptedFile(file)) {
        const encryptionKey = await getEncryptionKeyFromDirId(
          client,
          file.dir_id
        )
        const url = await getDecryptedFileURL(client, vaultClient, {
          file,
          encryptionKey
        })
        setCurrentDecryptedFileURL(url)
      }
    }
    getDecryptedURLIfNecessary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  useEffect(() => {
    let isMounted = true

    // If we get close of the last file fetched, but we know there are more in the folder
    // (it shouldn't happen in /recent), we fetch more files
    const fetchMoreIfNecessary = async () => {
      if (fetchingMore) {
        return
      }

      setFetchingMore(true)
      try {
        const currentIndex = files.findIndex(f => f.id === fileId)

        if (
          (filesQuery.data.length - currentIndex <= 5 || currentIndex === -1) &&
          filesQuery.hasMore &&
          isMounted
        ) {
          await filesQuery.fetchMore()
        }
      } finally {
        setFetchingMore(false)
      }
    }

    fetchMoreIfNecessary()

    return () => {
      isMounted = false
    }
  }, [fetchingMore, filesQuery, files, fileId])

  const viewerIndex = useMemo(
    () => (hasCurrentIndex ? currentIndex : 0),
    [hasCurrentIndex, currentIndex]
  )

  const actions = useMoreMenuActions(currentFile ?? {})

  // If we can't find the file, we fallback to the (potentially loading)
  // direct stat made by the viewer
  if (currentIndex === -1 && !currentFile) {
    return <FilesViewerLoading />
  }

  const redirectToPaywall = () => {
    navigate('v/ai/paywall', { replace: true })
  }

  return (
    <RightClickFileMenu
      doc={viewerFiles[viewerIndex]}
      actions={actions}
      disabled={!viewerFiles[viewerIndex]}
      prefixMenuId="FileViewerMenu"
    >
      <RemoveScroll>
        <Viewer
          files={viewerFiles}
          currentURL={currentDecryptedFileURL}
          currentIndex={viewerIndex}
          onChangeRequest={handleOnChange}
          onCloseRequest={handleOnClose}
          renderFallbackExtraContent={file => <Fallback file={file} t={t} />}
          componentsProps={{
            OnlyOfficeViewer: {
              isEnabled: isOfficeEnabled(isDesktop),
              opener: file => navigate(makeOnlyOfficeFileRoute(file.id))
            },
            toolbarProps: {
              showFilePath: true,
              onPaywallRedirect: redirectToPaywall
            },
            ...(viewerProps || {})
          }}
        >
          <ToolbarButtons>
            <MoreMenu file={viewerFiles[viewerIndex]} />

            {flag('drive.new-file-viewer-ui.enabled') && (
              <Button
                variant="secondary"
                aria-label={t('Viewer.share_btn')}
                label={t('Viewer.share_btn')}
                startIcon={<Icon icon={ShareIcon} />}
                onClick={() =>
                  navigateToModal({
                    navigate,
                    pathname: '',
                    files,
                    path: 'share'
                  })
                }
              />
            )}
          </ToolbarButtons>
          <FooterActionButtons>
            <SharingButton />
            <ForwardOrDownloadButton variant="buttonIcon" />
          </FooterActionButtons>
        </Viewer>
      </RemoveScroll>
    </RightClickFileMenu>
  )
}

export default React.memo(FilesViewer)
