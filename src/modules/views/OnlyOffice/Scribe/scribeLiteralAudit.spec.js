/**
 * Scribe literal audit — criterion-2 regression gate (I18N-01, v3.1-07-02).
 *
 * This test source-scans the USER-FACING Scribe surface files and FAILS if any
 * known hard-coded user-facing FR literal (or any hard-coded aria-label/title
 * prop string) reappears. It is the permanent net behind ROADMAP v3.1-07
 * success criterion 2: "no hard-coded Scribe UI string remains in the
 * popover/chat/result surfaces".
 *
 * SURFACES IN SCOPE (the user-facing popover / chat / result surfaces):
 *   - ScribeResultPanel.jsx
 *   - FragmentCard.jsx
 *   - ScribePopover.jsx
 *   - ScribeActionMenu.jsx
 *   - MarkdownPreview.jsx
 *   - ChatMessageList.jsx
 *
 * EXPLICITLY OUT OF SCOPE (do NOT extend this gate to scan them — per
 * v3.1-07-CONTEXT): the PROBE-01 DEVELOPER diagnostic panels rendered only
 * behind isScribeDevMd() — ParsedResponsePanel / ProbeMetricsPanel /
 * DevPanelGrid / ScribeDevPanels and the "Inspecteur dev (chat)" /
 * "DEV — inspecteur detaille" strings. Those French diagnostic strings are
 * developer-only and are NOT user-facing; the prop-literal regex below is
 * scoped so their presence in the file does NOT trip this gate.
 *
 * Dependency-free: node fs + jest globals only.
 */

import fs from 'fs'
import path from 'path'

const SURFACE_FILES = [
  'ScribeResultPanel.jsx',
  'FragmentCard.jsx',
  'ScribePopover.jsx',
  'ScribeActionMenu.jsx',
  'MarkdownPreview.jsx',
  'ChatMessageList.jsx',
  'ScribeIncludeZone.jsx',
  'ChatInput.jsx'
]

const readSurface = file =>
  fs.readFileSync(path.resolve(__dirname, file), 'utf8')

// The known FR literals extracted by v3.1-07-02. Their reappearance anywhere in
// the user surfaces is a hard regression.
const FORBIDDEN_SENTENCES = [
  'Insertion non disponible pour une selection partielle de tableau',
  'Description du panneau',
  'Copier le contenu'
]

// Bare-word literals ("Copier", "Description") legitimately appear inside the
// out-of-scope dev-panel French prose. Scope the check to hard-coded
// aria-label="/title=" PROP literals only — this matches a regression like
// `title="Copier"` but NOT `t('Scribe.button.copy')` and NOT free prose.
const FORBIDDEN_PROP_LITERAL = /(?:aria-label|title)="(?:Copier|Description)[^"]*"/

describe('Scribe literal audit (criterion-2 gate)', () => {
  const sources = SURFACE_FILES.map(file => ({ file, text: readSurface(file) }))
  const concatenated = sources.map(s => s.text).join('\n')

  it('finds no known extracted FR sentence in any user surface', () => {
    const offenders = []
    FORBIDDEN_SENTENCES.forEach(sentence => {
      sources.forEach(({ file, text }) => {
        if (text.includes(sentence)) {
          offenders.push({ file, sentence })
        }
      })
    })
    expect(offenders).toEqual([])
  })

  it('finds no hard-coded aria-label/title prop literal (Copier/Description) in the user surfaces', () => {
    const offenders = []
    sources.forEach(({ file, text }) => {
      const lines = text.split('\n')
      lines.forEach((line, idx) => {
        if (FORBIDDEN_PROP_LITERAL.test(line)) {
          offenders.push({ file, line: idx + 1, text: line.trim() })
        }
      })
    })
    expect(offenders).toEqual([])
  })

  it('confirms the extracted literals are wired through t() in ScribeResultPanel', () => {
    const text = readSurface('ScribeResultPanel.jsx')
    expect(text).toContain("t('Scribe.result.table_partial_insert_unavailable')")
    expect(text).toContain("t('Scribe.panel.description')")
    expect(text).toContain("t('Scribe.button.copy')")
  })

  it('the concatenated surface scan is non-empty (files were actually read)', () => {
    expect(concatenated.length).toBeGreaterThan(0)
  })
})
