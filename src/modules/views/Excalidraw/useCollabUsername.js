import { useI18n } from 'twake-i18n'

import { useEditorAuthor } from '@/modules/views/editor/useEditorAuthor'

/**
 * The display name for this client's live cursor: the shared editor author
 * (instance owner in private, token/URL recipient in public), with a localized
 * guest label when it cannot be resolved (anonymous link share) so a cursor is
 * never nameless.
 *
 * @param {{ isPublic?: boolean }} [options]
 * @returns {string}
 */
export const useCollabUsername = ({ isPublic = false } = {}) => {
  const { t } = useI18n()
  const { author } = useEditorAuthor({ isPublic })
  return author || t('Excalidraw.collaboration.guest')
}
