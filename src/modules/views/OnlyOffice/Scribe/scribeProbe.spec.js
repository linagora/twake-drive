import {
  computeSampleMetrics,
  maxFragmentDuplication,
  detectPreamble,
  hasSplitTable,
  refIntegrity,
  recordProbeSample,
  exportCorpus,
  importCorpus,
  replay,
  aggregate,
  PREAMBLE_PATTERNS,
  PROBE_KEY,
  DUP_THRESHOLD
} from './scribeProbe'

describe('scribeProbe', () => {
  describe('detectPreamble', () => {
    it('matches a French preamble and returns fr', () => {
      expect(detectPreamble('Voici le texte traduit.')).toBe('fr')
    })

    it('matches an English preamble and returns en', () => {
      expect(detectPreamble('Here is your translation.')).toBe('en')
    })

    it('matches a German preamble and returns de', () => {
      expect(detectPreamble('Hier ist Ihr Text.')).toBe('de')
    })

    it('matches a Spanish preamble and returns es', () => {
      expect(detectPreamble('Aquí tienes el texto.')).toBe('es')
    })

    it('matches an Italian preamble and returns it', () => {
      expect(detectPreamble('Ecco il testo richiesto.')).toBe('it')
    })

    it('returns null for pure content with no preamble', () => {
      expect(detectPreamble('Le chat dort.')).toBe(null)
    })

    it('returns null for non-string input', () => {
      expect(detectPreamble(null)).toBe(null)
      expect(detectPreamble(undefined)).toBe(null)
      expect(detectPreamble(42)).toBe(null)
    })

    it('is anchored at the start (preamble phrase mid-text does not match)', () => {
      expect(detectPreamble('Le résultat : voici le texte.')).toBe(null)
    })

    it('exposes a PREAMBLE_PATTERNS table covering all five locales', () => {
      const locales = new Set(PREAMBLE_PATTERNS.map(p => p.locale))
      expect(locales.has('fr')).toBe(true)
      expect(locales.has('en')).toBe(true)
      expect(locales.has('de')).toBe(true)
      expect(locales.has('es')).toBe(true)
      expect(locales.has('it')).toBe(true)
    })
  })

  describe('maxFragmentDuplication', () => {
    it('scores ~1.0 when discussion is identical to a fragment', () => {
      const text = 'the quick brown fox jumps over the lazy dog'
      const score = maxFragmentDuplication(text, [text])
      expect(score).toBeGreaterThan(0.95)
    })

    it('scores ~0 for fully disjoint text', () => {
      const score = maxFragmentDuplication(
        'alpha beta gamma delta epsilon',
        ['nothing whatsoever shared here friend']
      )
      expect(score).toBeLessThan(0.1)
    })

    it('strips markers and punctuation before scoring', () => {
      const disc = 'the quick brown fox'
      const frag = '{{fragment:0}} [TABLE:0] the, quick! brown. fox? [/TABLE]'
      const score = maxFragmentDuplication(disc, [frag])
      expect(score).toBeGreaterThan(0.95)
    })

    it('returns 0 for empty fragments array', () => {
      expect(maxFragmentDuplication('anything here', [])).toBe(0)
    })

    it('returns 0 when discussion is empty', () => {
      expect(maxFragmentDuplication('', ['some fragment text here'])).toBe(0)
    })

    it('returns the MAX overlap across multiple fragments', () => {
      const disc = 'the quick brown fox'
      const score = maxFragmentDuplication(disc, [
        'completely different words alpha',
        'the quick brown fox'
      ])
      expect(score).toBeGreaterThan(0.95)
    })

    it('is in the 0..1 range and DUP_THRESHOLD is a number in (0,1)', () => {
      expect(typeof DUP_THRESHOLD).toBe('number')
      expect(DUP_THRESHOLD).toBeGreaterThan(0)
      expect(DUP_THRESHOLD).toBeLessThan(1)
    })
  })

  describe('hasSplitTable', () => {
    it('returns false for a balanced single-fragment table', () => {
      const parsed = {
        discussion: 'Here is the table.',
        fragments: ['[TABLE:0][CELL:0,0]a[/CELL][/TABLE]'],
        warnings: []
      }
      expect(hasSplitTable(parsed)).toBe(false)
    })

    it('returns true when the parser already flagged split-table', () => {
      const parsed = {
        discussion: 'd',
        fragments: ['[TABLE:0]unbalanced'],
        warnings: ['split-table']
      }
      expect(hasSplitTable(parsed)).toBe(true)
    })

    it('returns true when a table marker leaks into discussion', () => {
      const parsed = {
        discussion: 'Here is [TABLE:0] a leak',
        fragments: ['[TABLE:0][/TABLE]'],
        warnings: []
      }
      expect(hasSplitTable(parsed)).toBe(true)
    })

    it('returns true when a CELL marker leaks into discussion', () => {
      const parsed = {
        discussion: 'leaked [CELL:0,0] here',
        fragments: [],
        warnings: []
      }
      expect(hasSplitTable(parsed)).toBe(true)
    })

    it('returns true when a table is spread across two fragments', () => {
      const parsed = {
        discussion: 'd',
        fragments: ['[TABLE:0][CELL:0,0]a[/CELL]', '[/TABLE]'],
        warnings: []
      }
      expect(hasSplitTable(parsed)).toBe(true)
    })

    it('handles non-array fragments defensively', () => {
      expect(hasSplitTable({ discussion: 'd', fragments: null })).toBe(false)
    })
  })

  describe('refIntegrity', () => {
    it('is not broken when the input ref id is preserved across fragments', () => {
      const input = 'See {{REF:scribe-ref-1:Section 2}}.'
      const frags = ['Translated {{REF:scribe-ref-1:Sezione 2}} body.']
      const r = refIntegrity(input, frags)
      expect(r.broken).toBe(false)
      expect(r.missing).toEqual([])
      expect(r.fabricated).toEqual([])
    })

    it('is broken with missing when an input ref id is dropped', () => {
      const input = '{{REF:scribe-ref-1:A}} and {{REF:scribe-ref-2:B}}'
      const frags = ['only {{REF:scribe-ref-1:A}} kept']
      const r = refIntegrity(input, frags)
      expect(r.broken).toBe(true)
      expect(r.missing).toContain('scribe-ref-2')
    })

    it('is broken with fabricated when an output ref id was never in input', () => {
      const input = '{{REF:scribe-ref-1:A}}'
      const frags = ['{{REF:scribe-ref-1:A}} plus {{REF:scribe-ref-9:fake}}']
      const r = refIntegrity(input, frags)
      expect(r.broken).toBe(true)
      expect(r.fabricated).toContain('scribe-ref-9')
    })

    it('is not broken when only visible text changed but id intact', () => {
      const input = '{{REF:scribe-ref-1:Original Visible Text}}'
      const frags = ['{{REF:scribe-ref-1:Completely Different Text}}']
      expect(refIntegrity(input, frags).broken).toBe(false)
    })

    it('also set-diffs footnote ids [^scribe-fn-N]', () => {
      const input = 'note[^scribe-fn-1] here'
      const frags = ['no footnote at all']
      const r = refIntegrity(input, frags)
      expect(r.broken).toBe(true)
      expect(r.missing).toContain('scribe-fn-1')
    })

    it('handles non-array fragments and non-string input defensively', () => {
      expect(refIntegrity(null, null).broken).toBe(false)
    })
  })

  describe('computeSampleMetrics', () => {
    it('composes the five metrics into one object', () => {
      const parsed = {
        discussion: 'Voici le texte : {{fragment:0}}',
        fragments: ['[TABLE:0][CELL:0,0]x[/CELL][/TABLE]'],
        warnings: []
      }
      const m = computeSampleMetrics(parsed, '')
      expect(m.fragCount).toBe(1)
      expect(typeof m.duplication).toBe('number')
      expect(m.preamble).toBe(false)
      expect(m.splitTable).toBe(false)
      expect(m.refBroken).toBe(false)
    })

    it('reports preamble true when a fragment starts with a preamble', () => {
      const parsed = {
        discussion: 'd',
        fragments: ['Here is your text.'],
        warnings: []
      }
      expect(computeSampleMetrics(parsed, '').preamble).toBe(true)
    })

    it('guards non-array fragments and non-string fields defensively', () => {
      const m = computeSampleMetrics({ discussion: null, fragments: null }, null)
      expect(m.fragCount).toBe(0)
      expect(m.duplication).toBe(0)
      expect(m.preamble).toBe(false)
      expect(m.splitTable).toBe(false)
      expect(m.refBroken).toBe(false)
    })
  })

  describe('corpus persistence (record/export/import/replay/aggregate)', () => {
    beforeEach(() => {
      try {
        localStorage.removeItem(PROBE_KEY)
      } catch {
        /* ignore */
      }
    })

    const sample = (over = {}) => ({
      discussion: 'd',
      fragments: ['frag body'],
      valid: true,
      fellBack: false,
      warnings: [],
      ...over
    })

    it('records a sample and returns the new count', () => {
      expect(recordProbeSample(sample(), { surface: 'chat', inputMd: '' })).toBe(1)
      expect(recordProbeSample(sample(), { surface: 'popover', inputMd: '' })).toBe(2)
    })

    it('export then import round-trips the corpus', () => {
      recordProbeSample(sample(), { surface: 'chat', inputMd: 'x' })
      const json = exportCorpus()
      localStorage.removeItem(PROBE_KEY)
      const count = importCorpus(json)
      expect(count).toBe(1)
      const back = JSON.parse(exportCorpus())
      expect(back.samples.length).toBe(1)
      expect(back.v).toBe(1)
    })

    it('importCorpus throws on a shape/version mismatch WITHOUT mutating storage', () => {
      recordProbeSample(sample(), { surface: 'chat', inputMd: '' })
      const before = exportCorpus()
      expect(() => importCorpus('{"v":99,"samples":[]}')).toThrow()
      expect(() => importCorpus('{"v":1,"samples":"nope"}')).toThrow()
      expect(exportCorpus()).toBe(before)
    })

    it('readCorpus resets to empty on a version-mismatched stored corpus', () => {
      localStorage.setItem(PROBE_KEY, JSON.stringify({ v: 99, samples: [{}] }))
      const corpus = JSON.parse(exportCorpus())
      expect(corpus.v).toBe(1)
      expect(corpus.samples).toEqual([])
    })

    it('readCorpus resets to empty on a corrupt (non-JSON) stored corpus', () => {
      localStorage.setItem(PROBE_KEY, 'not json at all {{{')
      const corpus = JSON.parse(exportCorpus())
      expect(corpus.samples).toEqual([])
    })

    it('replay recomputes metrics LLM-free and is idempotent vs record-time', () => {
      const p = {
        discussion: 'Voici le texte : {{fragment:0}}',
        fragments: ['Here is your text.'],
        valid: true,
        fellBack: false,
        warnings: []
      }
      const recordTime = computeSampleMetrics(p, '')
      recordProbeSample(p, { surface: 'chat', inputMd: '' })
      const replayed = replay()
      expect(replayed).toHaveLength(1)
      expect(replayed[0].metrics).toEqual(recordTime)
    })

    it('aggregate yields rates for duplication/preamble and counts for splitTable/refBroken', () => {
      const samples = [
        { metrics: { fragCount: 1, duplication: 0.9, preamble: true, splitTable: true, refBroken: false } },
        { metrics: { fragCount: 0, duplication: 0.1, preamble: false, splitTable: false, refBroken: true } },
        { metrics: { fragCount: 3, duplication: 0.2, preamble: false, splitTable: false, refBroken: false } }
      ]
      const a = aggregate(samples)
      expect(a.total).toBe(3)
      // duplication >= DUP_THRESHOLD only for the 0.9 sample -> 1/3
      expect(a.dupRate).toBeCloseTo(1 / 3, 5)
      expect(a.preambleRate).toBeCloseTo(1 / 3, 5)
      // counts, not rates
      expect(a.splitTableCount).toBe(1)
      expect(a.refBrokenCount).toBe(1)
      expect(a.fragDist).toEqual({ 0: 1, 1: 1, N: 1 })
    })

    it('aggregate coverage counts per-locale, table and ref cases from tags', () => {
      const samples = [
        { metrics: { fragCount: 1, duplication: 0, preamble: false, splitTable: false, refBroken: false }, tags: { locale: 'fr', hasTable: true, hasRef: false } },
        { metrics: { fragCount: 1, duplication: 0, preamble: false, splitTable: false, refBroken: false }, tags: { locale: 'fr', hasTable: false, hasRef: true } },
        { metrics: { fragCount: 1, duplication: 0, preamble: false, splitTable: false, refBroken: false }, tags: { locale: 'en', hasTable: true, hasRef: true } }
      ]
      const a = aggregate(samples)
      expect(a.coverage.perLocale.fr).toBe(2)
      expect(a.coverage.perLocale.en).toBe(1)
      expect(a.coverage.tableCases).toBe(2)
      expect(a.coverage.refCases).toBe(2)
    })

    it('aggregate of an empty sample is all-zero, never NaN', () => {
      const a = aggregate([])
      expect(a.total).toBe(0)
      expect(a.dupRate).toBe(0)
      expect(a.preambleRate).toBe(0)
      expect(a.splitTableCount).toBe(0)
      expect(a.refBrokenCount).toBe(0)
    })

    it('ring-buffer keeps at most MAX_SAMPLES, dropping oldest', () => {
      // Record a tagged marker first, then overflow; oldest (the marker) must drop.
      recordProbeSample(sample({ discussion: 'OLDEST' }), { surface: 'chat', inputMd: '', tags: { marker: true } })
      for (let i = 0; i < 205; i++) {
        recordProbeSample(sample(), { surface: 'chat', inputMd: '' })
      }
      const corpus = JSON.parse(exportCorpus())
      expect(corpus.samples.length).toBeLessThanOrEqual(200)
      expect(corpus.samples.some(s => s.discussion === 'OLDEST')).toBe(false)
    })
  })
})
