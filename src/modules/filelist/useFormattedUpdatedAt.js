import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

/**
 * Returns the formatted "last updated" string for a file row, or undefined
 * when the date is falsy.
 *
 * The guard matters: twake-i18n's `f()` calls date-fns `format()`, which
 * throws on falsy/invalid dates. The library catches the throw but logs it
 * via `console.error('Error in initFormat', ...)`, which our Sentry config
 * captures. Synthetic rows in the file list (shared-drive entries, sharing
 * placeholders) often lack `updated_at`/`created_at`, so we'd otherwise
 * emit a Sentry event for every such row.
 *
 * @param {string | undefined} updatedAt
 * @returns {string | undefined}
 */
export const useFormattedUpdatedAt = updatedAt => {
  const { f, t } = useI18n()
  const { isExtraLarge } = useBreakpoints()

  if (!updatedAt) return undefined

  return f(
    updatedAt,
    isExtraLarge
      ? t('table.row_update_format_full')
      : t('table.row_update_format')
  )
}
