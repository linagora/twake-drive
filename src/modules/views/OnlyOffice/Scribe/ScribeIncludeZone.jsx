import React from 'react'

import Checkbox from 'cozy-ui/transpiled/react/Checkbox'
import { makeStyles, useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'

// Lighten ONLY the unchecked box outline (the `:not(.Mui-checked)` guard leaves
// the checked fill at the library default) — even quieter per the 2026-06-24
// live UX review.
const useStyles = makeStyles(theme => ({
  checkbox: {
    '&:not(.Mui-checked) .MuiSvgIcon-root': {
      color: theme.palette.text.disabled
    }
  }
}))

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
 * Styling is deliberately quiet (CTX-UX-05): cozy-ui Checkbox size="small"
 * scaled to 0.85, all text 10/11px theme.palette.text.disabled (lighter than
 * text.secondary), library-default (primary) checked color — NO Scribe-purple
 * recolor on the checkboxes. Tightened after the 2026-06-24 live UX review.
 */
export const ScribeIncludeZone = () => {
  const { t } = useI18n()
  const theme = useTheme()
  const classes = useStyles()
  const {
    currentSelection,
    includeDocument,
    includeDiscussion,
    includeSelection,
    setIncludeDocument,
    setIncludeDiscussion,
    setIncludeSelection
  } = useScribe()

  // Deliberately quiet (CTX-UX-05): use the lighter `text.disabled` token (not
  // `text.secondary`) and small type so the zone stays well below the prompt's
  // visual weight. Live UX review (2026-06-24) asked for lighter + smaller.
  const muted = theme.palette.text.disabled

  const labelStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none'
  }

  const spanStyle = { color: muted }

  // size="small" is MUI's smallest preset; scale down a touch more for discretion.
  const checkboxStyle = { padding: 2, transform: 'scale(0.85)' }

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
          fontSize: 10,
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
            className={classes.checkbox}
            checked={includeDocument}
            onChange={() => setIncludeDocument(!includeDocument)}
            style={checkboxStyle}
            aria-label={t('Scribe.include.document')}
          />
          <span style={spanStyle}>{t('Scribe.include.document')}</span>
        </label>

        <label style={labelStyle} onMouseDown={e => e.stopPropagation()}>
          <Checkbox
            size="small"
            className={classes.checkbox}
            checked={includeDiscussion}
            onChange={() => setIncludeDiscussion(!includeDiscussion)}
            style={checkboxStyle}
            aria-label={t('Scribe.include.discussion')}
          />
          <span style={spanStyle}>{t('Scribe.include.discussion')}</span>
        </label>

        {/* The « sélection » control is ALWAYS rendered but hidden via
            `visibility` (not unmounted) when there is no selection, so it keeps
            its slot in the wrap row — selecting/deselecting text never reflows
            the zone (live UX review 2026-06-24). aria-live announces it on
            appearance; aria-hidden + disabled keep it inert while hidden. */}
        <div aria-live="polite" style={{ display: 'contents' }}>
          <label
            style={{
              ...labelStyle,
              visibility: currentSelection ? 'visible' : 'hidden'
            }}
            aria-hidden={currentSelection ? undefined : true}
            onMouseDown={e => e.stopPropagation()}
          >
            <Checkbox
              size="small"
              className={classes.checkbox}
              checked={includeSelection}
              onChange={() => setIncludeSelection(!includeSelection)}
              style={checkboxStyle}
              disabled={!currentSelection}
              aria-label={t('Scribe.include.selection')}
            />
            <span style={spanStyle}>{t('Scribe.include.selection')}</span>
          </label>
        </div>
      </div>
    </div>
  )
}

ScribeIncludeZone.displayName = 'ScribeIncludeZone'
