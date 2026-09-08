import { stackExec } from './config'

/** Flags applied to every instance at provisioning time (global-setup).
 * Specs overriding flags via setFlags should spread over this map so each
 * call re-asserts a full, deterministic state. */
export const DEFAULT_FLAGS: Record<string, boolean | string | number> = {
  'cozy.hide-sharing-cozy-to-cozy': true,
  'drive.shared-drive.enabled': true,
  'drive.federated-shared-folder.enabled': true,
  'drive.federated-shared-modal.enabled': true,
  'drive.file-picker-demo.enabled': true,
  'cozy.search.enabled': true,
  'dataproxy.force-trusted-device.enabled': true,
  'drive.move-to-picker.enabled': true
}

export function setFlags(
  instance: string,
  flags: Record<string, boolean | string | number>
): void {
  stackExec('features', 'flags', '--domain', instance, JSON.stringify(flags))
}
