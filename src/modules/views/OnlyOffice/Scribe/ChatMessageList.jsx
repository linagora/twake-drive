import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle
} from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import InfoIcon from 'cozy-ui/transpiled/react/Icons/Info'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useTheme } from 'cozy-ui/transpiled/react/styles'

import { FragmentCard } from '@/modules/views/OnlyOffice/Scribe/FragmentCard'
import { MarkdownPreview } from '@/modules/views/OnlyOffice/Scribe/MarkdownPreview'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { ScribeDevPanels } from '@/modules/views/OnlyOffice/Scribe/ScribeResultPanel'
import { buildAssistantSegments } from '@/modules/views/OnlyOffice/Scribe/assistantSegments'
import {
  isScribeDevMd,
  formatMessagesForDisplay
} from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'

const SCRIBE_PURPLE = '#7C3AED'

const SparkleSvg = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 1l1.796 4.204L14 7l-4.204 1.796L8 13l-1.796-4.204L2 7l4.204-1.796L8 1z"
      fill={SCRIBE_PURPLE}
      stroke={SCRIBE_PURPLE}
      strokeWidth="0.5"
    />
    <path
      d="M12.5 1l.898 2.102L15.5 4l-2.102.898L12.5 7l-.898-2.102L9.5 4l2.102-.898L12.5 1z"
      fill={SCRIBE_PURPLE}
      stroke={SCRIBE_PURPLE}
      strokeWidth="0.3"
    />
  </svg>
)

const SCRIBE_PURPLE_08 = 'rgba(124, 58, 237, 0.08)'

const SelectionQuote = ({ selection }) => (
  <div
    style={{
      borderLeft: `3px solid ${SCRIBE_PURPLE}`,
      background: SCRIBE_PURPLE_08,
      padding: '4px 8px',
      marginBottom: 6,
      borderRadius: '0 4px 4px 0',
      fontStyle: 'italic',
      fontSize: 12,
      lineHeight: 1.4,
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      wordBreak: 'break-word'
    }}
  >
    {selection.text}
  </div>
)

const UserBubble = ({ content, selection, theme }) => (
  <div
    style={{
      alignSelf: 'flex-end',
      background: theme.palette.action.selected,
      padding: '8px 12px',
      borderRadius: '12px 4px 12px 12px',
      maxWidth: '85%',
      wordBreak: 'break-word',
      fontSize: 14,
      lineHeight: 1.5
    }}
  >
    {selection && <SelectionQuote selection={selection} />}
    <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
  </div>
)

const AssistantBubble = ({ content, theme }) => {
  const isDark = (theme.palette.type || theme.palette.mode) === 'dark'

  return (
    <div
      style={{
        alignSelf: 'flex-start',
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        padding: '8px 12px',
        borderRadius: '4px 12px 12px 12px',
        maxWidth: '85%',
        fontSize: 14,
        lineHeight: 1.5,
        wordBreak: 'break-word'
      }}
    >
      <MarkdownPreview>{content}</MarkdownPreview>
    </div>
  )
}

const ErrorBubble = ({ content, theme, t }) => (
  <div
    style={{
      alignSelf: 'flex-start',
      background: `${theme.palette.error.main}1A`,
      color: theme.palette.error.main,
      padding: '8px 12px',
      borderRadius: '4px 12px 12px 12px',
      maxWidth: '85%',
      fontSize: 13,
      lineHeight: 1.5,
      wordBreak: 'break-word'
    }}
  >
    <strong>{t('Scribe.chat.error_prefix')}:</strong> {content}
  </div>
)

// Never-silent truncation feedback (UI-SPEC DEC-UI-01). A discreet, single-line
// system notice — NOT a chat bubble, NOT an Inclure-zone badge — rendered in
// thread order right after the user bubble whose document context was truncated.
// Styled as a sibling of the loading indicator (same alignSelf/display/gap/
// padding/opacity/fontSize); informational, so the icon + text are both
// text.secondary (no red, no accent — explicitness is carried by the words).
// role="status" + aria-live="polite" announce it without stealing focus; the
// icon is decorative (the text carries the meaning, so no aria-label).
const DocumentTruncatedNotice = ({ theme, t }) => (
  <div
    role="status"
    aria-live="polite"
    style={{
      alignSelf: 'flex-start',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      opacity: 0.7,
      fontSize: 13,
      color: theme.palette.text.secondary
    }}
  >
    <Icon icon={InfoIcon} size={14} />
    <span>{t('Scribe.include.documentTruncated')}</span>
  </div>
)

const WelcomeMessage = ({ t }) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.6
    }}
  >
    <SparkleSvg size={48} />
    <Typography variant="body2" color="textSecondary" style={{ marginTop: 16 }}>
      {t('Scribe.chat.welcome')}
    </Typography>
  </div>
)

// Dev-only per-turn debug control (SCRIBE_DEV_MD). A discreet link that opens a
// full modal showing the SAME inspector panels as the popover (ScribeDevPanels)
// for this turn — prompt sent, parsed contract, per-fragment views, etc. Renders
// nothing unless the message carries a captured _devExchange (flag on).
const DevExchangePanel = ({ msg, theme }) => {
  const [open, setOpen] = useState(false)
  const overlayRef = useRef(null)

  // Esc closes the modal. The embedded editor (cross-origin iframe) tends to grab
  // focus back, which would route keydowns away from us; so on open we focus the
  // overlay AND re-focus it whenever focus leaves the modal (focusout guard). A
  // capture-phase document listener is the fallback while focus is in our frame.
  useEffect(() => {
    if (!open) return undefined
    const el = overlayRef.current
    const focusOverlay = () => {
      if (overlayRef.current) overlayRef.current.focus()
    }
    focusOverlay()
    const onFocusOut = e => {
      if (el && !el.contains(e.relatedTarget)) setTimeout(focusOverlay, 0)
    }
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    if (el) el.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKey, true)
    return () => {
      if (el) el.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  if (!isScribeDevMd() || !msg._devExchange) return null
  const ex = msg._devExchange
  const promptSent = formatMessagesForDisplay(ex.messages)

  const modal = createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      onClick={() => setOpen(false)}
      onKeyDown={e => {
        if (e.key === 'Escape') setOpen(false)
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100001,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        outline: 'none'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '95vw',
          height: '90vh',
          background: theme.palette.background.paper,
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            marginBottom: 8
          }}
        >
          <Typography variant="subtitle2" color="textSecondary">
            Inspecteur dev (chat)
            <span style={{ marginLeft: 8, color: '#ff9800', fontSize: 11 }}>
              DEV MD
            </span>
          </Typography>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <Icon icon={CrossIcon} size={16} />
          </IconButton>
        </div>
        <ScribeDevPanels
          devData={ex.devData}
          promptSent={promptSent}
          rawResponse={ex.rawResponse}
          parsedResponse={ex.parsed}
        />
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 6,
          cursor: 'pointer',
          border: 'none',
          background: 'none',
          padding: 0,
          color: '#ff9800',
          fontSize: 11,
          textDecoration: 'underline'
        }}
      >
        DEV — inspecteur détaillé
      </button>
      {open && modal}
    </>
  )
}

// Index of the Insert button within a card's button group. Card buttons render
// in this order: [Copy, Insert, (Replace when hasSelection)] — so Insert is 1.
const INSERT_BUTTON_INDEX = 1

export const ChatMessageList = forwardRef(
  ({ returnFocusToInput } = {}, ref) => {
    const { messages, isLoading, currentSelection } = useScribe()
    const { t } = useI18n()
    const theme = useTheme()
    const containerRef = useRef(null)

    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }
    }, [messages.length, isLoading])

    // Thread-level keyboard focus controller (manual index + .focus(), no
    // roving-tabindex library — mirrors ScribeResultPanel / ScribeActionMenu).
    //
    // The flat, thread-ordered list of card button groups is computed ON DEMAND
    // from the DOM (cards change as messages arrive), so it is never stale and
    // never holds a dangling index (T-v3.1-04-14). Each "group" is the array of
    // present <button>s inside one FragmentCard (length 2 or 3).
    const getCardGroups = useCallback(() => {
      const root = containerRef.current
      if (!root) return []
      const cards = Array.from(root.querySelectorAll('[data-fragment-card]'))
      return cards.map(card => Array.from(card.querySelectorAll('button')))
    }, [])

    // Locate the focused element within the flat card-group list. Returns
    // { cardPos, buttonPos } or null when focus is not on a card button.
    const locateFocus = useCallback(groups => {
      const active = document.activeElement
      for (let c = 0; c < groups.length; c += 1) {
        const b = groups[c].indexOf(active)
        if (b !== -1) return { cardPos: c, buttonPos: b }
      }
      return null
    }, [])

    const returnToInput = useCallback(() => {
      if (returnFocusToInput) returnFocusToInput()
    }, [returnFocusToInput])

    const handleKeyDown = useCallback(
      e => {
        const key = e.key
        const isArrow =
          key === 'ArrowLeft' ||
          key === 'ArrowRight' ||
          key === 'ArrowUp' ||
          key === 'ArrowDown'
        // Enter/Space activate the focused <button> natively (KBD-04) — do NOT
        // intercept them. Escape returns focus to the input.
        if (key === 'Escape') {
          e.preventDefault()
          returnToInput()
          return
        }
        if (!isArrow) return

        const groups = getCardGroups()
        if (groups.length === 0) return
        const pos = locateFocus(groups)
        if (!pos) return
        // ArrowUp on the oldest card is a no-op: do NOT preventDefault (leave native
        // scroll intact) and do NOT move focus — no wrap upward past the oldest card.
        if (key === 'ArrowUp' && pos.cardPos === 0) return
        e.preventDefault()

        const { cardPos, buttonPos } = pos
        const group = groups[cardPos]

        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          // KBD-02: cycle within the focused card's button group (wrap allowed).
          const len = group.length
          const next =
            key === 'ArrowRight'
              ? (buttonPos + 1) % len
              : (buttonPos - 1 + len) % len
          group[next].focus()
          return
        }

        // KBD-03: ArrowUp/ArrowDown move across cards in thread order.
        if (key === 'ArrowDown') {
          if (cardPos === groups.length - 1) {
            // Past the most-recent card -> back to the input.
            returnToInput()
            return
          }
          const nextGroup = groups[cardPos + 1]
          const clamped = Math.min(buttonPos, nextGroup.length - 1)
          nextGroup[clamped].focus()
          return
        }
        // ArrowUp (oldest-card no-op already handled above, before preventDefault)
        const prevGroup = groups[cardPos - 1]
        const clampedUp = Math.min(buttonPos, prevGroup.length - 1)
        prevGroup[clampedUp].focus()
      },
      [getCardGroups, locateFocus, returnToInput]
    )

    // KBD-01 + D-10: focus the most-recent card's Insert button. "Most recent" =
    // last card in thread order; if the newest message is pure discussion (0
    // cards), this naturally resolves to the last card that exists anywhere
    // (getCardGroups already skips card-less messages). No-op when no cards
    // exist (T-v3.1-04-14: never crash on missing fragments).
    useImperativeHandle(
      ref,
      () => ({
        focusMostRecentCardInsert: () => {
          const groups = getCardGroups()
          if (groups.length === 0) return
          const lastGroup = groups[groups.length - 1]
          if (lastGroup.length === 0) return
          const idx = Math.min(INSERT_BUTTON_INDEX, lastGroup.length - 1)
          lastGroup[idx].focus()
        }
      }),
      [getCardGroups]
    )

    if (messages.length === 0 && !isLoading) {
      return <WelcomeMessage t={t} />
    }

    return (
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        {/* Spacer: pushes the conversation to the bottom (most-recent message
            stuck just above the prompt) when content is short; its auto margin
            collapses once messages overflow, so the top stays scrollable. */}
        <div style={{ marginTop: 'auto' }} />
        {messages.map(msg => {
          if (msg.role === 'user') {
            // Render the user bubble plus, in thread order right after it, the
            // never-silent documentNotice for this turn (set by plan 02 on the
            // user message): 'truncated' → discreet info row (DEC-UI-01),
            // 'unavailable' → the existing ErrorBubble (DEC-UI-03), absent →
            // nothing (default unlimited ⇒ silent success is correct). A map
            // callback returns a single node, so wrap them in a keyed Fragment.
            return (
              <React.Fragment key={msg.id}>
                <UserBubble
                  content={msg.content}
                  selection={msg.selection}
                  theme={theme}
                />
                {msg.documentNotice === 'truncated' && (
                  <DocumentTruncatedNotice
                    key={`${msg.id}-notice`}
                    theme={theme}
                    t={t}
                  />
                )}
                {msg.documentNotice === 'unavailable' && (
                  <ErrorBubble
                    key={`${msg.id}-notice`}
                    content={t('Scribe.include.documentUnavailable')}
                    theme={theme}
                    t={t}
                  />
                )}
              </React.Fragment>
            )
          }
          if (msg.role === 'error') {
            return (
              <ErrorBubble
                key={msg.id}
                content={msg.content}
                theme={theme}
                t={t}
              />
            )
          }
          // Assistant render (v3.1-04). Backward-compat: messages predating the
          // extended { discussion, fragments } model have no discussion/fragments,
          // so render a single prose bubble from msg.content — no cards, and (D-08)
          // no message-level actions.
          const hasContractFields =
            msg.discussion !== undefined && msg.fragments !== undefined

          if (!hasContractFields) {
            return (
              <div
                key={msg.id}
                style={{ alignSelf: 'flex-start', maxWidth: '85%' }}
              >
                <AssistantBubble content={msg.content} theme={theme} />
              </div>
            )
          }

          // Contract message: build ordered segments (prose + fragment cards) at
          // {{fragment:N}} positions, orphans appended (D-04). Each card carries the
          // RAW fragment (D-03) to the reinjection pipeline (FRAG-03).
          const segments = buildAssistantSegments(
            msg.discussion ?? msg.content,
            msg.fragments
          )

          // D-05 / CONTRACT-02 no-empty-bubble: a 0-fragment response collapses to a
          // single prose segment; if that prose is empty/whitespace-only, render
          // nothing for this message (no empty bubble).
          const isEmpty =
            segments.length === 1 &&
            segments[0].type === 'prose' &&
            (segments[0].md == null || segments[0].md.trim() === '')
          if (isEmpty) return null

          const isDark = (theme.palette.type || theme.palette.mode) === 'dark'
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                background: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.02)',
                padding: '8px 12px',
                borderRadius: '4px 12px 12px 12px',
                fontSize: 14,
                lineHeight: 1.5,
                wordBreak: 'break-word'
              }}
            >
              {segments.map((seg, i) =>
                seg.type === 'card' ? (
                  <FragmentCard
                    key={`${msg.id}-card-${seg.index}-${i}`}
                    raw={seg.raw}
                    hasSelection={!!currentSelection}
                  />
                ) : (
                  <MarkdownPreview key={`${msg.id}-prose-${i}`}>
                    {seg.md}
                  </MarkdownPreview>
                )
              )}
              <DevExchangePanel msg={msg} theme={theme} />
            </div>
          )
        })}

        {isLoading && (
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              opacity: 0.7,
              fontSize: 13
            }}
          >
            <Spinner size="small" />
            <span>{t('Scribe.chat.typing')}</span>
          </div>
        )}
      </div>
    )
  }
)

ChatMessageList.displayName = 'ChatMessageList'
