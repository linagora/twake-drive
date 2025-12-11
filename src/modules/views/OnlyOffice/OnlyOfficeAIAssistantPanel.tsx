import React from 'react'

import AIAssistantPanel from 'cozy-viewer/dist/Panel/AI/AIAssistantPanel'
import { withViewerLocales } from 'cozy-viewer/dist/hoc/withViewerLocales'
import { useViewer } from 'cozy-viewer/dist/providers/ViewerProvider'

import styles from './styles.styl'

const OnlyOfficeAIAssistantPanel: React.FC = () => {
  const { isOpenAiAssistant } = useViewer()

  return (
    <>
      {isOpenAiAssistant ? (
        <div className={styles['ai-assistant-panel']}>
          <AIAssistantPanel />
        </div>
      ) : null}
    </>
  )
}

export default withViewerLocales(OnlyOfficeAIAssistantPanel)
