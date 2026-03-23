import cx from 'classnames'
import React from 'react'

import { BarComponent } from 'cozy-bar'
import { RealTimeQueries } from 'cozy-client'
import { AssistantView } from 'cozy-search'
import { Layout as LayoutUI } from 'cozy-ui/transpiled/react/Layout'

import styles from './assistant.styl'

import {
  DOCTYPE_AI_CHAT_ASSISTANTS,
  DOCTYPE_AI_CHAT_CONVERSATIONS
} from '@/lib/doctypes'

const AssistantLayout = () => {
  return (
    <LayoutUI monoColumn>
      <RealTimeQueries doctype={DOCTYPE_AI_CHAT_CONVERSATIONS} />
      <RealTimeQueries doctype={DOCTYPE_AI_CHAT_ASSISTANTS} />
      <BarComponent
        searchOptions={{ enabled: true }}
        appSlug="assistant"
        disableInternalStore
        componentsProps={{
          Wrapper: {
            className: cx('u-elevation-0', styles['assistant-topbar-border'])
          }
        }}
      />
      <main className={styles['assistant-view']}>
        <AssistantView />
      </main>
    </LayoutUI>
  )
}

export default AssistantLayout
