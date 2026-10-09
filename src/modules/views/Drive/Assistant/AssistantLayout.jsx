import React from 'react'

import styles from './styles.styl'

import { AssistantPanel } from '@/modules/views/Drive/Assistant/AssistantPanel'

/**
 * The content of the layout, with the assistant beside it when it is open
 */
export const AssistantLayout = ({ children }) => (
  <div
    className={`${styles['assistant-layout']} u-flex u-flex-auto u-ov-hidden`}
  >
    {children}
    <AssistantPanel />
  </div>
)
