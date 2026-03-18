import React, { useRef, useEffect } from 'react'

import Spinner from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useTheme } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'
import Markdown from 'react-markdown'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'

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
      <Markdown>{content}</Markdown>
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
    <Typography
      variant="body2"
      color="textSecondary"
      style={{ marginTop: 16 }}
    >
      {t('Scribe.chat.welcome')}
    </Typography>
  </div>
)

export const ChatMessageList = () => {
  const { messages, isLoading } = useScribe()
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

  if (messages.length === 0 && !isLoading) {
    return <WelcomeMessage t={t} />
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}
    >
      {messages.map(msg => {
        if (msg.role === 'user') {
          return <UserBubble key={msg.id} content={msg.content} selection={msg.selection} theme={theme} />
        }
        if (msg.role === 'error') {
          return <ErrorBubble key={msg.id} content={msg.content} theme={theme} t={t} />
        }
        return <AssistantBubble key={msg.id} content={msg.content} theme={theme} />
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
