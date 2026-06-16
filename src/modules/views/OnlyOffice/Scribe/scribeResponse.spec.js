import { parseScribeResponse } from './scribeResponse'

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
      const raw = 'Sure, here is the JSON: {"discussion":"hi","fragments":[]} Let me know!'
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
        expect(() => parseScribeResponse(input, { surface: 'chat' })).not.toThrow()
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
      const keys = ['discussion', 'fragments', 'valid', 'fellBack', 'warnings', 'raw']
      const ok = parseScribeResponse('{"discussion":"hi"}', { surface: 'chat' })
      const bad = parseScribeResponse('nope', { surface: 'popover' })
      for (const k of keys) {
        expect(Object.prototype.hasOwnProperty.call(ok, k)).toBe(true)
        expect(Object.prototype.hasOwnProperty.call(bad, k)).toBe(true)
      }
    })
  })
})
