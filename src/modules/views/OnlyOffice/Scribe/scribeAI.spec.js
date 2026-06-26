import {
  buildMessages,
  buildChatSystemPrompt,
  markerPreservationClauses,
  encodeSelectionForPrompt,
  callScribeAIWithReask,
  REASK_CORRECTION_NUDGE,
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

  describe('D-05 conditional context-source framing (v3.2-02)', () => {
    it('no flags (or both false) => byte-identical to the marker-only prompt (regression)', () => {
      const baseline =
        CHAT_PERSONA +
        '\n\n' +
        RESPONSE_CONTRACT_CORE +
        CARDINALITY_CHAT +
        markerPreservationClauses('')
      expect(buildChatSystemPrompt('')).toBe(baseline)
      expect(buildChatSystemPrompt('', {})).toBe(baseline)
      expect(
        buildChatSystemPrompt('', { includeSelection: false, includeDiscussion: false })
      ).toBe(baseline)
    })

    it('{ includeSelection: true } appends a short selection announcement, contract still contiguous', () => {
      const out = buildChatSystemPrompt('', { includeSelection: true })
      expect(out).toMatch(/selection from the document/i)
      // contract block stays contiguous and unmodified
      expect(out).toContain(RESPONSE_CONTRACT_CORE + CARDINALITY_CHAT)
      // framing comes AFTER the contract block, not between core and cardinality
      expect(out.indexOf('selection from the document')).toBeGreaterThan(
        out.indexOf(CARDINALITY_CHAT)
      )
    })

    it('{ includeDiscussion: true } appends a short discussion announcement', () => {
      const out = buildChatSystemPrompt('', { includeDiscussion: true })
      expect(out).toMatch(/Earlier turns of this conversation/i)
    })

    it('both flags append both announcements; selection still keyed off selectionMd markers', () => {
      const out = buildChatSystemPrompt('[TABLE:0]x[/TABLE]', {
        includeSelection: true,
        includeDiscussion: true
      })
      expect(out).toMatch(/selection from the document/i)
      expect(out).toMatch(/Earlier turns of this conversation/i)
      expect(out).toMatch(/\[TABLE:N\]/) // marker clauses still present for the selection md
    })

    it('the framing carries NO enumerated multi-source frame and NO meta-comment incitement', () => {
      const out = buildChatSystemPrompt('', {
        includeSelection: true,
        includeDiscussion: true
      })
      // no "1. ... 2. ... 3. ..." enumerated context frame (that is v3.2-03)
      expect(out).not.toMatch(/1\.\s*(history|selection|document)/i)
      expect(out).not.toMatch(/judge the relevance/i)
      // no instruction to mention/list the provided contexts in the reply
      expect(out).not.toMatch(/mention (the|these) (context|sources)/i)
      expect(out).not.toMatch(/list the (context|sources)/i)
    })

    it('the framing does NOT weaken the contract strings (identity unchanged)', () => {
      const out = buildChatSystemPrompt('', {
        includeSelection: true,
        includeDiscussion: true
      })
      expect(out).toContain(RESPONSE_CONTRACT_CORE)
      expect(out).toContain(CARDINALITY_CHAT)
      expect(out).toContain(CHAT_PERSONA)
    })
  })

  describe('v3.2-03 includeDocument framing (CTX-LLM-01, D-06)', () => {
    const baseline =
      CHAT_PERSONA +
      '\n\n' +
      RESPONSE_CONTRACT_CORE +
      CARDINALITY_CHAT +
      markerPreservationClauses('')

    it('{ includeDocument: false } (or absent) is byte-identical to the no-flag baseline', () => {
      expect(buildChatSystemPrompt('', { includeDocument: false })).toBe(baseline)
      // absent => unchanged (regression: existing call sites stay byte-identical)
      expect(buildChatSystemPrompt('', {})).toBe(baseline)
    })

    it('{ includeDocument: true } appends ONE short document-reference sentence after the contract block', () => {
      const out = buildChatSystemPrompt('', { includeDocument: true })
      expect(out).toMatch(/full document is provided below for reference/i)
      // contract block stays contiguous and the framing comes AFTER it
      expect(out).toContain(RESPONSE_CONTRACT_CORE + CARDINALITY_CHAT)
      expect(out.indexOf('full document is provided')).toBeGreaterThan(
        out.indexOf(CARDINALITY_CHAT)
      )
    })

    it('document alone does NOT add the combined doc+selection focus clause', () => {
      const out = buildChatSystemPrompt('', { includeDocument: true })
      expect(out).not.toMatch(/focus within that document/i)
    })

    it('BOTH document and selection => the document sentence + ONE combined focus clause (D-04)', () => {
      const out = buildChatSystemPrompt('', {
        includeDocument: true,
        includeSelection: true
      })
      expect(out).toMatch(/full document is provided below for reference/i)
      expect(out).toMatch(/selection from the document/i)
      expect(out).toMatch(/focus within that document/i)
    })

    it('the document framing carries NO enumerated list and no "mention the sources" incitement', () => {
      const out = buildChatSystemPrompt('', {
        includeDocument: true,
        includeSelection: true,
        includeDiscussion: true
      })
      expect(out).not.toMatch(/1\.\s*(history|selection|document)/i)
      expect(out).not.toMatch(/judge the relevance/i)
      expect(out).not.toMatch(/mention (the|these) (context|sources)/i)
      expect(out).not.toMatch(/list the (context|sources)/i)
    })

    it('the document framing does NOT weaken the frozen contract strings', () => {
      const out = buildChatSystemPrompt('', { includeDocument: true })
      expect(out).toContain(RESPONSE_CONTRACT_CORE)
      expect(out).toContain(CARDINALITY_CHAT)
      expect(out).toContain(CHAT_PERSONA)
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

describe('callScribeAIWithReask — single corrective re-ask (HARDEN-01)', () => {
  // Build a fake CozyClient whose stackClient.fetchJSON returns the queued
  // response contents in order. Each queued entry is the model `content` string
  // (callScribeAI reads response.content first). A function entry is invoked
  // with the request body so a test can throw (e.g. AbortError) on a given call.
  const makeClient = queue => {
    const fetchJSON = jest.fn(async (method, url, body) => {
      const next = queue.shift()
      if (typeof next === 'function') return next(body)
      return { content: next }
    })
    return { client: { stackClient: { fetchJSON } }, fetchJSON }
  }

  const VALID = JSON.stringify({
    discussion: 'Here you go: {{fragment:0}}',
    fragments: ['the transformed text']
  })
  const SPLIT_TABLE = JSON.stringify({
    discussion: '',
    fragments: ['[TABLE:0][CELL:0,0]a[/CELL]'] // unbalanced -> valid:false
  })
  const NON_JSON = 'totally not json at all'

  const baseMessages = [{ role: 'user', content: 'transform this' }]

  it('issues exactly ONE transport call when the first response parses cleanly', async () => {
    const { client, fetchJSON } = makeClient([VALID])
    const parsed = await callScribeAIWithReask(client, baseMessages, {
      surface: 'popover'
    })
    expect(fetchJSON).toHaveBeenCalledTimes(1)
    expect(parsed.valid).toBe(true)
    expect(parsed.fellBack).toBe(false)
    expect(parsed.fragments).toEqual(['the transformed text'])
  })

  it('re-asks once when the first response is fellBack (illegible JSON) — exactly 2 calls', async () => {
    const { client, fetchJSON } = makeClient([NON_JSON, VALID])
    const parsed = await callScribeAIWithReask(client, baseMessages, {
      surface: 'popover'
    })
    expect(fetchJSON).toHaveBeenCalledTimes(2)
    // final result is the SECOND (clean) parse
    expect(parsed.valid).toBe(true)
    expect(parsed.fellBack).toBe(false)
    expect(parsed.fragments).toEqual(['the transformed text'])
  })

  it('re-asks once when the first response is valid===false (split table) — exactly 2 calls', async () => {
    const { client, fetchJSON } = makeClient([SPLIT_TABLE, VALID])
    const parsed = await callScribeAIWithReask(client, baseMessages, {
      surface: 'popover'
    })
    expect(fetchJSON).toHaveBeenCalledTimes(2)
    expect(parsed.valid).toBe(true)
  })

  it('caps at ONE retry: a second invalid response is returned as-is, never a third call', async () => {
    const { client, fetchJSON } = makeClient([NON_JSON, NON_JSON])
    const parsed = await callScribeAIWithReask(client, baseMessages, {
      surface: 'popover'
    })
    expect(fetchJSON).toHaveBeenCalledTimes(2)
    // second parse is still a fallback (fellBack) — returned without a third call
    expect(parsed.fellBack).toBe(true)
  })

  it('appends EXACTLY ONE corrective REASK_CORRECTION_NUDGE message on the retry, without mutating the original', async () => {
    const seenBodies = []
    const queue = [
      body => {
        seenBodies.push(body)
        return { content: NON_JSON }
      },
      body => {
        seenBodies.push(body)
        return { content: VALID }
      }
    ]
    const fetchJSON = jest.fn(async (method, url, body) => {
      const next = queue.shift()
      return next(body)
    })
    const client = { stackClient: { fetchJSON } }

    await callScribeAIWithReask(client, baseMessages, { surface: 'popover' })

    expect(seenBodies).toHaveLength(2)
    const firstMsgs = seenBodies[0].messages
    const secondMsgs = seenBodies[1].messages
    expect(secondMsgs).toHaveLength(firstMsgs.length + 1)
    expect(secondMsgs[secondMsgs.length - 1]).toEqual({
      role: 'user',
      content: REASK_CORRECTION_NUDGE
    })
    // original array not mutated in place
    expect(baseMessages).toHaveLength(1)
  })

  it('forwards the SAME abort signal to BOTH calls and lets AbortError propagate (no swallow, no re-ask after abort)', async () => {
    const controller = new AbortController()
    const seenSignals = []
    const queue = [
      () => {
        // first call returns illegible -> would normally trigger a re-ask
        return { content: NON_JSON }
      },
      () => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      }
    ]
    const fetchJSON = jest.fn(async (method, url, body, opts) => {
      seenSignals.push(opts && opts.signal)
      const next = queue.shift()
      return next(body)
    })
    const client = { stackClient: { fetchJSON } }

    await expect(
      callScribeAIWithReask(client, baseMessages, {
        signal: controller.signal,
        surface: 'popover'
      })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(fetchJSON).toHaveBeenCalledTimes(2)
    expect(seenSignals[0]).toBe(controller.signal)
    expect(seenSignals[1]).toBe(controller.signal)
  })

  it('honors the surface on the final parse (chat fallback -> discussion=raw, fragments=[])', async () => {
    const { client } = makeClient([NON_JSON, NON_JSON])
    const parsed = await callScribeAIWithReask(client, baseMessages, {
      surface: 'chat'
    })
    expect(parsed.fellBack).toBe(true)
    expect(parsed.discussion).toBe(NON_JSON)
    expect(parsed.fragments).toEqual([])
  })

  it('REASK_CORRECTION_NUDGE instructs JSON-only and stays consistent with the contract', () => {
    expect(typeof REASK_CORRECTION_NUDGE).toBe('string')
    expect(REASK_CORRECTION_NUDGE).toMatch(/JSON/)
  })
})
