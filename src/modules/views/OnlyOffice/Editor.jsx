import React from 'react'

import { isIOS } from 'cozy-device-helper'
import flag from 'cozy-flags'
import { DialogContent } from 'cozy-ui/transpiled/react/Dialog'
import ViewerProvider from 'cozy-viewer/dist/providers/ViewerProvider'

import Error from '@/modules/views/OnlyOffice/Error'
import Loading from '@/modules/views/OnlyOffice/Loading'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import Title from '@/modules/views/OnlyOffice/Title'
import View from '@/modules/views/OnlyOffice/View'
import CryptPadView from '@/modules/views/OnlyOffice/cryptpad/CryptPadView'
import useCryptPadConfig from '@/modules/views/OnlyOffice/cryptpad/useCryptPadConfig'
import { FileDeletedModal } from '@/modules/views/OnlyOffice/components/FileDeletedModal'
import { FileDivergedModal } from '@/modules/views/OnlyOffice/components/FileDivergedModal'
import {
  DEFAULT_EDITOR_TOOLBAR_HEIGHT_IOS,
  DEFAULT_EDITOR_TOOLBAR_HEIGHT
} from '@/modules/views/OnlyOffice/config'
import useConfig from '@/modules/views/OnlyOffice/useConfig'
import { isCryptPadEnabled } from '@/modules/views/OnlyOffice/helpers'

const getEditorToolbarHeight = editorToolbarHeightFlag => {
  if (Number.isInteger(editorToolbarHeightFlag)) {
    return editorToolbarHeightFlag
  } else if (isIOS()) {
    return DEFAULT_EDITOR_TOOLBAR_HEIGHT_IOS
  } else {
    return DEFAULT_EDITOR_TOOLBAR_HEIGHT
  }
}

const EditorContent = ({ config, status, isCryptPad }) => {
  const {
    isEditorModeView,
    hasFileDiverged,
    hasFileDeleted,
    file,
    isReadOnly,
    isPublic
  } = useOnlyOfficeContext()

  if (status === 'error') return <Error />
  if (status !== 'loaded' || !config) return <Loading />

  const { apiUrl, docEditorConfig } = config

  const editorToolbarHeight = getEditorToolbarHeight(
    flag('drive.onlyoffice.editorToolbarHeight')
  )
  return (
    <ViewerProvider file={file} isPublic={isPublic} isReadOnly={isReadOnly}>
      <Title />
      <DialogContent
        style={
          isEditorModeView
            ? {
                marginTop: `-${editorToolbarHeight}px`
              }
            : undefined
        }
        className="u-flex u-flex-column u-p-0"
      >
        {isCryptPad ? (
          <CryptPadView apiUrl={apiUrl} docEditorConfig={docEditorConfig} />
        ) : (
          <View
            id={new URL(config.serverUrl).hostname}
            apiUrl={apiUrl}
            docEditorConfig={docEditorConfig}
          />
        )}
        {hasFileDiverged ? <FileDivergedModal /> : null}
        {hasFileDeleted ? <FileDeletedModal /> : null}
      </DialogContent>
    </ViewerProvider>
  )
}

const CryptPadEditor = () => {
  const { config, status } = useCryptPadConfig()
  return <EditorContent config={config} status={status} isCryptPad={true} />
}

const ServerEditor = () => {
  const { config, status } = useConfig()
  return <EditorContent config={config} status={status} isCryptPad={false} />
}

export const Editor = () => {
  if (isCryptPadEnabled()) {
    return <CryptPadEditor />
  }
  return <ServerEditor />
}

export default Editor
