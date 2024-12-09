/* eslint-disable @typescript-eslint/no-explicit-any */
import { Shortcuts } from 'shortcuts';

const shortcuts = new Shortcuts({
  target: document,
});

export type ShortcutType = {
  shortcut: string;
  handler?: (event: any) => any;
};

export const defaultShortcutsMap = {
  SEARCH_CHANNEL: 'CmdOrCtrl+K',
};

export const addShortcut = (shortcut: ShortcutType | ShortcutType[]) => {
  return shortcuts.add({
    ...shortcut,
    handler: (event: any) => {
      const target = event.target as HTMLElement;
      if (
        ['input', 'textarea'].includes(target.tagName.toLowerCase()) ||
        target.isContentEditable
      ) {
        return;
      } else {
        if (shortcut instanceof Array) {
          shortcut.forEach(s => {
            s.handler && s.handler(event);
          });
        } else {
          shortcut.handler && shortcut.handler(event);
        }
      }
    },
  });
};

export const removeShortcut = (shortcut: ShortcutType | ShortcutType[]) => {
  return shortcuts.remove(shortcut);
};

export default { addShortcut, removeShortcut };
