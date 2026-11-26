# Upload Intent

The Upload intent stores files in Drive. It accepts two data shapes:

- From a URL: the Stack retrieves one file from an HTTP(S) URL into a folder of the user's local Drive. The browser does not download it.
- Local files: files picked in the calling app go to a folder of the user's Drive or to the root of a shared drive. Twake Space uses it to put files shared in a space's feed into the space's shared drive.

Drive picks the shape from the data: a `files` field means local files, anything else is a URL upload.

It uses the usual Cozy intent lifecycle (`ready`, then `done`, `error` or `cancel`). This page describes only the Upload-specific contract.

## Request

```ts
action = "UPLOAD";
type = "io.cozy.files";
```

## From a URL

Pass the configuration as the intent data (for example, as `options` with `IntentDialogOpener`, or in `attributes.data` for a raw intent):

```json
{
  "url": "https://documents.example/invoice.pdf",
  "folderId": "local-folder-id",
  "name": "invoice.pdf"
}
```

All three fields are required:

- `url`: absolute HTTP(S) URL. It must be retrievable by the Stack without extra credentials. Self-contained signed URLs are supported; caller cookies and headers are not forwarded.
- `folderId`: ID of a folder in the user's local Drive. The references of the Notes folder (`io.cozy.apps/notes`) and of the app folders of Downloads (`io.cozy.apps/calendar`, `io.cozy.apps/chat`, `io.cozy.apps/mail`, `io.cozy.apps/meetings`) are also supported. Shared-drive destinations are not supported.
- `name`: desired file name, not a path. It must be valid and nonempty; the intent does not infer it from the URL or response headers.

On success, the caller receives the created file's metadata through the normal `done` result:

```ts
{
  document: IOCozyFile;
}
```

The document contains the final stored name and destination. A name collision is resolved by keeping both files with an automatically adjusted name.

### Reference

Add `reference` to record where the file comes from, so that the calling app finds it again:

```json
{
  "url": "https://jmap.example/unauthenticatedDownload/a1/b1?token=t1",
  "folderId": "io.cozy.apps/mail",
  "name": "report.pdf",
  "reference": { "type": "io.cozy.mails.attachments", "id": "a1:e1:b1" }
}
```

- Drive adds it to the `referenced_by` of the stored file. The app lists the files of a reference with `GET /data/:type/:id/relationships/references` (`include=files` gives their documents, `trashed` included), with a `GET` permission on `type` only.
- `type` must be `io.cozy.mails.attachments` (an attachment of an email: `<accountId>:<emailId>:<blobId>`). Other doctypes are refused, so that an app cannot put a file in a list it does not own, such as a photo album.
- `id` has the shape of its doctype: `<accountId>:<emailId>:<blobId>`, three nonempty parts without `:` or `/`, 256 characters at most.
- The returned document carries the revision and the references of that write (`_rev`, `relationships.referenced_by`).
- A reference that fails to be added is logged: the file stays stored and the intent still succeeds.

### Limitations

- The Stack must be able to reach the URL and pass its network-safety checks. Browser CORS does not apply, but Stack DNS, connectivity, TLS and egress restrictions do. `localhost` refers to the Stack host, not the browser.
- The destination must be an accessible local folder where the user can create files. Missing ordinary folders are not created. These references resolve to their corresponding local folders, which the Stack creates when they are missing, along with the Downloads folder for the app folders.
- This shape uploads one file per call. It has no picker, progress UI or batch mode; the calling app is responsible for user feedback.
- Closing the intent does not guarantee that an upload already in progress is cancelled or rolled back. A failed or interrupted request may have an ambiguous outcome.
- Name-conflict retries can retrieve the source URL again. Short-lived or single-use signed URLs may therefore fail on retry.
- The Stack determines the file's MIME type from the supplied name. Use an appropriate extension.

### Deployment

URL Upload requires a Stack with [SourceURL creation support](https://github.com/linagora/cozy-stack/pull/4968). Verify Stack compatibility before enabling the intent: an older Stack may create an empty file instead of retrieving the source.

## Local files

The stack keeps intent data as JSON, which cannot hold a `File`. Send the data in reply to the service's `ready` message instead, through the usual intent handshake:

```ts
{ folderId: string, files: File[] } // a folder of the user's Drive
{ driveId: string, files: File[] }  // the root of a shared drive
```

- `folderId`: ID of a folder in the user's Drive, with the same rules as the URL shape's `folderId`.
- `driveId`: ID of the shared drive. The files go to its root folder.
- `files`: one or more `File` objects.
- `references` (optional): one entry per file, in the order of `files`: a reference as in the URL shape, or `null`. It needs `folderId`: the stack keeps no references on the files of a shared drive.

Pass exactly one of `folderId` and `driveId`.

On success, the caller receives the created files' metadata through the normal `done` result, in the order of `files`.

If any file fails, the intent ends with `error`. The error has the `message` and the numeric `status` (when there is one) of the first failure, plus a `results` list with one entry per file, in the order of `files`:

```ts
{ document: IOCozyFile }                   // stored
{ error: { message: string, status?: number } } // failed
```

Retry only the files whose entry has an `error`.

### Public link

Add `sharingLink: true` (or an object, as in the File Picker) to get a public link for each stored file, as the `sharingLink` action of the [File Picker](file-picker-intent.md) gives:

```ts
{ folderId: string, files: File[], sharingLink: true }
```

Each `document` is then the File Picker link entry instead of the `io.cozy.files` document, in the result and in `results`:

```ts
{
  id: string
  name: string // the stored name
  size: number
  mimeType: string | null
  sharingLink: string
  thumbnail?: { link: string }
}
```

- Drive creates the link with its own token: one `io.cozy.permissions` share by link per file, with the `GET` verb on that file only, no expiry and no password. The calling app needs no permission on `io.cozy.files`.
- It needs `folderId`: shared drives are not supported.
- A file whose link fails is a failed file in `results`, but it stays stored: retrying it stores a second copy. Drive then tries to revoke any share by link of that file, in case the Stack saved one before the call failed. This is best effort: if the revocation fails too, it is only logged, and the share may stay active.
- A file cancelled once stored, before its link is made, gets no link. A cancel that comes while the link is being made may leave a link that the caller never receives.

### Progress

Add `progress: true` to follow the upload. While a file uploads, Drive sends results through `sendResult`, which the caller gets with the `onResult` option of `start()` (cozy-interapp 0.20.0 or later):

```ts
{ index: number, loaded: number, total: number } // index in files, bytes
```

The final result still comes through `done` or `error`.

### Behavior

- A name already taken keeps both files, with an adjusted name for the new one.
- Files upload one at a time.
- A failed file does not stop the others. The files that were stored stay.
- The intent has no UI. The calling app gives the user feedback.
