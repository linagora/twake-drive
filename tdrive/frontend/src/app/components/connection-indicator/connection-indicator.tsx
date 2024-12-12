import React from 'react';
import './connection-indicator.scss';
import ErrorOutlinedIcon from '@material-ui/icons/ErrorOutlined';
import HourglassEmpty from '@material-ui/icons/HourglassEmpty';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import Languages from '@features/global/services/languages-service';
import { ConnectedState } from '@features/users/state/atoms/connected';
import { useRecoilState } from 'recoil';
// import WebSocket, { WebsocketEvents } from '@features/global/types/websocket-types';

export default () => {
  const [{ connected, reconnecting }] = useRecoilState(ConnectedState);

  return (
    <div className={'connection_indicator ' + (connected === false ? 'visible' : '') + ' testid:connection-indicator'}>
      {connected === false && reconnecting !== true && (
        <div className="testid:disconnected-status">
          <ErrorOutlinedIcon /> <span>{Languages.t('general.connexion_status.disconnected')}</span>
        </div>
      )}
      {connected === false && reconnecting === true && (
        <div className="testid:reconnect-status">
          <HourglassEmpty /> <span>{Languages.t('general.connexion_status.connecting')}</span>
        </div>
      )}
      {connected === true && (
        <div className="testid:connected-status">
          <CheckCircleIcon /> <span>{Languages.t('general.connexion_status.connected')}</span>
        </div>
      )}
    </div>
  );
};
