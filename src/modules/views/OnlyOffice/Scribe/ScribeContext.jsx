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
  callScribeAI,
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
import {
  parseScribeResponse,
  serializeAssistantTurnForHistory
} from '@/modules/views/OnlyOffice/Scribe/scribeResponse'

const STORAGE_KEY = 'scribe-panel-open'

const ScribeContext = createContext(null)

// Chat system prompt is now built from the SHARED hardened contract
// (scribeAI.buildChatSystemPrompt): persona + RESPONSE_CONTRACT_CORE +
// CARDINALITY_CHAT + per-selection marker-preservation clauses. This unifies the
// chat contract with the gate-validated inline one (v3.1-03-GATE.md) so the
// separation rules — and table/REF marker preservation — apply to both surfaces.
// Parsing happens at reception via parseScribeResponse(raw, { surface: 'chat' }).

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

  const setPanelActions = useCallback(actions => {
    setPanelActionsState(actions)
  }, [])

  const setPanelWidth = useCallback(newWidth => {
    const clamped = Math.min(Math.max(newWidth, 280), window.innerWidth * 0.6)
    setPanelWidthState(clamped)
  }, [])

  const sendMessage = useCallback(
    async (text, selectionContext) => {
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: text,
        selection: selectionContext || null,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage])
      setIsLoading(true)

      try {
        // Build AI messages: system prompt + conversation history (skip error messages)
        const currentMessages = [...messagesRef.current, userMessage]
        // Marker-preservation clauses key off the CURRENT turn's selection markdown,
        // encoded by the SAME shared helper the popover uses (single source of truth).
        const { selectionMd: currentSelectionMd } = encodeSelectionForPrompt({
          enrichedMd: selectionContext?.markdown,
          text: selectionContext?.text
        })
        const aiMessages = [
          {
            role: 'system',
            content: buildChatSystemPrompt(currentSelectionMd)
          },
          ...currentMessages
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

        const responseText = await callScribeAI(client, aiMessages)

        // D-13: parse the raw LLM response through the shared contract layer with
        // chat surface BEFORE storing/displaying. On parse failure the chat fallback
        // yields { discussion: raw, fragments: [] } so nothing is lost.
        const parsed = parseScribeResponse(responseText, { surface: 'chat' })

        // Dev diagnostic: dump the exact prompt + raw response + parsed contract so
        // the chat path can be compared against the popover (surface-divergence).
        logScribeExchange('chat', {
          messages: aiMessages,
          rawResponse: responseText,
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
            inputMd: selectionContext
              ? selectionContext.markdown || selectionContext.text || ''
              : '',
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
              rawResponse: responseText,
              parsed,
              devData: {
                html: selectionContext?.html || '',
                normalizedHtml: '',
                enrichedMd: selectionContext?.markdown || '',
                md: currentSelectionMd,
                source: selectionContext?.markdown ? 'plugin' : 'turndown'
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
