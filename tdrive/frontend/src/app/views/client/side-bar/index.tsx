import { Button } from '@atoms/button/button';
import {
  ClockIcon,
  CloudIcon,
  ExternalLinkIcon,
  HeartIcon,
  ShareIcon,
  TrashIcon,
  UserIcon,
  UserGroupIcon,
} from '@heroicons/react/outline';
import { useEffect } from 'react';
import useRouterCompany from '@features/router/hooks/use-router-company';
import useRouterWorkspace from '@features/router/hooks/use-router-workspace';
import { useCurrentUser } from 'app/features/users/hooks/use-current-user';
import { useRecoilState } from 'recoil';
import { Title } from '../../../atoms/text';
import { useDriveItem } from '../../../features/drive/hooks/use-drive-item';
import { DriveCurrentFolderAtom } from '../body/drive/browser';
import Account from '../common/account';
import AppGrid from '../common/app-grid';
import DiskUsage from '../common/disk-usage';
import Actions from './actions';
import { useHistory, useLocation } from 'react-router-dom';
import RouterServices from '@features/router/services/router-service';
import Languages from "features/global/services/languages-service";

export default () => {
  const history = useHistory();
  const location = useLocation();
  const company = useRouterCompany();
  const workspace = useRouterWorkspace();
  const [parentId, setParentId] = useRecoilState(
    DriveCurrentFolderAtom({ initialFolderId: 'root' }),
  );
  const { user } = useCurrentUser();
  const active = false;
  const { access: rootAccess } = useDriveItem('root');
  const { sharedWithMe, inTrash, path } = useDriveItem(parentId);
  const activeClass = 'bg-zinc-50 dark:bg-zinc-800 !text-blue-500';
  let folderType = 'home';
  if ((path || [])[0]?.id === 'user_' + user?.id) folderType = 'personal';
  if (inTrash) folderType = 'trash';
  if (sharedWithMe) folderType = 'shared';
  const { viewId, itemId } = RouterServices.getStateFromRoute();
  useEffect(() => {
    !itemId && viewId && setParentId(viewId);
  }, [viewId, itemId]);
  return (
    <div className="grow flex flex-col overflow-auto -m-4 p-4 relative">
      <div className="grow">
        <div className="sm:hidden block mb-2">
          <div className="flex flex-row space-between w-full">
            <div className="grow">
              <Account sidebar />
            </div>
            <AppGrid />
          </div>

          <div className="mt-6" />
          <Title>Actions</Title>
        </div>

        <Actions />

        <div className="mt-4" />
        <Title>Drive</Title>
        <Button
          onClick={() => {history.push(RouterServices.generateRouteFromState({companyId: company, viewId: 'user_' + user?.id})); setParentId('user_' + user?.id)}}
          size="lg"
          theme="white"
          className={'w-full mb-1 ' + (folderType === 'personal' && viewId == '' ? activeClass : '')}
        >
          <UserIcon className="w-5 h-5 mr-4" /> {Languages.t('components.side_menu.my_drive')}
        </Button>
        <Button
          onClick={() => {history.push(RouterServices.generateRouteFromState({companyId: company, viewId: "root"})); setParentId('root')}}
          size="lg"
          theme="white"
          className={'w-full mb-1 ' + (folderType === 'home' && viewId == '' ? activeClass : '')}
        >
          <CloudIcon className="w-5 h-5 mr-4" /> {Languages.t('components.side_menu.home')}
        </Button>
        <Button
          onClick={() => {history.push(RouterServices.generateRouteFromState({companyId: company, viewId: "shared_with_me"})); setParentId('shared_with_me')}}
          size="lg"
          theme="white"
          className={'w-full mb-1 ' + (folderType === 'shared' && viewId == ''? activeClass : '')}
        >
          <UserGroupIcon className="w-5 h-5 mr-4" /> {Languages.t('components.side_menu.shared_with_me')}
        </Button>
        {false && (
          <>
            <Button
              size="lg"
              theme="white"
              className={'w-full mb-1 ' + (!active ? activeClass : '')}
            >
              <ClockIcon className="w-5 h-5 mr-4" /> Recent
            </Button>
            <Button
              size="lg"
              theme="white"
              className={'w-full mb-1 ' + (!active ? activeClass : '')}
            >
              <HeartIcon className="w-5 h-5 mr-4" /> Favorites
            </Button>
          </>
        )}
        {rootAccess === 'manage' && (
          <Button
            onClick={() =>{history.push(RouterServices.generateRouteFromState({companyId: company, viewId: ""}));setParentId('trash')}}
            size="lg"
            theme="white"
            className={'w-full mb-1 ' + (folderType === 'trash' && viewId == ''? activeClass : '')}
          >
            <TrashIcon className="w-5 h-5 mr-4 text-rose-500" /> {Languages.t('components.side_menu.trash')}
          </Button>
        )}

        {false && (
          <>
            <div className="mt-4" />
            <Title>Shared</Title>
            <Button
              size="lg"
              theme="white"
              className={'w-full mt-2 mb-1 ' + (!inTrash ? activeClass : '')}
            >
              <ShareIcon className="w-5 h-5 mr-4" /> Shared with me
            </Button>
            <Button
              size="lg"
              theme="white"
              className={'w-full mb-1 ' + (inTrash ? activeClass : '')}
            >
              <ExternalLinkIcon className="w-5 h-5 mr-4" /> Shared by me
            </Button>
          </>
        )}
      </div>

      <div className="">
        <DiskUsage />
      </div>
    </div>
  );
};
