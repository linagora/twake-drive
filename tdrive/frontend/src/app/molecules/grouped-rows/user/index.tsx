/* eslint-disable @typescript-eslint/ban-ts-comment */
import React from 'react';
import { Base, Info } from '@atoms/text';
import Avatar from '@atoms/avatar';
import BaseBlock from '@molecules/grouped-rows/base';
import Languages from '@features/global/services/languages-service';
import type { UserType } from '@features/users/types/user';
import { getFullName } from '@features/users/utils/get-full-name';

interface UserBlockProps {
  className?: string;
  suffix?: JSX.Element | string | false;
  title_suffix?: JSX.Element | string | false;
  subtitle_suffix?: JSX.Element | string | false;
  user?: UserType;
  isSelf?: boolean;
  onClick?: () => void;
}

export default function UserBlock(props: UserBlockProps) {
  return <BaseBlock
    className={props.className + ' testid:user-block'}
    suffix={props.suffix}
    title_suffix={props.title_suffix}
    subtitle_suffix={props.subtitle_suffix}
    onClick={props.onClick}
    avatar={
      <Avatar
        avatar={props.user?.thumbnail || ''}
        title={props.user ? getFullName(props.user) : '-'}
        size="sm"
        testClassId="avatar"
      />
    }
    title={
      <>
        <Base>{!!props.user && getFullName(props.user)}</Base>
        {props.isSelf && <Info>{' ' + Languages.t('components.internal-access_specific_rules_you')}</Info>}
      </>
    }
    subtitle={
      <div className='text-sm text-slate-500'>{props.user?.email || ""}</div>
    }
  />
}
