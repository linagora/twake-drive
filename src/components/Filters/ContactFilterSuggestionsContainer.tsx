import React, { type ReactElement } from 'react'
import type Autosuggest from 'react-autosuggest'

import { Spinner } from 'cozy-ui/transpiled/react/Spinner'

import styles from './ContactFilter.styl'

interface ContactFilterSuggestionsContainerProps
  extends Autosuggest.RenderSuggestionsContainerParams {
  emptyMessage: string
  loading: boolean
  loadingMessage: string
}

const ContactFilterSuggestionsContainer = ({
  children,
  containerProps,
  emptyMessage,
  loading,
  loadingMessage
}: ContactFilterSuggestionsContainerProps): ReactElement => {
  if (loading) {
    return (
      <div {...containerProps}>
        <div
          className={`${styles.status} u-flex u-flex-items-center u-flex-justify-center u-ph-1 u-ta-center`}
          role="status"
        >
          <Spinner size="small" />
          <span className="u-ml-half">{loadingMessage}</span>
        </div>
      </div>
    )
  }

  if (!children) {
    return (
      <div {...containerProps}>
        <div
          className={`${styles.status} u-flex u-flex-items-center u-flex-justify-center u-ph-1 u-ta-center`}
          role="status"
        >
          {emptyMessage}
        </div>
      </div>
    )
  }

  return <div {...containerProps}>{children}</div>
}

export { ContactFilterSuggestionsContainer }
