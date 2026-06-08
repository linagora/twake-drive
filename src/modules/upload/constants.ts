export const uploadConflictStrategies = {
  REPLACE: 'replace',
  KEEP_BOTH: 'keep-both',
  CANCEL: 'cancel'
} as const

export type UploadConflictStrategy =
  (typeof uploadConflictStrategies)[keyof typeof uploadConflictStrategies]
