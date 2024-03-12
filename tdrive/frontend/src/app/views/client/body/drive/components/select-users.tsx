import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@atoms/input/input-text';
import { useSearchUsers } from '@features/users/hooks/use-search-user-list';
import User from '@components/ui/user';
import { Button } from '@atoms/button/button';
import { UserType } from '@features/users/types/user';
import { InputDecorationIcon } from '@atoms/input/input-decoration-icon';
import { SearchIcon } from '@heroicons/react/solid';
import { Info } from '@atoms/text';
import Languages from '@features/global/services/languages-service';
import _ from 'lodash';


export default (props: {
  className?: string;
  onChange: (users: UserType[]) => void;
  initialUsers: UserType[];
}) => {
  const [users, setUsers] = useState<UserType[]>(props.initialUsers);
  const { search, result, query } = useSearchUsers({ scope: 'company' });
  const [isFocus, setFocus] = useState(false);
  const inputElement = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (users.length) props.onChange(users);
  }, [users]);

  return (
    <div className="w-full relative">
      <InputDecorationIcon
        prefix={SearchIcon}
        input={({ className }) => (
          <Input
            onFocus={() => setFocus(true)}
            onBlur={() => {
              setTimeout(() => {
                if (inputElement.current !== document.activeElement) {
                  setFocus(false);
                }
              }, 200);
            }}
            placeholder={Languages.t('components.select-users_search_users')}
            className={props.className + ' ' + className + ' w-full'}
            theme="plain"
            onChange={e => search(e.target.value)}
            inputRef={inputElement}
          />
        )}
      />
      {isFocus && query?.trim() && (
        <div className="absolute w-full top-0 -translate-y-full bg-white dark:bg-zinc-800 dark:text-white rounded-md border shadow-md p-2">
          <div>
            {result.length === 0 && (
              <div className="text-center pt-8">
                <Info>{Languages.t('components.user_picker.modal_no_result')}</Info>
              </div>
            )}
            {_.reverse(result.slice(0, 5)).map((user, i) => {
              return (
                <div key={user.id} className={"rounded m-1 p-3 new-direct-channel-proposed-user flex flex-row items-center justify-center align-baseline" + (i > 0 ? ' border-t' : '')}>
                  <div className="grow">
                    <div className='font-bold'>
                    <User data={user} />
                    </div>
                    <div className='ml-3 text-sm text-slate-500'>{user.email}</div>
                  </div>
                  <div className='shrink-0 ml-2'>
                    <Button
                      onClick={() => {
                        setUsers([user]);
                        search('');
                      }}
                      size="sm"
                    >
                      {Languages.t('general.add')}
                    </Button>
                  </div>
                  </div>
              );
            })}
            <div className='-mb-px' />
          </div>
        </div>
      )}
    </div>
  );
};
