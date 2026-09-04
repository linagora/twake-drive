import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useEffect } from 'react'

import Alert from 'cozy-ui/transpiled/react/Alert'
import Box from 'cozy-ui/transpiled/react/Box'
import ListItemSkeleton from 'cozy-ui/transpiled/react/Skeletons/ListItemSkeleton'
import LinearProgress from 'cozy-ui/transpiled/react/LinearProgress'
import { useI18n } from 'twake-i18n'

import { EmptyMessage as DefaultEmptyMessage } from './EmptyMessage'
import PickerViewBreadcrumb from './PickerViewBreadcrumb'
import { PickerViewTable } from './PickerViewTable'
import styles from './styles.styl'

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
  const { t } = useI18n()

  useEffect(() => {
    if (
      isSectionChanging &&
      (fetchStatus !== 'loading' || isFetchingMore)
    ) {
      onSectionReady?.()
    }
  }, [fetchStatus, isFetchingMore, isSectionChanging, onSectionReady])

  const errorMessage = error
    ? t(`FilePicker.errors.${error}`, { _: error })
    : null
  const hasItems = items.length > 0
  const shouldShowSourceError =
    ['error', 'failed'].includes(fetchStatus) &&
    (!hasItems || !keepItemsOnError)

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
      {errorMessage && (
        <Alert
          severity="error"
          data-testid="file-picker-error"
          className="u-mt-1 u-mh-1"
        >
          {errorMessage}
        </Alert>
      )}
      <Box px={3} py={0} className="u-mt-half">
        <PickerViewBreadcrumb
          path={breadcrumbPath}
          onBreadcrumbClick={onBreadcrumbClick}
        />
      </Box>
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
      )}
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
