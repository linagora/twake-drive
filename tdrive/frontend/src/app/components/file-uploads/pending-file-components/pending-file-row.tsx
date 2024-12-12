import React from 'react';
import { PauseCircle, PlayCircle, Trash2 } from 'react-feather';
import { Row, Col, Typography, Divider, Progress, Button, Tooltip } from 'antd';
import { capitalize } from 'lodash';

import {
  isPendingFileStatusCancel,
  isPendingFileStatusError,
  isPendingFileStatusPause,
  isPendingFileStatusPending,
  isPendingFileStatusSuccess,
} from '../../../features/files/utils/pending-files';
import Languages from '@features/global/services/languages-service';
import { useUpload } from '@features/files/hooks/use-upload';
import { PendingFileRecoilType, PendingFileType } from '@features/files/types/file';

type PropsType = {
  pendingFileState: PendingFileRecoilType;
  pendingFile: PendingFileType;
};

const { Text } = Typography;
export default ({ pendingFileState, pendingFile }: PropsType) => {
  const { pauseOrResumeUpload, cancelUpload } = useUpload();

  const getProgressStrokeColor = (status: PendingFileRecoilType['status']) => {
    if (isPendingFileStatusCancel(status)) return 'var(--error)';
    if (isPendingFileStatusError(status)) return 'var(--error)';
    if (isPendingFileStatusPause(status)) return 'var(--warning)';
    if (isPendingFileStatusPending(status)) return 'var(--progress-bar-color)';

    return 'var(--success)';
  };

  const setStatus = () => {
    switch (pendingFileState.status) {
      case 'error':
      case 'pause':
      case 'cancel':
        return 'exception';
      case 'pending':
        return 'active';
      case 'success':
        return 'success';
      default:
        return 'normal';
    }
  };

  return (
    <div
      style={{
        backgroundColor:
          isPendingFileStatusCancel(pendingFileState.status) ||
          isPendingFileStatusError(pendingFileState.status)
            ? 'var(--error-background)'
            : undefined,
      }}
    >
      <Row
        className="testid:pending-files-row"
        justify="space-between"
        align="middle"
        wrap={false}
        style={{
          height: 39,
          width: '100%',
        }}
      >
        <Col className="small-left-margin" flex="auto" style={{ lineHeight: '16px' }}>
          {pendingFile?.originalFile?.name ? (
            <Row justify="start" align="middle" wrap={false}>
              <Text
                ellipsis
                style={{
                  maxWidth: isPendingFileStatusPause(pendingFile.status) ? 130 : 160,
                  verticalAlign: 'middle',
                }}
                className="testid:file-name"
              >
                {capitalize(pendingFile?.originalFile.name)}
              </Text>
              {isPendingFileStatusPause(pendingFile.status) && (
                <Text type="secondary" className='ant-typography-single-line' style={{ verticalAlign: 'middle', marginLeft: 4 }}>
                  ({Languages.t('general.paused')})
                </Text>
              )}
            </Row>
          ) : (
            <div
              style={{
                marginTop: 8,
                height: 8,
                maxWidth: 160,
                borderRadius: 8,
                backgroundColor: 'var(--grey-background)',
              }}
            />
          )}
          {pendingFile?.label ? (
            <Row justify="start" align="middle" wrap={false}>
              <Text
                className="testid:file-label"
                ellipsis
                style={{
                  maxWidth: isPendingFileStatusPause(pendingFile.status) ? 130 : 160,
                  verticalAlign: 'middle',
                }}
              >
                {pendingFile?.label}
              </Text>
            </Row>
          ) : (
            <div
              style={{
                marginTop: 8,
                height: 8,
                maxWidth: 160,
                borderRadius: 8,
                backgroundColor: 'var(--grey-background)',
              }}
            />
          )}
        </Col>

        <Col
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: '16px',
          }}
        >
          {pendingFileState.id ? (
            !isPendingFileStatusSuccess(pendingFileState.status) &&
            !isPendingFileStatusError(pendingFileState.status) ? (
              <Tooltip
                placement="top"
                title={
                  isPendingFileStatusPause(pendingFileState.status)
                    ? Languages.t('general.resume')
                    : Languages.t('general.pause')
                }
                className="pending-file-row-tooltip-file-status"
              >
                <Button
                  type="link"
                  shape="circle"
                  disabled={isPendingFileStatusError(pendingFileState.status)}
                  icon={
                    isPendingFileStatusPause(pendingFileState.status) ? (
                      <PlayCircle size={16} color="var(--black)" />
                    ) : (
                      <PauseCircle size={16} color="var(--black)" />
                    )
                  }
                  onClick={() => pauseOrResumeUpload(pendingFileState.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  className="testid:button-toggle-tooltip-status"
                />
              </Tooltip>
            ) : (
              <div style={{ width: 32 }} />
            )
          ) : (
            <div
              style={{
                marginTop: 8,
                height: 8,
                maxWidth: 32,
                borderRadius: 8,
                backgroundColor: 'var(--grey-background)',
              }}
            />
          )}
        </Col>

        <Col
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: '16px',
          }}
        >
          {!isPendingFileStatusSuccess(pendingFileState.status) &&
          !isPendingFileStatusError(pendingFileState.status) ? (
            <Tooltip title={Languages.t('general.cancel')} placement="top" className="testid:pending-file-row-tooltip-cancel">
              <Button
                type="link"
                shape="circle"
                icon={<Trash2 size={16} color={'var(--black)'} />}
                onClick={() => cancelUpload(pendingFileState.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="testid:button-toggle-tooltip-cancel"
              />
            </Tooltip>
          ) : (
            <div style={{ width: 32 }} />
          )}
        </Col>
      </Row>
      <div className="file-progress-bar-container testid:progress-bar">
        <Progress
          type="line"
          className="file-progress-bar"
          percent={pendingFileState.progress * 100}
          showInfo={false}
          trailColor="var(--white)"
          status={setStatus()}
          strokeColor={getProgressStrokeColor(pendingFileState.status)}
        />
      </div>
      <Divider style={{ margin: 0 }} />
    </div>
  );
};
