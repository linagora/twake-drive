/**
 * Oracle — normalisation du modèle capturé (T-03, partie pure / sans OO).
 *
 * Transforme la sortie brute `{ blocks, selection }` du hook plugin `dumpState`
 * en une forme CANONIQUE et déterministe, comparable d'un run à l'autre.
 *
 * Principe : **whitelist**. On ne recopie QUE les champs connus → tout champ
 * volatil (positions OO absolues, rsid, _id, rowIndex/cellIndex de la sonde…)
 * est éliminé par construction. En plus :
 *   - artefacts OO retirés du texte : `\t` (séparateur de cellule), `\r\n`/`\r`
 *     (marque de paragraphe) ;
 *   - nbsp (charCode 160,  ) → espace (cf SELECTION-CASES.md §2) ;
 *   - flags de run falsy supprimés (on n'émet que les flags vrais) ;
 *   - sélection start==end → `collapsed: true`.
 *
 * Schéma : voir test-harness/ORACLE-SCHEMA.md
 */

const RUN_FLAGS = ['b', 'i', 'u', 's', 'code'] // bold, italic, underline, strike, code

export function normText(t) {
  return (t || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, '')
    .replace(/\r\n/g, '')
    .replace(/\r/g, '')
}

function normRun(r) {
  const out = { t: normText(r.t) }
  for (const f of RUN_FLAGS) if (r[f]) out[f] = 1
  if (r.link) out.link = r.link
  return out
}

function normParagraph(p) {
  const runs = (p.runs || [])
    .map(normRun)
    .filter(r => r.t !== '' || r.link) // drop le bruit (runs purement vides)
  const out = { type: 'p', runs }
  // Style de ¶ : absence ⇒ "Normal" (défaut). On n'émet `style`/`lvl` que
  // lorsqu'ils sont significatifs → les goldens Normal restent inchangés.
  if (p.style) out.style = p.style
  if (p.lvl != null) out.lvl = p.lvl
  return out
}

function normCell(c) {
  const out = { blocks: (c.blocks || []).map(normBlock) }
  if (c.vmerge) out.vmerge = c.vmerge // "master" | "cont"
  if (c.hspan && c.hspan > 1) out.hspan = c.hspan
  return out
}

function normTable(tb) {
  return { type: 'table', grid: (tb.grid || []).map(row => row.map(normCell)) }
}

function normBlock(b) {
  return b && b.type === 'table' ? normTable(b) : normParagraph(b)
}

function normSelection(s) {
  if (!s) return null
  const out = { start: s.start, end: s.end }
  if (JSON.stringify(s.start) === JSON.stringify(s.end)) out.collapsed = true
  return out
}

export function normalizeModel(captured) {
  captured = captured || {}
  return {
    blocks: (captured.blocks || []).map(normBlock),
    selection: normSelection(captured.selection || null)
  }
}
