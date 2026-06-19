/**
 * fixtures.mjs — Input corpus for the gate harness.
 *
 * Each fixture: { id, surface, action, input, locale, tags }
 *  - action : an id present in prompt.mjs ACTION_TEMPLATES
 *  - input  : the selection markdown (plays the role of enrichedMd)
 *  - locale : the OUTPUT language ('fr'|'en'|'de'|'es'|'it') — for translate this
 *             is the target; for correct/rewrite it is the input language. Drives
 *             scribeProbe coverage.perLocale and per-locale preamble detection.
 *  - tags   : { locale, hasTable, hasRef, curated } passed straight to the corpus.
 *
 * IMPORTANT (lesson from manual testing): do NOT use self-referential / meta
 * sentences ("Here is the translation…", "The following is a summary…"). On those,
 * the model's legitimate conversational preamble collapses onto the translated
 * content and falsely trips the duplication metric. Use ordinary document prose.
 *
 * Table / REF cases (the two ZERO-TOLERANCE hard blockers, GATE thresholds #4/#5,
 * coverage #8/#9) need realistic enrichedMd carrying the OO plugin's marker
 * grammar. They live in captured/*.json and are loaded by loadCaptured() below —
 * see README.md for the capture workflow.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

// Neutral, non-meta source paragraphs (English) used for translate fixtures.
const SOURCES = [
  'The committee will meet on Thursday afternoon to review the quarterly budget and approve the new hiring plan.',
  'Our team has spent the last three months redesigning the onboarding flow so that new users reach their first success faster.',
  'Please remember to back up your files before the migration, as the old server will be decommissioned next week.',
  'The garden behind the house was full of lavender and rosemary, and the bees worked steadily through the warm morning.',
  'Although the results were promising, the authors caution that the sample size was small and further studies are needed.'
]

const TARGETS = [
  { locale: 'en', action: 'translate-en' },
  { locale: 'fr', action: 'translate-fr' },
  { locale: 'de', action: 'translate-de' },
  { locale: 'es', action: 'translate-es' },
  { locale: 'it', action: 'translate-it' }
]

const translateFixtures = []
for (const t of TARGETS) {
  // Skip translating an English source into English; use a French source instead
  // so the 'en' bucket still exercises a real translation.
  const sources = t.locale === 'en'
    ? [
        'Le rapport doit être remis avant la fin du mois afin que la direction puisse le présenter au conseil.',
        'La nouvelle politique de télétravail entrera en vigueur dès le premier lundi de septembre.',
        'Nous avons constaté une amélioration nette de la satisfaction client depuis le déploiement de la mise à jour.',
        'Le jardin derrière la maison était rempli de lavande et de romarin, et les abeilles butinaient sans relâche.',
        'Bien que les résultats soient encourageants, les auteurs rappellent que l’échantillon reste limité.'
      ]
    : SOURCES
  sources.forEach((input, i) => {
    translateFixtures.push({
      id: `tr-${t.locale}-${i + 1}`,
      surface: 'popover',
      action: t.action,
      input,
      locale: t.locale,
      tags: { locale: t.locale, hasTable: false, hasRef: false, curated: true }
    })
  })
}

// Native-language rewrite / correct fixtures (output language == input language).
const nativeFixtures = [
  { id: 'rw-fr-1', surface: 'popover', action: 'rewrite-professional', locale: 'fr',
    input: 'Salut, j’ai vu ton mail. Bon, en gros on peut pas livrer mardi, faut décaler.' },
  { id: 'cg-fr-1', surface: 'popover', action: 'correct-grammar', locale: 'fr',
    input: 'Les equipe on travailler tres dur ce trimestre et il on atteint tout leur objectif.' },
  { id: 'rw-en-1', surface: 'popover', action: 'rewrite-polite', locale: 'en',
    input: 'Send me the numbers now, I can’t wait any longer for this.' },
  { id: 'cg-en-1', surface: 'popover', action: 'correct-grammar', locale: 'en',
    input: 'Their is alot of reasons why the project was delay, but we is back on track now.' },
  { id: 'rw-de-1', surface: 'popover', action: 'rewrite-casual', locale: 'de',
    input: 'Sehr geehrte Damen und Herren, hiermit teile ich Ihnen die Verschiebung des Termins mit.' },
  { id: 'rw-es-1', surface: 'popover', action: 'rewrite-professional', locale: 'es',
    input: 'Oye, al final no llego a la reunión, tengo lío. Lo vemos otro día, ¿vale?' },
  { id: 'rw-it-1', surface: 'popover', action: 'rewrite-polite', locale: 'it',
    input: 'Mandami subito il preventivo, non ho tutto il giorno da aspettare.' }
]

/**
 * Load every captured/*.json case file and normalize it into a fixture.
 *
 * File shape: { source: 'seed'|'live', cases: [{ id, surface?, action, input,
 * locale, tags:{hasTable?,hasRef?} }] }. The `curated` tag is derived from
 * `source` (live captures → curated:false). Missing captured/ dir → []. A
 * malformed file throws with its path so the harness aborts loudly rather than
 * silently undercounting coverage.
 *
 * @returns {Array<object>}
 */
function loadCaptured() {
  const dir = join(HERE, 'captured')
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    const path = join(dir, name)
    let doc
    try {
      doc = JSON.parse(readFileSync(path, 'utf8'))
    } catch (e) {
      throw new Error(`fixtures.mjs: cannot parse captured file ${name}: ${e.message}`)
    }
    if (!doc || !Array.isArray(doc.cases)) {
      throw new Error(`fixtures.mjs: captured file ${name} has no "cases" array`)
    }
    const live = doc.source === 'live'
    doc.cases.forEach((c, i) => {
      if (!c || !c.action || typeof c.input !== 'string' || !c.locale) {
        throw new Error(`fixtures.mjs: ${name} case #${i} missing action/input/locale`)
      }
      const t = c.tags || {}
      out.push({
        id: c.id || `${name.replace(/\.json$/, '')}-${i + 1}`,
        surface: c.surface || 'popover',
        action: c.action,
        input: c.input,
        locale: c.locale,
        tags: {
          locale: c.locale,
          hasTable: !!t.hasTable,
          hasRef: !!t.hasRef,
          curated: !live
        }
      })
    })
  }
  return out
}

export const FIXTURES = [...translateFixtures, ...nativeFixtures, ...loadCaptured()]
