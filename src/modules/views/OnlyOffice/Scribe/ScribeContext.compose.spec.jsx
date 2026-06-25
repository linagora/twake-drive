/**
 * Deterministic prompt-composition spec for the v3.2-02 sendMessage seam.
 *
 * Proves D-01..D-05 + CTX-LLM-05 determinism by mocking callScribeAIWithReask so it
 * captures the assembled `aiMessages` array WITHOUT any network call, then driving
 * sendMessage through the real ScribeProvider and inspecting what was composed.
 *
 * The four gate quadrants (sélection on/off × discussion on/off), the D-02
 * past-selection-replay invariant, the D-03 byte-identical determinism, and the
 * CTX-LLM-05 no-fragment-leak guard are all asserted here. Written to FAIL if any
 * gate regresses.
 */
import { render, act } from '@testing-library/react'
import React from 'react'

// i18n: echo keys (only used by the error path; we never hit it here). The `t`
// function reference is STABLE across renders so the sendMessage useCallback
// (deps [client, t]) keeps its identity for the no-stale-closure assertion.
const mockT = key => key
jest.mock('twake-i18n', () => ({
  __esModule: true,
  useI18n: () => ({ t: mockT })
}))

// cozy-client: a STABLE stub client (same reference across renders) so the
// sendMessage useCallback (deps [client, t]) keeps its identity — the real network
// call is mocked away via callScribeAIWithReask below, so client is never deref'd.
const mockClient = { stackClient: { fetchJSON: jest.fn() } }
jest.mock('cozy-client', () => ({
  __esModule: true,
  useClient: () => mockClient
}))

// Keep the REAL prompt builders (buildChatSystemPrompt, encodeSelectionForPrompt,
// classifyScribeError) but replace ONLY callScribeAIWithReask with a capturing
// mock so the composed aiMessages array is observable with no fetch.
const captured = []
let cannedParsed
jest.mock('@/modules/views/OnlyOffice/Scribe/scribeAI', () => {
  const actual = jest.requireActual(
    '@/modules/views/OnlyOffice/Scribe/scribeAI'
  )
  return {
    __esModule: true,
    ...actual,
    callScribeAIWithReask: jest.fn(async (client, aiMessages) => {
      captured.push(aiMessages)
      return cannedParsed
    })
  }
})

// Dev-mode helpers are no-ops in the test environment, but stub them so the
// dev-only probe/log branches stay inert and never throw.
jest.mock('@/modules/views/OnlyOffice/Scribe/scribeDevMode', () => ({
  __esModule: true,
  isScribeDevMd: () => false,
  logScribeExchange: jest.fn()
}))

import {
  RESPONSE_CONTRACT_CORE,
  CARDINALITY_CHAT
} from '@/modules/views/OnlyOffice/Scribe/scribeAI'
import {
  ScribeProvider,
  useScribe
} from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { serializeAssistantTurnForHistory } from '@/modules/views/OnlyOffice/Scribe/scribeResponse'

const SELECTED_BLOCK = '[Selected text from document]'

// Canned valid parsed contract returned by the mocked re-ask helper.
const makeParsed = (discussion = 'ok', fragments = []) => ({
  discussion,
  fragments,
  valid: true,
  fellBack: false,
  warnings: [],
  raw: JSON.stringify({ discussion, fragments })
})

// Test harness: exposes the live context API + lets a test seed messages and
// toggle the include checkboxes imperatively before sending.
let api
const Harness = () => {
  api = useScribe()
  return null
}

const renderProvider = () => {
  captured.length = 0
  render(
    <ScribeProvider>
      <Harness />
    </ScribeProvider>
  )
}

const setIncludes = ({ selection, discussion }) =>
  act(() => {
    if (typeof selection === 'boolean') api.setIncludeSelection(selection)
    if (typeof discussion === 'boolean') api.setIncludeDiscussion(discussion)
  })

// Seed a prior user turn (with a stored selection) + a prior assistant turn so
// the discussion gate has history to include/exclude.
const PRIOR_SELECTION = { text: 'prior sel', markdown: 'prior sel md' }
const seedPriorTurns = () =>
  act(() => {
    api.addMessage({
      id: 1,
      role: 'user',
      content: 'earlier question',
      selection: PRIOR_SELECTION
    })
    api.addMessage({
      id: 2,
      role: 'assistant',
      content: 'earlier answer',
      discussion: 'earlier answer',
      fragments: ['frag body that must not leak verbatim']
    })
  })

const send = (text, selectionContext) =>
  act(async () => {
    await api.sendMessage(text, selectionContext)
  })

const CURRENT_SELECTION = { text: 'current sel', markdown: 'current sel md' }

beforeEach(() => {
  cannedParsed = makeParsed()
  captured.length = 0
})

describe('ScribeContext.sendMessage — deterministic gated composition (v3.2-02)', () => {
  describe('Quadrant A — sélection ON, discussion OFF', () => {
    it('aiMessages = [system, current user]; system has selection framing; user has the [Selected text] block', async () => {
      renderProvider()
      seedPriorTurns()
      setIncludes({ selection: true, discussion: false })
      await send('current question', CURRENT_SELECTION)

      const ai = captured[0]
      expect(ai).toHaveLength(2)
      expect(ai[0].role).toBe('system')
      expect(ai[0].content).toMatch(/selection from the document/i)
      expect(ai[1].role).toBe('user')
      expect(ai[1].content).toContain(SELECTED_BLOCK)
      expect(ai[1].content).toContain('current sel md')
      expect(ai[1].content).toContain('current question')
    })
  })

  describe('Quadrant B — sélection OFF, discussion OFF', () => {
    it('aiMessages = [system, current user]; NO selection framing/markers; user has NO [Selected text] block', async () => {
      renderProvider()
      seedPriorTurns()
      setIncludes({ selection: false, discussion: false })
      await send('current question', CURRENT_SELECTION)

      const ai = captured[0]
      expect(ai).toHaveLength(2)
      // D-04: no current-selection framing in the system prompt
      expect(ai[0].content).not.toMatch(/selection from the document/i)
      // system prompt is the no-flag baseline (no marker clauses for a marker selection)
      expect(ai[0].content).toContain(RESPONSE_CONTRACT_CORE + CARDINALITY_CHAT)
      // current user turn carries NO selection block
      expect(ai[1].content).not.toContain(SELECTED_BLOCK)
      expect(ai[1].content).toBe('current question')
    })

    it('D-04 marker clauses dropped: a TABLE selection produces no [TABLE:N] clause when « sélection » is OFF', async () => {
      renderProvider()
      setIncludes({ selection: false, discussion: false })
      await send('q', { text: 't', markdown: '[TABLE:0][CELL:0,0]a[/CELL][/TABLE]' })
      expect(captured[0][0].content).not.toMatch(/\[TABLE:N\]/)
    })
  })

  describe('Quadrant C — sélection ON, discussion ON', () => {
    it('full history present; current turn has the block; prior user turn replays its block; assistant turn serialized', async () => {
      renderProvider()
      seedPriorTurns()
      setIncludes({ selection: true, discussion: true })
      await send('current question', CURRENT_SELECTION)

      const ai = captured[0]
      // system + prior user + prior assistant + current user
      expect(ai).toHaveLength(4)
      expect(ai[0].role).toBe('system')
      // D-02: prior user turn replays its stored selection block AS-IS
      expect(ai[1].role).toBe('user')
      expect(ai[1].content).toContain(SELECTED_BLOCK)
      expect(ai[1].content).toContain('prior sel md')
      // prior assistant turn serialized via serializeAssistantTurnForHistory
      expect(ai[2].role).toBe('assistant')
      expect(ai[2].content).toBe(
        serializeAssistantTurnForHistory({
          discussion: 'earlier answer',
          fragments: ['frag body that must not leak verbatim']
        })
      )
      // current user turn
      expect(ai[3].content).toContain(SELECTED_BLOCK)
      expect(ai[3].content).toContain('current sel md')
    })
  })

  describe('Quadrant D — sélection OFF, discussion ON', () => {
    it('full history present (past selections replay), but current turn has NO block and no current-selection markers', async () => {
      renderProvider()
      seedPriorTurns()
      setIncludes({ selection: false, discussion: true })
      await send('current question', CURRENT_SELECTION)

      const ai = captured[0]
      expect(ai).toHaveLength(4)
      // D-02: past selection STILL replays even though « sélection » is OFF
      expect(ai[1].content).toContain(SELECTED_BLOCK)
      expect(ai[1].content).toContain('prior sel md')
      // current turn (last) has NO block
      expect(ai[3].content).toBe('current question')
      // no current-selection framing in the system prompt
      expect(ai[0].content).not.toMatch(/selection from the document/i)
    })
  })

  describe('D-03 / CTX-LLM-05 — determinism', () => {
    it('same transcript + same checkbox values => byte-identical aiMessages across two sends', async () => {
      renderProvider()
      seedPriorTurns()
      setIncludes({ selection: true, discussion: true })
      await send('current question', CURRENT_SELECTION)
      const first = JSON.stringify(captured[0])

      // Reset the transcript to the SAME seed and resend identically.
      renderProvider()
      seedPriorTurns()
      setIncludes({ selection: true, discussion: true })
      await send('current question', CURRENT_SELECTION)
      const second = JSON.stringify(captured[0])

      expect(second).toBe(first)
    })
  })

  describe('CTX-LLM-05 — no fragment leak guard', () => {
    it('assistant history content equals serializeAssistantTurnForHistory; raw fragment body is never duplicated verbatim', async () => {
      renderProvider()
      seedPriorTurns()
      setIncludes({ selection: false, discussion: true })
      await send('q', null)

      const ai = captured[0]
      const assistantEntries = ai.filter(m => m.role === 'assistant')
      expect(assistantEntries).toHaveLength(1)
      const expected = serializeAssistantTurnForHistory({
        discussion: 'earlier answer',
        fragments: ['frag body that must not leak verbatim']
      })
      expect(assistantEntries[0].content).toBe(expected)
      // the serializer truncates + annotates; the raw fragment body is NOT emitted
      // verbatim as a standalone field anywhere in the assembled messages
      const joined = JSON.stringify(ai)
      // the truncated note may contain a prefix of the fragment, but never the full
      // verbatim body as the entire `discussion` of any entry
      ai.forEach(m => {
        expect(m.content).not.toBe('frag body that must not leak verbatim')
      })
      expect(joined).toContain('insertable fragment')
    })
  })

  describe('D-03 live-read — no stale closure', () => {
    it('a checkbox toggled between sends is honored on the very next send (callback identity preserved)', async () => {
      renderProvider()
      seedPriorTurns()
      const firstSendMessage = api.sendMessage

      setIncludes({ selection: true, discussion: false })
      await send('q1', CURRENT_SELECTION)
      expect(captured[0]).toHaveLength(2) // discussion OFF => current turn only

      setIncludes({ discussion: true })
      await send('q2', CURRENT_SELECTION)
      // discussion now ON => prior turns are included on the very next send
      expect(captured[1].length).toBeGreaterThan(2)

      // callback identity preserved across the toggle (deps stay [client, t])
      expect(api.sendMessage).toBe(firstSendMessage)
    })
  })
})
