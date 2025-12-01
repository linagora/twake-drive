import extraDoctypes from '@/lib/extraDoctypes'
import { Contact, Group } from '@/models'

export const DOCTYPE_FILES = 'io.cozy.files'
export const DOCTYPE_FILES_SETTINGS = 'io.cozy.files.settings'
export const DOCTYPE_DRIVE_SETTINGS = 'io.cozy.drive.settings'
export const DOCTYPE_FILES_ENCRYPTION = 'io.cozy.files.encryption'
export const DOCTYPE_FILES_SHORTCUT = 'io.cozy.files.shortcuts'
export const DOCTYPE_ALBUMS = 'io.cozy.photos.albums'
export const DOCTYPE_PHOTOS_SETTINGS = 'io.cozy.photos.settings'
export const DOCTYPE_APPS = 'io.cozy.apps'
export const DOCTYPE_CONTACTS = 'io.cozy.contacts'
export const DOCTYPE_KONNECTORS = 'io.cozy.konnectors'
export const DOCTYPE_CONTACTS_VERSION = 2

export const schema = {
  files: {
    doctype: DOCTYPE_FILES,
    relationships: {
      old_versions: {
        type: 'has-many',
        doctype: 'io.cozy.files.versions'
      },
      encryption: {
        type: 'io.cozy.files:has-many',
        doctype: DOCTYPE_FILES_ENCRYPTION
      }
    }
  },
  contacts: {
    doctype: Contact.doctype,
    doctypeVersion: DOCTYPE_CONTACTS_VERSION
  },
  groups: { doctype: Group.doctype },
  versions: { doctype: 'io.cozy.files.versions' },
  ...extraDoctypes
}
