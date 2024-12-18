import { DotsHorizontalIcon } from '@heroicons/react/outline';
import { FolderIcon } from '@heroicons/react/solid';
import { Button } from '@atoms/button/button';
import { Base, BaseSmall } from '@atoms/text';
import Menu from '@components/menus/menu';
import { formatBytes } from '@features/drive/utils';
import { useState } from 'react';
import { PublicIcon } from '../components/public-icon';
import { CheckableIcon, DriveItemProps } from './common';
import { hasAnyPublicLinkAccess } from '@features/files/utils/access-info-helpers';
import './style.scss';

export const FolderRow = ({
  item,
  className,
  onCheck,
  checked,
  onClick,
  onBuildContextMenu,
  testClassId,
}: DriveItemProps) => {
  const [hover, setHover] = useState(false);

  const testId = testClassId ? ` testid:${testClassId}` : '';

  return (
    <div
      className={
        'flex flex-row items-center border border-zinc-200 dark:border-zinc-800 px-4 py-3 cursor-pointer ' +
        (className || '') +
        (checked
          ? 'bg-blue-500 bg-opacity-10 hover:bg-opacity-25 '
          : 'hover:bg-zinc-500 hover:bg-opacity-10 ') +
        (className || '') + ' ' +
        testId
      }
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={e => {
        if (e.shiftKey || e.ctrlKey) onCheck(!checked);
        else if (onClick) onClick();
      }}
    >
      <div onClick={e => e.stopPropagation()}>
        <CheckableIcon
          className="mr-2 -ml-1"
          show={hover || checked}
          checked={checked}
          onCheck={onCheck}
          fallback={<FolderIcon className="h-5 w-5 shrink-0 text-blue-500" />}
        />
      </div>
      <div className="grow whitespace-nowrap overflow-hidden">
        <Base className="!font-semibold text-ellipsis overflow-hidden block max-w-full">{item.name}</Base>
      </div>
      <div className="shrink-0 ml-4">
        {hasAnyPublicLinkAccess(item) && (
          <PublicIcon className="h-5 w-5 text-blue-500" />
        )}
      </div>
      <div className="shrink-0 ml-4 text-right minWidth80">
        <BaseSmall>{formatBytes(item.size)}</BaseSmall>
      </div>
      <div className="shrink-0 ml-4">
        <Menu menu={onBuildContextMenu} testClassId="folder-row-menu">
          <Button
            theme={'secondary'}
            size="sm"
            className={'!rounded-full '}
            icon={DotsHorizontalIcon}
            testClassId="folder-row-button-open-menu"
          />
        </Menu>
      </div>
    </div>
  );
};
