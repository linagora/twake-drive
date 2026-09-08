import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useEffect } from 'react'

import Alert from 'cozy-ui/transpiled/react/Alert'
import Box from 'cozy-ui/transpiled/react/Box'
import LinearProgress from 'cozy-ui/transpiled/react/LinearProgress'
import ListItemSkeleton from 'cozy-ui/transpiled/react/Skeletons/ListItemSkeleton'
import { useI18n } from 'twake-i18n'

import { EmptyMessage as DefaultEmptyMessage } from './EmptyMessage'
import PickerViewBreadcrumb from './PickerViewBreadcrumb'
import { PickerViewTable } from './PickerViewTable'
import styles from './styles.styl'

function PickerViewErrorMessage({ error }) {
  const { t } = useI18n()

  if (!error) return null

  return (
    <Alert
      severity="error"
      data-testid="file-picker-error"
      className="u-mt-1 u-mh-1"
    >
      {t(`FilePicker.errors.${error}`, { _: error })}
    </Alert>
  )
}

PickerViewErrorMessage.propTypes = {
  error: PropTypes.string
}

function PickerViewTableContent({
  items,
  hasMore,
  fetchMore,
  isFetchingMore,
  selectedItemIds,
  isItemDisabled,
  onItemClick,
  onItemToggle,
  onItemDoubleClick,
  onItemNavigate,
  withFilePath,
  virtuosoRef,
  scrollerRef
}) {
  return (
    <>
      {isFetchingMore && (
        <LinearProgress
          className="u-mh-1"
          data-testid="file-picker-loading-more"
        />
      )}
      <PickerViewTable
        items={items}
        itemsIdsSelected={selectedItemIds}
        isItemDisabled={isItemDisabled}
        onItemClick={onItemClick}
        onItemToggle={onItemToggle}
        onItemDoubleClick={onItemDoubleClick}
        onItemNavigate={onItemNavigate}
        fetchMore={hasMore ? fetchMore : null}
        scrollerRef={scrollerRef}
        virtuosoRef={virtuosoRef}
        withFilePath={withFilePath}
      />
    </>
  )
}

PickerViewTableContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  hasMore: PropTypes.bool.isRequired,
  fetchMore: PropTypes.func,
  isFetchingMore: PropTypes.bool.isRequired,
  selectedItemIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  isItemDisabled: PropTypes.func.isRequired,
  onItemClick: PropTypes.func,
  onItemToggle: PropTypes.func,
  onItemDoubleClick: PropTypes.func,
  onItemNavigate: PropTypes.func,
  withFilePath: PropTypes.bool.isRequired,
  virtuosoRef: PropTypes.object,
  scrollerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
}

function PickerViewContent({
  items,
  fetchStatus,
  hasMore,
  fetchMore,
  isFetchingMore,
  keepItemsOnError,
  errorMessageKey,
  withFilePath,
  selectedItemIds,
  isItemDisabled,
  onItemClick,
  onItemToggle,
  onItemDoubleClick,
  onItemNavigate,
  error,
  emptyMessage,
  isSectionChanging,
  virtuosoRef,
  scrollerRef
}) {
  const { t } = useI18n()
  const hasItems = items.length > 0
  const shouldShowSourceError =
    ['error', 'failed'].includes(fetchStatus) &&
    (!hasItems || !keepItemsOnError)

  return (
    <>
      <PickerViewErrorMessage error={error} />
      {isSectionChanging ? null : shouldShowSourceError ? (
        <Alert
          severity="error"
          data-testid="file-picker-source-error"
          className="u-mt-1 u-mh-1"
        >
          {t(errorMessageKey)}
        </Alert>
      ) : fetchStatus === 'loading' && !isFetchingMore ? (
        <Box
          px={3}
          role="status"
          aria-label={t('loading.message')}
          data-testid="file-picker-loading"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <ListItemSkeleton key={index} hasSecondary divider={index !== 2} />
          ))}
        </Box>
      ) : !hasItems ? (
        (emptyMessage ?? <DefaultEmptyMessage />)
      ) : (
        <PickerViewTableContent
          items={items}
          hasMore={hasMore}
          fetchMore={fetchMore}
          isFetchingMore={isFetchingMore}
          selectedItemIds={selectedItemIds}
          isItemDisabled={isItemDisabled}
          onItemClick={onItemClick}
          onItemToggle={onItemToggle}
          onItemDoubleClick={onItemDoubleClick}
          onItemNavigate={onItemNavigate}
          withFilePath={withFilePath}
          virtuosoRef={virtuosoRef}
          scrollerRef={scrollerRef}
        />
      )}
    </>
  )
}

PickerViewContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  fetchStatus: PropTypes.string.isRequired,
  hasMore: PropTypes.bool.isRequired,
  fetchMore: PropTypes.func,
  isFetchingMore: PropTypes.bool.isRequired,
  keepItemsOnError: PropTypes.bool.isRequired,
  errorMessageKey: PropTypes.string.isRequired,
  withFilePath: PropTypes.bool.isRequired,
  selectedItemIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  isItemDisabled: PropTypes.func.isRequired,
  onItemClick: PropTypes.func,
  onItemToggle: PropTypes.func,
  onItemDoubleClick: PropTypes.func,
  onItemNavigate: PropTypes.func,
  error: PropTypes.string,
  emptyMessage: PropTypes.node,
  isSectionChanging: PropTypes.bool.isRequired,
  virtuosoRef: PropTypes.object,
  scrollerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
}

export const PickerView = ({
  items = [],
  breadcrumbPath,
  onBreadcrumbClick,
  fetchStatus = 'loaded',
  hasMore = false,
  fetchMore = null,
  isFetchingMore = false,
  keepItemsOnError = false,
  errorMessageKey = 'error.open_folder',
  withFilePath = false,
  selectedItemIds = [],
  isItemDisabled = () => false,
  onItemClick,
  onItemToggle,
  onItemDoubleClick,
  onItemNavigate,
  error,
  emptyMessage,
  isSectionChanging = false,
  onSectionReady,
  selectionContainerRef,
  virtuosoRef,
  scrollerRef
}) => {
  useEffect(() => {
    if (isSectionChanging && (fetchStatus !== 'loading' || isFetchingMore)) {
      onSectionReady?.()
    }
  }, [fetchStatus, isFetchingMore, isSectionChanging, onSectionReady])

  return (
    <Box
      ref={selectionContainerRef}
      tabIndex={-1}
      className={cx(
        'u-pos-absolute u-top-0 u-right-0 u-bottom-0 u-left-0',
        styles.pickerViewSelectionContainer
      )}
      display="flex"
      flexDirection="column"
    >
      <Box px={3} py={0} className="u-mt-half">
        <PickerViewBreadcrumb
          path={breadcrumbPath}
          onBreadcrumbClick={onBreadcrumbClick}
        />
      </Box>
      <PickerViewContent
        items={items}
        fetchStatus={fetchStatus}
        hasMore={hasMore}
        fetchMore={fetchMore}
        isFetchingMore={isFetchingMore}
        keepItemsOnError={keepItemsOnError}
        errorMessageKey={errorMessageKey}
        withFilePath={withFilePath}
        selectedItemIds={selectedItemIds}
        isItemDisabled={isItemDisabled}
        onItemClick={onItemClick}
        onItemToggle={onItemToggle}
        onItemDoubleClick={onItemDoubleClick}
        onItemNavigate={onItemNavigate}
        error={error}
        emptyMessage={emptyMessage}
        isSectionChanging={isSectionChanging}
        virtuosoRef={virtuosoRef}
        scrollerRef={scrollerRef}
      />
    </Box>
  )
}

PickerView.displayName = 'PickerView'
PickerView.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  breadcrumbPath: PropTypes.array,
  onBreadcrumbClick: PropTypes.func,
  fetchStatus: PropTypes.string,
  hasMore: PropTypes.bool,
  fetchMore: PropTypes.func,
  isFetchingMore: PropTypes.bool,
  keepItemsOnError: PropTypes.bool,
  errorMessageKey: PropTypes.string,
  withFilePath: PropTypes.bool,
  selectedItemIds: PropTypes.arrayOf(PropTypes.string),
  isItemDisabled: PropTypes.func,
  onItemClick: PropTypes.func,
  onItemToggle: PropTypes.func,
  onItemDoubleClick: PropTypes.func,
  onItemNavigate: PropTypes.func,
  error: PropTypes.string,
  emptyMessage: PropTypes.node,
  isSectionChanging: PropTypes.bool,
  onSectionReady: PropTypes.func,
  selectionContainerRef: PropTypes.object,
  virtuosoRef: PropTypes.object,
  scrollerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
}

export default PickerView
