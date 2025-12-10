/**
 * This component was previously named FileOpener
 * It has been renamed since it is used in :
 *  - an intent handler (aka service)
 *  - via cozydrive://
 */

import React, { useCallback, useEffect, useState } from 'react'
import { RemoveScroll } from 'react-remove-scroll'
import { useNavigate, useParams } from 'react-router-dom'
import { translate, useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Viewer, {
  FooterActionButtons,
  ForwardOrDownloadButton,
  ToolbarButtons,
  SharingButton
} from 'cozy-viewer'

import { ensureFileHasPath } from '@/components/FilesRealTimeQueries'
import Fallback from '@/modules/viewer/Fallback'
import {
  isOfficeEnabled,
  makeOnlyOfficeFileRoute
} from '@/modules/views/OnlyOffice/helpers'
import { buildFileOrFolderByIdQuery } from '@/queries'

const FileNotFoundError = translate()(({ t }) => (
  <pre className="u-error">{t('FileOpenerExternal.fileNotFoundError')}</pre>
))

const FileOpener = props => {
  const navigate = useNavigate()
  const { isDesktop } = useBreakpoints()
  const { t } = useI18n()
  const { fileId } = useParams()
  const { showAlert } = useAlert()

  const client = useClient()
  const [state, setState] = useState({
    loading: true,
    file: null
  })

  const { service } = props
  const { file, loading, fileNotFound } = state

  const loadFileInfo = useCallback(
    async id => {
      try {
        setState({ fileNotFound: false, loading: true })
        const query = buildFileOrFolderByIdQuery(id)
        const result = await client.query(query.definition(), query.options)

        const file = await ensureFileHasPath(result.data, client)

        setState({ file, loading: false })
      } catch (e) {
        setState({ fileNotFound: true, loading: false })
        showAlert({
          message: t('alert.could_not_open_file')
        })
      }
    },
    [client, showAlert, t]
  )

  useEffect(() => {
    const requestedFileId = fileId ?? props.fileId
    if (requestedFileId) {
      loadFileInfo(requestedFileId)
    }
  }, [fileId, props.fileId, loadFileInfo])

  return (
    <div className="u-pos-absolute u-w-100 u-h-100 u-bg-charcoalGrey">
      {loading && <Spinner size="xxlarge" middle noMargin color="white" />}
      {fileNotFound && <FileNotFoundError />}
      {!loading && !fileNotFound && (
        <RemoveScroll>
          <Viewer
            files={[file]}
            currentIndex={0}
            onChangeRequest={() => {}}
            onCloseRequest={service ? () => service.terminate() : null}
            renderFallbackExtraContent={file => <Fallback file={file} t={t} />}
            componentsProps={{
              OnlyOfficeViewer: {
                isEnabled: isOfficeEnabled(isDesktop),
                opener: file => navigate(makeOnlyOfficeFileRoute(file.id))
              }
            }}
          >
            <ToolbarButtons>
              <SharingButton variant="iconButton" />
            </ToolbarButtons>
            <FooterActionButtons>
              <SharingButton />
              <ForwardOrDownloadButton variant="buttonIcon" />
            </FooterActionButtons>
          </Viewer>
        </RemoveScroll>
      )}
    </div>
  )
}

export default FileOpener
