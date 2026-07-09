import { buildAssistantSegments } from './assistantSegments'

describe('assistantSegments', () => {
  describe('buildAssistantSegments', () => {
    // CONTRACT-02 / D-05 — a 0-fragment response yields a single prose segment,
    // never a card segment, so the chat renders no insertion UI.
    it('(CONTRACT-02) returns a single prose segment and NO card when there are 0 fragments', () => {
      const segments = buildAssistantSegments('hello', [])
      expect(segments).toEqual([{ type: 'prose', md: 'hello' }])
      expect(segments.some(s => s.type === 'card')).toBe(false)
    })

    it('(CONTRACT-02) returns one empty-prose segment for empty discussion + no fragments', () => {
      const segments = buildAssistantSegments('', [])
      expect(segments).toEqual([{ type: 'prose', md: '' }])
      expect(segments.some(s => s.type === 'card')).toBe(false)
    })

    // FRAG-01 — a card is emitted at the marker position, between the surrounding prose.
    it('(FRAG-01) emits ordered prose/card/prose around a {{fragment:0}} marker', () => {
      const segments = buildAssistantSegments('A {{fragment:0}} B', ['FRAG0'])
      expect(segments).toEqual([
        { type: 'prose', md: 'A ' },
        { type: 'card', index: 0, raw: 'FRAG0' },
        { type: 'prose', md: ' B' }
      ])
    })

    it('(FRAG-01) is 0-indexed: {{fragment:0}} resolves to fragments[0]', () => {
      const segments = buildAssistantSegments('{{fragment:0}}', ['first', 'second'])
      const cards = segments.filter(s => s.type === 'card')
      // first card encountered is the inline {{fragment:0}} → fragments[0]
      expect(cards[0]).toEqual({ type: 'card', index: 0, raw: 'first' })
    })

    // D-04 — orphan (unreferenced) fragments are appended after all prose, in fragment order.
    it('(D-04) appends orphan fragments as cards at the end, in fragment order', () => {
      const segments = buildAssistantSegments('only prose', ['X', 'Y'])
      expect(segments).toEqual([
        { type: 'prose', md: 'only prose' },
        { type: 'card', index: 0, raw: 'X' },
        { type: 'card', index: 1, raw: 'Y' }
      ])
    })

    it('(D-04) mixes an inline referenced card with an orphan card appended at the end', () => {
      const segments = buildAssistantSegments('see {{fragment:1}} here', ['a', 'b'])
      // inline card for index 1, then orphan card for index 0 appended at the end
      const cards = segments.filter(s => s.type === 'card')
      expect(cards).toEqual([
        { type: 'card', index: 1, raw: 'b' },
        { type: 'card', index: 0, raw: 'a' }
      ])
      // the inline card appears before the trailing prose " here"
      const inlineIdx = segments.findIndex(
        s => s.type === 'card' && s.index === 1
      )
      const tailProseIdx = segments.findIndex(
        s => s.type === 'prose' && s.md === ' here'
      )
      expect(inlineIdx).toBeGreaterThanOrEqual(0)
      expect(tailProseIdx).toBeGreaterThan(inlineIdx)
      // orphan index 0 is the LAST segment
      expect(segments[segments.length - 1]).toEqual({
        type: 'card',
        index: 0,
        raw: 'a'
      })
    })

    // REF-safety / CONTRACT-04 — a {{REF:...}} cross-ref marker survives untouched in prose;
    // only the {{fragment:N}} marker is replaced by a card.
    it('(REF-safety) leaves {{REF:scribe-ref-2:Figure 1}} intact in prose, replacing only the fragment marker', () => {
      const disc = 'See {{REF:scribe-ref-2:Figure 1}} then {{fragment:0}} done'
      const segments = buildAssistantSegments(disc, ['INSERT'])
      const proseMds = segments
        .filter(s => s.type === 'prose')
        .map(s => s.md)
        .join('')
      // the REF marker text survives verbatim in a prose segment
      expect(proseMds).toContain('{{REF:scribe-ref-2:Figure 1}}')
      // exactly one card was produced for the fragment marker
      const cards = segments.filter(s => s.type === 'card')
      expect(cards).toEqual([{ type: 'card', index: 0, raw: 'INSERT' }])
      // no prose segment still contains the consumed fragment marker
      expect(proseMds).not.toContain('{{fragment:0}}')
    })

    // Out-of-range skip — a dangling {{fragment:5}} with only 1 fragment is stripped from
    // prose and never resolved to a card.
    it('(out-of-range) strips a dangling {{fragment:5}} marker and emits no card for it', () => {
      const segments = buildAssistantSegments('before {{fragment:5}} after', ['only'])
      const proseMds = segments
        .filter(s => s.type === 'prose')
        .map(s => s.md)
        .join('')
      expect(proseMds).not.toContain('{{fragment:5}}')
      expect(segments.some(s => s.type === 'card' && s.index === 5)).toBe(false)
      // the lone fragment is unreferenced → appended as an orphan card
      expect(segments.some(s => s.type === 'card' && s.index === 0 && s.raw === 'only')).toBe(true)
    })

    it('(card.raw verbatim) keeps card.raw === fragments[index] with markers intact', () => {
      const raw = 'text {{REF:scribe-ref-1:Tbl}} [TABLE:0] more'
      const segments = buildAssistantSegments('x {{fragment:0}} y', [raw])
      const card = segments.find(s => s.type === 'card')
      expect(card.raw).toBe(raw)
    })

    // Non-string / non-array guards — never throw; coerce to one empty-prose segment.
    it('(non-string guard) returns one empty-prose segment for undefined/undefined', () => {
      expect(buildAssistantSegments(undefined, undefined)).toEqual([
        { type: 'prose', md: '' }
      ])
    })

    it('(non-string guard) returns one empty-prose segment for null discussion + non-array fragments', () => {
      expect(buildAssistantSegments(null, 'notarray')).toEqual([
        { type: 'prose', md: '' }
      ])
    })
  })
})
