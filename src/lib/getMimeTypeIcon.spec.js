import {
  FileTypeFiles,
  FileTypeSheet,
  FileTypeText
} from '@linagora/twake-icons'

import getMimeTypeIcon from './getMimeTypeIcon'

describe('getMimeTypeIcon', () => {
  it.each([
    ['contact.vcf', 'text/vcard', FileTypeFiles],
    ['CONTACTS.VCF', 'text/x-vcard', FileTypeFiles],
    ['contact.vcf', 'application/octet-stream', FileTypeFiles],
    ['event.ics', 'text/calendar', FileTypeFiles],
    ['notes.txt', 'text/plain', FileTypeText],
    ['readme.md', 'text/markdown', FileTypeText],
    ['letter.rtf', 'text/rtf', FileTypeText],
    ['budget.csv', 'text/csv', FileTypeText],
    [
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      FileTypeText
    ],
    [
      'budget.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      FileTypeSheet
    ]
  ])('returns the right icon for %s (%s)', (name, mime, icon) => {
    expect(getMimeTypeIcon(false, name, mime)).toBe(icon)
  })
})
