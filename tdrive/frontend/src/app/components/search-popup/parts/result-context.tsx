/* eslint-disable @typescript-eslint/no-explicit-any */
import UsersService from '@features/users/services/current-user-service';
import { UserType } from '@features/users/types/user';

export default ({ user }: { user?: UserType }) => {
  return (
    <div className="flex overflow-hidden whitespace-nowrap text-ellipsis testid:result-context">
      {!!user && <>{UsersService.getFullName(user)}</>}
    </div>
  );
};
