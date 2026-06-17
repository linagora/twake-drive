import React, { useEffect, useRef, useCallback, useState } from 'react'
import PropTypes from 'prop-types'

import { useI18n } from 'twake-i18n'
import { useTheme } from 'cozy-ui/transpiled/react/styles'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import SyncIcon from 'cozy-ui/transpiled/react/Icons/Sync'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Typography from 'cozy-ui/transpiled/react/Typography'
import Checkbox from 'cozy-ui/transpiled/react/Checkbox'

import { MarkdownPreview } from '@/modules/views/OnlyOffice/Scribe/MarkdownPreview'
import { loadBeautify, loadHighlightJs } from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'
import {
  aggregate,
  replay,
  exportCorpus,
  importCorpus,
  DUP_THRESHOLD
} from '@/modules/views/OnlyOffice/Scribe/scribeProbe'
import styles from '@/modules/views/OnlyOffice/Scribe/scribe.styl'

const DEV_PANELS_STORAGE_KEY = 'SCRIBE_DEV_MD_PANELS'
const DEV_PANEL_KEYS = ['htmlSource', 'htmlNorm', 'mdConverted', 'llmRaw', 'llmDisplay', 'rendered', 'parsedResponse', 'probeMetrics']
function getDevPanelLabels(source) {
  const fromPlugin = source === 'plugin'
  return {
    htmlSource: fromPlugin ? 'HTML brut (sélection OO) — non utilisé' : 'HTML brut (sélection OO)',
    htmlNorm: fromPlugin ? 'HTML normalisé — non utilisé' : 'HTML normalisé',
    mdConverted: fromPlugin ? 'MD enrichi (plugin OO → marqueurs)' : 'MD converti (HTML → Turndown)',
    llmRaw: 'MD brut LLM (réponse IA — marqueurs)',
    llmDisplay: 'MD pour affichage (tableaux en md)',
    rendered: 'Rendu final (aperçu)',
    parsedResponse: 'Réponse parsée (contrat)',
    probeMetrics: 'Métriques + couverture (sonde)'
  }
}
const DEV_PANEL_DEFAULTS = { htmlSource: true, htmlNorm: true, mdConverted: true, llmRaw: true, llmDisplay: true, rendered: true, parsedResponse: true, probeMetrics: true }

function loadDevPanelPrefs() {
  try {
    var stored = localStorage.getItem(DEV_PANELS_STORAGE_KEY)
    if (stored) {
      var parsed = JSON.parse(stored)
      // Merge with defaults so new keys are visible
      return Object.assign({}, DEV_PANEL_DEFAULTS, parsed)
    }
  } catch { /* ignore */ }
  return Object.assign({}, DEV_PANEL_DEFAULTS)
}

function saveDevPanelPrefs(prefs) {
  try {
    localStorage.setItem(DEV_PANELS_STORAGE_KEY, JSON.stringify(prefs))
  } catch { /* ignore */ }
}

/**
 * ScribeResultPanel - Step 2 of the Scribe two-step flow.
 *
 * Displays either the AI-transformed text (success) or an error message.
 * In dev mode (devData prop), shows up to 6 panels in a dynamic grid:
 *   1. HTML brut (sélection OO) — raw HTML from OO (prettified + syntax colored)
 *   2. HTML normalisé — after normalizeHtml (prettified + syntax colored)
 *   3. MD converti (sélection → markdown) — converted markdown (syntax colored)
 *   4. MD brut LLM (réponse IA — marqueurs) — raw markdown returned by the LLM with TABLE/CELL markers
 *   5. MD pour affichage (tableaux formatés) — markers transformed to readable markdown tables
 *   6. Rendu final (aperçu) — rendered markdown preview
 *
 * Each panel can be toggled via checkboxes in the title bar.
 * Visibility preferences are persisted in localStorage.
 * highlight.js is loaded lazily only when devData is present.
 */

const escapeHtml = str =>
  (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// [ASSUMED] coverage minimums (documented in GATE.md). The panel only WARNS below
// these; the gate go/no-go decision lives in GATE.md, not in this component.
const COVERAGE_MIN = { perLocale: 1, tableCases: 1, refCases: 1 }

/**
 * ProbeMetricsPanel — renders the conformance metrics + coverage produced by
 * scribeProbe.aggregate(replay()). ALL metric math lives in scribeProbe.js; this
 * component only renders the already-computed aggregate output (anti-pattern:
 * no metric computation here). Provides Export (exportCorpus) and Import
 * (importCorpus, wrapped in try/catch) controls for GATE.md evidence + offline
 * replay. Import never crashes the panel on a bad shape — it surfaces an error.
 */
const ProbeMetricsPanel = ({ devPreStyle, devLabelStyle, label, colorText }) => {
  const [version, setVersion] = useState(0) // bump to re-aggregate after import
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef(null)

  // replay() + aggregate() are pure scribeProbe exports; component renders only.
  const stats = aggregate(replay())

  const handleExport = useCallback(() => {
    try {
      const json = exportCorpus()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'scribe-probe-corpus.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setImportError('Export échoué: ' + (e && e.message ? e.message : 'erreur'))
    }
  }, [])

  const handleImportFile = useCallback(e => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        // importCorpus validates shape/version and throws WITHOUT mutating storage
        // on a bad import (T-v3.1-03-06). try/catch surfaces the error, never crashes.
        importCorpus(String(reader.result))
        setImportError('')
        setVersion(v => v + 1) // re-aggregate from the freshly imported corpus
      } catch (err) {
        setImportError('Import rejeté: ' + (err && err.message ? err.message : 'forme/version invalide'))
      }
    }
    reader.onerror = () => setImportError('Lecture du fichier échouée')
    reader.readAsText(file)
    e.target.value = '' // allow re-importing the same file
  }, [])

  const warn = (value, min) => (value < min ? { color: '#ff9800', fontWeight: 'bold' } : undefined)
  const flagNonZero = value => (value > 0 ? { color: '#f44336', fontWeight: 'bold' } : undefined)
  const pct = r => (r * 100).toFixed(1) + '%'

  const localeEntries = Object.keys(stats.coverage.perLocale)

  return (
    <div key="probeMetrics" style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={devLabelStyle}>{label}</div>
      <div style={{ ...devPreStyle, whiteSpace: 'normal', fontSize: 11 }}>
        {/* hidden version dependency so re-aggregation re-renders after import */}
        <span style={{ display: 'none' }}>{version}</span>
        <div><strong>Total:</strong> {stats.total} échantillons</div>
        <div style={{ marginTop: 6 }}>
          <strong>Taux (vs seuils, D-04):</strong>
          <div>· duplication ≥ {DUP_THRESHOLD}: <span>{pct(stats.dupRate)}</span></div>
          <div>· préambule: <span>{pct(stats.preambleRate)}</span></div>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Comptes zéro-tolérance (D-03):</strong>
          <div>· table scindée: <span style={flagNonZero(stats.splitTableCount)}>{stats.splitTableCount}</span></div>
          <div>· REF cassés: <span style={flagNonZero(stats.refBrokenCount)}>{stats.refBrokenCount}</span></div>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Répartition fragments (0/1/N, D-05):</strong>
          <div>· 0: {stats.fragDist[0]} · 1: {stats.fragDist[1]} · N: {stats.fragDist.N}</div>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Couverture (D-09):</strong>
          <div>· locales: <span style={warn(localeEntries.length, COVERAGE_MIN.perLocale)}>
            {localeEntries.length ? localeEntries.map(l => `${l}:${stats.coverage.perLocale[l]}`).join(', ') : '—'}
          </span></div>
          <div>· cas table: <span style={warn(stats.coverage.tableCases, COVERAGE_MIN.tableCases)}>{stats.coverage.tableCases}</span></div>
          <div>· cas REF: <span style={warn(stats.coverage.refCases, COVERAGE_MIN.refCases)}>{stats.coverage.refCases}</span></div>
        </div>
        {importError && (
          <div style={{ marginTop: 6, color: '#f44336' }}>{importError}</div>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button type="button" onClick={handleExport} style={{ fontSize: 11, cursor: 'pointer' }}>
            Export
          </button>
          <button type="button" onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{ fontSize: 11, cursor: 'pointer' }}>
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * DevPanelGrid — renders up to 5 dev panels in a dynamic grid.
 * Only visible panels (from devPanelPrefs) are rendered.
 * Grid adapts columns: 1 col for 1-2 panels, 2 cols for 3-4, 3 cols for 5.
 */
const DevPanelGrid = ({
  devPanelPrefs,
  devColumnStyle,
  devLabelStyle,
  devPreStyle,
  highlightedHtml,
  highlightedNormalized,
  highlightedMd,
  highlightedLlmMd,
  highlightedLlmDisplay,
  highlightedParsedJson,
  rawLlmResult,
  devData,
  parsedResponse,
  resultText,
  resultContent
}) => {
  const labels = getDevPanelLabels(devData.source)
  const panels = []

  if (devPanelPrefs.htmlSource !== false) {
    panels.push(
      <div key="htmlSource" style={devColumnStyle}>
        <div style={devLabelStyle}>{labels.htmlSource}</div>
        <pre
          className="hljs"
          style={devPreStyle}
          dangerouslySetInnerHTML={{
            __html: highlightedHtml || escapeHtml(devData.html)
          }}
        />
      </div>
    )
  }

  if (devPanelPrefs.htmlNorm !== false) {
    panels.push(
      <div key="htmlNorm" style={devColumnStyle}>
        <div style={devLabelStyle}>{labels.htmlNorm}</div>
        <pre
          className="hljs"
          style={devPreStyle}
          dangerouslySetInnerHTML={{
            __html: highlightedNormalized || escapeHtml(devData.normalizedHtml)
          }}
        />
      </div>
    )
  }

  if (devPanelPrefs.mdConverted !== false) {
    panels.push(
      <div key="mdConverted" style={devColumnStyle}>
        <div style={devLabelStyle}>{labels.mdConverted}</div>
        <pre
          className="hljs"
          style={devPreStyle}
          dangerouslySetInnerHTML={{
            __html: highlightedMd || escapeHtml(devData.md)
          }}
        />
      </div>
    )
  }

  if (devPanelPrefs.llmRaw !== false) {
    panels.push(
      <div key="llmRaw" style={devColumnStyle}>
        <div style={devLabelStyle}>{labels.llmRaw}</div>
        <pre
          className="hljs"
          style={devPreStyle}
          dangerouslySetInnerHTML={{
            __html: highlightedLlmMd || escapeHtml(rawLlmResult || resultText)
          }}
        />
      </div>
    )
  }

  if (devPanelPrefs.llmDisplay !== false) {
    panels.push(
      <div key="llmDisplay" style={devColumnStyle}>
        <div style={devLabelStyle}>{labels.llmDisplay}</div>
        <pre
          className="hljs"
          style={devPreStyle}
          dangerouslySetInnerHTML={{
            __html: highlightedLlmDisplay || escapeHtml(resultText)
          }}
        />
      </div>
    )
  }

  if (devPanelPrefs.rendered !== false) {
    panels.push(
      <div key="rendered" style={devColumnStyle}>
        <div style={devLabelStyle}>{labels.rendered}</div>
        {resultContent}
      </div>
    )
  }

  // PROBE-01: live parsed-response viewer. Renders the structured contract
  // { discussion, fragments, valid, fellBack, warnings } as syntax-highlighted
  // JSON through the SAME escapeHtml + highlight.js pipeline used by sibling
  // panels (never inject raw model text as HTML — T-v3.1-03-07).
  if (devPanelPrefs.parsedResponse !== false) {
    const parsedJsonRaw = parsedResponse
      ? JSON.stringify(
          {
            discussion: parsedResponse.discussion,
            fragments: parsedResponse.fragments,
            valid: parsedResponse.valid,
            fellBack: parsedResponse.fellBack,
            warnings: parsedResponse.warnings
          },
          null,
          2
        )
      : ''
    panels.push(
      <div key="parsedResponse" style={devColumnStyle}>
        <div style={devLabelStyle}>{labels.parsedResponse}</div>
        <pre
          className="hljs"
          style={devPreStyle}
          dangerouslySetInnerHTML={{
            __html: highlightedParsedJson || escapeHtml(parsedJsonRaw)
          }}
        />
      </div>
    )
  }

  // PROBE-01: conformance metrics + coverage with export/import. All metric math
  // lives in scribeProbe.js (aggregate/replay) — this panel only renders output.
  if (devPanelPrefs.probeMetrics !== false) {
    panels.push(
      <ProbeMetricsPanel
        key="probeMetrics"
        devPreStyle={devPreStyle}
        devLabelStyle={devLabelStyle}
        label={labels.probeMetrics}
      />
    )
  }

  if (panels.length === 0) return null

  const cols = panels.length <= 2 ? panels.length : panels.length <= 4 ? 2 : 3
  const rows = Math.ceil(panels.length / cols)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 8,
        flex: 1,
        overflow: 'hidden'
      }}
    >
      {panels}
    </div>
  )
}

const ScribeResultPanel = ({
  breadcrumb,
  resultText,
  error,
  canRetry,
  cellWarning,
  insertDisabled,
  onRetry,
  onReplace,
  onInsert,
  onClose,
  rawLlmResult,
  devData,
  parsedResponse,
  dragOffset,
  onDragMove,
  panelSize,
  onResize
}) => {
  const { t } = useI18n()
  const theme = useTheme()
  const insertRef = useRef(null)
  const replaceRef = useRef(null)
  const closeRef = useRef(null)
  const retryRef = useRef(null)
  const paperRef = useRef(null)

  // Drag-to-move state
  const dragStateRef = useRef({ dragging: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 })
  // Resize state
  const resizeStateRef = useRef({ resizing: false, startX: 0, startY: 0, startWidth: 0, startHeight: 0 })

  // --- Drag-to-move handlers ---
  const handleDragMove = useCallback(e => {
    const ds = dragStateRef.current
    if (!ds.dragging) return
    const dx = e.clientX - ds.startX
    const dy = e.clientY - ds.startY
    onDragMove({ x: ds.startOffsetX + dx, y: ds.startOffsetY + dy })
  }, [onDragMove])

  const handleDragEnd = useCallback(() => {
    dragStateRef.current.dragging = false
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
  }, [handleDragMove])

  const handleDragStart = useCallback(e => {
    // Skip if clicking on interactive elements (close button in header)
    let el = e.target
    while (el && el !== e.currentTarget) {
      const tag = el.tagName && el.tagName.toLowerCase()
      if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea') return
      if (el.getAttribute && el.getAttribute('role') === 'button') return
      el = el.parentElement
    }
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: dragOffset ? dragOffset.x : 0,
      startOffsetY: dragOffset ? dragOffset.y : 0
    }
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
    e.preventDefault()
  }, [dragOffset, handleDragMove, handleDragEnd])

  // --- Resize handlers ---
  const handleResizeMove = useCallback(e => {
    const rs = resizeStateRef.current
    if (!rs.resizing) return
    const maxW = window.innerWidth * 0.95
    const maxH = window.innerHeight * 0.9
    const newWidth = Math.min(maxW, Math.max(250, rs.startWidth + (e.clientX - rs.startX)))
    const newHeight = Math.min(maxH, Math.max(150, rs.startHeight + (e.clientY - rs.startY)))
    onResize({ width: newWidth, height: newHeight })
  }, [onResize])

  const handleResizeEnd = useCallback(() => {
    resizeStateRef.current.resizing = false
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
  }, [handleResizeMove])

  const handleResizeStart = useCallback(e => {
    e.stopPropagation()
    e.preventDefault()
    if (!paperRef.current) return
    const rect = paperRef.current.getBoundingClientRect()
    resizeStateRef.current = {
      resizing: true,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height
    }
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }, [handleResizeMove, handleResizeEnd])

  // Cleanup document listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
    }
  }, [handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd])

  // Dev mode: panel visibility prefs (persisted in localStorage)
  const [devPanelPrefs, setDevPanelPrefs] = useState(loadDevPanelPrefs)
  const toggleDevPanel = useCallback(key => {
    setDevPanelPrefs(prev => {
      const next = Object.assign({}, prev, { [key]: !prev[key] })
      saveDevPanelPrefs(next)
      return next
    })
  }, [])

  // Dev mode: highlighted HTML from highlight.js (loaded lazily from CDN)
  const [highlightedHtml, setHighlightedHtml] = useState('')
  const [highlightedNormalized, setHighlightedNormalized] = useState('')
  const [highlightedMd, setHighlightedMd] = useState('')
  const [highlightedLlmMd, setHighlightedLlmMd] = useState('')
  const [highlightedLlmDisplay, setHighlightedLlmDisplay] = useState('')
  const [highlightedParsedJson, setHighlightedParsedJson] = useState('')

  useEffect(() => {
    if (!devData) return

    const beautifyOpts = { indent_size: 2, wrap_line_length: 80 }
    const doBeautify = (beautify, src) =>
      beautify.html_beautify
        ? beautify.html_beautify(src, beautifyOpts)
        : beautify(src, beautifyOpts)

    Promise.all([loadHighlightJs(), loadBeautify()]).then(([hljs, beautify]) => {
      if (devData.html) {
        setHighlightedHtml(
          hljs.highlight(doBeautify(beautify, devData.html), { language: 'xml' }).value
        )
      }
      if (devData.normalizedHtml) {
        setHighlightedNormalized(
          hljs.highlight(doBeautify(beautify, devData.normalizedHtml), { language: 'xml' }).value
        )
      }
      if (devData.md) {
        setHighlightedMd(
          hljs.highlight(devData.md, { language: 'markdown' }).value
        )
      }
      if (rawLlmResult) {
        setHighlightedLlmMd(
          hljs.highlight(rawLlmResult, { language: 'markdown' }).value
        )
      }
      if (resultText) {
        setHighlightedLlmDisplay(
          hljs.highlight(resultText, { language: 'markdown' }).value
        )
      }
      if (parsedResponse) {
        // Reuse the vetted highlight path for the parsed-response JSON viewer
        // (T-v3.1-03-07: no raw model text injected as HTML).
        const parsedJson = JSON.stringify(
          {
            discussion: parsedResponse.discussion,
            fragments: parsedResponse.fragments,
            valid: parsedResponse.valid,
            fellBack: parsedResponse.fellBack,
            warnings: parsedResponse.warnings
          },
          null,
          2
        )
        setHighlightedParsedJson(
          hljs.highlight(parsedJson, { language: 'json' }).value
        )
      }
    })
  }, [devData, rawLlmResult, resultText, parsedResponse])

  const getFocusables = useCallback(() => {
    if (error && canRetry) {
      return [retryRef.current, closeRef.current].filter(Boolean)
    }
    if (error) {
      return [closeRef.current].filter(Boolean)
    }
    return [insertRef.current, replaceRef.current, closeRef.current].filter(
      Boolean
    )
  }, [error, canRetry])

  useEffect(() => {
    setTimeout(() => {
      if (error && canRetry && retryRef.current) {
        retryRef.current.focus()
      } else if (error && closeRef.current) {
        closeRef.current.focus()
      } else if (insertRef.current) {
        insertRef.current.focus()
      }
    }, 50)
  }, [error, canRetry])

  const handleKeyDown = useCallback(
    e => {
      const isNav =
        e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight'

      if (!isNav) return

      e.preventDefault()
      const items = getFocusables()
      if (items.length === 0) return

      const currentIndex = items.indexOf(document.activeElement)
      const backward = e.shiftKey || e.key === 'ArrowLeft'
      const next = backward
        ? (currentIndex - 1 + items.length) % items.length
        : (currentIndex + 1) % items.length

      items[next].focus()
    },
    [getFocusables]
  )

  const isDark = (theme.palette.type || theme.palette.mode) === 'dark'
  const codeBg = isDark ? '#1e1e1e' : '#f5f5f5'
  const codeColor = isDark ? '#d4d4d4' : '#333'

  const devColumnStyle = {
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }

  const devLabelStyle = {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    marginBottom: 4,
    letterSpacing: '0.5px',
    flexShrink: 0
  }

  const devPreStyle = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    padding: 12,
    borderRadius: 4,
    backgroundColor: codeBg,
    color: codeColor,
    fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
    fontSize: 11,
    lineHeight: 1.4,
    whiteSpace: 'pre',
    margin: 0
  }

  const resultContent = (
    <div
      className={styles['scribe-result-text']}
      style={{
        backgroundColor: theme.palette.action.hover,
        ...(error ? { color: theme.palette.error.main } : {}),
        ...(devData ? { flex: 1, minWidth: 0, maxHeight: 'none' } : {}),
        ...(panelSize && !devData ? { flex: 1, minHeight: 0 } : {})
      }}
    >
      {error ? error : (
        <>
          {cellWarning && (
            <div style={{
              padding: '4px 8px',
              backgroundColor: isDark ? '#5c3a00' : '#fff3cd',
              color: isDark ? '#ffc107' : '#856404',
              borderRadius: 4,
              fontSize: '0.8em',
              marginBottom: 4
            }}>
              {cellWarning}
            </div>
          )}
          <MarkdownPreview>{resultText}</MarkdownPreview>
        </>
      )}
    </div>
  )

  return (
    <Paper
      ref={paperRef}
      className={styles['scribe-result-panel']}
      elevation={0}
      onKeyDown={handleKeyDown}
      style={{
        ...(panelSize || devData ? {
          maxWidth: '95vw',
          display: 'flex',
          flexDirection: 'column'
        } : {}),
        ...(panelSize ? {
          width: panelSize.width,
          height: panelSize.height,
          maxHeight: '90vh'
        } : {}),
        ...(devData && !panelSize ? {
          width: 'auto',
          height: '90vh'
        } : {})
      }}
    >
      <div
        className={styles['scribe-result-header']}
        onMouseDown={handleDragStart}
        style={{ cursor: 'move', ...(devData ? { flexShrink: 0, flexWrap: 'wrap' } : {}) }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Typography variant="subtitle2" color="textSecondary">
            {breadcrumb}
            {devData && (
              <span
                style={{ marginLeft: 8, color: '#ff9800', fontSize: 11 }}
              >
                DEV MD
              </span>
            )}
          </Typography>
          <IconButton ref={closeRef} size="small" onClick={onClose}>
            <Icon icon={CrossIcon} size={16} />
          </IconButton>
        </div>
        {devData && (() => {
          const checkboxLabels = getDevPanelLabels(devData.source)
          return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'center', width: '100%', marginTop: 2 }}>
            {DEV_PANEL_KEYS.map(key => (
              <label
                key={key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: 10,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  marginRight: 4
                }}
                onMouseDown={e => e.stopPropagation()}
              >
                <Checkbox
                  size="small"
                  checked={devPanelPrefs[key] !== false}
                  onChange={() => toggleDevPanel(key)}
                  style={{ padding: 2 }}
                />
                <span style={{ color: theme.palette.text.secondary }}>
                  {checkboxLabels[key]}
                </span>
              </label>
            ))}
          </div>
          )
        })()}
      </div>

      {devData ? (
        <DevPanelGrid
          devPanelPrefs={devPanelPrefs}
          devColumnStyle={devColumnStyle}
          devLabelStyle={devLabelStyle}
          devPreStyle={devPreStyle}
          highlightedHtml={highlightedHtml}
          highlightedNormalized={highlightedNormalized}
          highlightedMd={highlightedMd}
          highlightedLlmMd={highlightedLlmMd}
          highlightedLlmDisplay={highlightedLlmDisplay}
          highlightedParsedJson={highlightedParsedJson}
          rawLlmResult={rawLlmResult}
          devData={devData}
          parsedResponse={parsedResponse}
          resultText={resultText}
          resultContent={resultContent}
        />
      ) : (
        resultContent
      )}

      <div
        className={styles['scribe-result-actions']}
        style={devData ? { flexShrink: 0 } : undefined}
      >
        {error ? (
          <>
            {canRetry && onRetry && (
              <Buttons
                ref={retryRef}
                variant="text"
                label={t('Scribe.button.retry')}
                startIcon={<Icon icon={SyncIcon} />}
                onClick={onRetry}
              />
            )}
          </>
        ) : (
          <>
            <Buttons
              ref={insertRef}
              label={t('Scribe.button.insert')}
              onClick={onInsert}
              disabled={insertDisabled}
              title={insertDisabled ? 'Insertion non disponible pour une selection partielle de tableau' : undefined}
            />
            <Buttons
              ref={replaceRef}
              variant="text"
              label={t('Scribe.button.replace')}
              onClick={onReplace}
            />
          </>
        )}
      </div>
      <div
        className={styles['scribe-resize-handle']}
        onMouseDown={handleResizeStart}
        tabIndex={-1}
      />
    </Paper>
  )
}

ScribeResultPanel.propTypes = {
  breadcrumb: PropTypes.string.isRequired,
  resultText: PropTypes.string.isRequired,
  rawLlmResult: PropTypes.string,
  error: PropTypes.string,
  canRetry: PropTypes.bool,
  cellWarning: PropTypes.string,
  insertDisabled: PropTypes.bool,
  onRetry: PropTypes.func,
  onReplace: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  devData: PropTypes.shape({
    html: PropTypes.string,
    normalizedHtml: PropTypes.string,
    md: PropTypes.string
  }),
  parsedResponse: PropTypes.shape({
    discussion: PropTypes.string,
    fragments: PropTypes.array,
    valid: PropTypes.bool,
    fellBack: PropTypes.bool,
    warnings: PropTypes.array
  }),
  dragOffset: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number
  }),
  onDragMove: PropTypes.func,
  panelSize: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number
  }),
  onResize: PropTypes.func
}

ScribeResultPanel.defaultProps = {
  error: '',
  canRetry: false,
  rawLlmResult: '',
  cellWarning: null,
  insertDisabled: false,
  onRetry: undefined,
  devData: null,
  parsedResponse: null,
  dragOffset: { x: 0, y: 0 },
  onDragMove: undefined,
  panelSize: null,
  onResize: undefined
}

export { ScribeResultPanel }
