import React from 'react'

import Checkbox from 'cozy-ui/transpiled/react/Checkbox'
import { useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'

/**
 * ScribeIncludeZone — the discreet « Inclure » zone above the Scribe prompt
 * (v3.2-01, CTX-UX-01..05).
 *
 * A muted caption + a role=group row of cozy-ui checkboxes that let the user
 * pick which contexts to enrich the prompt with: « document », « discussion »
 * and (conditionally) « sélection ». This component is a PURE presentational
 * consumer — it owns NO state for the include booleans: they live in
 * ScribeContext (read/written via useScribe), so the prompt-assembly seam can
 * read them in v3.2-02/03. This phase performs NO prompt injection; toggling a
 * box only flips a context boolean (and, for « sélection », chip visibility in
 * ChatInput).
 *
 * Styling is deliberately quiet (CTX-UX-05): cozy-ui Checkbox size="small" with
 * padding:2, all text 11/12px theme.palette.text.secondary, library-default
 * (primary) checked color — NO Scribe-purple recolor on the checkboxes.
 */
export const ScribeIncludeZone = () => {
  const { t } = useI18n()
  const theme = useTheme()
  const {
    currentSelection,
    includeDocument,
    includeDiscussion,
    includeSelection,
    setIncludeDocument,
    setIncludeDiscussion,
    setIncludeSelection
  } = useScribe()

  const muted = theme.palette.text.secondary

  const labelStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none'
  }

  const spanStyle = { color: muted }

  return (
    <div
      role="group"
      aria-label={t('Scribe.include.label')}
      style={{
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.4,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: muted
        }}
      >
        {t('Scribe.include.label')}
      </span>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          rowGap: 4
        }}
      >
        <label style={labelStyle} onMouseDown={e => e.stopPropagation()}>
          <Checkbox
            size="small"
            checked={includeDocument}
            onChange={() => setIncludeDocument(!includeDocument)}
            style={{ padding: 2 }}
            aria-label={t('Scribe.include.document')}
          />
          <span style={spanStyle}>{t('Scribe.include.document')}</span>
        </label>

        <label style={labelStyle} onMouseDown={e => e.stopPropagation()}>
          <Checkbox
            size="small"
            checked={includeDiscussion}
            onChange={() => setIncludeDiscussion(!includeDiscussion)}
            style={{ padding: 2 }}
            aria-label={t('Scribe.include.discussion')}
          />
          <span style={spanStyle}>{t('Scribe.include.discussion')}</span>
        </label>

        {/* Always-mounted aria-live region keeps the live-region registration
            stable; only the inner « sélection » control mounts conditionally. */}
        <div aria-live="polite" style={{ display: 'contents' }}>
          {currentSelection ? (
            <label style={labelStyle} onMouseDown={e => e.stopPropagation()}>
              <Checkbox
                size="small"
                checked={includeSelection}
                onChange={() => setIncludeSelection(!includeSelection)}
                style={{ padding: 2 }}
                aria-label={t('Scribe.include.selection')}
              />
              <span style={spanStyle}>{t('Scribe.include.selection')}</span>
            </label>
          ) : null}
        </div>
      </div>
    </div>
  )
}

ScribeIncludeZone.displayName = 'ScribeIncludeZone'
