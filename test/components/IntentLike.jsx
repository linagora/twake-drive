import PropTypes from 'prop-types'
import React from 'react'

import IntentProvider from '@/lib/IntentProvider'
import enLocale from '@/locales/en.json'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'

export function IntentLike({ client, children }) {
  return (
    <IntentProvider client={client} lang="en" dictRequire={() => enLocale}>
      <SelectionProvider clearOnLocationChange={false}>
        {children}
      </SelectionProvider>
    </IntentProvider>
  )
}

IntentLike.propTypes = {
  client: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired
}
