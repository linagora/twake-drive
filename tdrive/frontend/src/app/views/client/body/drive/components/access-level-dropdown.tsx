import Select, { SelectSize } from '@atoms/input/input-select';
import { DriveFileAccessLevel } from '@features/drive/types';
import Languages from 'features/global/services/languages-service';

type DriveFileAccessLevelOrRemove = DriveFileAccessLevel | 'remove';

export function translateAccessLevel(level: DriveFileAccessLevelOrRemove) {
  if (!level) return undefined;
  const key = {
      'manage': 'common.access-level_full_access',
      'write':  'common.access-level_write',
      'read':   'common.access-level_read',
      'none':   'common.access-level_no_access',
      'remove': 'common.access-level_remove',
    }[level];
  if (!key) throw new Error("Unknown level: " + JSON.stringify(level));
  return Languages.t(key);
}

export const AccessLevelDropdown = ({
  disabled,
  level,
  onChange,
  hiddenLevels,
  labelOverrides,
  className,
  size,
  noRedWhenLevelNone,
  testClassId,
}: {
  disabled?: boolean;
  level: DriveFileAccessLevel | null;
  onChange: (level: DriveFileAccessLevel & 'remove') => void;
  className?: string;
  labelOverrides?: { [key: string]: string };
  hiddenLevels?: DriveFileAccessLevelOrRemove[] | string[];
  size?: SelectSize,
  noRedWhenLevelNone?: boolean,
  testClassId?: string,
}) => {
  const createOption = (level: DriveFileAccessLevelOrRemove) =>
    !hiddenLevels?.includes(level) && <option value={level}>{(labelOverrides || {})[level] || translateAccessLevel(level)}</option>;
  return (
    <Select
      disabled={disabled}
      size={size}
      className={className + ' w-auto' + ` testid:${testClassId}`}
      theme={(!noRedWhenLevelNone && level === 'none') ? 'rose' : 'outline'}
      value={level || 'none'}
      onChange={e => onChange(e.target.value as DriveFileAccessLevel & 'remove')}
    >
      {createOption('manage')}
      {createOption('write')}
      {createOption('read')}
      {createOption('none')}
      {createOption('remove')}
    </Select>
  );
};
