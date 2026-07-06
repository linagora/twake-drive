import cx from 'classnames'
import React from 'react'
import { Link, Outlet } from 'react-router-dom'

import { BarComponent, BarLeft } from 'cozy-bar'
import { RealTimeQueries } from 'cozy-client'
import { AiText } from 'cozy-search'
import AppTitle from 'cozy-ui/transpiled/react/AppTitle'
import TwakeWorkplace from 'cozy-ui/transpiled/react/Icons/TwakeWorkplace'
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
        appIcon={TwakeWorkplace}
        appTextIcon={AiText}
        componentsProps={{
          Wrapper: {
            className: cx('u-elevation-0', styles['assistant-topbar-border'])
          }
        }}
      />
      <BarLeft>
        <Link to="/folder" className="coz-nav-apps-btns-home">
          <AppTitle appIcon={TwakeWorkplace} appTextIcon={AiText} />
        </Link>
      </BarLeft>
      <main className={styles['assistant-view']}>
        <Outlet />
      </main>
    </LayoutUI>
  )
}

export default AssistantLayout
