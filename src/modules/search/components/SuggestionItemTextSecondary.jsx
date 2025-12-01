import React from 'react'

import { generateWebLink, useClient } from 'cozy-client'
import { isFlagshipApp } from 'cozy-device-helper'
import AppLinker, { generateUniversalLink } from 'cozy-ui-plus/dist/AppLinker'

import styles from '@/modules/search/components/styles.styl'

import SuggestionItemTextHighlighted from '@/modules/search/components/SuggestionItemTextHighlighted'

const SuggestionItemTextSecondary = ({
  text,
  query,
  url,
  onOpened,
  isMobile
}) => {
  const client = useClient()

  if (isMobile) {
    return <SuggestionItemTextHighlighted text={text} query={query} />
  }

  const app = {
    slug: 'drive'
  }

  const { subdomain: subDomainType } = client.getInstanceOptions()
  const generateLink = isFlagshipApp() ? generateUniversalLink : generateWebLink

  const appWebRef =
    app &&
    generateLink({
      slug: 'drive',
      cozyUrl: client.getStackClient().uri,
      subDomainType,
      nativePath: url,
      pathname: '/',
      hash: url
    })
  return (
    <AppLinker app={app} href={appWebRef}>
      {({ onClick, href }) => (
        <a
          className={styles['suggestion-item-parent-link']}
          href={href}
          onClick={e => {
            e.stopPropagation()
            if (typeof onOpened == 'function') {
              onOpened(e)
            }
            if (typeof onClick == 'function') {
              onClick(e)
            }
          }}
        >
          <SuggestionItemTextHighlighted text={text} query={query} />
        </a>
      )}
    </AppLinker>
  )
}

export default SuggestionItemTextSecondary
