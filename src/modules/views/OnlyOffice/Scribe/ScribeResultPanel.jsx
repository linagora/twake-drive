import PropTypes from 'prop-types'
import React, { useEffect, useRef, useCallback, useState } from 'react'
import { useI18n } from 'twake-i18n'

import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Checkbox from 'cozy-ui/transpiled/react/Checkbox'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import SyncIcon from 'cozy-ui/transpiled/react/Icons/Sync'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useTheme } from 'cozy-ui/transpiled/react/styles'

import styles from '@/modules/views/OnlyOffice/Scribe/scribe.styl'

import { MarkdownPreview } from '@/modules/views/OnlyOffice/Scribe/MarkdownPreview'
import {
  loadBeautify,
  loadHighlightJs
} from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'
import {
  aggregate,
  replay,
  exportCorpus,
  importCorpus,
  DUP_THRESHOLD
} from '@/modules/views/OnlyOffice/Scribe/scribeProbe'
import { transformCellMarkersForPreview } from '@/modules/views/OnlyOffice/Scribe/tableCellMarkers'

const DEV_PANELS_STORAGE_KEY = 'SCRIBE_DEV_MD_PANELS'

// Dev panel metadata: ordered keys + fixed (editor-agnostic) label and a longer
// description surfaced via a discreet "info" toggle next to each panel title.
// The pipeline order is: inputs (HTML / Markdown) -> prompt -> parsed contract ->
// per-fragment views (markers / display md / preview) -> quality probe.
const DEV_PANEL_KEYS = [
  'htmlSource',
  'htmlNorm',
  'mdRaw',
  'mdConverted',
  'promptSent',
  'parsedResponse',
  'llmRaw',
  'llmDisplay',
  'rendered',
  'probeMetrics'
]
const DEV_PANEL_META = {
  htmlSource: {
    label: 'HTML brut (entrée)',
    desc: "HTML de la sélection fourni par l'éditeur, lorsqu'il transmet du HTML plutôt que du Markdown. Inactif tant que l'éditeur fournit directement du Markdown."
  },
  htmlNorm: {
    label: 'HTML normalisé',
    desc: "Le HTML d'entrée après nettoyage/normalisation — étape intermédiaire avant sa conversion en Markdown."
  },
  mdRaw: {
    label: 'Markdown brut (éditeur)',
    desc: "Le Markdown fourni directement par l'éditeur, avec ses marqueurs riches ([TABLE], [CELL], {{REF}}, [^fn]), avant tout traitement. Inactif quand l'éditeur fournit du HTML."
  },
  mdConverted: {
    label: 'Markdown envoyé au LLM',
    desc: "Le Markdown réellement transmis au modèle : Markdown brut de l'éditeur, ou converti depuis le HTML, ou texte brut en dernier recours. C'est la charge utile insérée dans le prompt."
  },
  promptSent: {
    label: 'Prompt envoyé',
    desc: "Le message complet transmis au modèle : instructions système + contrat de réponse + la sélection ci-dessus + l'instruction d'action. Tout ce que le modèle reçoit."
  },
  parsedResponse: {
    label: 'Réponse parsée',
    desc: 'La réponse JSON du modèle décomposée selon le contrat : discussion, liste complète des fragments, et indicateurs valid / fellBack / warnings. La vue la plus fidèle de la sortie du modèle.'
  },
  llmRaw: {
    label: 'Fragments (marqueurs)',
    desc: "Chaque fragment insérable de la réponse, empilés et séparés, marqueurs intacts. C'est la source de réinjection. Aucun n'est encore « choisi » : le tri/normalisation dépend de la surface."
  },
  llmDisplay: {
    label: "Fragments — MD d'affichage",
    desc: 'Les mêmes fragments, marqueurs de tableau ([TABLE]/[CELL]) convertis en tables Markdown standard. REF et notes de bas de page restent en marqueurs à ce stade.'
  },
  rendered: {
    label: 'Fragments — aperçu',
    desc: "Le rendu visuel de chaque fragment (REF → texte, note → exposant, tables rendues), empilé et séparé par fragment, tel qu'il apparaîtrait une fois inséré."
  },
  probeMetrics: {
    label: 'Qualité (sonde)',
    desc: 'Métriques de respect du contrat agrégées sur le corpus enregistré (200 derniers échantillons, persistant entre sessions) : duplications discussion↔fragment, préambules parasites, tableaux scindés, références cassées/inventées, distribution des fragments, couverture.'
  }
}
const DEV_PANEL_DEFAULTS = {
  htmlSource: true,
  htmlNorm: true,
  mdRaw: true,
  mdConverted: true,
  promptSent: true,
  parsedResponse: true,
  llmRaw: true,
  llmDisplay: true,
  rendered: true,
  probeMetrics: true
}

function loadDevPanelPrefs() {
  try {
    var stored = localStorage.getItem(DEV_PANELS_STORAGE_KEY)
    if (stored) {
      var parsed = JSON.parse(stored)
      // Merge with defaults so new keys are visible
      return Object.assign({}, DEV_PANEL_DEFAULTS, parsed)
    }
  } catch {
    /* ignore */
  }
  return Object.assign({}, DEV_PANEL_DEFAULTS)
}

function saveDevPanelPrefs(prefs) {
  try {
    localStorage.setItem(DEV_PANELS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
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

// Per-fragment separator label used by the markers / display-md / preview panels.
const fragmentSeparator = i => `── Fragment réponse ${i + 1} ──`

// Plain-text (un-escaped) stacked, separator-delimited fragments — used for the
// copy-to-clipboard payload. `transform` maps a raw fragment to its shown text.
const buildFragmentsText = (fragments, transform) => {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    return '(aucun fragment)'
  }
  return fragments
    .map((f, i) => `${fragmentSeparator(i)}\n${transform ? transform(f) : f}`)
    .join('\n\n')
}

// Same as buildFragmentsText but HTML-escaped for dangerouslySetInnerHTML.
const buildFragmentsHtml = (fragments, transform) => {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    return '<em>aucun fragment dans la réponse (contenu en discussion — voir « Réponse parsée »)</em>'
  }
  return fragments
    .map(
      (f, i) =>
        `${fragmentSeparator(i)}\n${escapeHtml(transform ? transform(f) : f)}`
    )
    .join('\n\n')
}

// Human-readable rendering of the parsed contract: discussion + each fragment on
// its own block with real line breaks (NOT JSON.stringify, whose \n escapes are
// unreadable), followed by the status flags.
const formatParsedForDisplay = parsed => {
  if (!parsed) return ''
  const lines = ['discussion :', parsed.discussion || '(vide)']
  const frags = Array.isArray(parsed.fragments) ? parsed.fragments : []
  frags.forEach((f, i) => {
    lines.push('', `fragment ${i} :`, f)
  })
  lines.push('', `— valid : ${parsed.valid} · fellBack : ${parsed.fellBack}`)
  if (Array.isArray(parsed.warnings) && parsed.warnings.length) {
    lines.push(`— warnings : ${JSON.stringify(parsed.warnings)}`)
  }
  return lines.join('\n')
}

// DevPanelTitle — panel heading with a discreet "info" toggle that reveals the
// panel's description inline. Local open/close state per title.
const DevPanelTitle = ({ label, desc, labelStyle }) => {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          ...labelStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 2
        }}
      >
        <span>{label}</span>
        {desc && (
          <button
            type="button"
            onClick={() => setShowInfo(s => !s)}
            aria-label="Description du panneau"
            title="Description"
            style={{
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              padding: 0,
              fontSize: 12,
              lineHeight: 1,
              // Blue, like a clickable link.
              color: '#297EF2',
              fontWeight: showInfo ? 'bold' : 'normal'
            }}
          >
            ⓘ
          </button>
        )}
      </div>
      {showInfo && desc && (
        <div
          style={{
            fontSize: 10,
            lineHeight: 1.4,
            opacity: 0.8,
            marginBottom: 4,
            fontWeight: 'normal',
            textTransform: 'none',
            letterSpacing: 0
          }}
        >
          {desc}
        </div>
      )}
    </div>
  )
}

// Copy-to-clipboard button overlaid at the top-right INSIDE a panel's content
// area (not in the title). Brief ✓ feedback after a successful copy.
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    try {
      navigator.clipboard.writeText(text || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }, [text])
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copier le contenu"
      title="Copier"
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        zIndex: 1,
        cursor: 'pointer',
        border: 'none',
        borderRadius: 4,
        background: 'rgba(0,0,0,0.35)',
        padding: '2px 6px',
        fontSize: 11,
        lineHeight: 1.2,
        color: copied ? '#2ecc71' : '#fff'
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  )
}

// A panel content area: a syntax-highlighted <pre> with a copy button overlaid
// inside it (top-right). `html` is pre-escaped/highlighted markup.
const DevPanelPre = ({ html, copyText, devPreStyle }) => (
  <div
    style={{
      position: 'relative',
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    {copyText != null && <CopyButton text={copyText} />}
    <pre
      className="hljs"
      style={devPreStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  </div>
)

// Parsed-response panel with a raw/parsed toggle:
//  - "vraiment brute": the literal LLM response, untouched.
//  - "parsée": the readable contract when the response was well-formed; if NOT
//    (invalid format), falls back to the raw text with literal \n → real breaks.
const ParsedResponsePanel = ({
  parsedResponse,
  rawResponse,
  devColumnStyle,
  devLabelStyle,
  devPreStyle
}) => {
  const [view, setView] = useState('parsed')
  const valid = !!(parsedResponse && parsedResponse.valid)
  const parsedText = valid
    ? formatParsedForDisplay(parsedResponse)
    : (rawResponse || '').replace(/\\n/g, '\n')
  const content = view === 'raw' ? rawResponse || '' : parsedText
  const radioLabel = {
    fontSize: 11,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    cursor: 'pointer',
    marginRight: 12
  }
  return (
    <div key="parsedResponse" style={devColumnStyle}>
      <DevPanelTitle
        label={DEV_PANEL_META.parsedResponse.label}
        desc={DEV_PANEL_META.parsedResponse.desc}
        labelStyle={devLabelStyle}
      />
      <div style={{ flexShrink: 0, marginBottom: 4 }}>
        <label style={radioLabel}>
          <input
            type="radio"
            checked={view === 'parsed'}
            onChange={() => setView('parsed')}
          />
          parsée{valid ? '' : ' (format invalide → brut lisible)'}
        </label>
        <label style={radioLabel}>
          <input
            type="radio"
            checked={view === 'raw'}
            onChange={() => setView('raw')}
          />
          vraiment brute
        </label>
      </div>
      <DevPanelPre
        html={escapeHtml(content)}
        copyText={content}
        devPreStyle={devPreStyle}
      />
    </div>
  )
}

// [ASSUMED] coverage minimums (documented in GATE.md). The panel only WARNS below
// these; the gate go/no-go decision lives in GATE.md, not in this component.
const COVERAGE_MIN = { perLocale: 1, tableCases: 1, refCases: 1 }

// Standalone fallback styles so ProbeMetricsPanel can be mounted outside the
// inline DevPanelGrid (e.g. from the chat side panel) without the result-panel
// style props. When rendered inside DevPanelGrid the real styles are passed in.
const PROBE_LABEL_STYLE_DEFAULT = {
  fontSize: 10,
  fontWeight: 'bold',
  textTransform: 'uppercase',
  marginBottom: 4,
  letterSpacing: '0.5px',
  flexShrink: 0,
  opacity: 0.7
}
const PROBE_PRE_STYLE_DEFAULT = {
  flex: 1,
  overflowY: 'auto',
  padding: 12,
  borderRadius: 4,
  fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
  fontSize: 11,
  lineHeight: 1.4,
  margin: 0
}

/**
 * ProbeMetricsPanel — renders the conformance metrics + coverage produced by
 * scribeProbe.aggregate(replay()). ALL metric math lives in scribeProbe.js; this
 * component only renders the already-computed aggregate output (anti-pattern:
 * no metric computation here). Provides Export (exportCorpus) and Import
 * (importCorpus, wrapped in try/catch) controls for GATE.md evidence + offline
 * replay. Import never crashes the panel on a bad shape — it surfaces an error.
 *
 * Self-contained: reads the corpus from localStorage, so it can be mounted both
 * inside the inline DevPanelGrid and standalone from the chat side panel.
 */
export const ProbeMetricsPanel = ({
  devPreStyle = PROBE_PRE_STYLE_DEFAULT,
  devLabelStyle = PROBE_LABEL_STYLE_DEFAULT,
  label = DEV_PANEL_META.probeMetrics.label,
  desc = DEV_PANEL_META.probeMetrics.desc
}) => {
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
      setImportError(
        'Export échoué: ' + (e && e.message ? e.message : 'erreur')
      )
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
        setImportError(
          'Import rejeté: ' +
            (err && err.message ? err.message : 'forme/version invalide')
        )
      }
    }
    reader.onerror = () => setImportError('Lecture du fichier échouée')
    reader.readAsText(file)
    e.target.value = '' // allow re-importing the same file
  }, [])

  const warn = (value, min) =>
    value < min ? { color: '#ff9800', fontWeight: 'bold' } : undefined
  const flagNonZero = value =>
    value > 0 ? { color: '#f44336', fontWeight: 'bold' } : undefined
  const pct = r => (r * 100).toFixed(1) + '%'

  const localeEntries = Object.keys(stats.coverage.perLocale)

  return (
    <div
      key="probeMetrics"
      style={{
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <DevPanelTitle label={label} desc={desc} labelStyle={devLabelStyle} />
      <div style={{ ...devPreStyle, whiteSpace: 'normal', fontSize: 11 }}>
        {/* hidden version dependency so re-aggregation re-renders after import */}
        <span style={{ display: 'none' }}>{version}</span>
        <div>
          <strong>Total :</strong> {stats.total} réponses analysées
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Anomalies de séparation (% des réponses)</strong>
          <div>
            · contenu dupliqué fragment ↔ discussion (≥ {DUP_THRESHOLD}) :{' '}
            <span>{pct(stats.dupRate)}</span>
          </div>
          <div>
            · préambule parasite en tête de fragment :{' '}
            <span>{pct(stats.preambleRate)}</span>
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Erreurs bloquantes (0 toléré)</strong>
          <div>
            · tableau scindé (entre fragments / discussion) :{' '}
            <span style={flagNonZero(stats.splitTableCount)}>
              {stats.splitTableCount}
            </span>
          </div>
          <div>
            · références (REF) perdues ou inventées :{' '}
            <span style={flagNonZero(stats.refBrokenCount)}>
              {stats.refBrokenCount}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Fragments renvoyés (nb de réponses)</strong>
          <div>
            · 0 : {stats.fragDist[0]} · 1 : {stats.fragDist[1]} · ≥2 :{' '}
            {stats.fragDist.N}
          </div>
          <div style={{ opacity: 0.6, fontSize: 10, marginTop: 2 }}>
            compte les réponses selon le nombre de fragments réellement renvoyés
            (attendu : popover = 1, chat = 0..N)
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Couverture du corpus (cas testés)</strong>
          <div>
            · locales :{' '}
            <span style={warn(localeEntries.length, COVERAGE_MIN.perLocale)}>
              {localeEntries.length
                ? localeEntries
                    .map(l => `${l}:${stats.coverage.perLocale[l]}`)
                    .join(', ')
                : '—'}
            </span>
          </div>
          <div>
            · cas avec tableau :{' '}
            <span
              style={warn(stats.coverage.tableCases, COVERAGE_MIN.tableCases)}
            >
              {stats.coverage.tableCases}
            </span>
          </div>
          <div>
            · cas avec référence (REF) :{' '}
            <span style={warn(stats.coverage.refCases, COVERAGE_MIN.refCases)}>
              {stats.coverage.refCases}
            </span>
          </div>
        </div>
        {importError && (
          <div style={{ marginTop: 6, color: '#f44336' }}>{importError}</div>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={handleExport}
            style={{ fontSize: 11, cursor: 'pointer' }}
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{ fontSize: 11, cursor: 'pointer' }}
          >
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
  highlightedMdRaw,
  highlightedMd,
  promptSent,
  rawResponse,
  devData,
  parsedResponse
}) => {
  // Per-fragment views (markers / display-md / preview) iterate the FULL parsed
  // fragments array — at this stage no single fragment is "retained" yet (the
  // pick/normalization is surface-specific), so we show them all, stacked.
  const fragments = (parsedResponse && parsedResponse.fragments) || []
  const title = key => (
    <DevPanelTitle
      label={DEV_PANEL_META[key].label}
      desc={DEV_PANEL_META[key].desc}
      labelStyle={devLabelStyle}
    />
  )
  const panels = []

  if (devPanelPrefs.htmlSource !== false) {
    panels.push(
      <div key="htmlSource" style={devColumnStyle}>
        {title('htmlSource')}
        <DevPanelPre
          html={highlightedHtml || escapeHtml(devData.html)}
          copyText={devData.html || ''}
          devPreStyle={devPreStyle}
        />
      </div>
    )
  }

  if (devPanelPrefs.htmlNorm !== false) {
    panels.push(
      <div key="htmlNorm" style={devColumnStyle}>
        {title('htmlNorm')}
        <DevPanelPre
          html={highlightedNormalized || escapeHtml(devData.normalizedHtml)}
          copyText={devData.normalizedHtml || ''}
          devPreStyle={devPreStyle}
        />
      </div>
    )
  }

  if (devPanelPrefs.mdRaw !== false) {
    panels.push(
      <div key="mdRaw" style={devColumnStyle}>
        {title('mdRaw')}
        <DevPanelPre
          html={highlightedMdRaw || escapeHtml(devData.enrichedMd)}
          copyText={devData.enrichedMd || ''}
          devPreStyle={devPreStyle}
        />
      </div>
    )
  }

  if (devPanelPrefs.mdConverted !== false) {
    panels.push(
      <div key="mdConverted" style={devColumnStyle}>
        {title('mdConverted')}
        <DevPanelPre
          html={highlightedMd || escapeHtml(devData.md)}
          copyText={devData.md || ''}
          devPreStyle={devPreStyle}
        />
      </div>
    )
  }

  if (devPanelPrefs.promptSent !== false) {
    panels.push(
      <div key="promptSent" style={devColumnStyle}>
        {title('promptSent')}
        <DevPanelPre
          html={escapeHtml(promptSent)}
          copyText={promptSent || ''}
          devPreStyle={devPreStyle}
        />
      </div>
    )
  }

  // Parsed-response viewer with a raw/parsed toggle (own component for state).
  if (devPanelPrefs.parsedResponse !== false) {
    panels.push(
      <ParsedResponsePanel
        key="parsedResponse"
        parsedResponse={parsedResponse}
        rawResponse={rawResponse}
        devColumnStyle={devColumnStyle}
        devLabelStyle={devLabelStyle}
        devPreStyle={devPreStyle}
      />
    )
  }

  // Per-fragment: each response fragment with markers intact, stacked + separated.
  if (devPanelPrefs.llmRaw !== false) {
    panels.push(
      <div key="llmRaw" style={devColumnStyle}>
        {title('llmRaw')}
        <DevPanelPre
          html={buildFragmentsHtml(fragments)}
          copyText={buildFragmentsText(fragments)}
          devPreStyle={devPreStyle}
        />
      </div>
    )
  }

  // Per-fragment: same fragments with table markers turned into standard md tables.
  if (devPanelPrefs.llmDisplay !== false) {
    const toDisplay = f =>
      transformCellMarkersForPreview(f, devData.md).displayMd
    panels.push(
      <div key="llmDisplay" style={devColumnStyle}>
        {title('llmDisplay')}
        <DevPanelPre
          html={buildFragmentsHtml(fragments, toDisplay)}
          copyText={buildFragmentsText(fragments, toDisplay)}
          devPreStyle={devPreStyle}
        />
      </div>
    )
  }

  // Per-fragment: visual preview of each fragment (MarkdownPreview handles the
  // marker transforms internally), stacked + separated.
  if (devPanelPrefs.rendered !== false) {
    panels.push(
      <div key="rendered" style={devColumnStyle}>
        {title('rendered')}
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <CopyButton text={buildFragmentsText(fragments)} />
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              minHeight: 0,
              padding: 8
            }}
          >
            {fragments.length === 0 ? (
              <em style={{ opacity: 0.7, fontSize: 12 }}>
                aucun fragment dans la réponse (contenu en discussion — voir «
                Réponse parsée »)
              </em>
            ) : (
              fragments.map((f, i) => (
                <div key={i}>
                  <div
                    style={{
                      ...devLabelStyle,
                      marginTop: i === 0 ? 0 : 10,
                      opacity: 0.6
                    }}
                  >
                    {fragmentSeparator(i)}
                  </div>
                  <MarkdownPreview>{f}</MarkdownPreview>
                </div>
              ))
            )}
          </div>
        </div>
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

/**
 * ScribeDevPanels — the full dev inspector (checkbox toggles + panel grid),
 * self-contained: owns its visibility prefs, lazy syntax-highlight state, and
 * theme-derived styles. Shared by BOTH surfaces — the inline popover result panel
 * AND the chat per-turn modal — so the inspector is identical wherever it opens.
 *
 * @param {{devData: object, promptSent: string, parsedResponse: object}} props
 */
export const ScribeDevPanels = ({
  devData,
  promptSent,
  rawResponse,
  parsedResponse
}) => {
  const theme = useTheme()

  const [devPanelPrefs, setDevPanelPrefs] = useState(loadDevPanelPrefs)
  const toggleDevPanel = useCallback(key => {
    setDevPanelPrefs(prev => {
      const next = Object.assign({}, prev, { [key]: !prev[key] })
      saveDevPanelPrefs(next)
      return next
    })
  }, [])

  const [highlightedHtml, setHighlightedHtml] = useState('')
  const [highlightedNormalized, setHighlightedNormalized] = useState('')
  const [highlightedMdRaw, setHighlightedMdRaw] = useState('')
  const [highlightedMd, setHighlightedMd] = useState('')

  useEffect(() => {
    if (!devData) return undefined

    const beautifyOpts = { indent_size: 2, wrap_line_length: 80 }
    const doBeautify = (beautify, src) =>
      beautify.html_beautify
        ? beautify.html_beautify(src, beautifyOpts)
        : beautify(src, beautifyOpts)

    Promise.all([loadHighlightJs(), loadBeautify()])
      .then(([hljs, beautify]) => {
        if (devData.html) {
          setHighlightedHtml(
            hljs.highlight(doBeautify(beautify, devData.html), {
              language: 'xml'
            }).value
          )
        }
        if (devData.normalizedHtml) {
          setHighlightedNormalized(
            hljs.highlight(doBeautify(beautify, devData.normalizedHtml), {
              language: 'xml'
            }).value
          )
        }
        if (devData.enrichedMd) {
          setHighlightedMdRaw(
            hljs.highlight(devData.enrichedMd, { language: 'markdown' }).value
          )
        }
        if (devData.md) {
          setHighlightedMd(
            hljs.highlight(devData.md, { language: 'markdown' }).value
          )
        }
        return undefined
      })
      .catch(() => {
        // Dev-only highlighting; a chunk-load failure must not crash the panel.
      })
  }, [devData, parsedResponse])

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
    overflowX: 'hidden',
    padding: 12,
    borderRadius: 4,
    backgroundColor: codeBg,
    color: codeColor,
    fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
    fontSize: 11,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    margin: 0
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0,
          alignItems: 'center',
          width: '100%',
          marginBottom: 4,
          flexShrink: 0
        }}
      >
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
              {DEV_PANEL_META[key].label}
            </span>
          </label>
        ))}
      </div>
      <DevPanelGrid
        devPanelPrefs={devPanelPrefs}
        devColumnStyle={devColumnStyle}
        devLabelStyle={devLabelStyle}
        devPreStyle={devPreStyle}
        highlightedHtml={highlightedHtml}
        highlightedNormalized={highlightedNormalized}
        highlightedMdRaw={highlightedMdRaw}
        highlightedMd={highlightedMd}
        promptSent={promptSent}
        rawResponse={rawResponse}
        devData={devData}
        parsedResponse={parsedResponse}
      />
    </>
  )
}

ScribeDevPanels.propTypes = {
  devData: PropTypes.object,
  promptSent: PropTypes.string,
  rawResponse: PropTypes.string,
  parsedResponse: PropTypes.object
}

ScribeDevPanels.defaultProps = {
  devData: null,
  promptSent: '',
  rawResponse: '',
  parsedResponse: null
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
  promptSent,
  rawResponse,
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
  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0
  })
  // Resize state
  const resizeStateRef = useRef({
    resizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0
  })

  // --- Drag-to-move handlers ---
  const handleDragMove = useCallback(
    e => {
      const ds = dragStateRef.current
      if (!ds.dragging) return
      const dx = e.clientX - ds.startX
      const dy = e.clientY - ds.startY
      onDragMove({ x: ds.startOffsetX + dx, y: ds.startOffsetY + dy })
    },
    [onDragMove]
  )

  const handleDragEnd = useCallback(() => {
    dragStateRef.current.dragging = false
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
  }, [handleDragMove])

  const handleDragStart = useCallback(
    e => {
      // Skip if clicking on interactive elements (close button in header)
      let el = e.target
      while (el && el !== e.currentTarget) {
        const tag = el.tagName && el.tagName.toLowerCase()
        if (
          tag === 'button' ||
          tag === 'a' ||
          tag === 'input' ||
          tag === 'textarea'
        )
          return
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
    },
    [dragOffset, handleDragMove, handleDragEnd]
  )

  // --- Resize handlers ---
  const handleResizeMove = useCallback(
    e => {
      const rs = resizeStateRef.current
      if (!rs.resizing) return
      const maxW = window.innerWidth * 0.95
      const maxH = window.innerHeight * 0.9
      const newWidth = Math.min(
        maxW,
        Math.max(250, rs.startWidth + (e.clientX - rs.startX))
      )
      const newHeight = Math.min(
        maxH,
        Math.max(150, rs.startHeight + (e.clientY - rs.startY))
      )
      onResize({ width: newWidth, height: newHeight })
    },
    [onResize]
  )

  const handleResizeEnd = useCallback(() => {
    resizeStateRef.current.resizing = false
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
  }, [handleResizeMove])

  const handleResizeStart = useCallback(
    e => {
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
    },
    [handleResizeMove, handleResizeEnd]
  )

  // Cleanup document listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
    }
  }, [handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd])

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
      {error ? (
        error
      ) : (
        <>
          {cellWarning && (
            <div
              style={{
                padding: '4px 8px',
                backgroundColor: isDark ? '#5c3a00' : '#fff3cd',
                color: isDark ? '#ffc107' : '#856404',
                borderRadius: 4,
                fontSize: '0.8em',
                marginBottom: 4
              }}
            >
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
        ...(panelSize || devData
          ? {
              maxWidth: '95vw',
              display: 'flex',
              flexDirection: 'column'
            }
          : {}),
        ...(panelSize
          ? {
              width: panelSize.width,
              height: panelSize.height,
              maxHeight: '90vh'
            }
          : {}),
        ...(devData && !panelSize
          ? {
              // Fixed full width so the popover (centered on the viewport via
              // anchorPosition + transformOrigin center) stays centered — an
              // 'auto' width grows after async highlight/grid layout and shifts it.
              width: '95vw',
              height: '90vh'
            }
          : {})
      }}
    >
      <div
        className={styles['scribe-result-header']}
        onMouseDown={handleDragStart}
        style={{
          cursor: 'move',
          ...(devData ? { flexShrink: 0, flexWrap: 'wrap' } : {})
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Typography variant="subtitle2" color="textSecondary">
            {breadcrumb}
            {devData && (
              <span style={{ marginLeft: 8, color: '#ff9800', fontSize: 11 }}>
                DEV MD
              </span>
            )}
          </Typography>
          <IconButton ref={closeRef} size="small" onClick={onClose}>
            <Icon icon={CrossIcon} size={16} />
          </IconButton>
        </div>
      </div>

      {devData ? (
        <ScribeDevPanels
          devData={devData}
          promptSent={promptSent}
          rawResponse={rawResponse}
          parsedResponse={parsedResponse}
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
              title={
                insertDisabled
                  ? 'Insertion non disponible pour une selection partielle de tableau'
                  : undefined
              }
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
  promptSent: PropTypes.string,
  rawResponse: PropTypes.string,
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
    enrichedMd: PropTypes.string,
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
  promptSent: '',
  rawResponse: '',
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
