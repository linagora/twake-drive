/* eslint-disable @typescript-eslint/no-explicit-any */
import UsersService from '@features/users/services/current-user-service';
import { UserType } from '@features/users/types/user';

export default ({ user, testClassId }: { user?: UserType; testClassId?: string }) => {
  const testId = testClassId ? `testid:${testClassId}` : ''
  return (
    <div className={`flex overflow-hidden whitespace-nowrap text-ellipsis ${testId}`}>
      {!!user && <>{UsersService.getFullName(user)}</>}
    </div>
  );
};
