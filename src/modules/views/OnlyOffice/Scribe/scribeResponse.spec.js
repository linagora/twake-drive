import {
  parseScribeResponse,
  MAX_RAW_LENGTH,
  extractChannelMarkers,
  serializeAssistantTurnForHistory,
  SCRIBE_OUTPUT_SCHEMA
} from './scribeResponse'

describe('scribeResponse', () => {
  describe('parseScribeResponse', () => {
    it('parses a valid contract object (happy path)', () => {
      const raw = '{"discussion":"hi","fragments":["a","b"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.discussion).toBe('hi')
      expect(r.fragments).toEqual(['a', 'b'])
      expect(r.valid).toBe(true)
      expect(r.fellBack).toBe(false)
      expect(Array.isArray(r.warnings)).toBe(true)
    })

    it('parses JSON wrapped in a ```json fence', () => {
      const raw = '```json\n{"discussion":"hi","fragments":["a"]}\n```'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.discussion).toBe('hi')
      expect(r.fragments).toEqual(['a'])
      expect(r.fellBack).toBe(false)
    })

    it('extracts the first balanced object from prose-wrapped text', () => {
      const raw =
        'Sure, here is the JSON: {"discussion":"hi","fragments":[]} Let me know!'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.discussion).toBe('hi')
      expect(r.fragments).toEqual([])
      expect(r.fellBack).toBe(false)
    })

    it('repairs a trailing comma before } and ]', () => {
      const raw = '{"discussion":"x","fragments":["a",],}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.discussion).toBe('x')
      expect(r.fragments).toEqual(['a'])
      expect(r.fellBack).toBe(false)
    })

    it('uses string-aware brace matching (braces inside strings do not truncate)', () => {
      const raw = '{"discussion":"d","fragments":["a } b { c"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.fragments).toEqual(['a } b { c'])
      expect(r.fellBack).toBe(false)
    })

    it('normalizes absent fragments to []', () => {
      const raw = '{"discussion":"only"}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.fragments).toEqual([])
      expect(r.valid).toBe(true)
    })

    it('drops non-string fragment elements with a warning', () => {
      const raw = '{"discussion":"d","fragments":["ok",123,null]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.fragments).toEqual(['ok'])
      expect(r.warnings).toContain('non-string-fragment-dropped')
    })

    it('coerces null/missing discussion to empty string', () => {
      const raw = '{"discussion":null,"fragments":["a"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.discussion).toBe('')
      expect(r.valid).toBe(true)
    })

    it('flags a fragment with an unmatched table marker as split-table', () => {
      const raw = '{"discussion":"d","fragments":["before [TABLE:0] orphan"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.valid).toBe(false)
      expect(r.warnings).toContain('split-table')
    })

    it('flags a stray closing [/CELL] marker as split-table', () => {
      const raw = '{"discussion":"d","fragments":["dangling [/CELL] here"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.valid).toBe(false)
      expect(r.warnings).toContain('split-table')
    })

    it('does NOT flag a fully balanced [TABLE:0]...[/TABLE] fragment', () => {
      const raw =
        '{"discussion":"d","fragments":["[TABLE:0][CELL:0,0]x[/CELL][/TABLE]"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.warnings).not.toContain('split-table')
    })

    it('falls back to discussion=raw, fragments=[] on the chat surface', () => {
      const raw = 'totally not json at all'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.discussion).toBe(raw)
      expect(r.fragments).toEqual([])
      expect(r.valid).toBe(false)
      expect(r.fellBack).toBe(true)
    })

    it('falls back to discussion="", fragments=[raw] on the popover surface', () => {
      const raw = 'totally not json at all'
      const r = parseScribeResponse(raw, { surface: 'popover' })
      expect(r.discussion).toBe('')
      expect(r.fragments).toEqual([raw])
      expect(r.valid).toBe(false)
      expect(r.fellBack).toBe(true)
    })

    it('treats an unknown/missing surface as chat-style fallback', () => {
      const raw = 'totally not json at all'
      const rUnknown = parseScribeResponse(raw, { surface: 'wat' })
      expect(rUnknown.discussion).toBe(raw)
      expect(rUnknown.fragments).toEqual([])
      const rNoOpts = parseScribeResponse(raw)
      expect(rNoOpts.discussion).toBe(raw)
      expect(rNoOpts.fragments).toEqual([])
    })

    it('never throws on adversarial / non-string input', () => {
      const inputs = [
        '',
        null,
        undefined,
        42,
        {},
        '[]',
        '"bare string"',
        '{"discussion":"x'
      ]
      for (const input of inputs) {
        expect(() =>
          parseScribeResponse(input, { surface: 'chat' })
        ).not.toThrow()
        const r = parseScribeResponse(input, { surface: 'chat' })
        expect(typeof r).toBe('object')
        expect(r).not.toBeNull()
      }
    })

    it('always preserves raw as the original input coerced to a string', () => {
      expect(parseScribeResponse(42, { surface: 'chat' }).raw).toBe('42')
      expect(parseScribeResponse(null, { surface: 'chat' }).raw).toBe('null')
      const raw = '{"discussion":"hi"}'
      expect(parseScribeResponse(raw, { surface: 'chat' }).raw).toBe(raw)
    })

    it('returns all documented keys on every path', () => {
      const keys = [
        'discussion',
        'fragments',
        'valid',
        'fellBack',
        'warnings',
        'raw'
      ]
      const ok = parseScribeResponse('{"discussion":"hi"}', { surface: 'chat' })
      const bad = parseScribeResponse('nope', { surface: 'popover' })
      for (const k of keys) {
        expect(Object.prototype.hasOwnProperty.call(ok, k)).toBe(true)
        expect(Object.prototype.hasOwnProperty.call(bad, k)).toBe(true)
      }
    })
  })

  describe('parseScribeResponse — security hardening', () => {
    it('does not pollute Object.prototype via a __proto__ key', () => {
      const raw =
        '{"discussion":"x","fragments":["a"],"__proto__":{"polluted":true}}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.discussion).toBe('x')
      expect(r.fragments).toEqual(['a'])
      expect({}.polluted).toBeUndefined()
    })

    it('does not pollute Object.prototype via a constructor.prototype key', () => {
      const raw =
        '{"constructor":{"prototype":{"polluted":true}},"discussion":"x"}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.discussion).toBe('x')
      expect({}.polluted).toBeUndefined()
    })

    it('result object exposes only documented own keys (no inherited pollution)', () => {
      const raw = '{"discussion":"x","__proto__":{"polluted":true}}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.polluted).toBeUndefined()
      expect(Object.keys(r).sort()).toEqual(
        [
          'discussion',
          'fellBack',
          'fragments',
          'raw',
          'valid',
          'warnings'
        ].sort()
      )
    })

    it('short-circuits to a fallback when raw exceeds MAX_RAW_LENGTH', () => {
      const raw = 'x'.repeat(MAX_RAW_LENGTH + 1)
      let r
      expect(() => {
        r = parseScribeResponse(raw, { surface: 'chat' })
      }).not.toThrow()
      expect(r.fellBack).toBe(true)
      expect(r.warnings).toContain('input-too-large')
    })

    it('is ReDoS-safe: ~50k adversarial input completes well under 1s', () => {
      const adversarial = '`'.repeat(25000) + '{'.repeat(25000)
      const start = Date.now()
      expect(() =>
        parseScribeResponse(adversarial, { surface: 'chat' })
      ).not.toThrow()
      expect(Date.now() - start).toBeLessThan(1000)
    })
  })

  describe('extractChannelMarkers', () => {
    it('returns ordered fragment hits with index and position', () => {
      const text = 'a {{fragment:0}} b {{fragment:2}} c'
      const hits = extractChannelMarkers(text, 'fragment')
      expect(hits.map(h => h.index)).toEqual([0, 2])
      expect(hits[0].position).toBeLessThan(hits[1].position)
      expect(hits[0].position).toBe(text.indexOf('{{fragment:0}}'))
    })

    it('returns [] when the channel does not appear', () => {
      expect(extractChannelMarkers('no markers here', 'fragment')).toEqual([])
    })

    it('returns [] for non-string text', () => {
      expect(extractChannelMarkers(null, 'fragment')).toEqual([])
      expect(extractChannelMarkers(42, 'fragment')).toEqual([])
    })

    it('never matches {{REF:scribe-ref-N:...}} cross-ref markers (CONTRACT-04)', () => {
      const text = 'before {{REF:scribe-ref-3:Voici la section}} after'
      const hits = extractChannelMarkers(text, 'fragment')
      expect(hits).toEqual([])
      // read-only: the REF substring is unaffected
      expect(text).toContain('{{REF:scribe-ref-3:Voici la section}}')
    })

    it('picks only fragment indices in mixed REF/fragment text', () => {
      const text =
        '{{fragment:0}} then {{REF:scribe-ref-1:x}} then {{fragment:1}}'
      const hits = extractChannelMarkers(text, 'fragment')
      expect(hits.map(h => h.index)).toEqual([0, 1])
    })

    it('is 0-indexed: {{fragment:0}} is the first fragment', () => {
      const hits = extractChannelMarkers('{{fragment:0}}', 'fragment')
      expect(hits[0].index).toBe(0)
    })
  })

  describe('parseScribeResponse — marker cross-check', () => {
    it('preserves a {{REF:scribe-ref-7:link}} inside a fragment body verbatim', () => {
      const raw =
        '{"discussion":"d","fragments":["see {{REF:scribe-ref-7:link}} here"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.fragments[0]).toContain('{{REF:scribe-ref-7:link}}')
    })

    it('warns fragment-marker-out-of-range when a marker exceeds fragments.length', () => {
      const raw = '{"discussion":"see {{fragment:5}}","fragments":["a","b"]}'
      let r
      expect(() => {
        r = parseScribeResponse(raw, { surface: 'chat' })
      }).not.toThrow()
      expect(r.fellBack).toBe(false)
      expect(r.warnings).toContain('fragment-marker-out-of-range')
    })

    it('warns fragment-not-referenced when a fragment has no marker', () => {
      const raw = '{"discussion":"only {{fragment:0}}","fragments":["a","b"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.warnings).toContain('fragment-not-referenced')
    })

    it('does not warn when every fragment is referenced in range', () => {
      const raw =
        '{"discussion":"{{fragment:0}} and {{fragment:1}}","fragments":["a","b"]}'
      const r = parseScribeResponse(raw, { surface: 'chat' })
      expect(r.warnings).not.toContain('fragment-marker-out-of-range')
      expect(r.warnings).not.toContain('fragment-not-referenced')
    })
  })

  describe('serializeAssistantTurnForHistory', () => {
    it('returns a string containing discussion + a compact fragment note', () => {
      const out = serializeAssistantTurnForHistory({
        discussion: 'See {{fragment:0}}',
        fragments: ['Le chat dort.']
      })
      expect(typeof out).toBe('string')
      expect(out).toContain('See {{fragment:0}}')
      expect(out).toContain('fragment')
    })

    it('truncates long fragment bodies (does not emit the full body)', () => {
      const longBody = 'X'.repeat(5000)
      const out = serializeAssistantTurnForHistory({
        discussion: 'd',
        fragments: [longBody]
      })
      expect(out).not.toContain(longBody)
      expect(out.length).toBeLessThan('d'.length + longBody.length)
    })

    it('returns just the discussion when there are no fragments', () => {
      expect(
        serializeAssistantTurnForHistory({ discussion: 'hello', fragments: [] })
      ).toBe('hello')
    })

    it('uses a stable English note label (not i18n)', () => {
      const out = serializeAssistantTurnForHistory({
        discussion: 'd',
        fragments: ['a']
      })
      expect(out.toLowerCase()).toContain('fragment')
      // no French/German localized label leaks
      expect(out).not.toMatch(/produit|fragmente|abschnitt/i)
    })

    it('always returns a plain string, never an object', () => {
      expect(
        typeof serializeAssistantTurnForHistory({
          discussion: 'd',
          fragments: ['a']
        })
      ).toBe('string')
      expect(typeof serializeAssistantTurnForHistory({})).toBe('string')
    })
  })

  describe('SCRIBE_OUTPUT_SCHEMA', () => {
    it('declares discussion (string) and fragments (array of strings)', () => {
      expect(SCRIBE_OUTPUT_SCHEMA).toBeDefined()
      expect(SCRIBE_OUTPUT_SCHEMA.properties.discussion.type).toBe('string')
      expect(SCRIBE_OUTPUT_SCHEMA.properties.fragments.type).toBe('array')
      expect(SCRIBE_OUTPUT_SCHEMA.properties.fragments.items.type).toBe(
        'string'
      )
      expect(SCRIBE_OUTPUT_SCHEMA.required).toContain('discussion')
    })
  })
})
