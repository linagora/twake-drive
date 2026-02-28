import React from 'react'
import PropTypes from 'prop-types'

import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Typography from 'cozy-ui/transpiled/react/Typography'

/**
 * Placeholder modal for AI_TEXT_EDIT intent display and action.
 *
 * Displays the selected text received from the plugin and offers
 * Replace, Insert After, and Cancel actions. In this Phase 2
 * placeholder, the buttons pass the selected text back as-is
 * (no transformation). Phase 3 will add the mock AI transformation.
 *
 * Follows the FileDeletedModal pattern (ConfirmDialog + Buttons from cozy-ui).
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {string} props.selectedText - The text selected in the editor
 * @param {Function} props.onReplace - Called with text when Replace is clicked
 * @param {Function} props.onInsert - Called with text when Insert After is clicked
 * @param {Function} props.onCancel - Called when Cancel is clicked
 */
const ScribeModal = ({ open, selectedText, onReplace, onInsert, onCancel }) => {
  return (
    <ConfirmDialog
      open={open}
      onClose={onCancel}
      title="Scribe"
      content={
        <>
          <Typography variant="caption" color="textSecondary">
            Selected text:
          </Typography>
          <div
            style={{
              backgroundColor: '#f5f5f5',
              padding: '12px',
              borderRadius: '4px',
              maxHeight: '300px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              marginTop: '8px'
            }}
          >
            <Typography style={{ whiteSpace: 'pre-wrap' }}>
              {selectedText}
            </Typography>
          </div>
        </>
      }
      actions={
        <>
          <Buttons variant="secondary" label="Cancel" onClick={onCancel} />
          <Buttons
            variant="secondary"
            label="Insert After"
            onClick={() => onInsert(selectedText)}
          />
          <Buttons
            label="Replace"
            onClick={() => onReplace(selectedText)}
          />
        </>
      }
    />
  )
}

ScribeModal.propTypes = {
  open: PropTypes.bool.isRequired,
  selectedText: PropTypes.string.isRequired,
  onReplace: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
}

export { ScribeModal }
