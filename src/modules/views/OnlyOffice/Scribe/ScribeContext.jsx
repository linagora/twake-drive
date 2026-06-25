import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} from 'react'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'

import {
  callScribeAIWithReask,
  classifyScribeError,
  buildChatSystemPrompt,
  encodeSelectionForPrompt
} from '@/modules/views/OnlyOffice/Scribe/scribeAI'
import { htmlToMarkdown } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'
import {
  isScribeDevMd,
  logScribeExchange
} from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'
import { recordProbeSample } from '@/modules/views/OnlyOffice/Scribe/scribeProbe'
import { serializeAssistantTurnForHistory } from '@/modules/views/OnlyOffice/Scribe/scribeResponse'

const STORAGE_KEY = 'scribe-panel-open'

const ScribeContext = createContext(null)

// Chat system prompt is now built from the SHARED hardened contract
// (scribeAI.buildChatSystemPrompt): persona + RESPONSE_CONTRACT_CORE +
// CARDINALITY_CHAT + per-selection marker-preservation clauses. This unifies the
// chat contract with the gate-validated inline one (v3.1-03-GATE.md) so the
// separation rules — and table/REF marker preservation — apply to both surfaces.
// Parsing (and a single corrective re-ask on parse-invalid responses) happens at
// reception via callScribeAIWithReask(client, msgs, { surface: 'chat' }).

const readStorage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch (e) {
    return false
  }
}

const writeStorage = value => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch (e) {
    // localStorage unavailable
  }
}

export const ScribeProvider = ({ children }) => {
  const [isPanelOpen, setIsPanelOpen] = useState(readStorage)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentSelection, setCurrentSelectionState] = useState(null)
  // v3.2-01 « Inclure » zone state — three context-include toggles whose state
  // lives HERE in the provider (NOT in the leaf ScribeIncludeZone component) so
  // the prompt-assembly seam can read them later.
  // read by v3.2-02/03; no prompt injection in v3.2-01
  const [includeDocument, setIncludeDocument] = useState(false)
  const [includeDiscussion, setIncludeDiscussion] = useState(false)
  const [includeSelection, setIncludeSelection] = useState(true)
  const [panelActions, setPanelActionsState] = useState(null)
  const [panelWidth, setPanelWidthState] = useState(400)
  // Draft prompt handed over from the inline popover when the user opens the
  // side panel mid-typing; consumed once by the chat input on mount.
  const [pendingDraft, setPendingDraft] = useState('')

  const client = useClient()
  const { t } = useI18n()

  // Use ref to always have current messages in sendMessage without re-creating the callback
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // v3.2-02 (D-03, no stale-closure): mirror the include booleans into refs the
  // SAME way messagesRef does, so sendMessage (deps [client, t]) reads the LIVE
  // checkbox values at send time — a toggle between renders is honored on the very
  // next send without re-creating the callback identity. includeDocument is out of
  // scope this phase (v3.2-03), so it is intentionally NOT mirrored here.
  const includeDiscussionRef = useRef(includeDiscussion)
  includeDiscussionRef.current = includeDiscussion
  const includeSelectionRef = useRef(includeSelection)
  includeSelectionRef.current = includeSelection

  // Track dismissed selection text so chip doesn't reappear until a NEW different selection arrives
  const selectionDismissedRef = useRef(null)

  useEffect(() => {
    writeStorage(isPanelOpen)
  }, [isPanelOpen])

  const togglePanel = useCallback(() => setIsPanelOpen(prev => !prev), [])
  const openPanel = useCallback(draft => {
    if (typeof draft === 'string' && draft) setPendingDraft(draft)
    setIsPanelOpen(true)
  }, [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])
  const clearPendingDraft = useCallback(() => setPendingDraft(''), [])

  const addMessage = useCallback(msg => {
    setMessages(prev => [...prev, msg])
  }, [])

  const setCurrentSelection = useCallback(
    (text, html, enrichedMd, tableSnapshots) => {
      if (!text) {
        setCurrentSelectionState(null)
        return
      }
      // If user dismissed this exact text, don't re-show it
      if (selectionDismissedRef.current === text) return
      // New different selection resets the dismissed state
      selectionDismissedRef.current = null
      const markdown = enrichedMd || (html ? htmlToMarkdown(html) : text)
      setCurrentSelectionState({
        text,
        html,
        markdown,
        tableSnapshots: tableSnapshots || null
      })
    },
    []
  )

  const dismissSelection = useCallback(() => {
    if (currentSelection) {
      selectionDismissedRef.current = currentSelection.text
    }
    setCurrentSelectionState(null)
  }, [currentSelection])

  // CTX-UX-03 (opt-OUT model): on a null -> non-null selection edge, auto-check
  // « sélection » so a fresh selection is included by default. We do NOT force
  // it back while a selection persists — once shown, the user's manual uncheck
  // sticks until the selection itself changes. This auto-check OWNS the include
  // flag in the provider; the leaf ScribeIncludeZone never sets it on mount.
  const prevSelectionRef = useRef(currentSelection)
  useEffect(() => {
    const prev = prevSelectionRef.current
    if (!prev && currentSelection) {
      setIncludeSelection(true)
    }
    prevSelectionRef.current = currentSelection
  }, [currentSelection])

  const setPanelActions = useCallback(actions => {
    setPanelActionsState(actions)
  }, [])

  const setPanelWidth = useCallback(newWidth => {
    const clamped = Math.min(Math.max(newWidth, 280), window.innerWidth * 0.6)
    setPanelWidthState(clamped)
  }, [])

  const sendMessage = useCallback(
    async (text, selectionContext) => {
      // SEAM (v3.2-02): read the LIVE checkbox values from refs (D-03) — the
      // callback deps stay [client, t] (identity preserved) while still honoring a
      // toggle made between renders. includeDocument is out of scope (v3.2-03).
      const includeDiscussion = includeDiscussionRef.current
      // D-02/D-04: « sélection » gates ONLY the current turn. It is included iff the
      // box is live-checked AND there actually is a current selection.
      const selectionIncluded = includeSelectionRef.current && !!selectionContext

      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: text,
        // D-03 faithful registry: store the selection AS SENT. When « sélection »
        // is off (or there is none), no selection is attached — so a later history
        // replay of THIS turn reflects exactly what was sent.
        selection: selectionIncluded ? selectionContext : null,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage])
      setIsLoading(true)

      try {
        // SEAM: the include booleans gate prompt composition here (v3.2-02). The
        // response handling below (callScribeAIWithReask + parsed handling) is
        // byte-for-byte identical to v3.1 — only the assembled aiMessages changes.
        // D-04: when the current selection is NOT included, buildChatSystemPrompt
        // receives '' (no marker-preservation clauses) and the current user message
        // carries NO [Selected text…] block. When included, behavior is exactly v3.1.
        const { selectionMd: encodedSelectionMd } = encodeSelectionForPrompt({
          enrichedMd: selectionContext?.markdown,
          text: selectionContext?.text
        })
        const currentSelectionMd = selectionIncluded ? encodedSelectionMd : ''
        // D-01 discussion gate: « discussion » on ⇒ full prior history + current
        // turn (v3.1 behavior); off ⇒ current turn ONLY. The gate only decides HOW
        // MANY turns are mapped — it MUST NOT change how a PAST turn renders (D-02:
        // past turns replay their stored .selection block as-is).
        const turnsToMap = includeDiscussion
          ? [...messagesRef.current, userMessage]
          : [userMessage]
        const aiMessages = [
          {
            role: 'system',
            content: buildChatSystemPrompt(currentSelectionMd, {
              includeSelection: selectionIncluded,
              includeDiscussion
            })
          },
          ...turnsToMap
            .filter(m => m.role !== 'error')
            // WR-01: self-contained guard so only user/assistant turns are ever
            // serialized for the LLM, independent of the outer error filter above.
            // UI-only roles (e.g. 'error') would be rejected by the AI endpoint.
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => {
              // For user messages with selection, build composite content for AI
              if (m.role === 'user' && m.selection) {
                const { selectionMd } = encodeSelectionForPrompt({
                  enrichedMd: m.selection.markdown,
                  text: m.selection.text
                })
                return {
                  role: m.role,
                  content: `[Selected text from document]\n${selectionMd}\n[End of selected text]\n\n${m.content}`
                }
              }
              // D-12: serialize prior assistant turns as discussion + a compact,
              // truncated fragment note (never raw fragment bodies, never the raw
              // contract JSON). Older messages predating the extended model lack
              // m.discussion/m.fragments, so fall back to m.content.
              if (m.role === 'assistant') {
                return {
                  role: m.role,
                  content: serializeAssistantTurnForHistory({
                    discussion: m.discussion ?? m.content,
                    fragments: m.fragments
                  })
                }
              }
              return { role: m.role, content: m.content }
            })
        ]

        // HARDEN-01: obtain the PARSED chat contract through the shared re-ask
        // helper. On a parse-invalid first response (fellBack || !valid) it issues
        // exactly one corrective re-ask before the chat fallback applies; a clean
        // first response makes no second call. The chat path holds no
        // AbortController today, so no signal is passed — behavior preserved. The
        // chat fallback still yields { discussion: raw, fragments: [] } so nothing
        // is lost. parsed.raw is the literal model text for dev diagnostics.
        const parsed = await callScribeAIWithReask(client, aiMessages, {
          surface: 'chat'
        })

        // Dev diagnostic: dump the exact prompt + raw response + parsed contract so
        // the chat path can be compared against the popover (surface-divergence).
        logScribeExchange('chat', {
          messages: aiMessages,
          rawResponse: parsed.raw,
          parsed
        })

        // PROBE-01 (D-11): feed the conformance probe the parsed chat response.
        // Dev-mode only (isScribeDevMd guard) => zero production cost. The per-turn
        // selection markdown (same `markdown || text` accessor used in the history
        // mapping above) is the probe `inputMd`; absent => '' (RESEARCH A4: REF
        // missing-detection degrades to N/A for that sample — acceptable). Additive
        // observation only — no behavior change to the message model or rendering.
        if (isScribeDevMd()) {
          recordProbeSample(parsed, {
            surface: 'chat',
            // Faithful to what was actually sent (D-03): when « sélection » is OFF
            // currentSelectionMd is '' so the probe never derives hasTable/hasRef
            // (or runs refIntegrity) against a selection the model never received.
            inputMd: currentSelectionMd,
            ts: Date.now()
          })
        }

        // Dev-only: attach the exact prompt + raw response + parsed contract + the
        // selection-derived devData so the chat surface can open the SAME dev panels
        // as the popover (ScribeDevPanels) for this turn. The chat path never sends
        // HTML (markdown markers only), so html/normalizedHtml stay empty; `md` is
        // the selection markdown actually embedded in the prompt. Guarded by
        // isScribeDevMd() => undefined (and absent) in prod.
        const devExchange = isScribeDevMd()
          ? {
              messages: aiMessages,
              rawResponse: parsed.raw,
              parsed,
              devData: {
                // Gate the dev panel's selection-derived fields on selectionIncluded
                // so they reflect what was actually sent (D-03), matching `md`.
                html: selectionIncluded ? selectionContext?.html || '' : '',
                normalizedHtml: '',
                enrichedMd: selectionIncluded
                  ? selectionContext?.markdown || ''
                  : '',
                md: currentSelectionMd,
                source:
                  selectionIncluded && selectionContext?.markdown
                    ? 'plugin'
                    : 'turndown'
              }
            }
          : undefined

        // D-10: extended message model — keep content == discussion (existing UI
        // reads content unchanged) plus structured discussion/fragments/fellBack.
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            role: 'assistant',
            content: parsed.discussion,
            discussion: parsed.discussion,
            fragments: parsed.fragments,
            fellBack: parsed.fellBack,
            _devExchange: devExchange,
            timestamp: new Date()
          }
        ])
      } catch (err) {
        const classified = classifyScribeError(err)
        // Skip adding error message for abort errors (empty messageKey)
        if (classified.messageKey) {
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 1,
              role: 'error',
              content: t(classified.messageKey),
              timestamp: new Date()
            }
          ])
        }
      } finally {
        setIsLoading(false)
      }
    },
    [client, t]
  )

  const value = useMemo(
    () => ({
      isPanelOpen,
      togglePanel,
      openPanel,
      closePanel,
      messages,
      isLoading,
      sendMessage,
      addMessage,
      currentSelection,
      setCurrentSelection,
      dismissSelection,
      includeDocument,
      setIncludeDocument,
      includeDiscussion,
      setIncludeDiscussion,
      includeSelection,
      setIncludeSelection,
      panelActions,
      setPanelActions,
      panelWidth,
      setPanelWidth,
      pendingDraft,
      clearPendingDraft
    }),
    [
      isPanelOpen,
      togglePanel,
      openPanel,
      closePanel,
      messages,
      isLoading,
      sendMessage,
      addMessage,
      currentSelection,
      setCurrentSelection,
      dismissSelection,
      includeDocument,
      setIncludeDocument,
      includeDiscussion,
      setIncludeDiscussion,
      includeSelection,
      setIncludeSelection,
      panelActions,
      setPanelActions,
      panelWidth,
      setPanelWidth,
      pendingDraft,
      clearPendingDraft
    ]
  )

  return (
    <ScribeContext.Provider value={value}>{children}</ScribeContext.Provider>
  )
}

export const useScribe = () => useContext(ScribeContext)
