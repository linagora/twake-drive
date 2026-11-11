import { stackExec } from './config'

/** Flags applied to every instance at provisioning time (global-setup).
 * Setting flags merges them into those of the instance, so a flag a spec turns
 * on is listed here as false: spreading this map then turns it off again, also
 * on a runtime kept with E2E_PERSIST. */
export const DEFAULT_FLAGS: Record<string, boolean | string | number> = {
  'cozy.hide-sharing-cozy-to-cozy': true,
  'drive.shared-drive.enabled': true,
  'drive.federated-shared-folder.enabled': true,
  'drive.federated-shared-modal.enabled': true,
  'drive.file-picker-demo.enabled': true,
  'drive.move-intent-demo.enabled': true,
  'cozy.search.enabled': true,
  'dataproxy.force-trusted-device.enabled': true,
  'drive.move-to-picker.enabled': true,
  'drive.default-updated-at-sort.enabled': true,
  'drive.office.enabled': true,
  'drive.office.write': true,
  'cozy.assistant.enabled': false,
  'drive.new-file-viewer-ui.enabled': false,
  'drive.onlyoffice.pdf-editing.enabled': false,
  'drive.virtualization.enabled': false
}

export function setFlags(
  instance: string,
  flags: Record<string, boolean | string | number>
): void {
  stackExec('features', 'flags', '--domain', instance, JSON.stringify(flags))
}
