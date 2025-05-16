import { atom, useRecoilState } from 'recoil';
import { useState, useEffect } from 'react';

import Languages from 'features/global/services/languages-service';
import { useDriveItem, getPublicLink } from '@features/drive/hooks/use-drive-item';
import { useCurrentCompany } from '@features/companies/hooks/use-companies';
import { changePublicLink, hasAnyPublicLinkAccess } from '@features/files/utils/access-info-helpers';
import type { DriveFileAccessLevel } from '@features/drive/types';

import A from '@atoms/link';
import { Subtitle } from '@atoms/text';
import { LockClosedIcon, EyeIcon, PencilIcon, ScaleIcon, EyeOffIcon } from '@heroicons/react/outline';
import { Modal, ModalContent } from '@atoms/modal';
import { PublicLinkAccessOptions } from './public-link-access-options';
import BaseBlock from '@molecules/grouped-rows/base';
import { AccessLevelDropdown, translateAccessLevel } from '../../components/access-level-dropdown';
import { CopyLinkButton } from './copy-link-button';
import Styles from './styles';

export type PublicLinkModalType = {
  open: boolean;
  id: string;
};

export const PublicLinkModalAtom = atom<PublicLinkModalType>({
  key: 'PublicLinkModalType',
  default: {
    open: false,
    id: '',
  },
});

export const PublicLinkModal = () => {
  const [state, setState] = useRecoilState(PublicLinkModalAtom);
  const [isOnAdvancedScreen, setIsOnAdvancedScreen] = useState(false);

  return (
    <Modal
      open={state.open}
      onClose={() => {
        setIsOnAdvancedScreen(false);
        setState({ ...state, open: false });
      }}
      className="testid:public-link-modal"
      >
      {!!state.id &&
        <PublicLinkModalContent
          id={state.id}
          isOnAdvancedScreen={isOnAdvancedScreen}
          onShowAdvancedScreen={(active) => setIsOnAdvancedScreen(active)}
        />}
    </Modal>
  );
};

const ChangePublicLinkAccessLevelRow = (props: {
  disabled?: boolean;
  level: DriveFileAccessLevel | null;
  onChange: (level: DriveFileAccessLevel & 'remove') => void;
}) => {
  const IconForLevel = {
    'manage': ScaleIcon,
    'write': PencilIcon,
    'read': EyeIcon,
    'none': EyeOffIcon,
  }[props.level || 'none'];
  return (
    <BaseBlock
      className='p-4 flex flex-row items-center justify-center text-zinc-800 dark:text-white'
      avatar={<IconForLevel className="w-5 mr-2" />}
      title={translateAccessLevel(props.level || 'none')}
      subtitle={Languages.t("components.public-link-access-level-update-subtitle")}
      suffix={
        <AccessLevelDropdown
          className='leading-tight text-end !pl-5 !pr-8 border-none bg-white dark:bg-zinc-900'
          disabled={props.disabled}
          size={'sm'}
          noRedWhenLevelNone={true}
          level={props.level}
          hiddenLevels={['remove']}
          onChange={props.onChange}
          testClassId="level-dropdown"
        />
      }
      />
  );
}

const SwitchToAdvancedSettingsRow = (props: {
  disabled: boolean,
  onShowAdvancedScreen: (active: boolean) => void,
}) =>
  <BaseBlock
    className='p-4 flex flex-row items-center justify-center text-zinc-800 dark:text-white'
    avatar={<LockClosedIcon className="w-5 mr-2" />}
    title={Languages.t('components.public-link-security')}
    suffix={
      <A
        className={"pr-4 inline-block " + (props.disabled ? '!text-zinc-500 dark:!text-white dark:opacity-50' : '!text-zinc-800 dark:!text-white')}
        disabled={props.disabled}
        noColor={props.disabled}
        onClick={() => {
          if (!props.disabled)
            props.onShowAdvancedScreen(true);
        }}
        testClassId="advance-switcher"
      >
        {Languages.t("components.public-link-security-change")}
      </A>
    }
    subtitle={Languages.t("components.public-link-security-change-subtitle")}
    />;

const PublicLinkModalContent = (props: {
  id: string,
  isOnAdvancedScreen: boolean,
  onShowAdvancedScreen: (active: boolean) => void,
}) => {
  const { id } = props;
  const { item, access, loading, update, refresh } = useDriveItem(id);
  const { refresh: refreshCompany } = useCurrentCompany();
  useEffect(() => {
    refresh(id);
    refreshCompany();
  }, []);
  const havePublicLink = hasAnyPublicLinkAccess(item);
  const publicLink = getPublicLink(item);

  return (
    <ModalContent
      title={
        <>
          {Languages.t('components.public-link-security-title') + ' '}
          <strong>{item?.name}</strong>
        </>
      }
    >
      <div className="rounded-md border dark:border-zinc-700 my-5 mb-8">
        <ChangePublicLinkAccessLevelRow
          disabled={loading}
          level={item?.access_info?.public?.level || 'none'}
          onChange={level => {
            item && update({
              ...changePublicLink(item, { level }),
              is_update_access_to_share_link: true,
            });
          }}
          />
        <SwitchToAdvancedSettingsRow
          disabled={!havePublicLink}
          onShowAdvancedScreen={props.onShowAdvancedScreen}
        />
      </div>

      <div className="flex flex-row place-content-end my-4">
        <CopyLinkButton textToCopy={havePublicLink && publicLink} />
      </div>

      <Modal
        open={props.isOnAdvancedScreen}
        onClose={() => { props.onShowAdvancedScreen(false); }}
        className="testid:public-link-advance-setting-modal"
      >
        <ModalContent
          title={
            <>
              {Languages.t('components.public-link-security-title') + ' '}
              <strong>{item?.name}</strong>
            </>
          }
        >
          <div className='my-4'><Subtitle>{Languages.t('components.public-link-security')}</Subtitle></div>
          <div className={Styles.RoundedBorderSection}>
            <PublicLinkAccessOptions
              disabled={loading || access !== 'manage'}
              password={item?.access_info?.public?.password}
              expiration={item?.access_info?.public?.expiration}
              onChangePassword={async (password: string) => {
                item && await update(changePublicLink(item, { password: password || '' }));
              }}
              onChangeExpiration={async (expiration: number) => {
                item && await update(changePublicLink(item, { expiration }));
              }}
            />
          </div>
        </ModalContent>
      </Modal>
    </ModalContent>
  );
}