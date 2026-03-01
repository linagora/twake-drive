import React from 'react'
import PropTypes from 'prop-types'

import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Typography from 'cozy-ui/transpiled/react/Typography'

/**
 * ScribeResultPanel - Step 2 of the Scribe two-step flow.
 *
 * Displays the mock-transformed text with an action breadcrumb header
 * (e.g. "Translate > Anglais") and Replace/Insert action buttons.
 *
 * Layout:
 * +------------------------------------------+
 * | [breadcrumb text]              [X close]  |
 * +------------------------------------------+
 * | [result text - read-only, pre-wrap]       |
 * |                                           |
 * +------------------------------------------+
 * |                    Replace    [Inserer]   |
 * +------------------------------------------+
 *
 * @param {Object} props
 * @param {string} props.breadcrumb - Path taken, e.g. "Translate > Anglais"
 * @param {string} props.resultText - The mock-transformed text
 * @param {Function} props.onReplace - Called when Replace is clicked
 * @param {Function} props.onInsert - Called when Inserer is clicked
 * @param {Function} props.onClose - Called when X button is clicked
 */
const ScribeResultPanel = ({
  breadcrumb,
  resultText,
  onReplace,
  onInsert,
  onClose
}) => {
  return (
    <div className="scribe-result-panel">
      <div className="scribe-result-header">
        <Typography variant="subtitle2" color="textSecondary">
          {breadcrumb}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <Icon icon={CrossIcon} size={16} />
        </IconButton>
      </div>

      <div className="scribe-result-text">{resultText}</div>

      <div className="scribe-result-actions">
        <Buttons variant="text" label="Replace" onClick={onReplace} />
        <Buttons label="Inserer" onClick={onInsert} />
      </div>
    </div>
  )
}

ScribeResultPanel.propTypes = {
  breadcrumb: PropTypes.string.isRequired,
  resultText: PropTypes.string.isRequired,
  onReplace: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
}

export { ScribeResultPanel }
