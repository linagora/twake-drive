import { TRASH_DIR_PATH } from '@/constants/config'

// A live folder such as /.cozy_trash_backup only shares the Bin's prefix
export const isInTrashDir = path =>
  path === TRASH_DIR_PATH || !!path?.startsWith(`${TRASH_DIR_PATH}/`)
