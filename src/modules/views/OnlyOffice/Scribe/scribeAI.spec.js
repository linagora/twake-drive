import {
  buildMessages,
  buildChatSystemPrompt,
  markerPreservationClauses,
  encodeSelectionForPrompt,
  RESPONSE_CONTRACT_CORE,
  CARDINALITY_INLINE,
  CARDINALITY_CHAT,
  CHAT_PERSONA
} from './scribeAI'

describe('scribeAI — unified response contract', () => {
  describe('shared core invariant', () => {
    it('both surfaces compose the SAME hardened RESPONSE_CONTRACT_CORE', () => {
      const inline = buildMessages('free-prompt', 'hello', 'do X')[0].content
      const chat = buildChatSystemPrompt('')
      expect(inline).toContain(RESPONSE_CONTRACT_CORE)
      expect(chat).toContain(RESPONSE_CONTRACT_CORE)
    })

    it('the core asserts the separation imperatively (the v2 hardening)', () => {
      expect(RESPONSE_CONTRACT_CORE).toMatch(/ONLY there/)
      expect(RESPONSE_CONTRACT_CORE).toMatch(/MUST NOT contain or repeat/)
      expect(RESPONSE_CONTRACT_CORE).toMatch(/no code fences/)
    })
  })

  describe('per-surface cardinality', () => {
    it('inline appends EXACTLY ONE fragment, never the chat clause', () => {
      const inline = buildMessages('free-prompt', 'hello', 'do X')[0].content
      expect(inline).toContain(CARDINALITY_INLINE)
      expect(inline).toMatch(/EXACTLY ONE/)
      expect(inline).not.toContain(CARDINALITY_CHAT)
    })

    it('chat appends 0..N fragments, never the inline clause', () => {
      const chat = buildChatSystemPrompt('')
      expect(chat).toContain(CHAT_PERSONA)
      expect(chat).toContain(CARDINALITY_CHAT)
      expect(chat).toMatch(/0\.\.N fragments/)
      expect(chat).not.toContain(CARDINALITY_INLINE)
    })
  })

  describe('marker-preservation clauses (shared by both surfaces)', () => {
    it('emits table, footnote and REF clauses only when the markers are present', () => {
      expect(markerPreservationClauses('plain text')).toBe('')
      expect(markerPreservationClauses('[TABLE:0]x[/TABLE]')).toMatch(/\[TABLE:N\]/)
      expect(markerPreservationClauses('a[^scribe-fn-1]')).toMatch(/\[\^scribe-fn-N\]/)
      expect(markerPreservationClauses('{{REF:scribe-ref-1:S2}}')).toMatch(/\{\{REF:scribe-ref-N/)
      expect(markerPreservationClauses(undefined)).toBe('')
    })

    it('inline injects table/REF clauses from enrichedMd', () => {
      const content = buildMessages('free-prompt', 'sel', 'do X', {
        enrichedMd: '[TABLE:0][CELL:0,0]a[/CELL][/TABLE] {{REF:scribe-ref-1:S2}}'
      })[0].content
      expect(content).toMatch(/\[TABLE:N\]/)
      expect(content).toMatch(/\{\{REF:scribe-ref-N/)
    })

    it('chat now injects marker clauses too (previously absent — latent bug fixed)', () => {
      const chat = buildChatSystemPrompt('see [TABLE:0]x[/TABLE] and {{REF:scribe-ref-3:S4}}')
      expect(chat).toMatch(/\[TABLE:N\]/)
      expect(chat).toMatch(/\{\{REF:scribe-ref-N/)
    })

    it('chat without a marker selection carries no marker clauses', () => {
      expect(buildChatSystemPrompt('just a question')).not.toMatch(/\[TABLE:N\]/)
    })

    it('the table clause mandates a WHOLE table in a SINGLE fragment (anti-split) on BOTH surfaces', () => {
      // This is the chat-table-destructuring fix: CARDINALITY_CHAT otherwise lets
      // the model split a table across fragments / dump cells into `discussion`.
      const clause = markerPreservationClauses('[TABLE:0][CELL:0,0]a[/CELL][/TABLE]')
      expect(clause).toMatch(/WHOLE/)
      expect(clause).toMatch(/SINGLE fragment/)
      expect(clause).toMatch(/never split/i)

      const inline = buildMessages('free-prompt', 'sel', 'do X', {
        enrichedMd: '[TABLE:0][CELL:0,0]a[/CELL][/TABLE]'
      })[0].content
      const chat = buildChatSystemPrompt('[TABLE:0][CELL:0,0]a[/CELL][/TABLE]')
      expect(inline).toMatch(/SINGLE fragment/)
      expect(chat).toMatch(/SINGLE fragment/)
    })
  })

  describe('encodeSelectionForPrompt (shared selection encoder — single source of truth)', () => {
    it('prefers structured enrichedMd over html and plain text', () => {
      const { selectionMd } = encodeSelectionForPrompt({
        enrichedMd: '[TABLE:0]x[/TABLE]',
        html: '<p>ignored</p>',
        text: 'ignored too'
      })
      expect(selectionMd).toBe('[TABLE:0]x[/TABLE]')
    })

    it('falls back to plain text when no enrichedMd/html', () => {
      expect(encodeSelectionForPrompt({ text: 'just text' }).selectionMd).toBe('just text')
      expect(encodeSelectionForPrompt({}).selectionMd).toBe('')
      expect(encodeSelectionForPrompt(null).selectionMd).toBe('')
    })

    it('returns marker clauses keyed off the SAME md it encodes', () => {
      const { selectionMd, markerClauses } = encodeSelectionForPrompt({
        enrichedMd: '[TABLE:0]x[/TABLE]'
      })
      expect(markerClauses).toBe(markerPreservationClauses(selectionMd))
      expect(markerClauses).toMatch(/\[TABLE:N\]/)
    })

    it('produces the SAME selection md the popover sends (parity with buildMessages)', () => {
      const sel = { enrichedMd: '[TABLE:0][CELL:0,0]a[/CELL][/TABLE]' }
      const { selectionMd } = encodeSelectionForPrompt(sel)
      const inline = buildMessages('free-prompt', 'sel', 'do X', { enrichedMd: sel.enrichedMd })[0].content
      // The encoded selection md is what the inline path embeds verbatim as "Text:".
      expect(inline).toContain(selectionMd)
    })
  })
})
