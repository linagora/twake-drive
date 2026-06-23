/**
 * Derives the four flags both FolderViewBody implementations share:
 *
 *   - `isInError`     any query failed
 *   - `hasDataToShow` no error and at least one query has rows
 *   - `isLoading`     no data yet and some query is fetching for the first
 *                     time. Legacy callers also gate on settings loading by
 *                     passing `isSettingsLoaded`; virtualized callers omit it.
 *   - `isEmpty`       no error, no loading, no data
 *
 * The default `isSettingsLoaded = false` means "don't gate isLoading on it",
 * which matches the virtualized body's original behavior; the legacy body
 * passes its real `isSettingsLoaded` to preserve its quicker empty-state
 * fallthrough once settings load.
 */
export const getFolderViewState = ({
  queryResults,
  isSettingsLoaded = false
}) => {
  const isInError = queryResults.some(query => query.fetchStatus === 'failed')
  const hasDataToShow =
    !isInError &&
    queryResults.some(query => query.data && query.data.length > 0)
  const isLoading =
    !hasDataToShow &&
    queryResults.some(
      query => query.fetchStatus === 'loading' && !query.lastUpdate
    ) &&
    !isSettingsLoaded
  const isEmpty = !isInError && !isLoading && !hasDataToShow
  return { isInError, hasDataToShow, isLoading, isEmpty }
}
